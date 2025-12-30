import { useState, useRef } from 'react';
import { Search, RefreshCw, Loader2, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePipefy } from '@/contexts/PipefyContext';
import { searchCardsByAssignee, searchCardsInAllPipes, PipefyCard, PipefyMember } from '@/lib/pipefy-api';
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
  currentPipe?: number;
  totalPipes?: number;
  pipeName?: string;
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
  const { token, pipes, isConnected, refreshPipes, refreshMembers } = usePipefy();
  const [selectedPipeId, setSelectedPipeId] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingMembers, setIsRefreshingMembers] = useState(false);
  const [searchProgress, setSearchProgress] = useState<SearchProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleRefreshPipes = async () => {
    setIsRefreshing(true);
    await refreshPipes();
    setIsRefreshing(false);
    toast.success('Lista de pipes atualizada!');
  };

  const handleRefreshMembers = async () => {
    setIsRefreshingMembers(true);
    await refreshMembers();
    setIsRefreshingMembers(false);
    toast.success('Lista de usuários atualizada!');
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleSearch = async () => {
    if (!token || !selectedPipeId || !selectedFromUser) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    setSearchProgress(null);
    
    try {
      let cards: PipefyCard[];
      let resultPipeName: string;

      if (selectedPipeId === 'all') {
        // Search in all pipes
        cards = await searchCardsInAllPipes(
          token,
          pipes,
          selectedFromUser.user.email,
          (currentPipe, totalPipes, pipeName, currentPhase, totalPhases, phaseName, cardsFound) => {
            setSearchProgress({ currentPipe, totalPipes, pipeName, currentPhase, totalPhases, phaseName, cardsFound });
          },
          controller.signal
        );
        resultPipeName = 'Todos os pipes';
      } else {
        // Search in single pipe
        cards = await searchCardsByAssignee(
          token, 
          selectedPipeId, 
          selectedFromUser.user.email,
          (currentPhase, totalPhases, phaseName, cardsFound) => {
            setSearchProgress({ currentPhase, totalPhases, phaseName, cardsFound });
          },
          controller.signal
        );
        resultPipeName = pipes.find(p => p.id === selectedPipeId)?.name || 'Pipe';
      }

      onCardsFound(cards, resultPipeName);
      
      if (cards.length === 0) {
        toast.info('Nenhum card encontrado para este responsável.');
      } else {
        toast.success(`${cards.length} card(s) encontrado(s)!`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.info('Busca cancelada');
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Erro ao buscar cards');
      onCardsFound([], '');
    } finally {
      setIsSearching(false);
      setSearchProgress(null);
      abortControllerRef.current = null;
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
        {/* Refresh Members Button */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshMembers}
            disabled={isRefreshingMembers || !isConnected}
          >
            {isRefreshingMembers ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Users className="h-4 w-4 mr-2" />
            )}
            Atualizar Usuários
          </Button>
        </div>

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
                <SelectItem value="all">
                  🔍 Todos os pipes
                </SelectItem>
                <Separator className="my-1" />
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
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {searchProgress.currentPipe && searchProgress.totalPipes && (
                  <span className="font-medium">Pipe {searchProgress.currentPipe}/{searchProgress.totalPipes} • </span>
                )}
                Fase {searchProgress.currentPhase}/{searchProgress.totalPhases}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {searchProgress.cardsFound} cards
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="text-xs text-muted-foreground truncate space-y-0.5">
              {searchProgress.pipeName && (
                <p className="font-medium">{searchProgress.pipeName}</p>
              )}
              <p>{searchProgress.phaseName}</p>
            </div>
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
