import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Filter, X, Calendar, User, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

interface HistoryFiltersProps {
  performedByOptions: string[];
  onFiltersChange: (filters: HistoryFiltersState) => void;
}

export interface HistoryFiltersState {
  performedBy: string | null;
  status: 'all' | 'success' | 'partial' | 'failed';
  dateFrom: Date | null;
  dateTo: Date | null;
  search: string;
}

export function HistoryFilters({ performedByOptions, onFiltersChange }: HistoryFiltersProps) {
  const [filters, setFilters] = useState<HistoryFiltersState>({
    performedBy: null,
    status: 'all',
    dateFrom: null,
    dateTo: null,
    search: '',
  });

  const updateFilters = (newFilters: Partial<HistoryFiltersState>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    onFiltersChange(updated);
  };

  const clearFilters = () => {
    const cleared: HistoryFiltersState = {
      performedBy: null,
      status: 'all',
      dateFrom: null,
      dateTo: null,
      search: '',
    };
    setFilters(cleared);
    onFiltersChange(cleared);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.performedBy) count++;
    if (filters.status !== 'all') count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.search) count++;
    return count;
  }, [filters]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <Input
          placeholder="Buscar por email..."
          value={filters.search}
          onChange={(e) => updateFilters({ search: e.target.value })}
          className="w-48"
        />

        {/* Performed By Filter */}
        <Select
          value={filters.performedBy || 'all'}
          onValueChange={(value) => updateFilters({ performedBy: value === 'all' ? null : value })}
        >
          <SelectTrigger className="w-48">
            <User className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Realizado por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os usuários</SelectItem>
            {performedByOptions.map((email) => (
              <SelectItem key={email} value={email}>
                {email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={filters.status}
          onValueChange={(value: HistoryFiltersState['status']) => updateFilters({ status: value })}
        >
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="success">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-success" />
                Sucesso Total
              </span>
            </SelectItem>
            <SelectItem value="partial">
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-warning" />
                Sucesso Parcial
              </span>
            </SelectItem>
            <SelectItem value="failed">
              <span className="flex items-center gap-1">
                <X className="h-3 w-3 text-destructive" />
                Falha
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Date From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-36 justify-start gap-2">
              <Calendar className="h-4 w-4" />
              {filters.dateFrom 
                ? format(filters.dateFrom, 'dd/MM/yyyy', { locale: ptBR })
                : 'Data início'
              }
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={filters.dateFrom || undefined}
              onSelect={(date) => updateFilters({ dateFrom: date || null })}
              locale={ptBR}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Date To */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-36 justify-start gap-2">
              <Calendar className="h-4 w-4" />
              {filters.dateTo 
                ? format(filters.dateTo, 'dd/MM/yyyy', { locale: ptBR })
                : 'Data fim'
              }
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={filters.dateTo || undefined}
              onSelect={(date) => updateFilters({ dateTo: date || null })}
              locale={ptBR}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Clear Filters */}
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Limpar ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Active Filters Badges */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.performedBy && (
            <Badge variant="secondary" className="gap-1">
              <User className="h-3 w-3" />
              {filters.performedBy}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => updateFilters({ performedBy: null })}
              />
            </Badge>
          )}
          {filters.status !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {filters.status === 'success' && 'Sucesso'}
              {filters.status === 'partial' && 'Parcial'}
              {filters.status === 'failed' && 'Falha'}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => updateFilters({ status: 'all' })}
              />
            </Badge>
          )}
          {filters.dateFrom && (
            <Badge variant="secondary" className="gap-1">
              De: {format(filters.dateFrom, 'dd/MM/yyyy', { locale: ptBR })}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => updateFilters({ dateFrom: null })}
              />
            </Badge>
          )}
          {filters.dateTo && (
            <Badge variant="secondary" className="gap-1">
              Até: {format(filters.dateTo, 'dd/MM/yyyy', { locale: ptBR })}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => updateFilters({ dateTo: null })}
              />
            </Badge>
          )}
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Busca: {filters.search}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => updateFilters({ search: '' })}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
