import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Automation } from '@/types/automation';
import { Loader2 } from 'lucide-react';

interface DeleteAutomationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  automation: Automation | null;
  isDeleting: boolean;
}

export function DeleteAutomationModal({
  open,
  onClose,
  onConfirm,
  automation,
  isDeleting,
}: DeleteAutomationModalProps) {
  if (!automation) return null;

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && !isDeleting && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Automação</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir a automação{' '}
            <strong className="text-foreground">{automation.name}</strong>?
            <br />
            <br />
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
