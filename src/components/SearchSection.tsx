import { useState } from 'react';
import { Search, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePipefy } from '@/contexts/PipefyContext';
import { searchCardsByAssignee, PipefyCard, PipefyMember } from '@/lib/pipefy-api';
import { toast } from 'sonner';
import { UserSearch } from './UserSearch';

interface SearchSectionProps {
  onCardsFound: (cards: PipefyCard[], pipeName: string) => void;
  selectedFromUser: PipefyMember | null;
  selectedToUser: PipefyMember | null;
  onFromUserChange: (member: PipefyMember | null) => void;
  onToUserChange: (member: PipefyMember | null) => void;
}

interface SearchProgress {
  currentPhase: number;
  totalPhases: number;
  phaseName: string;
  cardsFound: number;
}

export function SearchSection({
  onCardsFound,
  selectedFromUser,
  selectedToUser,
  onFromUserChange,
  onToUserChange,
}: SearchSectionProps) {
  const { token, pipes, isConnected, refreshPipes } = usePipefy();
  const [selectedPipeId, setSelectedPipeId] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchProgress, setSearchProgress] = useState<SearchProgress | null>(null);

  const handleRefreshPipes = async () => {
    setIsRefreshing(true);
    await refreshPipes();
    setIsRefreshing(false);
    toast.success('Lista de pipes atualizada!');
  };

  const handleSearch = async () => {
    if (!token || !selectedPipeId || !selectedFromUser) return;

    setIsSearching(true);
    setSearchProgress(null);
    
    try {
      const cards = await searchCardsByAssignee(
        token, 
        selectedPipeId, 
        selectedFromUser.user.email,
        (currentPhase, totalPhases, phaseName, cardsFound) => {
          setSearchProgress({ currentPhase, totalPhases, phaseName, cardsFound });
        }
      );
      const pipeName = pipes.find(p => p.id === selectedPipeId)?.name || 'Pipe';
      onCardsFound(cards, pipeName);
      
      if (cards.length === 0) {
        toast.info('Nenhum card encontrado para este responsável.');
      } else {
        toast.success(`${cards.length} card(s) encontrado(s)!`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao buscar cards');
      onCardsFound([], '');
    } finally {
      setIsSearching(false);
      setSearchProgress(null);
    }
  };

  const canSearch = isConnected && selectedPipeId && selectedFromUser && selectedToUser && 
    selectedFromUser.user.id !== selectedToUser.user.id;

  const sameUserError = selectedFromUser && selectedToUser && 
    selectedFromUser.user.id === selectedToUser.user.id
    ? 'Os responsáveis devem ser diferentes'
    : undefined;

  const progressPercentage = searchProgress 
    ? (searchProgress.currentPhase / searchProgress.totalPhases) * 100 
    : 0;

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Buscar Cards
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* From User */}
        <UserSearch
          label="Responsável Atual"
          placeholder="Digite nome ou email do responsável atual..."
          selectedUser={selectedFromUser}
          onUserSelect={onFromUserChange}
          excludeUserId={selectedToUser?.user.id}
        />

        {/* Pipe Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Pipe</Label>
          <div className="flex gap-2">
            <Select value={selectedPipeId} onValueChange={setSelectedPipeId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um pipe..." />
              </SelectTrigger>
              <SelectContent>
                {pipes.map((pipe) => (
                  <SelectItem key={pipe.id} value={pipe.id}>
                    {pipe.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefreshPipes}
              disabled={isRefreshing}
              title="Atualizar lista de pipes"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* To User */}
        <UserSearch
          label="Novo Responsável"
          placeholder="Digite nome ou email do novo responsável..."
          selectedUser={selectedToUser}
          onUserSelect={onToUserChange}
          excludeUserId={selectedFromUser?.user.id}
          error={sameUserError}
        />

        {/* Search Progress */}
        {isSearching && searchProgress && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Fase {searchProgress.currentPhase}/{searchProgress.totalPhases}
              </span>
              <span className="text-muted-foreground">
                {searchProgress.cardsFound} cards encontrados
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground truncate">
              {searchProgress.phaseName}
            </p>
          </div>
        )}

        {/* Search Button */}
        <Button
          onClick={handleSearch}
          disabled={!canSearch || isSearching}
          className="w-full btn-primary h-11"
        >
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Buscar Cards
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
