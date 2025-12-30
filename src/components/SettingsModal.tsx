import { useState } from 'react';
import { Key, Loader2, CheckCircle, AlertCircle, ExternalLink, Building2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePipefy } from '@/contexts/PipefyContext';
import { useUserRole } from '@/hooks/useUserRole';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { user, organizationId, setToken, clearToken } = usePipefy();
  const { isAdmin } = useUserRole();
  const [newToken, setNewToken] = useState('');
  const [newOrgId, setNewOrgId] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleUpdateToken = async () => {
    if (!newToken.trim()) {
      setError('Por favor, insira um token válido.');
      return;
    }

    if (!newOrgId.trim()) {
      setError('Por favor, insira o ID da organização.');
      return;
    }

    setError(null);
    setSuccess(false);
    setIsUpdating(true);

    const result = await setToken(newToken.trim(), newOrgId.trim());

    setIsUpdating(false);

    if (result.success) {
      setSuccess(true);
      setNewToken('');
      setNewOrgId('');
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
      }, 1500);
    } else {
      setError(result.error || 'Token inválido. Verifique e tente novamente.');
    }
  };

  const handleDisconnect = () => {
    clearToken();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Configurações
          </DialogTitle>
          <DialogDescription>
            Gerencie sua conexão com o Pipefy
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Connection */}
          {user && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-4">
              <div className="flex items-center gap-2 text-success mb-2">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium text-sm">Conectado</span>
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground mt-1">{user.name}</p>
              {organizationId && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Organização: {organizationId}
                </p>
              )}
            </div>
          )}

          {/* Update Token - Admin Only */}
          {isAdmin ? (
            <>
              <div className="space-y-3">
                <Label htmlFor="newToken">Atualizar Token</Label>
                <Input
                  id="newToken"
                  type="password"
                  placeholder="Cole o novo token aqui..."
                  value={newToken}
                  onChange={(e) => {
                    setNewToken(e.target.value);
                    setError(null);
                    setSuccess(false);
                  }}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="newOrgId" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  ID da Organização
                </Label>
                <Input
                  id="newOrgId"
                  type="text"
                  placeholder="Ex: 300549064"
                  value={newOrgId}
                  onChange={(e) => {
                    setNewOrgId(e.target.value);
                    setError(null);
                    setSuccess(false);
                  }}
                  className="font-mono text-sm"
                />
              </div>

              {error && (
                <Alert variant="destructive" className="animate-fade-in">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-success/50 bg-success/10 text-success animate-fade-in">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>Token atualizado com sucesso!</AlertDescription>
                </Alert>
              )}

              <a
                href="https://app.pipefy.com/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Gerar novo token no Pipefy
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          ) : (
            <Alert className="bg-muted/50">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Apenas administradores podem alterar as configurações de conexão do Pipefy.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                className="text-destructive hover:text-destructive"
              >
                Desconectar
              </Button>
              <Button
                onClick={handleUpdateToken}
                disabled={!newToken.trim() || !newOrgId.trim() || isUpdating}
                className="btn-primary"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  'Atualizar Token'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
