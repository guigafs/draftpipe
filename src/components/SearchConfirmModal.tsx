import { Info, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PipefyPipe } from '@/lib/pipefy-api';

interface SearchConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromEmail: string;
  selectedPipeIds: string[];
  pipes: PipefyPipe[];
  onConfirm: () => void;
}

export function SearchConfirmModal({
  open,
  onOpenChange,
  fromEmail,
  selectedPipeIds,
  pipes,
  onConfirm,
}: SearchConfirmModalProps) {
  const isAllPipes = selectedPipeIds.length === pipes.length;
  const selectedPipes = pipes.filter(p => selectedPipeIds.includes(p.id));
  
  // Calculate requests based on cached phases (no extra request needed for phases)
  const calculateEstimatedRequests = () => {
    if (selectedPipes.length === 0) {
      return '0 requisições';
    }
    
    // Sum all active phases from selected pipes
    const totalActivePhases = selectedPipes.reduce((sum, pipe) => {
      const activePhases = pipe.phases?.filter(p => !p.done).length || 0;
      return sum + activePhases;
    }, 0);
    
    if (isAllPipes) {
      return `~${totalActivePhases} requisições (${pipes.length} pipes, fases em cache)`;
    } else if (selectedPipes.length === 1) {
      return `~${totalActivePhases} requisições (fases em cache)`;
    } else {
      return `~${totalActivePhases} requisições (${selectedPipes.length} pipes, fases em cache)`;
    }
  };
  
  const estimatedRequests = calculateEstimatedRequests();
  
  const getPipeDisplayText = () => {
    if (isAllPipes) {
      return `Todos os pipes (${pipes.length})`;
    }
    if (selectedPipes.length === 1) {
      return selectedPipes[0].name;
    }
    return `${selectedPipes.length} pipes selecionados`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Confirmar Busca</DialogTitle>
              <DialogDescription>
                Revise os detalhes antes de iniciar
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Responsável:</span>
              <span className="font-medium text-sm">{fromEmail}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pipe(s):</span>
              <span className="font-medium text-sm">
                {getPipeDisplayText()}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Requisições estimadas:</span>
              <span className="font-semibold text-sm text-primary">{estimatedRequests}</span>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20">
            <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p className="text-sm text-warning">
              A busca pode demorar dependendo da quantidade de fases e cards no(s) pipe(s) selecionado(s).
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            className="btn-primary gap-2"
          >
            <Search className="h-4 w-4" />
            Confirmar Busca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
