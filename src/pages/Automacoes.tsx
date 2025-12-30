import { useState, useEffect } from 'react';
import { Plus, Zap, Loader2 } from 'lucide-react';
import { MainLayout } from '@/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { AutomationCard } from '@/components/AutomationCard';
import { AutomationFormModal } from '@/components/AutomationFormModal';
import { ExecuteAutomationModal } from '@/components/ExecuteAutomationModal';
import { DeleteAutomationModal } from '@/components/DeleteAutomationModal';
import { HelpModal } from '@/components/HelpModal';
import { SettingsModal } from '@/components/SettingsModal';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Automation, AutomationFormData } from '@/types/automation';
import { toast } from '@/hooks/use-toast';

export default function Automacoes() {
  const { user } = useAuth();
  const { isAdmin, isLoading: isRoleLoading } = useUserRole();

  // UI State
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [executeOpen, setExecuteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Data State
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch automations
  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    try {
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Ensure headers is properly typed
      const typedData = (data || []).map(item => ({
        ...item,
        headers: (item.headers || {}) as Record<string, string>
      }));
      
      setAutomations(typedData);
    } catch (error) {
      console.error('Erro ao carregar automações:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar automações',
        description: 'Não foi possível carregar a lista de automações.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedAutomation(null);
    setFormOpen(true);
  };

  const handleEdit = (automation: Automation) => {
    setSelectedAutomation(automation);
    setFormOpen(true);
  };

  const handleDelete = (automation: Automation) => {
    setSelectedAutomation(automation);
    setDeleteOpen(true);
  };

  const handleExecute = (automation: Automation) => {
    setSelectedAutomation(automation);
    setExecuteOpen(true);
  };

  const handleFormSubmit = async (data: AutomationFormData) => {
    try {
      if (selectedAutomation) {
        // Update
        const { error } = await supabase
          .from('automations')
          .update({
            name: data.name,
            description: data.description || null,
            webhook_url: data.webhook_url,
            headers: data.headers,
            estimated_requests: data.estimated_requests,
            average_execution_time: data.average_execution_time,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedAutomation.id);

        if (error) throw error;

        toast({
          title: 'Automação atualizada',
          description: 'A automação foi atualizada com sucesso.',
        });
      } else {
        // Create
        const { error } = await supabase.from('automations').insert({
          name: data.name,
          description: data.description || null,
          webhook_url: data.webhook_url,
          headers: data.headers,
          estimated_requests: data.estimated_requests,
          average_execution_time: data.average_execution_time,
          created_by: user?.id,
        });

        if (error) throw error;

        toast({
          title: 'Automação criada',
          description: 'A automação foi criada com sucesso.',
        });
      }

      fetchAutomations();
    } catch (error: any) {
      console.error('Erro ao salvar automação:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar a automação.',
      });
      throw error;
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedAutomation) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('automations')
        .delete()
        .eq('id', selectedAutomation.id);

      if (error) throw error;

      toast({
        title: 'Automação excluída',
        description: 'A automação foi excluída com sucesso.',
      });

      setDeleteOpen(false);
      fetchAutomations();
    } catch (error: any) {
      console.error('Erro ao excluir automação:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: error.message || 'Não foi possível excluir a automação.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmExecute = async () => {
    if (!selectedAutomation || !user) return;

    setIsExecuting(true);
    const startTime = Date.now();

    try {
      // Execute webhook
      const response = await fetch(selectedAutomation.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...selectedAutomation.headers,
        },
        body: JSON.stringify({
          automation_id: selectedAutomation.id,
          automation_name: selectedAutomation.name,
          executed_by: user.email,
          executed_at: new Date().toISOString(),
        }),
      });

      const executionTime = Date.now() - startTime;
      let responseBody = '';
      
      try {
        responseBody = await response.text();
      } catch {
        responseBody = 'Não foi possível ler a resposta';
      }

      // Log execution
      await supabase.from('automation_logs').insert({
        automation_id: selectedAutomation.id,
        executed_by: user.id,
        status: response.ok ? 'success' : 'error',
        response_status: response.status,
        response_body: responseBody.substring(0, 5000), // Limit size
        execution_time: executionTime,
      });

      if (response.ok) {
        toast({
          title: 'Automação executada',
          description: `${selectedAutomation.name} foi executada com sucesso em ${executionTime}ms.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro na execução',
          description: `Status ${response.status}: ${responseBody.substring(0, 100)}`,
        });
      }

      setExecuteOpen(false);
    } catch (error: any) {
      console.error('Erro ao executar automação:', error);

      // Log error
      await supabase.from('automation_logs').insert({
        automation_id: selectedAutomation.id,
        executed_by: user.id,
        status: 'error',
        response_body: error.message || 'Erro desconhecido',
        execution_time: Date.now() - startTime,
      });

      toast({
        variant: 'destructive',
        title: 'Erro ao executar',
        description: error.message || 'Não foi possível executar a automação.',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const isPageLoading = isLoading || isRoleLoading;

  return (
    <MainLayout
      onSettingsClick={() => setSettingsOpen(true)}
      onHelpClick={() => setHelpOpen(true)}
    >
      <div className="container px-4 py-6 md:px-6 md:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Automações</h1>
            <p className="text-muted-foreground">
              Gerencie e execute automações via webhooks
            </p>
          </div>

          {isAdmin && (
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Automação
            </Button>
          )}
        </div>

        {/* Content */}
        {isPageLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">
              Nenhuma automação cadastrada
            </h3>
            <p className="text-muted-foreground max-w-sm">
              {isAdmin
                ? 'Clique em "Nova Automação" para criar sua primeira automação.'
                : 'Aguarde o administrador criar as automações.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {automations.map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                isAdmin={isAdmin}
                onExecute={handleExecute}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />

      <AutomationFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        automation={selectedAutomation}
      />

      <ExecuteAutomationModal
        open={executeOpen}
        onClose={() => setExecuteOpen(false)}
        onConfirm={handleConfirmExecute}
        automation={selectedAutomation}
        isExecuting={isExecuting}
      />

      <DeleteAutomationModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        automation={selectedAutomation}
        isDeleting={isDeleting}
      />
    </MainLayout>
  );
}
