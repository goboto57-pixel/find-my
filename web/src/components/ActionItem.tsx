import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

interface ActionItemProps {
  icon: LucideIcon;
  title: string;
  description: string | null;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
}

export const ActionItem = ({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
  variant = 'default',
}: ActionItemProps) => {
  const isDestructive = variant === 'destructive';

  return (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className="h-auto w-full justify-start gap-3 rounded-none border-b border-border p-4 last:border-b-0 hover:bg-accent"
    >
      <div
        className={cn(
          'rounded-lg p-2',
          isDestructive ? 'bg-destructive/10' : 'bg-muted'
        )}
      >
        <Icon
          className={cn(
            'h-5 w-5',
            isDestructive ? 'text-destructive' : 'text-muted-foreground'
          )}
        />
      </div>
      <div className="flex-1 text-left">
        <div
          className={cn(
            'font-medium',
            isDestructive ? 'text-destructive' : 'text-foreground'
          )}
        >
          {title}
        </div>
        {description && (
          <div className="pt-1 text-sm whitespace-normal text-muted-foreground">
            {description}
          </div>
        )}
      </div>
    </Button>
  );
};
