import { useState } from 'react';
import { User, Key, LogOut, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePipefy } from '@/contexts/PipefyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function UserMenu() {
  const { user, logout } = useAuth();
  const { clearToken } = usePipefy();
  const navigate = useNavigate();
  
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleLogout = async () => {
    clearToken();
    await logout();
    navigate('/login');
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast.error('Erro ao alterar senha: ' + error.message);
        return;
      }

      toast.success('Senha alterada com sucesso!');
      setIsPasswordDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error('Erro ao alterar senha');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';
  const userEmail = user?.email || 'Usuário';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-medium text-sm">{userInitial}</span>
            </div>
            <span className="hidden md:inline text-sm font-medium max-w-32 truncate">
              {userEmail}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">Minha Conta</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsPasswordDialogOpen(true)}>
            <Key className="mr-2 h-4 w-4" />
            Alterar Senha
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleLogout}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Digite sua nova senha abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite novamente"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPasswordDialogOpen(false)}
              disabled={isChangingPassword}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !newPassword || !confirmPassword}
            >
              {isChangingPassword ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
