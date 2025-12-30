import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Automation } from '@/types/automation';
import { Clock, Zap, Loader2 } from 'lucide-react';

interface ExecuteAutomationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  automation: Automation | null;
  isExecuting: boolean;
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  }
  return `${minutes}min ${remainingSeconds}s`;
}

export function ExecuteAutomationModal({
  open,
  onClose,
  onConfirm,
  automation,
  isExecuting,
}: ExecuteAutomationModalProps) {
  if (!automation) return null;

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && !isExecuting && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Executar Automação</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Você está prestes a executar a automação{' '}
                <strong className="text-foreground">{automation.name}</strong>.
              </p>

              {automation.description && (
                <p className="text-sm">{automation.description}</p>
              )}

              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-warning" />
                  <span>
                    Consumirá aproximadamente{' '}
                    <strong className="text-foreground">
                      {automation.estimated_requests} requisição
                      {automation.estimated_requests !== 1 ? 'ões' : ''}
                    </strong>
                  </span>
                </div>

                {automation.average_execution_time > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>
                      Tempo médio de execução:{' '}
                      <strong className="text-foreground">
                        {formatTime(automation.average_execution_time)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              <p className="text-sm">Deseja continuar?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isExecuting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isExecuting}
            className="bg-primary"
          >
            {isExecuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Execução
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
