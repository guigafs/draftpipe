import { useState, useMemo } from 'react';
import { Search, CheckSquare, Square, RotateCcw, X, User, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { PipefyCard } from '@/lib/pipefy-api';
import { cn } from '@/lib/utils';

interface CardsListProps {
  cards: PipefyCard[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  isLoading?: boolean;
}

export function CardsList({ cards, selectedIds, onSelectionChange, isLoading }: CardsListProps) {
  const [searchFilter, setSearchFilter] = useState('');

  const filteredCards = useMemo(() => {
    if (!searchFilter.trim()) return cards;
    
    const term = searchFilter.toLowerCase();
    return cards.filter(
      (card) =>
        card.title.toLowerCase().includes(term) ||
        card.id.includes(term)
    );
  }, [cards, searchFilter]);

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCards.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(filteredCards.map((c) => c.id)));
    }
  };

  const handleInvertSelection = () => {
    const newSelection = new Set<string>();
    filteredCards.forEach((card) => {
      if (!selectedIds.has(card.id)) {
        newSelection.add(card.id);
      }
    });
    onSelectionChange(newSelection);
  };

  const handleClearSelection = () => {
    onSelectionChange(new Set());
  };

  const handleToggleCard = (cardId: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(cardId)) {
      newSelection.delete(cardId);
    } else {
      newSelection.add(cardId);
    }
    onSelectionChange(newSelection);
  };

  const allSelected = filteredCards.length > 0 && selectedIds.size === filteredCards.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredCards.length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-5 w-5 bg-muted rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <Card className="shadow-soft">
        <CardContent className="py-16 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">Nenhum card encontrado</h3>
          <p className="text-muted-foreground">
            Faça uma busca para encontrar os cards do responsável
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="shadow-soft">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por nome ou ID..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-9 input-field"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="gap-1.5"
              >
                {allSelected ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {allSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleInvertSelection}
                className="gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                Inverter
              </Button>

              {selectedIds.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelection}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                  Limpar
                </Button>
              )}

              <Badge variant="secondary" className="ml-2 font-medium">
                {selectedIds.size} de {filteredCards.length} selecionado(s)
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards List */}
      <div className="space-y-2">
        {filteredCards.map((card, index) => (
          <Card
            key={card.id}
            className={cn(
              'cursor-pointer transition-all duration-200 hover:shadow-md card-hover',
              selectedIds.has(card.id) && 'card-selected',
              'animate-fade-in'
            )}
            style={{ animationDelay: `${index * 30}ms` }}
            onClick={() => handleToggleCard(card.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Checkbox
                  checked={selectedIds.has(card.id)}
                  onCheckedChange={() => handleToggleCard(card.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">{card.title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        ID: {card.id}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {card.pipeName && (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <FolderKanban className="h-3 w-3" />
                          {card.pipeName}
                        </Badge>
                      )}
                      <Badge variant="outline" className="status-info">
                        {card.current_phase?.name || 'Sem fase'}
                      </Badge>
                    </div>
                  </div>

                  {card.assignees && card.assignees.length > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex flex-wrap gap-1">
                        {card.assignees.map((assignee) => (
                          <Badge
                            key={assignee.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            {assignee.name || assignee.email}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCards.length === 0 && cards.length > 0 && (
        <Card className="shadow-soft">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Nenhum card corresponde ao filtro "{searchFilter}"
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
