import { Card, CardContent } from '@/components/ui/card';
import { Activity, Users, Zap, TrendingUp } from 'lucide-react';

interface DashboardKPICardsProps {
  totalRequests: number;
  transferRequests: number;
  automationRequests: number;
  dailyAverage: number;
  isLoading?: boolean;
}

export function DashboardKPICards({
  totalRequests,
  transferRequests,
  automationRequests,
  dailyAverage,
  isLoading,
}: DashboardKPICardsProps) {
  const kpis = [
    {
      title: 'Total de Requisições',
      value: totalRequests,
      icon: Activity,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Responsáveis',
      value: transferRequests,
      icon: Users,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      subtitle: 'transferências',
    },
    {
      title: 'Automações',
      value: automationRequests,
      icon: Zap,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      subtitle: 'execuções',
    },
    {
      title: 'Média Diária',
      value: dailyAverage,
      icon: TrendingUp,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      prefix: '~',
      suffix: '/dia',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title} className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </p>
                <div className="flex items-baseline gap-1">
                  {kpi.prefix && (
                    <span className="text-xl text-muted-foreground">{kpi.prefix}</span>
                  )}
                  <span className="text-3xl font-bold">
                    {isLoading ? '...' : kpi.value.toLocaleString('pt-BR')}
                  </span>
                  {kpi.suffix && (
                    <span className="text-sm text-muted-foreground">{kpi.suffix}</span>
                  )}
                </div>
                {kpi.subtitle && (
                  <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
                )}
              </div>
              <div className={`p-3 rounded-full ${kpi.bgColor}`}>
                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
