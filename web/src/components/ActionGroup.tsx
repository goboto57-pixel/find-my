import { useState } from 'react';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { ActionItem } from '@/components/ActionItem';

interface ActionGroupItem {
  icon: LucideIcon;
  title: string;
  description: string | null;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
}

interface ActionGroupProps {
  title: string;
  description?: string | null;
  icon: LucideIcon;
  actions: ActionGroupItem[];
  disabled?: boolean;
}

export const ActionGroup = ({
  title,
  description,
  icon: Icon,
  actions,
  disabled,
}: ActionGroupProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-border">
      <Button
        variant="ghost"
        onClick={() => setOpen((prev) => !prev)}
        className="h-auto w-full justify-start gap-3 rounded-lg border-border p-4 last:border-b-0 hover:bg-accent"
      >
        <div className={cn('rounded-lg p-2', 'bg-muted')}>
          <Icon className={cn('h-5 w-5', 'text-muted-foreground')} />
        </div>

        <div className="flex-1 text-left">
          <div className={cn('font-medium', 'text-foreground')}>{title}</div>
          {description && (
            <div className="pt-1 text-sm whitespace-normal text-muted-foreground">
              {description}
            </div>
          )}
        </div>

        {open ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </Button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          open ? 'max-h-250' : 'max-h-0'
        )}
      >
        <div className="border-t border-border">
          {actions.map((action) => (
            <ActionItem
              icon={action.icon}
              title={action.title}
              description={action.description}
              onClick={action.onClick}
              disabled={disabled}
              variant={action.variant}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
