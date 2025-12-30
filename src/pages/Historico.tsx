import { useState } from 'react';
import { ArrowRightLeft, Zap } from 'lucide-react';
import { MainLayout } from '@/layouts/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransferHistorySection } from '@/components/TransferHistorySection';
import { AutomationHistorySection } from '@/components/AutomationHistorySection';
import { HelpModal } from '@/components/HelpModal';
import { SettingsModal } from '@/components/SettingsModal';

export default function Historico() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <MainLayout
      onSettingsClick={() => setSettingsOpen(true)}
      onHelpClick={() => setHelpOpen(true)}
    >
      <div className="container px-4 py-6 md:px-6 md:py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Histórico</h1>
          <p className="text-muted-foreground">
            Visualize o histórico de transferências e automações
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="transfers" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="transfers" className="gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Transferências
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-2">
              <Zap className="h-4 w-4" />
              Automações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transfers" className="mt-4">
            <TransferHistorySection />
          </TabsContent>

          <TabsContent value="automations" className="mt-4">
            <AutomationHistorySection />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </MainLayout>
  );
}
