import { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
  variant?: 'destructive' | 'default';
  children?: ReactNode;
  confirmDisabled?: boolean;
}

export const ConfirmModal = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'destructive',
  children,
  confirmDisabled = false,
}: ConfirmModalProps) => {
  const isDestructive = variant === 'destructive';

  const { t } = useTranslation('common');
  confirmText = confirmText ?? t('confirm');
  cancelText = cancelText ?? t('cancel');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel?.()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-3 pb-4">
            {isDestructive && (
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
            )}

            <DialogTitle className={cn(isDestructive ? 'text-destructive' : '')}>
              {title}
            </DialogTitle>
          </div>

          {message && <DialogDescription>{message}</DialogDescription>}
        </DialogHeader>

        {children && <div className="py-4">{children}</div>}

        <DialogFooter className="gap-3 sm:gap-3">
          {onCancel && (
            <Button onClick={onCancel} variant="outline" className="flex-1">
              {cancelText}
            </Button>
          )}

          <Button
            onClick={() => {
              onConfirm();
            }}
            variant={variant}
            className="flex-1"
            disabled={confirmDisabled}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
