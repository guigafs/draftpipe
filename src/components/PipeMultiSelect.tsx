import { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { PipefyPipe } from '@/lib/pipefy-api';

interface PipeMultiSelectProps {
  pipes: PipefyPipe[];
  selectedPipeIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function PipeMultiSelect({
  pipes,
  selectedPipeIds,
  onSelectionChange,
  disabled = false,
}: PipeMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const sortedPipes = useMemo(() => 
    [...pipes].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })),
    [pipes]
  );

  const filteredPipes = useMemo(() => 
    sortedPipes.filter(pipe => 
      pipe.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [sortedPipes, searchTerm]
  );

  const allSelected = selectedPipeIds.length === pipes.length && pipes.length > 0;
  const someSelected = selectedPipeIds.length > 0 && selectedPipeIds.length < pipes.length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTogglePipe = (pipeId: string) => {
    if (selectedPipeIds.includes(pipeId)) {
      onSelectionChange(selectedPipeIds.filter(id => id !== pipeId));
    } else {
      onSelectionChange([...selectedPipeIds, pipeId]);
    }
  };

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(pipes.map(p => p.id));
    }
  };

  const handleRemovePipe = (pipeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedPipeIds.filter(id => id !== pipeId));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange([]);
  };

  const getDisplayText = () => {
    if (selectedPipeIds.length === 0) {
      return 'Selecione os pipes...';
    }
    if (allSelected) {
      return `Todos os pipes (${pipes.length})`;
    }
    return null;
  };

  const selectedPipesNames = selectedPipeIds
    .map(id => pipes.find(p => p.id === id)?.name)
    .filter(Boolean);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full justify-between h-auto min-h-10 px-3 py-2",
          selectedPipeIds.length === 0 && "text-muted-foreground"
        )}
      >
        <div className="flex flex-wrap gap-1 flex-1 text-left">
          {getDisplayText() || (
            <>
              {selectedPipesNames.slice(0, 3).map((name, idx) => (
                <Badge
                  key={selectedPipeIds[idx]}
                  variant="secondary"
                  className="text-xs"
                >
                  {name}
                  <X
                    className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={(e) => handleRemovePipe(selectedPipeIds[idx], e)}
                  />
                </Badge>
              ))}
              {selectedPipeIds.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{selectedPipeIds.length - 3}
                </Badge>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          {selectedPipeIds.length > 0 && (
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
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg">
          {/* Search Input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pipes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>

          {/* Select All Option */}
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
                🔍 Selecionar todos ({pipes.length})
              </span>
            </div>
          </div>

          {/* Pipes List */}
          <div className="max-h-64 overflow-y-auto p-2">
            {filteredPipes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum pipe encontrado
              </p>
            ) : (
              <div className="space-y-1">
                {filteredPipes.map((pipe) => {
                  const isSelected = selectedPipeIds.includes(pipe.id);
                  return (
                    <div
                      key={pipe.id}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                        isSelected ? "bg-accent" : "hover:bg-accent/50"
                      )}
                      onClick={() => handleTogglePipe(pipe.id)}
                    >
                      <Checkbox checked={isSelected} />
                      <span className="text-sm truncate flex-1">{pipe.name}</span>
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