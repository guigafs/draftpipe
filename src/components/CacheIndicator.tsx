import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CacheIndicatorProps {
  updatedAt: Date | null;
  label?: string;
  expiredAfterMs?: number;
}

export function CacheIndicator({ 
  updatedAt, 
  label,
  expiredAfterMs = 60 * 60 * 1000 // 1 hour default
}: CacheIndicatorProps) {
  const [, setTick] = useState(0);

  // Force re-render every minute to update relative time
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!updatedAt) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {label ? `${label}: ` : ''}Sem cache
      </span>
    );
  }

  const isExpired = Date.now() - updatedAt.getTime() > expiredAfterMs;
  const relativeTime = formatDistanceToNow(updatedAt, { 
    addSuffix: true, 
    locale: ptBR 
  });
  const exactTime = updatedAt.toLocaleString('pt-BR');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            className={cn(
              "text-xs flex items-center gap-1 cursor-default",
              isExpired ? "text-destructive" : "text-muted-foreground"
            )}
          >
            <Clock className="h-3 w-3" />
            {label ? `${label}: ` : ''}{relativeTime}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Atualizado em {exactTime}</p>
          {isExpired && <p className="text-destructive">Cache expirado</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
