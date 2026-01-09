import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Zap, CheckCircle2, XCircle } from 'lucide-react';

export interface LogEntry {
  id: string;
  created_at: string;
  type: 'transfer' | 'automation';
  description: string;
  requests: number;
  status: 'success' | 'error' | 'partial';
  executor?: string;
}

interface DashboardLogTableProps {
  logs: LogEntry[];
  isLoading?: boolean;
}

export function DashboardLogTable({ logs, isLoading }: DashboardLogTableProps) {
  const getStatusBadge = (status: LogEntry['status']) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-500/10">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Sucesso
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="text-red-600 border-red-600/30 bg-red-500/10">
            <XCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-500/10">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Parcial
          </Badge>
        );
    }
  };

  const getTypeIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'transfer':
        return <Users className="h-4 w-4 text-green-500" />;
      case 'automation':
        return <Zap className="h-4 w-4 text-purple-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">
          Log de Operações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Carregando...
          </div>
        ) : logs.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhuma operação encontrada no período selecionado
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Data/Hora</TableHead>
                  <TableHead className="w-[100px]">Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[100px] text-right">Requisições</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[150px]">Executor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(log.type)}
                        <span className="text-sm">
                          {log.type === 'transfer' ? 'Transf.' : 'Autom.'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate" title={log.description}>
                      {log.description}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {log.requests.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate" title={log.executor}>
                      {log.executor || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
