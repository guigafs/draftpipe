import { useState } from 'react';
import { AlertTriangle, Check, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PipefyCard } from '@/lib/pipefy-api';

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromEmail: string;
  toEmail: string;
  cards: PipefyCard[];
  onConfirm: () => void;
  isLoading?: boolean;
}

export function TransferModal({
  open,
  onOpenChange,
  fromEmail,
  toEmail,
  cards,
  onConfirm,
  isLoading,
}: TransferModalProps) {
  const [showCardList, setShowCardList] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <DialogTitle className="text-xl">Confirmar Transferência</DialogTitle>
              <DialogDescription>
                Revise os detalhes antes de confirmar
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">De:</span>
              <span className="font-medium text-sm">{fromEmail}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Para:</span>
              <span className="font-medium text-sm">{toEmail}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Quantidade:</span>
              <span className="font-semibold text-primary">{cards.length} card(s)</span>
            </div>
          </div>

          {/* Expandable Card List */}
          <div className="rounded-lg border border-border">
            <button
              onClick={() => setShowCardList(!showCardList)}
              className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-lg"
            >
              <span className="text-sm font-medium">Ver cards que serão transferidos</span>
              {showCardList ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {showCardList && (
              <ScrollArea className="h-[200px] border-t border-border">
                <div className="p-3 space-y-2">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30"
                    >
                      <span className="text-sm truncate flex-1 mr-2">{card.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        #{card.id}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p className="text-sm text-warning">
              Esta ação não pode ser desfeita facilmente. Certifique-se de que os dados estão corretos.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="btn-success gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Sim, Transferir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
