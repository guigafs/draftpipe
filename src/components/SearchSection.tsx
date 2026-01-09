import { useState, useRef } from 'react';
import { Search, RefreshCw, Loader2, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { usePipefy } from '@/contexts/PipefyContext';
import { searchCardsByResponsibleField, searchCardsInAllPipes, PipefyCard, PipefyMember, PipefyPipe } from '@/lib/pipefy-api';
import { toast } from 'sonner';
import { UserSearch, NO_ASSIGNEE_MEMBER } from './UserSearch';
import { SearchConfirmModal } from './SearchConfirmModal';
import { CacheIndicator } from './CacheIndicator';
import { PipeMultiSelect } from './PipeMultiSelect';

interface SearchSectionProps {
  onCardsFound: (cards: PipefyCard[], pipeName: string, pipeIds: string[]) => void;
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
  const { token, pipes, isConnected, refreshPipes, refreshMembers, pipesCacheUpdatedAt, membersCacheUpdatedAt } = usePipefy();
  const [selectedPipeIds, setSelectedPipeIds] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingMembers, setIsRefreshingMembers] = useState(false);
  const [searchProgress, setSearchProgress] = useState<SearchProgress | null>(null);
  const [showSearchConfirm, setShowSearchConfirm] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleRefreshPipes = async () => {
    setIsRefreshing(true);
    const result = await refreshPipes();
    setIsRefreshing(false);
    
    if (result.cacheSaved) {
      toast.success('Lista de pipes atualizada e salva no cache!');
    } else if (result.ok) {
      toast.warning(`Pipes atualizados, mas não foi possível salvar no cache: ${result.cacheError || 'Erro desconhecido'}`);
    } else {
      toast.error(`Erro ao atualizar pipes: ${result.cacheError || 'Erro desconhecido'}`);
    }
  };

  const handleRefreshMembers = async () => {
    setIsRefreshingMembers(true);
    const result = await refreshMembers();
    setIsRefreshingMembers(false);
    
    if (result.cacheSaved) {
      toast.success('Lista de usuários atualizada e salva no cache!');
    } else if (result.ok) {
      toast.warning(`Usuários atualizados, mas não foi possível salvar no cache: ${result.cacheError || 'Erro desconhecido'}`);
    } else {
      toast.error(`Erro ao atualizar usuários: ${result.cacheError || 'Erro desconhecido'}`);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleSearchClick = () => {
    if (!token || selectedPipeIds.length === 0 || !selectedFromUser) return;
    setShowSearchConfirm(true);
  };

  const handleConfirmSearch = async () => {
    setShowSearchConfirm(false);
    
    if (!token || selectedPipeIds.length === 0 || !selectedFromUser) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    setSearchProgress(null);
    
    try {
      let cards: PipefyCard[];
      let resultPipeName: string;

      // Get selected pipes
      const selectedPipes = selectedPipeIds.length === pipes.length
        ? pipes
        : pipes.filter(p => selectedPipeIds.includes(p.id));

      // Check if searching for cards without responsible (empty field)
      const isSearchingNoResponsible = selectedFromUser.user.id === '__NO_ASSIGNEE__';
      // Use user ID (not email) for searching by responsible field value
      const searchUserId = isSearchingNoResponsible ? null : selectedFromUser.user.id;

      if (selectedPipes.length > 1) {
        // Search in multiple pipes by responsible field
        cards = await searchCardsInAllPipes(
          token,
          selectedPipes,
          searchUserId,
          (currentPipe, totalPipes, pipeName, currentPhase, totalPhases, phaseName, cardsFound) => {
            setSearchProgress({ currentPipe, totalPipes, pipeName, currentPhase, totalPhases, phaseName, cardsFound });
          },
          controller.signal
        );
        resultPipeName = selectedPipeIds.length === pipes.length 
          ? 'Todos os pipes' 
          : `${selectedPipes.length} pipes selecionados`;
        onCardsFound(cards, resultPipeName, selectedPipeIds);
      } else {
        // Search in single pipe by responsible field
        const selectedPipe = selectedPipes[0];
        cards = await searchCardsByResponsibleField(
          token, 
          selectedPipe.id, 
          searchUserId,
          selectedPipe?.phases, // Pass cached phases to avoid extra API request
          (currentPhase, totalPhases, phaseName, cardsFound) => {
            setSearchProgress({ currentPhase, totalPhases, phaseName, cardsFound });
          },
          controller.signal
        );
        resultPipeName = selectedPipe?.name || 'Pipe';
        onCardsFound(cards, resultPipeName, [selectedPipe.id]);
      }
      
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
      onCardsFound([], '', []);
    } finally {
      setIsSearching(false);
      setSearchProgress(null);
      abortControllerRef.current = null;
    }
  };

  const isSearchingNoResponsible = selectedFromUser?.user.id === '__NO_ASSIGNEE__';
  
  // Allow same user (useful for fixing field values)
  const canSearch = isConnected && selectedPipeIds.length > 0 && selectedFromUser && selectedToUser;

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
        {/* Refresh Buttons with Cache Indicators */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-end gap-2">
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshPipes}
              disabled={isRefreshing || !isConnected}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Atualizar Pipes
            </Button>
          </div>
          <div className="flex justify-end gap-4">
            <CacheIndicator updatedAt={membersCacheUpdatedAt} label="Usuários" />
            <CacheIndicator updatedAt={pipesCacheUpdatedAt} label="Pipes" />
          </div>
        </div>

        {/* From User */}
        <UserSearch
          label="Responsável Atual"
          placeholder="Digite nome ou email do responsável atual..."
          selectedUser={selectedFromUser}
          onUserSelect={onFromUserChange}
          allowNoAssignee
        />

        {/* Pipe Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Pipe(s)</Label>
          <PipeMultiSelect
            pipes={pipes}
            selectedPipeIds={selectedPipeIds}
            onSelectionChange={setSelectedPipeIds}
            disabled={!isConnected}
          />
        </div>

        {/* To User */}
        <UserSearch
          label="Novo Responsável"
          placeholder="Digite nome ou email do novo responsável..."
          selectedUser={selectedToUser}
          onUserSelect={onToUserChange}
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
          onClick={handleSearchClick}
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

      {/* Search Confirmation Modal */}
      <SearchConfirmModal
        open={showSearchConfirm}
        onOpenChange={setShowSearchConfirm}
        fromEmail={isSearchingNoResponsible ? 'Sem Responsável' : (selectedFromUser?.user.email || '')}
        selectedPipeIds={selectedPipeIds}
        pipes={pipes}
        onConfirm={handleConfirmSearch}
      />
    </Card>
  );
}
