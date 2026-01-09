import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardFilters, PeriodType, getDateRangeForPeriod } from '@/components/dashboard/DashboardFilters';
import { DashboardKPICards } from '@/components/dashboard/DashboardKPICards';
import { DashboardChart, ChartDataPoint } from '@/components/dashboard/DashboardChart';
import { DashboardLogTable, LogEntry } from '@/components/dashboard/DashboardLogTable';
import { format, eachDayOfInterval, differenceInDays, parseISO } from 'date-fns';

interface TransferRecord {
  id: string;
  created_at: string;
  succeeded_count: number;
  failed_count: number;
  pipe_name: string;
  performed_by_email: string;
}

interface AutomationLogRaw {
  id: string;
  created_at: string;
  status: string;
  automation_id: string;
  automations: {
    name: string;
    estimated_requests: number;
  }[] | { name: string; estimated_requests: number } | null;
}

interface AutomationLog {
  id: string;
  created_at: string;
  status: string;
  automation_id: string;
  automationName: string;
  estimatedRequests: number;
}

const parseAutomationLog = (raw: AutomationLogRaw): AutomationLog => {
  let name = 'Automação';
  let requests = 1;
  
  if (raw.automations) {
    if (Array.isArray(raw.automations) && raw.automations.length > 0) {
      name = raw.automations[0].name || 'Automação';
      requests = raw.automations[0].estimated_requests || 1;
    } else if (!Array.isArray(raw.automations)) {
      name = raw.automations.name || 'Automação';
      requests = raw.automations.estimated_requests || 1;
    }
  }
  
  return {
    id: raw.id,
    created_at: raw.created_at,
    status: raw.status,
    automation_id: raw.automation_id,
    automationName: name,
    estimatedRequests: requests,
  };
};

export default function Dashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodType>('7days');
  const [dateRange, setDateRange] = useState(getDateRangeForPeriod('7days'));
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsLoading(true);

      try {
        const [transfersResult, automationsResult] = await Promise.all([
          supabase
            .from('transfer_history')
            .select('id, created_at, succeeded_count, failed_count, pipe_name, performed_by_email')
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString())
            .order('created_at', { ascending: false }),
          supabase
            .from('automation_logs')
            .select(`
              id,
              created_at,
              status,
              automation_id,
              automations (name, estimated_requests)
            `)
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString())
            .order('created_at', { ascending: false }),
        ]);

        if (transfersResult.data) {
          setTransfers(transfersResult.data);
        }

        if (automationsResult.data) {
          setAutomationLogs(automationsResult.data.map(parseAutomationLog));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, dateRange]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const transferRequests = transfers.reduce((sum, t) => {
      return sum + (t.succeeded_count + t.failed_count) * 2;
    }, 0);

    const automationRequests = automationLogs.reduce((sum, log) => {
      return sum + log.estimatedRequests;
    }, 0);

    const totalRequests = transferRequests + automationRequests;

    const days = Math.max(1, differenceInDays(dateRange.to, dateRange.from) + 1);
    const dailyAverage = Math.round(totalRequests / days);

    return {
      totalRequests,
      transferRequests,
      automationRequests,
      dailyAverage,
    };
  }, [transfers, automationLogs, dateRange]);

  // Prepare chart data
  const chartData = useMemo((): ChartDataPoint[] => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });

    return days.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');

      // Use parseISO to correctly handle the date string and format to local date
      const dayTransfers = transfers.filter((t) => {
        const transferDate = format(parseISO(t.created_at), 'yyyy-MM-dd');
        return transferDate === dayStr;
      });
      const dayAutomations = automationLogs.filter((log) => {
        const logDate = format(parseISO(log.created_at), 'yyyy-MM-dd');
        return logDate === dayStr;
      });

      const responsaveis = dayTransfers.reduce(
        (sum, t) => sum + (t.succeeded_count + t.failed_count) * 2,
        0
      );
      const automacoes = dayAutomations.reduce(
        (sum, log) => sum + log.estimatedRequests,
        0
      );

      return {
        date: dayStr,
        responsaveis,
        automacoes,
        total: responsaveis + automacoes,
      };
    });
  }, [transfers, automationLogs, dateRange]);

  // Prepare log entries
  const logEntries = useMemo((): LogEntry[] => {
    const transferLogs: LogEntry[] = transfers.map((t) => ({
      id: `transfer-${t.id}`,
      created_at: t.created_at,
      type: 'transfer' as const,
      description: `Transferência em ${t.pipe_name}`,
      requests: (t.succeeded_count + t.failed_count) * 2,
      status:
        t.failed_count === 0
          ? ('success' as const)
          : t.succeeded_count === 0
          ? ('error' as const)
          : ('partial' as const),
      executor: t.performed_by_email,
    }));

    const automationLogEntries: LogEntry[] = automationLogs.map((log) => ({
      id: `automation-${log.id}`,
      created_at: log.created_at,
      type: 'automation' as const,
      description: log.automationName,
      requests: log.estimatedRequests,
      status: log.status === 'success' ? ('success' as const) : ('error' as const),
      executor: undefined,
    }));

    return [...transferLogs, ...automationLogEntries].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [transfers, automationLogs]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Monitoramento do consumo de chamadas de API
            </p>
          </div>
          <DashboardFilters
            period={period}
            onPeriodChange={setPeriod}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>

        <DashboardKPICards
          totalRequests={kpis.totalRequests}
          transferRequests={kpis.transferRequests}
          automationRequests={kpis.automationRequests}
          dailyAverage={kpis.dailyAverage}
          isLoading={isLoading}
        />

        <DashboardChart data={chartData} isLoading={isLoading} />

        <DashboardLogTable logs={logEntries} isLoading={isLoading} />
      </div>
    </MainLayout>
  );
}
