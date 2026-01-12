import { useState, useRef, useEffect, useMemo } from 'react';
import { Filter, X, ChevronDown, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { PipefyCard, PipefyCardField } from '@/lib/pipefy-api';

export interface CardFiltersState {
  clientes: string[];
  disciplinas: string[];
  fases: string[];
}

interface CardFiltersProps {
  cards: PipefyCard[];
  filters: CardFiltersState;
  onFiltersChange: (filters: CardFiltersState) => void;
}

// Helper to parse string value
function parseStringValue(value: string | null): string {
  if (!value) return '';
  
  // Try to parse as JSON array
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.join(', ');
    }
    return String(parsed);
  } catch {
    // If not JSON, return as-is but clean up common patterns
    return value
      .replace(/^\[["']?/, '')
      .replace(/["']?\]$/, '')
      .trim();
  }
}

// Parse field value - prioritizes connectedRepoItems for database fields
export function parseFieldValue(field: PipefyCardField | string | null): string {
  // If null or undefined
  if (field === null || field === undefined) {
    return '';
  }
  
  // If it's a field object with connectedRepoItems
  if (typeof field === 'object') {
    if (field.connectedRepoItems && field.connectedRepoItems.length > 0) {
      return field.connectedRepoItems.map(item => item.title).join(', ');
    }
    // Fallback to value
    return parseStringValue(field.value);
  }
  
  // If it's a string directly (backward compatibility)
  return parseStringValue(field);
}

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

function MultiSelectDropdown({ label, options, selectedValues, onChange }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => 
    options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase())),
    [options, searchTerm]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const handleSelectAll = () => {
    if (selectedValues.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedValues.filter(v => v !== value));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const allSelected = selectedValues.length === options.length && options.length > 0;
  const someSelected = selectedValues.length > 0 && selectedValues.length < options.length;

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-[200px] justify-between h-auto min-h-9 px-3 py-1.5",
          selectedValues.length === 0 && "text-muted-foreground"
        )}
      >
        <div className="flex flex-wrap gap-1 flex-1 text-left">
          {selectedValues.length === 0 ? (
            <span className="text-sm">{label}</span>
          ) : selectedValues.length <= 2 ? (
            selectedValues.map((value) => (
              <Badge key={value} variant="secondary" className="text-xs">
                {value}
                <X
                  className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={(e) => handleRemove(value, e)}
                />
              </Badge>
            ))
          ) : (
            <Badge variant="secondary" className="text-xs">
              {selectedValues.length} selecionados
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          {selectedValues.length > 0 && (
            <X
              className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={handleClearAll}
            />
          )}
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </div>
      </Button>

      {isOpen && (
        <div className="absolute z-50 w-[250px] mt-1 bg-popover border border-border rounded-md shadow-lg">
          {/* Search */}
          {options.length > 5 && (
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8"
                />
              </div>
            </div>
          )}

          {/* Select All */}
          <div className="p-2 border-b border-border">
            <div
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
              onClick={handleSelectAll}
            >
              <Checkbox
                checked={allSelected}
                className={cn(someSelected && "data-[state=unchecked]:bg-primary/50")}
              />
              <span className="font-medium text-sm">
                Selecionar todos ({options.length})
              </span>
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto p-2">
            {filteredOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum encontrado
              </p>
            ) : (
              <div className="space-y-1">
                {filteredOptions.map((option) => {
                  const isSelected = selectedValues.includes(option);
                  return (
                    <div
                      key={option}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                        isSelected ? "bg-accent" : "hover:bg-accent/50"
                      )}
                      onClick={() => handleToggle(option)}
                    >
                      <Checkbox checked={isSelected} />
                      <span className="text-sm truncate flex-1">{option}</span>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CardFilters({ cards, filters, onFiltersChange }: CardFiltersProps) {
  const { clientes, disciplinas, fases } = useMemo(() => {
    const clienteSet = new Set<string>();
    const disciplinaSet = new Set<string>();
    const faseSet = new Set<string>();

    cards.forEach((card) => {
      // Extract phase name
      const phaseName = card.current_phase?.name;
      if (phaseName) {
        faseSet.add(phaseName);
      }

      card.fields?.forEach((field) => {
        const fieldName = field.name.toLowerCase();
        
        if (fieldName === 'cliente') {
          // Prioritize connectedRepoItems for database fields
          if (field.connectedRepoItems && field.connectedRepoItems.length > 0) {
            field.connectedRepoItems.forEach(item => {
              if (item.title) clienteSet.add(item.title);
            });
          } else {
            const cleanValue = parseFieldValue(field);
            if (cleanValue) clienteSet.add(cleanValue);
          }
        } else if (fieldName === 'disciplina') {
          // Prioritize connectedRepoItems for database fields
          if (field.connectedRepoItems && field.connectedRepoItems.length > 0) {
            field.connectedRepoItems.forEach(item => {
              if (item.title) disciplinaSet.add(item.title);
            });
          } else {
            const cleanValue = parseFieldValue(field);
            if (cleanValue) disciplinaSet.add(cleanValue);
          }
        }
      });
    });

    return {
      clientes: [...clienteSet].sort(),
      disciplinas: [...disciplinaSet].sort(),
      fases: [...faseSet].sort(),
    };
  }, [cards]);

  const hasFilters = filters.clientes.length > 0 || filters.disciplinas.length > 0 || filters.fases.length > 0;
  const hasOptions = clientes.length > 0 || disciplinas.length > 0 || fases.length > 0;

  if (!hasOptions) {
    return null;
  }

  const handleClearFilters = () => {
    onFiltersChange({ clientes: [], disciplinas: [], fases: [] });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Filter className="h-4 w-4 text-muted-foreground" />

      {clientes.length > 0 && (
        <MultiSelectDropdown
          label="Cliente"
          options={clientes}
          selectedValues={filters.clientes}
          onChange={(values) => onFiltersChange({ ...filters, clientes: values })}
        />
      )}

      {fases.length > 0 && (
        <MultiSelectDropdown
          label="Fase"
          options={fases}
          selectedValues={filters.fases}
          onChange={(values) => onFiltersChange({ ...filters, fases: values })}
        />
      )}

      {disciplinas.length > 0 && (
        <MultiSelectDropdown
          label="Disciplina"
          options={disciplinas}
          selectedValues={filters.disciplinas}
          onChange={(values) => onFiltersChange({ ...filters, disciplinas: values })}
        />
      )}

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
