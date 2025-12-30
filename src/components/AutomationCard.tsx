import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Automation } from '@/types/automation';
import { Play, Pencil, Trash2, Clock, Zap } from 'lucide-react';

interface AutomationCardProps {
  automation: Automation;
  isAdmin: boolean;
  onExecute: (automation: Automation) => void;
  onEdit?: (automation: Automation) => void;
  onDelete?: (automation: Automation) => void;
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}min`;
  }
  return `${minutes}min ${remainingSeconds}s`;
}

export function AutomationCard({
  automation,
  isAdmin,
  onExecute,
  onEdit,
  onDelete,
}: AutomationCardProps) {
  return (
    <Card className="card-hover">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-semibold leading-tight">
            {automation.name}
          </CardTitle>
          <div className="flex gap-1 shrink-0">
            {isAdmin && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(automation)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {isAdmin && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(automation)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {automation.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {automation.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <Zap className="h-3 w-3" />
            {automation.estimated_requests} req
          </Badge>
          {automation.average_execution_time > 0 && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(automation.average_execution_time)}
            </Badge>
          )}
        </div>

        <Button
          className="w-full btn-success"
          onClick={() => onExecute(automation)}
        >
          <Play className="mr-2 h-4 w-4" />
          Executar
        </Button>
      </CardContent>
    </Card>
  );
}
