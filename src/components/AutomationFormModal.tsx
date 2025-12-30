import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { HeadersEditor } from '@/components/HeadersEditor';
import { Automation, AutomationFormData } from '@/types/automation';
import { Loader2 } from 'lucide-react';

interface AutomationFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AutomationFormData) => Promise<void>;
  automation?: Automation | null;
}

export function AutomationFormModal({
  open,
  onClose,
  onSubmit,
  automation,
}: AutomationFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<AutomationFormData>({
    name: '',
    description: '',
    webhook_url: '',
    headers: {},
    estimated_requests: 1,
    average_execution_time: 0,
  });

  const isEditing = !!automation;

  useEffect(() => {
    if (automation) {
      setFormData({
        name: automation.name,
        description: automation.description || '',
        webhook_url: automation.webhook_url,
        headers: automation.headers || {},
        estimated_requests: automation.estimated_requests,
        average_execution_time: automation.average_execution_time,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        webhook_url: '',
        headers: {},
        estimated_requests: 1,
        average_execution_time: 0,
      });
    }
  }, [automation, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Automação' : 'Nova Automação'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Nome da automação"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Descreva o que essa automação faz"
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook_url">URL do Webhook *</Label>
            <Input
              id="webhook_url"
              type="url"
              value={formData.webhook_url}
              onChange={(e) =>
                setFormData({ ...formData, webhook_url: e.target.value })
              }
              placeholder="https://n8n.example.com/webhook/..."
              required
              disabled={isLoading}
            />
          </div>

          <HeadersEditor
            headers={formData.headers}
            onChange={(headers) => setFormData({ ...formData, headers })}
            disabled={isLoading}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimated_requests">Previsão de Requisições</Label>
              <Input
                id="estimated_requests"
                type="number"
                min={1}
                value={formData.estimated_requests}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estimated_requests: parseInt(e.target.value) || 1,
                  })
                }
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Quantidade de requisições que serão consumidas
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="average_execution_time">
                Tempo Médio (segundos)
              </Label>
              <Input
                id="average_execution_time"
                type="number"
                min={0}
                value={formData.average_execution_time}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    average_execution_time: parseInt(e.target.value) || 0,
                  })
                }
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Tempo médio de execução
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
