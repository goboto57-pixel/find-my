import { Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';

interface LiveTrackingToggleProps {
  active: boolean;
  onToggle: (active: boolean) => void;
  disabled?: boolean;
  secondsToNextUpdate?: number | null;
}

export const LiveTrackingToggle = ({
  active,
  onToggle,
  disabled,
  secondsToNextUpdate,
}: LiveTrackingToggleProps) => {
  const { t } = useTranslation('dashboard');

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`rounded-full p-2 ${active ? 'bg-fmd-green/10' : 'bg-muted'}`}
        >
          <Radio
            className={`h-5 w-5 ${active ? 'text-fmd-green animate-pulse' : 'text-muted-foreground'}`}
          />
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {t('live_tracking.title')}
            {active && (
              <span className="bg-fmd-green/10 text-fmd-green rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                {t('live_tracking.active')}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {active && secondsToNextUpdate != null
              ? t('live_tracking.next_update', { seconds: secondsToNextUpdate })
              : t('live_tracking.description')}
          </div>
        </div>
      </div>

      <Switch checked={active} onCheckedChange={onToggle} disabled={disabled} />
    </div>
  );
};
