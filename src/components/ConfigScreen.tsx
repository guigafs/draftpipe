import { useState } from 'react';
import { Key, ExternalLink, CheckCircle, AlertCircle, Loader2, Building2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePipefy } from '@/contexts/PipefyContext';
import { useUserRole } from '@/hooks/useUserRole';

export function ConfigScreen() {
  const { setToken, isLoading } = usePipefy();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [tokenInput, setTokenInput] = useState('');
  const [orgIdInput, setOrgIdInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [testing, setTesting] = useState(false);

  // Se não é admin, mostrar mensagem de acesso negado
  if (!roleLoading && !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg animate-scale-in shadow-medium">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-warning/10 flex items-center justify-center">
              <ShieldAlert className="h-7 w-7 text-warning" />
            </div>
            <CardTitle className="text-2xl">Acesso Restrito</CardTitle>
            <CardDescription className="text-base">
              Aguardando configuração do administrador
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <Alert className="bg-warning/10 border-warning/30">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-sm">
                O sistema ainda não foi configurado. Entre em contato com o administrador para configurar a conexão com o Pipefy.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) {
      setError('Por favor, insira um token válido.');
      return;
    }

    if (!orgIdInput.trim()) {
      setError('Por favor, insira o ID da organização.');
      return;
    }

    setError(null);
    setSuccess(false);
    setTesting(true);

    const result = await setToken(tokenInput.trim(), orgIdInput.trim());

    setTesting(false);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error || 'Token inválido. Verifique e tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg animate-scale-in shadow-medium">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Key className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Configurar Acesso</CardTitle>
          <CardDescription className="text-base">
            Insira seu Personal Access Token e ID da organização do Pipefy
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="token" className="text-sm font-medium">
              Personal Access Token
            </label>
            <Input
              id="token"
              type="password"
              placeholder="Cole seu token aqui..."
              value={tokenInput}
              onChange={(e) => {
                setTokenInput(e.target.value);
                setError(null);
                setSuccess(false);
              }}
              className="input-field font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="orgId" className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              ID da Organização
            </label>
            <Input
              id="orgId"
              type="text"
              placeholder="Ex: 300549064"
              value={orgIdInput}
              onChange={(e) => {
                setOrgIdInput(e.target.value);
                setError(null);
                setSuccess(false);
              }}
              className="input-field font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Você encontra o ID da organização na URL do Pipefy: app.pipefy.com/organizations/<strong>ID</strong>
            </p>
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
              <AlertDescription>Token validado com sucesso! Redirecionando...</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleSaveToken}
            disabled={!tokenInput.trim() || !orgIdInput.trim() || testing || isLoading}
            className="w-full btn-primary h-11"
          >
            {testing || isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validando...
              </>
            ) : (
              'Salvar e Conectar'
            )}
          </Button>

          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium mb-3">Como gerar seu token:</h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Acesse o Pipefy e vá em Configurações</li>
              <li>Clique em "Personal Access Token"</li>
              <li>Gere um novo token e copie</li>
              <li>Cole o token acima</li>
            </ol>
            <a
              href="https://app.pipefy.com/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Abrir página de tokens
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <Alert className="bg-muted/50 border-border">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <AlertDescription className="text-sm text-muted-foreground">
              <strong>Nota:</strong> Esta configuração é global e será usada por todos os usuários do sistema.
              Apenas administradores podem alterar estas configurações.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
