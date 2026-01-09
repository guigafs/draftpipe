import { useMemo } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PipefyCard } from '@/lib/pipefy-api';

export interface CardFiltersState {
  cliente: string | null;
  disciplina: string | null;
}

interface CardFiltersProps {
  cards: PipefyCard[];
  filters: CardFiltersState;
  onFiltersChange: (filters: CardFiltersState) => void;
}

export function CardFilters({ cards, filters, onFiltersChange }: CardFiltersProps) {
  const { clientes, disciplinas } = useMemo(() => {
    const clienteSet = new Set<string>();
    const disciplinaSet = new Set<string>();

    cards.forEach((card) => {
      card.fields?.forEach((field) => {
        const fieldName = field.name.toLowerCase();
        if (fieldName === 'cliente' && field.value) {
          clienteSet.add(field.value);
        } else if (fieldName === 'disciplina' && field.value) {
          disciplinaSet.add(field.value);
        }
      });
    });

    return {
      clientes: [...clienteSet].sort(),
      disciplinas: [...disciplinaSet].sort(),
    };
  }, [cards]);

  const hasFilters = filters.cliente || filters.disciplina;
  const hasOptions = clientes.length > 0 || disciplinas.length > 0;

  if (!hasOptions) {
    return null;
  }

  const handleClearFilters = () => {
    onFiltersChange({ cliente: null, disciplina: null });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Filter className="h-4 w-4 text-muted-foreground" />

      {clientes.length > 0 && (
        <Select
          value={filters.cliente || ''}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, cliente: value || null })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            {clientes.map((cliente) => (
              <SelectItem key={cliente} value={cliente}>
                {cliente}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {disciplinas.length > 0 && (
        <Select
          value={filters.disciplina || ''}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, disciplina: value || null })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Disciplina" />
          </SelectTrigger>
          <SelectContent>
            {disciplinas.map((disciplina) => (
              <SelectItem key={disciplina} value={disciplina}>
                {disciplina}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
