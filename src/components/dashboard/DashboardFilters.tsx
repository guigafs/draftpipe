import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

export type PeriodType = 'today' | '7days' | '30days' | '3months' | 'custom';

interface DashboardFiltersProps {
  period: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  dateRange: { from: Date; to: Date };
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
}

const periodOptions = [
  { value: 'today' as PeriodType, label: 'Hoje' },
  { value: '7days' as PeriodType, label: '7 dias' },
  { value: '30days' as PeriodType, label: '30 dias' },
  { value: '3months' as PeriodType, label: '3 meses' },
  { value: 'custom' as PeriodType, label: 'Personalizado' },
];

export function getDateRangeForPeriod(period: PeriodType): { from: Date; to: Date } {
  const now = new Date();
  const today = startOfDay(now);
  const endToday = endOfDay(now);

  switch (period) {
    case 'today':
      return { from: today, to: endToday };
    case '7days':
      return { from: startOfDay(subDays(now, 6)), to: endToday };
    case '30days':
      return { from: startOfDay(subDays(now, 29)), to: endToday };
    case '3months':
      return { from: startOfDay(subMonths(now, 3)), to: endToday };
    case 'custom':
    default:
      return { from: startOfMonth(now), to: endToday };
  }
}

export function DashboardFilters({
  period,
  onPeriodChange,
  dateRange,
  onDateRangeChange,
}: DashboardFiltersProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handlePeriodClick = (newPeriod: PeriodType) => {
    onPeriodChange(newPeriod);
    if (newPeriod !== 'custom') {
      onDateRangeChange(getDateRangeForPeriod(newPeriod));
    }
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onDateRangeChange({ 
        from: startOfDay(range.from), 
        to: endOfDay(range.to) 
      });
      setCalendarOpen(false);
    } else if (range?.from) {
      onDateRangeChange({ 
        from: startOfDay(range.from), 
        to: endOfDay(range.from) 
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {periodOptions.map((option) => (
        <Button
          key={option.value}
          variant={period === option.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePeriodClick(option.value)}
        >
          {option.label}
        </Button>
      ))}

      {period === 'custom' && (
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'justify-start text-left font-normal',
                !dateRange && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })} -{' '}
                    {format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}
                  </>
                ) : (
                  format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })
                )
              ) : (
                <span>Selecione o período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={handleDateRangeSelect}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
