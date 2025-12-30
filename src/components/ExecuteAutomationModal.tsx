import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Automation } from '@/types/automation';
import { Clock, Zap, Loader2, CheckCircle, XCircle, Timer } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export interface ExecutionResult {
  success: boolean;
  executionTime: number;
  responseStatus?: number;
  errorMessage?: string;
}

interface ExecuteAutomationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<ExecutionResult>;
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

function formatExecutionTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

type ModalPhase = 'confirm' | 'executing' | 'result';

export function ExecuteAutomationModal({
  open,
  onClose,
  onConfirm,
  automation,
  isExecuting,
}: ExecuteAutomationModalProps) {
  const [phase, setPhase] = useState<ModalPhase>('confirm');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [progress, setProgress] = useState(0);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setElapsedTime(0);
      setResult(null);
      setProgress(0);
    }
  }, [open]);

  // Timer during execution
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (phase === 'executing') {
      const startTime = Date.now();
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setElapsedTime(elapsed);
        
        // Animate progress based on estimated time
        if (automation?.average_execution_time) {
          const estimatedMs = automation.average_execution_time * 1000;
          const progressValue = Math.min((elapsed / estimatedMs) * 90, 90); // Max 90% until complete
          setProgress(progressValue);
        } else {
          // Slow progress animation if no estimate
          setProgress((prev) => Math.min(prev + 0.5, 90));
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [phase, automation?.average_execution_time]);

  const handleConfirm = async () => {
    setPhase('executing');
    try {
      const executionResult = await onConfirm();
      setResult(executionResult);
      setProgress(100);
      setPhase('result');
    } catch (error: any) {
      setResult({
        success: false,
        executionTime: elapsedTime,
        errorMessage: error.message || 'Erro desconhecido',
      });
      setProgress(100);
      setPhase('result');
    }
  };

  const handleClose = () => {
    if (phase !== 'executing') {
      onClose();
    }
  };

  if (!automation) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {phase === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Executar Automação
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-4 pt-2">
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
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm}>
                Confirmar Execução
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'executing' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                Executando Automação
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="text-center space-y-2">
                <p className="text-lg font-medium">{automation.name}</p>
                <p className="text-sm text-muted-foreground">
                  Aguarde enquanto a automação é executada...
                </p>
              </div>

              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Processando...</span>
                  <span className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {formatExecutionTime(elapsedTime)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span>Aguardando resposta do webhook</span>
              </div>
            </div>
          </>
        )}

        {phase === 'result' && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {result.success ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-success" />
                    Execução Concluída
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    Falha na Execução
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className={`rounded-lg border p-4 ${
                result.success 
                  ? 'bg-success/10 border-success/30' 
                  : 'bg-destructive/10 border-destructive/30'
              }`}>
                <div className="flex items-center justify-center gap-3">
                  {result.success ? (
                    <CheckCircle className="h-12 w-12 text-success" />
                  ) : (
                    <XCircle className="h-12 w-12 text-destructive" />
                  )}
                  <div>
                    <p className="text-lg font-semibold">
                      {result.success ? 'Sucesso!' : 'Erro!'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {automation.name}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Tempo de Execução</p>
                  <p className="text-lg font-semibold flex items-center justify-center gap-1">
                    <Timer className="h-4 w-4 text-primary" />
                    {formatExecutionTime(result.executionTime)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <p className={`text-lg font-semibold ${
                    result.success ? 'text-success' : 'text-destructive'
                  }`}>
                    {result.responseStatus ? `HTTP ${result.responseStatus}` : (result.success ? 'OK' : 'Erro')}
                  </p>
                </div>
              </div>

              {result.errorMessage && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Mensagem de erro:</p>
                  <p className="text-sm text-destructive">{result.errorMessage}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
