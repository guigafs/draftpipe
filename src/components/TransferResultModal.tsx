import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Download, ChevronDown, ChevronUp } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TransferResultItem {
  cardId: string;
  cardTitle: string;
  previousResponsible: string[];
  currentResponsible: string[];
  expectedResponsible: string;
  status: 'confirmed' | 'alert' | 'error';
  error?: string;
  isVerifying?: boolean;
}

interface TransferResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: TransferResultItem[];
  newResponsibleName: string;
  onVerifyCard: (cardId: string) => Promise<void>;
  onClose: () => void;
}

export function TransferResultModal({
  open,
  onOpenChange,
  results,
  newResponsibleName,
  onVerifyCard,
  onClose,
}: TransferResultModalProps) {
  const [expandedSection, setExpandedSection] = useState<'confirmed' | 'alert' | 'error' | null>(null);
  const [verifyingCards, setVerifyingCards] = useState<Set<string>>(new Set());

  const confirmedItems = results.filter((r) => r.status === 'confirmed');
  const alertItems = results.filter((r) => r.status === 'alert');
  const errorItems = results.filter((r) => r.status === 'error');

  const handleVerifyCard = async (cardId: string) => {
    setVerifyingCards((prev) => new Set(prev).add(cardId));
    try {
      await onVerifyCard(cardId);
    } finally {
      setVerifyingCards((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  };

  const handleVerifyAll = async () => {
    const cardsToVerify = [...alertItems, ...errorItems];
    for (const item of cardsToVerify) {
      await handleVerifyCard(item.cardId);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Card ID', 'Título', 'Responsável Anterior', 'Responsável Atual', 'Status', 'Erro'];
    const rows = results.map((r) => [
      r.cardId,
      r.cardTitle,
      r.previousResponsible.join('; '),
      r.currentResponsible.join('; '),
      r.status === 'confirmed' ? 'Confirmado' : r.status === 'alert' ? 'Alerta' : 'Erro',
      r.error || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transfer-results-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const toggleSection = (section: 'confirmed' | 'alert' | 'error') => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const renderSection = (
    title: string,
    items: TransferResultItem[],
    sectionKey: 'confirmed' | 'alert' | 'error',
    icon: React.ReactNode,
    colorClass: string,
    bgClass: string,
    borderClass: string
  ) => {
    if (items.length === 0) return null;

    const isExpanded = expandedSection === sectionKey;

    return (
      <div className={cn('rounded-lg border', borderClass)}>
        <button
          onClick={() => toggleSection(sectionKey)}
          className={cn(
            'w-full flex items-center justify-between p-3 transition-colors rounded-lg',
            bgClass
          )}
        >
          <div className="flex items-center gap-2">
            {icon}
            <span className={cn('text-sm font-medium', colorClass)}>
              {title} ({items.length})
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className={cn('h-4 w-4', colorClass)} />
          ) : (
            <ChevronDown className={cn('h-4 w-4', colorClass)} />
          )}
        </button>

        {isExpanded && (
          <ScrollArea className={cn('max-h-[200px] border-t', borderClass.replace('border-', 'border-t-'))}>
            <div className="p-3 space-y-2">
              {items.map((item) => (
                <div
                  key={item.cardId}
                  className={cn('py-2 px-3 rounded-md', bgClass)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.cardTitle}</p>
                      <p className="text-xs text-muted-foreground">ID: {item.cardId}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">
                          Anterior: {item.previousResponsible.length > 0 ? item.previousResponsible.join(', ') : '(vazio)'}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Atual: {item.currentResponsible.length > 0 ? item.currentResponsible.join(', ') : '(vazio)'}
                        </Badge>
                      </div>
                      {item.error && (
                        <p className="text-xs text-destructive mt-1">{item.error}</p>
                      )}
                    </div>
                    {(sectionKey === 'alert' || sectionKey === 'error') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => handleVerifyCard(item.cardId)}
                        disabled={verifyingCards.has(item.cardId)}
                      >
                        <RefreshCw
                          className={cn('h-3 w-3', verifyingCards.has(item.cardId) && 'animate-spin')}
                        />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl">Validação da Transferência</DialogTitle>
          <DialogDescription>
            Verificação do campo "Responsável" após a transferência para {newResponsibleName}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-center">
                <CheckCircle className="h-5 w-5 text-success mx-auto mb-1" />
                <p className="text-xl font-semibold text-success">{confirmedItems.length}</p>
                <p className="text-xs text-muted-foreground">Confirmados</p>
              </div>
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-center">
                <AlertTriangle className="h-5 w-5 text-warning mx-auto mb-1" />
                <p className="text-xl font-semibold text-warning">{alertItems.length}</p>
                <p className="text-xs text-muted-foreground">Alertas</p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
                <p className="text-xl font-semibold text-destructive">{errorItems.length}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-2">
              {renderSection(
                'Confirmados',
                confirmedItems,
                'confirmed',
                <CheckCircle className="h-4 w-4 text-success" />,
                'text-success',
                'bg-success/5 hover:bg-success/10',
                'border-success/30'
              )}
              {renderSection(
                'Alertas (verificar)',
                alertItems,
                'alert',
                <AlertTriangle className="h-4 w-4 text-warning" />,
                'text-warning',
                'bg-warning/5 hover:bg-warning/10',
                'border-warning/30'
              )}
              {renderSection(
                'Erros',
                errorItems,
                'error',
                <XCircle className="h-4 w-4 text-destructive" />,
                'text-destructive',
                'bg-destructive/5 hover:bg-destructive/10',
                'border-destructive/30'
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            {(alertItems.length > 0 || errorItems.length > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerifyAll}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Verificar Novamente
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
          <Button onClick={onClose} className="btn-primary">
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
