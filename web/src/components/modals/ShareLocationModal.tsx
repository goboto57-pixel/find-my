import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Copy, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useStore } from '@/lib/store';
import { apiService } from '@/lib/apiService';
import { encryptForShareLink } from '@/lib/crypto';

interface ShareLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DURATION_OPTIONS = [
  { label: '1h', seconds: 60 * 60 },
  { label: '6h', seconds: 6 * 60 * 60 },
  { label: '24h', seconds: 24 * 60 * 60 },
  { label: '7d', seconds: 7 * 24 * 60 * 60 },
];

export const ShareLocationModal = ({ isOpen, onClose }: ShareLocationModalProps) => {
  const { t } = useTranslation('common');
  const { locations, currentLocationIndex } = useStore();

  const [durationSeconds, setDurationSeconds] = useState(DURATION_OPTIONS[1].seconds);
  const [busy, setBusy] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [links, setLinks] = useState<
    { token: string; expiresAt: number; createdAt: number }[] | null
  >(null);

  useEffect(() => {
    if (!isOpen) return;
    setGeneratedUrl('');
    void apiService
      .listShareLinks()
      .then(setLinks)
      .catch(() => setLinks([]));
  }, [isOpen]);

  const handleGenerate = () => {
    const location = locations[currentLocationIndex];
    if (!location) {
      toast.error(t('share_no_location'));
      return;
    }

    setBusy(true);
    void (async () => {
      try {
        const { ciphertextBase64, keyBase64Url } = await encryptForShareLink(
          JSON.stringify(location)
        );
        const { token } = await apiService.createShareLink(ciphertextBase64, durationSeconds);

        // Resolve relative to the current page so this also works when the
        // server is hosted under a subdirectory (see main.tsx's getBasePath).
        const base = window.location.href.replace(/[^/]*$/, '');
        const url = new URL(`share?token=${token}`, base);
        url.hash = keyBase64Url;

        setGeneratedUrl(url.toString());
        const updated = await apiService.listShareLinks();
        setLinks(updated);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to create share link');
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(generatedUrl);
    toast.success(t('share_link_copied'));
  };

  const handleRevoke = (token: string) => {
    void (async () => {
      try {
        await apiService.revokeShareLink(token);
        setLinks((prev) => prev?.filter((l) => l.token !== token) ?? null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to revoke link');
      }
    })();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('share_location')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('share_description')}</p>

          <ToggleGroup
            type="single"
            value={String(durationSeconds)}
            onValueChange={(value) => value && setDurationSeconds(Number(value))}
          >
            {DURATION_OPTIONS.map((opt) => (
              <ToggleGroupItem key={opt.seconds} value={String(opt.seconds)}>
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Button onClick={handleGenerate} disabled={busy} className="w-full">
            {t('share_generate')}
          </Button>

          {generatedUrl && (
            <div className="flex items-center gap-2 rounded-md border border-border p-2">
              <span className="flex-1 truncate font-mono text-xs">{generatedUrl}</span>
              <Button variant="ghost" size="icon-sm" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}

          {links && links.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-foreground">
                {t('share_active_links')}
              </h4>
              <ul className="space-y-1">
                {links.map((l) => (
                  <li
                    key={l.token}
                    className="flex items-center justify-between gap-2 border-b border-border py-1 text-sm text-muted-foreground"
                  >
                    <span>
                      {t('share_expires')} {new Date(l.expiresAt * 1000).toLocaleString()}
                    </span>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleRevoke(l.token)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
