import { useState, useMemo } from 'react';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  XCircle,
  Trash2,
  Download,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { usePipefy } from '@/contexts/PipefyContext';
import { HistoryFilters, HistoryFiltersState } from './HistoryFilters';

export function TransferHistorySection() {
  const { history, historyLoading, clearHistory } = usePipefy();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<HistoryFiltersState>({
    performedBy: null,
    status: 'all',
    dateFrom: null,
    dateTo: null,
    search: '',
  });

  const getStatusBadge = (succeeded: number, failed: number) => {
    if (failed === 0) {
      return (
        <Badge className="status-badge status-success gap-1">
          <CheckCircle className="h-3 w-3" />
          Sucesso Total
        </Badge>
      );
    }
    if (succeeded === 0) {
      return (
        <Badge className="status-badge status-error gap-1">
          <XCircle className="h-3 w-3" />
          Falha
        </Badge>
      );
    }
    return (
      <Badge className="status-badge status-warning gap-1">
        <AlertCircle className="h-3 w-3" />
        Sucesso Parcial
      </Badge>
    );
  };

  const getRecordStatus = (succeeded: number, failed: number): 'success' | 'partial' | 'failed' => {
    if (failed === 0) return 'success';
    if (succeeded === 0) return 'failed';
    return 'partial';
  };

  // Get unique performed by emails for filter options
  const performedByOptions = useMemo(() => {
    const emails = new Set<string>();
    history.forEach((record) => {
      if (record.performedByEmail) {
        emails.add(record.performedByEmail);
      }
    });
    return Array.from(emails).sort();
  }, [history]);

  // Filter history based on current filters
  const filteredHistory = useMemo(() => {
    return history.filter((record) => {
      // Filter by performed by
      if (filters.performedBy && record.performedByEmail !== filters.performedBy) {
        return false;
      }

      // Filter by status
      if (filters.status !== 'all') {
        const recordStatus = getRecordStatus(record.succeeded.length, record.failed.length);
        if (recordStatus !== filters.status) {
          return false;
        }
      }

      // Filter by date from
      if (filters.dateFrom) {
        const recordDate = new Date(record.timestamp);
        if (isBefore(recordDate, startOfDay(filters.dateFrom))) {
          return false;
        }
      }

      // Filter by date to
      if (filters.dateTo) {
        const recordDate = new Date(record.timestamp);
        if (isAfter(recordDate, endOfDay(filters.dateTo))) {
          return false;
        }
      }

      // Filter by search (email)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesFrom = record.fromEmail.toLowerCase().includes(searchLower);
        const matchesTo = record.toEmail.toLowerCase().includes(searchLower);
        const matchesPerformedBy = record.performedByEmail?.toLowerCase().includes(searchLower);
        if (!matchesFrom && !matchesTo && !matchesPerformedBy) {
          return false;
        }
      }

      return true;
    });
  }, [history, filters]);

  const handleExport = () => {
    const data = filteredHistory.map((record) => ({
      data: format(new Date(record.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
      realizadoPor: record.performedByEmail,
      de: record.fromEmail,
      para: record.toEmail,
      pipe: record.pipeName,
      total: record.cardIds.length,
      sucesso: record.succeeded.length,
      erros: record.failed.length,
      cards: record.cardTitles,
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipefy-transferencias-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (historyLoading) {
    return (
      <Card className="shadow-soft">
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Carregando histórico...</p>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="shadow-soft">
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">Sem histórico</h3>
          <p className="text-muted-foreground">
            Suas transferências aparecerão aqui
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader className="flex flex-col gap-4 pb-4">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Transferências
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Limpar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar histórico?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Todo o histórico de transferências será removido.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={clearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Limpar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Filters */}
        <HistoryFilters
          performedByOptions={performedByOptions}
          onFiltersChange={setFilters}
        />
      </CardHeader>

      <CardContent className="pt-0">
        {filteredHistory.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Nenhum registro encontrado com os filtros aplicados
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {filteredHistory.map((record, index) => (
                <div
                  key={record.id}
                  className="rounded-lg border border-border bg-card animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-lg"
                    onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground truncate">{record.fromEmail}</span>
                          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{record.toEmail}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>
                            {format(new Date(record.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          <span>•</span>
                          <span>{record.cardIds.length} card(s)</span>
                          <span>•</span>
                          <span>{record.pipeName}</span>
                          {record.performedByEmail && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {record.performedByEmail}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {getStatusBadge(record.succeeded.length, record.failed.length)}
                        {expandedId === record.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedId === record.id && (
                    <div className="px-4 pb-4 border-t border-border pt-3">
                      <p className="text-xs text-muted-foreground mb-2">Cards transferidos:</p>
                      <div className="space-y-1">
                        {record.cardTitles.map((title, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-muted/30"
                          >
                            {record.succeeded.includes(record.cardIds[i]) ? (
                              <CheckCircle className="h-3 w-3 text-success shrink-0" />
                            ) : (
                              <XCircle className="h-3 w-3 text-destructive shrink-0" />
                            )}
                            <span className="truncate">{title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
