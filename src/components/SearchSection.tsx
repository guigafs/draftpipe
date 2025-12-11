import { useState } from 'react';
import { Search, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { usePipefy } from '@/contexts/PipefyContext';
import { searchCardsByAssignee, PipefyCard } from '@/lib/pipefy-api';
import { toast } from '@/hooks/use-toast';

interface SearchSectionProps {
  onCardsFound: (cards: PipefyCard[], fromEmail: string, pipeName: string) => void;
  newAssigneeEmail: string;
  onNewAssigneeChange: (email: string) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SearchSection({ onCardsFound, newAssigneeEmail, onNewAssigneeChange }: SearchSectionProps) {
  const { token, pipes, refreshPipes, isConnected } = usePipefy();
  const [currentEmail, setCurrentEmail] = useState('');
  const [selectedPipe, setSelectedPipe] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [newEmailError, setNewEmailError] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    return EMAIL_REGEX.test(email);
  };

  const handleCurrentEmailChange = (value: string) => {
    setCurrentEmail(value);
    if (value && !validateEmail(value)) {
      setEmailError('Email inválido');
    } else if (value && value.toLowerCase() === newAssigneeEmail.toLowerCase()) {
      setEmailError('Emails devem ser diferentes');
    } else {
      setEmailError(null);
    }
  };

  const handleNewEmailChange = (value: string) => {
    onNewAssigneeChange(value);
    if (value && !validateEmail(value)) {
      setNewEmailError('Email inválido');
    } else if (value && value.toLowerCase() === currentEmail.toLowerCase()) {
      setNewEmailError('Emails devem ser diferentes');
    } else {
      setNewEmailError(null);
    }
  };

  const handleRefreshPipes = async () => {
    setIsRefreshing(true);
    await refreshPipes();
    setIsRefreshing(false);
    toast({
      title: 'Pipes atualizados',
      description: 'Lista de pipes recarregada com sucesso.',
    });
  };

  const handleSearch = async () => {
    if (!token || !selectedPipe || !currentEmail) return;

    if (!validateEmail(currentEmail)) {
      setEmailError('Email inválido');
      return;
    }

    setIsSearching(true);

    try {
      const cards = await searchCardsByAssignee(token, selectedPipe, currentEmail);
      const pipe = pipes.find(p => p.id === selectedPipe);
      onCardsFound(cards, currentEmail, pipe?.name || 'Pipe');
      
      if (cards.length === 0) {
        toast({
          title: 'Nenhum card encontrado',
          description: `Não há cards atribuídos a ${currentEmail} neste pipe.`,
        });
      } else {
        toast({
          title: `${cards.length} card(s) encontrado(s)`,
          description: `Localizados no pipe "${pipe?.name}"`,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro na busca',
        description: error instanceof Error ? error.message : 'Erro ao buscar cards',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const canSearch = isConnected && selectedPipe && currentEmail && validateEmail(currentEmail) && !emailError;

  return (
    <Card className="shadow-soft">
      <CardContent className="p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Current Assignee Email */}
          <div className="space-y-2">
            <Label htmlFor="currentEmail">Email do Responsável Atual</Label>
            <Input
              id="currentEmail"
              type="email"
              placeholder="responsavel@empresa.com"
              value={currentEmail}
              onChange={(e) => handleCurrentEmailChange(e.target.value)}
              className={`input-field ${emailError ? 'border-destructive focus:ring-destructive/20' : ''}`}
            />
            {emailError && (
              <p className="text-xs text-destructive">{emailError}</p>
            )}
          </div>

          {/* Pipe Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Selecionar Pipe</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshPipes}
                disabled={isRefreshing}
                className="h-6 px-2 text-xs"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
            <Select value={selectedPipe} onValueChange={setSelectedPipe}>
              <SelectTrigger className="input-field">
                <SelectValue placeholder="Escolha um pipe..." />
              </SelectTrigger>
              <SelectContent>
                {pipes.map((pipe) => (
                  <SelectItem key={pipe.id} value={pipe.id}>
                    {pipe.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* New Assignee Email */}
          <div className="space-y-2">
            <Label htmlFor="newEmail">Email do Novo Responsável</Label>
            <Input
              id="newEmail"
              type="email"
              placeholder="novo@empresa.com"
              value={newAssigneeEmail}
              onChange={(e) => handleNewEmailChange(e.target.value)}
              className={`input-field ${newEmailError ? 'border-destructive focus:ring-destructive/20' : ''}`}
            />
            {newEmailError && (
              <p className="text-xs text-destructive">{newEmailError}</p>
            )}
          </div>

          {/* Search Button */}
          <div className="space-y-2">
            <Label className="invisible">Ação</Label>
            <Button
              onClick={handleSearch}
              disabled={!canSearch || isSearching}
              className="w-full btn-primary h-10"
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar Projetos
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
