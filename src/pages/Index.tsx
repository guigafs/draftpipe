import { useState, useCallback } from 'react';
import { ArrowRightLeft, History as HistoryIcon } from 'lucide-react';
import { Header } from '@/components/Header';
import { ConfigScreen } from '@/components/ConfigScreen';
import { SearchSection } from '@/components/SearchSection';
import { CardsList } from '@/components/CardsList';
import { TransferModal } from '@/components/TransferModal';
import { ProgressModal } from '@/components/ProgressModal';
import { HistorySection } from '@/components/HistorySection';
import { HelpModal } from '@/components/HelpModal';
import { SettingsModal } from '@/components/SettingsModal';
import { usePipefy } from '@/contexts/PipefyContext';
import { PipefyCard, searchUserByEmail, transferCards } from '@/lib/pipefy-api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';

interface ProgressItem {
  cardId: string;
  cardTitle: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

export default function Index() {
  const { isConnected, isLoading, token, addHistoryRecord } = usePipefy();

  // UI State
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);

  // Data State
  const [cards, setCards] = useState<PipefyCard[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fromEmail, setFromEmail] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [pipeName, setPipeName] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // Progress State
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [progressCount, setProgressCount] = useState(0);
  const [isTransferComplete, setIsTransferComplete] = useState(false);

  const handleCardsFound = useCallback((foundCards: PipefyCard[], email: string, pipe: string) => {
    setCards(foundCards);
    setFromEmail(email);
    setPipeName(pipe);
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

    if (!toEmail) {
      toast({
        variant: 'destructive',
        title: 'Email não informado',
        description: 'Informe o email do novo responsável.',
      });
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmTransfer = async () => {
    if (!token) return;

    setConfirmOpen(false);
    setProgressOpen(true);
    setIsTransferComplete(false);
    setProgressCount(0);

    // Initialize progress items
    const initialItems: ProgressItem[] = selectedCards.map((card) => ({
      cardId: card.id,
      cardTitle: card.title,
      status: 'pending',
    }));
    setProgressItems(initialItems);

    // Find new user ID
    const newUser = await searchUserByEmail(token, toEmail);

    if (!newUser) {
      toast({
        variant: 'destructive',
        title: 'Usuário não encontrado',
        description: `Não foi possível encontrar o usuário ${toEmail} no Pipefy.`,
      });
      setProgressOpen(false);
      return;
    }

    // Execute transfer
    const cardIds = selectedCards.map((c) => c.id);

    const result = await transferCards(
      token,
      cardIds,
      newUser.id,
      (completed, total, cardId, success, error) => {
        setProgressCount(completed);
        setProgressItems((prev) =>
          prev.map((item) =>
            item.cardId === cardId
              ? { ...item, status: success ? 'success' : 'error', error }
              : item
          )
        );
      }
    );

    setIsTransferComplete(true);

    // Add to history
    addHistoryRecord({
      fromEmail,
      toEmail,
      cardIds: selectedCards.map((c) => c.id),
      cardTitles: selectedCards.map((c) => c.title),
      succeeded: result.succeeded,
      failed: result.failed,
      pipeName,
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

  // Show loading or config screen
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

  if (!isConnected) {
    return <ConfigScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onSettingsClick={() => setSettingsOpen(true)} onHelpClick={() => setHelpOpen(true)} />

      <main className="container px-4 py-6 md:px-6 md:py-8 space-y-6">
        {/* Search Section */}
        <SearchSection
          onCardsFound={handleCardsFound}
          newAssigneeEmail={toEmail}
          onNewAssigneeChange={setToEmail}
        />

        {/* Main Content */}
        <Tabs defaultValue="cards" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="cards" className="gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Cards
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <HistoryIcon className="h-4 w-4" />
                Histórico
              </TabsTrigger>
            </TabsList>

            {selectedIds.size > 0 && (
              <Button onClick={handleTransferClick} className="btn-success gap-2 animate-scale-in">
                <ArrowRightLeft className="h-4 w-4" />
                Transferir {selectedIds.size} Card(s)
              </Button>
            )}
          </div>

          <TabsContent value="cards" className="mt-4">
            <CardsList
              cards={cards}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              isLoading={searchLoading}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <HistorySection />
          </TabsContent>
        </Tabs>
      </main>

      {/* Modals */}
      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      
      <TransferModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        fromEmail={fromEmail}
        toEmail={toEmail}
        cards={selectedCards}
        onConfirm={handleConfirmTransfer}
      />

      <ProgressModal
        open={progressOpen}
        onOpenChange={setProgressOpen}
        cards={selectedCards}
        progress={progressCount}
        total={selectedCards.length}
        items={progressItems}
        isComplete={isTransferComplete}
        onClose={handleProgressClose}
      />
    </div>
  );
}
