import { useState, useCallback } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { MainLayout } from '@/layouts/MainLayout';
import { ConfigScreen } from '@/components/ConfigScreen';
import { SearchSection } from '@/components/SearchSection';
import { CardsList } from '@/components/CardsList';
import { TransferModal } from '@/components/TransferModal';
import { ProgressModal } from '@/components/ProgressModal';
import { HelpModal } from '@/components/HelpModal';
import { SettingsModal } from '@/components/SettingsModal';
import { usePipefy } from '@/contexts/PipefyContext';
import { PipefyCard, PipefyMember, transferCards, InviteOptions } from '@/lib/pipefy-api';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface ProgressItem {
  cardId: string;
  cardTitle: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

export default function Responsaveis() {
  const { isConnected, isLoading, token, addHistoryRecord } = usePipefy();

  // UI State
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);

  // Data State
  const [cards, setCards] = useState<PipefyCard[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedFromUser, setSelectedFromUser] = useState<PipefyMember | null>(null);
  const [selectedToUser, setSelectedToUser] = useState<PipefyMember | null>(null);
  const [pipeName, setPipeName] = useState('');
  const [pipeIds, setPipeIds] = useState<string[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Progress State
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [completedBatches, setCompletedBatches] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [isTransferComplete, setIsTransferComplete] = useState(false);

  const handleCardsFound = useCallback((foundCards: PipefyCard[], pipe: string, ids: string[]) => {
    setCards(foundCards);
    setPipeName(pipe);
    setPipeIds(ids);
    setSelectedIds(new Set());
  }, []);

  const selectedCards = cards.filter((c) => selectedIds.has(c.id));

  const handleTransferClick = () => {
    if (selectedCards.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum card selecionado',
        description: 'Selecione pelo menos um card para transferir.',
      });
      return;
    }

    if (!selectedToUser) {
      toast({
        variant: 'destructive',
        title: 'Usuário não informado',
        description: 'Selecione o novo responsável.',
      });
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmTransfer = async () => {
    if (!token || !selectedToUser) return;

    setConfirmOpen(false);
    setProgressOpen(true);
    setIsTransferComplete(false);
    setCompletedBatches(0);
    setSuccessCount(0);
    setErrorCount(0);

    // Calculate total batches (50 cards per batch)
    const batchSize = 50;
    const batches = Math.ceil(selectedCards.length / batchSize);
    setTotalBatches(batches);

    // Initialize progress items
    const initialItems: ProgressItem[] = selectedCards.map((card) => ({
      cardId: card.id,
      cardTitle: card.title,
      status: 'pending',
    }));
    setProgressItems(initialItems);

    // Execute transfer with batching
    const cardIds = selectedCards.map((c) => c.id);

    // Prepare invite options to add user to pipe automatically if not a member
    // Use the first pipeId for invitation (user will be added to that pipe)
    const firstPipeId = pipeIds.length > 0 ? pipeIds[0] : undefined;
    const inviteOptions: InviteOptions | undefined = firstPipeId && selectedToUser.user.email ? {
      pipeId: firstPipeId,
      email: selectedToUser.user.email,
      roleName: 'member'
    } : undefined;

    // If searching for "No Assignee", pass empty string so we don't try to remove anyone
    const sourceUserId = selectedFromUser?.user.id === '__NO_ASSIGNEE__' 
      ? '' 
      : (selectedFromUser?.user.id || '');

    const result = await transferCards(
      token,
      cardIds,
      sourceUserId,
      selectedToUser.user.id,
      selectedToUser.user.name,
      selectedCards,
      batchSize,
      (completed, total, batchResults) => {
        setCompletedBatches(completed);
        
        // Update items based on batch results
        setProgressItems((prev) => {
          const updated = [...prev];
          for (const cardId of batchResults.succeeded) {
            const idx = updated.findIndex(item => item.cardId === cardId);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], status: 'success' };
            }
          }
          for (const { cardId, error } of batchResults.failed) {
            const idx = updated.findIndex(item => item.cardId === cardId);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], status: 'error', error };
            }
          }
          return updated;
        });
        
        // Update counts
        setSuccessCount(prev => prev + batchResults.succeeded.length);
        setErrorCount(prev => prev + batchResults.failed.length);
      },
      inviteOptions
    );

    setIsTransferComplete(true);

    // Show toast if user was added to pipe
    if (result.userInvited) {
      toast({
        title: 'Usuário adicionado ao pipe',
        description: `${selectedToUser.user.name} foi adicionado automaticamente ao pipe.`,
      });
    }
    addHistoryRecord({
      fromEmail: selectedFromUser?.user.email || '',
      toEmail: selectedToUser.user.email,
      cardIds: selectedCards.map((c) => c.id),
      cardTitles: selectedCards.map((c) => c.title),
      succeeded: result.succeeded,
      failed: result.failed,
      pipeName,
      pipeId: pipeIds.join(','),
      performedByEmail: '', // Will be filled by context with auth user email
    });

    // Show toast
    if (result.failed.length === 0) {
      toast({
        title: 'Transferência concluída! 🎉',
        description: `${result.succeeded.length} card(s) transferido(s) com sucesso.`,
      });
    } else if (result.succeeded.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Transferência parcial',
        description: `${result.succeeded.length} sucesso(s), ${result.failed.length} erro(s).`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Falha na transferência',
        description: 'Nenhum card foi transferido. Verifique os erros.',
      });
    }
  };

  const handleProgressClose = () => {
    setProgressOpen(false);
    // Remove transferred cards from list
    const succeededIds = new Set(progressItems.filter((i) => i.status === 'success').map((i) => i.cardId));
    setCards((prev) => prev.filter((c) => !succeededIds.has(c.id)));
    setSelectedIds(new Set());
  };

  // Show loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/20" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Show config screen if not connected
  if (!isConnected) {
    return <ConfigScreen />;
  }

  return (
    <MainLayout 
      onSettingsClick={() => setSettingsOpen(true)} 
      onHelpClick={() => setHelpOpen(true)}
    >
      <div className="container px-4 py-6 md:px-6 md:py-8 space-y-6">
        {/* Search Section */}
        <SearchSection
          onCardsFound={handleCardsFound}
          selectedFromUser={selectedFromUser}
          selectedToUser={selectedToUser}
          onFromUserChange={setSelectedFromUser}
          onToUserChange={setSelectedToUser}
        />

        {/* Main Content */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Cards para Transferir
            </h2>

            {selectedIds.size > 0 && (
              <Button onClick={handleTransferClick} className="btn-success gap-2 animate-scale-in">
                <ArrowRightLeft className="h-4 w-4" />
                Transferir {selectedIds.size} Card(s)
              </Button>
            )}
          </div>

          <CardsList
            cards={cards}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            isLoading={searchLoading}
          />
        </div>
      </div>

      {/* Modals */}
      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      
      <TransferModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        fromEmail={selectedFromUser?.user.email || ''}
        toEmail={selectedToUser?.user.email || ''}
        cards={selectedCards}
        onConfirm={handleConfirmTransfer}
      />

      <ProgressModal
        open={progressOpen}
        onOpenChange={setProgressOpen}
        cards={selectedCards}
        completedBatches={completedBatches}
        totalBatches={totalBatches}
        successCount={successCount}
        errorCount={errorCount}
        items={progressItems}
        isComplete={isTransferComplete}
        onClose={handleProgressClose}
      />
    </MainLayout>
  );
}
