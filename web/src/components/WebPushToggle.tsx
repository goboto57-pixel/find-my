import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useWebPush } from '@/hooks/useWebPush';

export const WebPushToggle = () => {
  const { t } = useTranslation('settings');
  const { enabled, loading, error, subscribe, unsubscribe, supported } = useWebPush();

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">{t('notifications_unsupported')}</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t('notifications_description')}</p>
        <Button
          variant={enabled ? 'outline' : 'default'}
          size="sm"
          disabled={loading}
          onClick={() => void (enabled ? unsubscribe() : subscribe())}
        >
          {enabled ? t('notifications_disable') : t('notifications_enable')}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};
