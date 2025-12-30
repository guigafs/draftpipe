import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Trash2,
  Download,
  Loader2,
  User,
  Timer,
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/hooks/use-toast';

interface AutomationLogWithDetails {
  id: string;
  automation_id: string;
  automation_name: string;
  executed_by: string;
  executed_by_email: string;
  status: 'success' | 'error';
  response_status: number | null;
  response_body: string | null;
  execution_time: number | null;
  created_at: string;
}

export function AutomationHistorySection() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [logs, setLogs] = useState<AutomationLogWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('automation_logs')
        .select(`
          id,
          automation_id,
          executed_by,
          status,
          response_status,
          response_body,
          execution_time,
          created_at,
          automations (name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get user emails for executed_by
      const userIds = [...new Set((data || []).map(log => log.executed_by))];
      const { data: usersData } = await supabase.auth.admin.listUsers?.() || { data: null };
      
      const formattedLogs: AutomationLogWithDetails[] = (data || []).map(log => ({
        id: log.id,
        automation_id: log.automation_id,
        automation_name: (log.automations as any)?.name || 'Automação removida',
        executed_by: log.executed_by,
        executed_by_email: log.executed_by === user?.id ? (user?.email || 'Você') : 'Usuário',
        status: log.status as 'success' | 'error',
        response_status: log.response_status,
        response_body: log.response_body,
        execution_time: log.execution_time,
        created_at: log.created_at,
      }));

      setLogs(formattedLogs);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar histórico',
        description: 'Não foi possível carregar o histórico de automações.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      const { error } = await supabase
        .from('automation_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;

      setLogs([]);
      toast({
        title: 'Histórico limpo',
        description: 'O histórico de automações foi limpo com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao limpar logs:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao limpar',
        description: 'Não foi possível limpar o histórico.',
      });
    }
  };

  const handleExport = () => {
    const data = logs.map((log) => ({
      data: format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
      automacao: log.automation_name,
      executadoPor: log.executed_by_email,
      status: log.status,
      statusHttp: log.response_status,
      tempoExecucao: log.execution_time ? `${log.execution_time}ms` : null,
      resposta: log.response_body?.substring(0, 500),
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `automacoes-logs-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatExecutionTime = (ms: number | null) => {
    if (ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (isLoading) {
    return (
      <Card className="shadow-soft">
        <CardContent className="py-12 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando histórico...</p>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card className="shadow-soft">
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Zap className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">Sem histórico</h3>
          <p className="text-muted-foreground">
            As execuções de automações aparecerão aqui
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Histórico de Automações
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          {isAdmin && (
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
                    Esta ação não pode ser desfeita. Todo o histórico de automações será removido.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearLogs} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Limpar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {logs.map((log, index) => (
              <div
                key={log.id}
                className="rounded-lg border border-border bg-card animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div
                  className="p-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-lg"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Zap className="h-4 w-4 text-primary" />
                        <span className="truncate">{log.automation_name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {log.executed_by_email}
                        </span>
                        {log.execution_time && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              {formatExecutionTime(log.execution_time)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className={log.status === 'success' ? 'status-badge status-success gap-1' : 'status-badge status-error gap-1'}>
                        {log.status === 'success' ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            Sucesso
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" />
                            Erro
                          </>
                        )}
                      </Badge>
                      {log.response_status && (
                        <Badge variant="outline" className="text-xs">
                          HTTP {log.response_status}
                        </Badge>
                      )}
                      {expandedId === log.id ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedId === log.id && log.response_body && (
                  <div className="px-4 pb-4 border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground mb-2">Resposta:</p>
                    <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                      {log.response_body}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
