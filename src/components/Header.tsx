import { Settings, HelpCircle, CheckCircle, XCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePipefy } from '@/contexts/PipefyContext';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HeaderProps {
  onSettingsClick: () => void;
  onHelpClick: () => void;
}

export function Header({ onSettingsClick, onHelpClick }: HeaderProps) {
  const { isConnected, user, clearToken } = usePipefy();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">D</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Draft Pipefy</h1>
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 ml-4">
                {isConnected ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-xs text-success font-medium hidden sm:inline">Conectado</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-xs text-destructive font-medium hidden sm:inline">Desconectado</span>
                  </>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isConnected ? `Logado como ${user?.email}` : 'Configure seu token para conectar'}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onHelpClick}
            className="gap-2"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Ajuda</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onSettingsClick}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configurações</span>
          </Button>

          {isConnected && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearToken}
                  className="gap-2 text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Desconectar</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </header>
  );
}
