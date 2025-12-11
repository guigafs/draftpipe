import { ExternalLink, Key, Search, CheckSquare, Send, History } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const steps = [
  {
    icon: Key,
    title: '1. Configure seu Token',
    description:
      'Acesse o Pipefy, gere um Personal Access Token e cole nas configurações. Você precisará de permissões de Admin ou Super Admin.',
  },
  {
    icon: Search,
    title: '2. Busque os Cards',
    description:
      'Insira o email do responsável atual, selecione o Pipe desejado e clique em "Buscar Projetos" para encontrar todos os cards.',
  },
  {
    icon: CheckSquare,
    title: '3. Selecione os Cards',
    description:
      'Marque os cards que deseja transferir. Use "Selecionar Todos" para marcar todos ou selecione individualmente.',
  },
  {
    icon: Send,
    title: '4. Transfira',
    description:
      'Insira o email do novo responsável, clique em "Transferir Selecionados" e confirme a operação.',
  },
  {
    icon: History,
    title: '5. Acompanhe o Histórico',
    description:
      'Todas as transferências são registradas no histórico. Você pode exportar ou limpar quando necessário.',
  },
];

const faqs = [
  {
    question: 'Preciso de quais permissões no Pipefy?',
    answer:
      'Você precisa ser Admin ou Super Admin da organização para poder transferir cards entre usuários.',
  },
  {
    question: 'Posso desfazer uma transferência?',
    answer:
      'Não diretamente por aqui. Você pode fazer uma nova transferência de volta para o responsável original se necessário.',
  },
  {
    question: 'O token fica salvo onde?',
    answer:
      'O token é salvo apenas no localStorage do seu navegador. Ele não é enviado para nenhum servidor além do Pipefy.',
  },
  {
    question: 'Existe limite de transferências?',
    answer:
      'O Pipefy permite 500 requisições a cada 30 segundos. A aplicação respeita esse limite automaticamente.',
  },
];

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Como usar o Draft Pipefy</DialogTitle>
          <DialogDescription>
            Guia passo a passo para transferir cards entre responsáveis
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-8 py-4">
            {/* Steps */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Passo a Passo</h3>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className="flex gap-4 p-4 rounded-lg border border-border bg-muted/30 animate-fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{step.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Perguntas Frequentes</h3>
              <div className="space-y-3">
                {faqs.map((faq, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border border-border"
                  >
                    <h4 className="font-medium text-sm">{faq.question}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* External Links */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Links Úteis</h3>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://app.pipefy.com/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  Gerar Token
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <span className="text-muted-foreground">•</span>
                <a
                  href="https://developers.pipefy.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  Documentação Pipefy
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <span className="text-muted-foreground">•</span>
                <a
                  href="https://help.pipefy.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  Central de Ajuda
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
