import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PipefyCard } from '@/lib/pipefy-api';

interface ProgressItem {
  cardId: string;
  cardTitle: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

interface ProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: PipefyCard[];
  completedBatches: number;
  totalBatches: number;
  successCount: number;
  errorCount: number;
  items: ProgressItem[];
  isComplete: boolean;
  onClose: () => void;
}

export function ProgressModal({
  open,
  onOpenChange,
  cards,
  completedBatches,
  totalBatches,
  successCount,
  errorCount,
  items,
  isComplete,
  onClose,
}: ProgressModalProps) {
  const [showErrors, setShowErrors] = useState(false);

  const errorItems = items.filter((i) => i.status === 'error');
  const percentage = totalBatches > 0 ? Math.round((completedBatches / totalBatches) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isComplete ? 'Transferência Concluída' : 'Transferindo Cards...'}
          </DialogTitle>
          <DialogDescription>
            {isComplete
              ? 'A operação foi finalizada'
              : `Processando lote ${completedBatches} de ${totalBatches} (${cards.length} cards)`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>

          {/* Status Summary */}
          {isComplete && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
                <CheckCircle className="h-6 w-6 text-success mx-auto mb-2" />
                <p className="text-2xl font-semibold text-success">{successCount}</p>
                <p className="text-sm text-muted-foreground">Sucesso</p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
                <XCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
                <p className="text-2xl font-semibold text-destructive">{errorCount}</p>
                <p className="text-sm text-muted-foreground">Erros</p>
              </div>
            </div>
          )}

          {/* Live Progress List */}
          {!isComplete && (
            <ScrollArea className="h-[200px] rounded-lg border border-border">
              <div className="p-3 space-y-2">
                {items.map((item) => (
                  <div
                    key={item.cardId}
                    className="flex items-center gap-3 py-2 px-3 rounded-md bg-muted/30"
                  >
                    {item.status === 'pending' && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {item.status === 'success' && (
                      <CheckCircle className="h-4 w-4 text-success" />
                    )}
                    {item.status === 'error' && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-sm truncate flex-1">{item.cardTitle}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Error Details */}
          {isComplete && errorCount > 0 && (
            <div className="rounded-lg border border-destructive/30">
              <button
                onClick={() => setShowErrors(!showErrors)}
                className="w-full flex items-center justify-between p-3 hover:bg-destructive/5 transition-colors rounded-lg"
              >
                <span className="text-sm font-medium text-destructive">
                  Ver detalhes dos erros ({errorCount})
                </span>
                {showErrors ? (
                  <ChevronUp className="h-4 w-4 text-destructive" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-destructive" />
                )}
              </button>

              {showErrors && (
                <ScrollArea className="h-[150px] border-t border-destructive/20">
                  <div className="p-3 space-y-2">
                    {errorItems.map((item) => (
                      <div
                        key={item.cardId}
                        className="py-2 px-3 rounded-md bg-destructive/5"
                      >
                        <p className="text-sm font-medium truncate">{item.cardTitle}</p>
                        <p className="text-xs text-destructive mt-1">{item.error}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {isComplete ? (
            <Button onClick={onClose} className="btn-primary">
              Concluir
            </Button>
          ) : (
            <Button disabled variant="outline" className="gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processando...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
