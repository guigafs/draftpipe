import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ChartDataPoint {
  date: string;
  responsaveis: number;
  automacoes: number;
  total: number;
}

interface DashboardChartProps {
  data: ChartDataPoint[];
  isLoading?: boolean;
}

export function DashboardChart({ data, isLoading }: DashboardChartProps) {
  const average = useMemo(() => {
    if (data.length === 0) return 0;
    const total = data.reduce((sum, item) => sum + item.total, 0);
    return Math.round(total / data.length);
  }, [data]);

  const formatXAxis = (dateStr: string) => {
    try {
      // Use parseISO to correctly handle the date string without timezone shift
      const date = parseISO(dateStr);
      return format(date, 'dd/MM', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Use parseISO to correctly handle the date string without timezone shift
      const date = parseISO(label);
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-2">
            {format(date, "dd 'de' MMMM", { locale: ptBR })}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">
          Consumo de API por Período
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Carregando...
          </div>
        ) : data.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Nenhum dado encontrado no período selecionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
              />
              <Bar
                dataKey="responsaveis"
                stackId="a"
                fill="hsl(142, 76%, 36%)"
                name="Responsáveis"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="automacoes"
                stackId="a"
                fill="hsl(262, 83%, 58%)"
                name="Automações"
                radius={[4, 4, 0, 0]}
              />
              {average > 0 && (
                <ReferenceLine
                  y={average}
                  stroke="hsl(38, 92%, 50%)"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  label={{
                    value: `Média: ${average}`,
                    position: 'right',
                    fill: 'hsl(38, 92%, 50%)',
                    fontSize: 12,
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
