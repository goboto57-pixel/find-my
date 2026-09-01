import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Download,
  ExternalLink,
  ImageMinus,
  MapPinMinus,
  Shield,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import { apiService } from '@/lib/apiService';
import { useStore, logout, type UnitSystem } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { LoadingModal } from '@/components/modals/LoadingModal';
import { LanguageNativeSelect } from '../LanguageNativeSelect';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { userData, units } = useStore();
  const { t } = useTranslation(['settings', 'login', 'common', 'errors']);

  const [showDeleteLocationsConfirm, setShowDeleteLocationsConfirm] = useState(false);
  const [showDeletePicturesConfirm, setShowDeletePicturesConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);

  const [showExportLoading, setShowExportLoading] = useState(false);

  // ------- Security tab: device tags, TOTP, audit log -------
  const [displayName, setDisplayName] = useState('');
  const [tags, setTags] = useState('');
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [totpSetupSecret, setTotpSetupSecret] = useState('');
  const [totpSetupQr, setTotpSetupQr] = useState('');
  const [totpConfirmCode, setTotpConfirmCode] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [showDisableTotpConfirm, setShowDisableTotpConfirm] = useState(false);

  const [auditLog, setAuditLog] = useState<
    { event: string; remoteIp: string; createdAt: number }[] | null
  >(null);

  const loadSecurityTab = () => {
    if (metaLoaded) return;
    setMetaLoaded(true);

    void (async () => {
      try {
        const [meta, enabled, log] = await Promise.all([
          apiService.getDeviceMeta(),
          apiService.getTotpStatus(),
          apiService.getAuditLog(),
        ]);
        setDisplayName(meta.displayName);
        setTags(meta.tags);
        setTotpEnabled(enabled);
        setAuditLog(log);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load security settings');
      }
    })();
  };

  const handleSaveMeta = () => {
    setSavingMeta(true);
    void (async () => {
      try {
        await apiService.setDeviceMeta(displayName, tags);
        toast.info(t('security.meta_saved'));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Save failed');
      } finally {
        setSavingMeta(false);
      }
    })();
  };

  const handleBeginTotpSetup = () => {
    setTotpBusy(true);
    void (async () => {
      try {
        const { secret, qrCodePngB64 } = await apiService.beginTotpSetup();
        setTotpSetupSecret(secret);
        setTotpSetupQr(qrCodePngB64);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to start 2FA setup');
      } finally {
        setTotpBusy(false);
      }
    })();
  };

  const handleConfirmTotpSetup = () => {
    setTotpBusy(true);
    void (async () => {
      try {
        await apiService.confirmTotpSetup(totpConfirmCode);
        setTotpEnabled(true);
        setTotpSetupSecret('');
        setTotpSetupQr('');
        setTotpConfirmCode('');
        toast.info(t('security.totp_enabled'));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('errors:totp_invalid'));
      } finally {
        setTotpBusy(false);
      }
    })();
  };

  const handleDisableTotp = () => {
    setTotpBusy(true);
    void (async () => {
      try {
        await apiService.disableTotp();
        setTotpEnabled(false);
        setShowDisableTotpConfirm(false);
        toast.info(t('security.totp_disabled'));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to disable 2FA');
      } finally {
        setTotpBusy(false);
      }
    })();
  };

  const handleExport = async () => {
    if (!userData) {
      toast.error('Not logged in');
      return;
    }

    setShowExportLoading(true);

    try {
      const [locations, pictures, pushUrl] = await Promise.all([
        apiService.getLocations(),
        apiService.getPictures(),
        apiService.getPushUrl(),
      ]);

      let locationsCSV =
        'Date,Provider,Battery,Latitude,Longitude,Accuracy,Altitude,Speed,Bearing\n';

      for (const loc of locations) {
        const date = new Date(loc.time).toISOString();
        const accuracy = loc.accuracy || '';
        const altitude = loc.altitude || '';
        const speed = loc.speed || '';
        const bearing = loc.bearing || '';
        locationsCSV += `${date},${loc.provider},${loc.bat},${loc.lat},${loc.lon},${accuracy},${altitude},${speed},${bearing}\n`;
      }

      const generalInfo = {
        fmdId: userData.fmdId,
        pushUrl: pushUrl,
      };

      const JSZip = (await import('jszip')).default; // lazy-load
      const zip = new JSZip();
      zip.file('info.json', JSON.stringify(generalInfo));
      zip.file('locations.csv', locationsCSV);

      const picturesFolder = zip.folder('pictures');
      if (picturesFolder) {
        for (let i = 0; i < pictures.length; i++) {
          picturesFolder.file(`${i}.png`, pictures[i], { base64: true });
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });

      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fmd-export-${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    }

    setShowExportLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('common:settings')}</DialogTitle>
        </DialogHeader>

        <Tabs
          defaultValue="settings"
          className="w-full"
          onValueChange={(v) => v === 'security' && loadSecurityTab()}
        >
          <TabsList className="mb-6 w-full">
            <TabsTrigger value="settings" className="flex-1">
              {t('general')}
            </TabsTrigger>

            <TabsTrigger value="security" className="flex-1">
              {t('security.tab')}
            </TabsTrigger>

            <TabsTrigger value="about" className="flex-1">
              {t('about')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            <div>
              <h3 className="text-fmd-green mb-3 font-semibold">{t('theme')}</h3>
              <ThemeToggle />
            </div>

            <div>
              <h3 className="text-fmd-green mb-3 font-semibold">{t('units')}</h3>
              <ToggleGroup
                type="single"
                value={units}
                onValueChange={(value) =>
                  value && useStore.setState({ units: value as UnitSystem })
                }
              >
                <ToggleGroupItem value="metric">{t('units_metric')}</ToggleGroupItem>
                <ToggleGroupItem value="imperial">{t('units_imperial')}</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div>
              <h3 className="text-fmd-green mb-3 font-semibold">{t('language.title')}</h3>
              <LanguageNativeSelect />
            </div>

            <div>
              <h3 className="text-fmd-green mb-3 font-semibold">{t('account')}</h3>
              <div className="flex flex-wrap gap-3 mb-3">
                <Button variant="secondary" onClick={() => void handleExport()}>
                  <Download className="h-4 w-4" />
                  {t('export_data')}
                </Button>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="destructive" onClick={() => setShowDeleteLocationsConfirm(true)}>
                  <MapPinMinus className="h-4 w-4" />
                  {t('delete_locations.button')}
                </Button>

                <Button variant="destructive" onClick={() => setShowDeletePicturesConfirm(true)}>
                  <ImageMinus className="h-4 w-4" />
                  {t('delete_pictures.button')}
                </Button>

                <Button variant="destructive" onClick={() => setShowDeleteAccountConfirm(true)}>
                  <Trash2 className="h-4 w-4" />
                  {t('delete_account')}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="max-h-96 space-y-6 overflow-y-auto">
            <div>
              <h3 className="text-fmd-green mb-3 font-semibold">{t('security.device_meta')}</h3>
              <div className="space-y-2">
                <Input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('security.display_name_placeholder')}
                />
                <Input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder={t('security.tags_placeholder')}
                />
                <Button variant="secondary" disabled={savingMeta} onClick={handleSaveMeta}>
                  {t('security.save')}
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-fmd-green mb-3 font-semibold">{t('security.totp_title')}</h3>

              {totpEnabled === null && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('security.loading')}</p>
              )}

              {totpEnabled === true && (
                <div className="flex items-center gap-3">
                  <ShieldCheck className="text-fmd-green h-5 w-5" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t('security.totp_status_enabled')}
                  </span>
                  <Button
                    variant="destructive"
                    disabled={totpBusy}
                    onClick={() => setShowDisableTotpConfirm(true)}
                  >
                    {t('security.totp_disable')}
                  </Button>
                </div>
              )}

              {totpEnabled === false && !totpSetupQr && (
                <Button variant="secondary" disabled={totpBusy} onClick={handleBeginTotpSetup}>
                  {t('security.totp_enable')}
                </Button>
              )}

              {totpEnabled === false && totpSetupQr && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {t('security.totp_scan_instruction')}
                  </p>
                  <img
                    src={`data:image/png;base64,${totpSetupQr}`}
                    alt="TOTP QR code"
                    className="h-40 w-40"
                  />
                  <p className="font-mono text-xs break-all text-gray-600 dark:text-gray-400">
                    {totpSetupSecret}
                  </p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={totpConfirmCode}
                    onChange={(e) => setTotpConfirmCode(e.target.value)}
                    placeholder={t('security.totp_code_placeholder')}
                  />
                  <Button variant="secondary" disabled={totpBusy} onClick={handleConfirmTotpSetup}>
                    {t('security.totp_confirm')}
                  </Button>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-fmd-green mb-3 font-semibold">{t('security.audit_log')}</h3>
              {!auditLog && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('security.loading')}</p>
              )}
              {auditLog && auditLog.length === 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('security.audit_log_empty')}
                </p>
              )}
              {auditLog && auditLog.length > 0 && (
                <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  {auditLog.map((entry, i) => (
                    <li key={i} className="flex justify-between gap-4 border-b border-gray-100 py-1 dark:border-gray-800">
                      <span>{t(`security.audit_events.${entry.event}`, entry.event)}</span>
                      <span className="text-gray-500 dark:text-gray-500">
                        {new Date(entry.createdAt * 1000).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="about"
            className="max-h-96 space-y-4 overflow-y-auto text-gray-900 dark:text-white"
          >
            <div>
              <h3 className="text-fmd-green font-semibold">FMD Server</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('about_text')}</p>
            </div>

            <div>
              <h3 className="text-fmd-green font-semibold">Links</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  <a
                    href="https://gitlab.com/fmd-foss/fmd-server"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-fmd-green dark:hover:text-fmd-green flex items-center gap-2 text-gray-700 dark:text-gray-300"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('login:source_code')}
                  </a>
                </li>
                <li>
                  <a
                    href="https://fmd-foss.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-fmd-green dark:hover:text-fmd-green flex items-center gap-2 text-gray-700 dark:text-gray-300"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('login:project_website')}
                  </a>
                </li>
                <li>
                  <Link
                    to="/privacy"
                    className="hover:text-fmd-green dark:hover:text-fmd-green flex items-center gap-2 text-gray-700 dark:text-gray-300"
                  >
                    <Shield className="h-4 w-4" />
                    {t('login:privacy_notice')}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-fmd-green font-semibold">FMD Android</h3>
              <a
                href="https://f-droid.org/packages/de.nulide.findmydevice/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block"
              >
                <img src="./fdroid-badge.png" alt="Get it on F-Droid" className="h-16 w-auto" />
              </a>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <LoadingModal isOpen={showExportLoading} message={t('export_data_loading_message')} />

      <ConfirmModal
        isOpen={showDeleteLocationsConfirm}
        onCancel={() => setShowDeleteLocationsConfirm(false)}
        onConfirm={() => {
          void (async () => {
            if (!userData) return;

            try {
              await apiService.deleteAllLocations();
              useStore.setState({ locations: [], currentLocationIndex: 0 });

              setShowDeleteLocationsConfirm(false);
              toast.info(t('delete_locations.success'));
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Delete failed');
            }
          })();
        }}
        title={t('delete_locations.title')}
        message={t('delete_locations.description')}
        confirmText={t('delete_locations.button')}
      />

      <ConfirmModal
        isOpen={showDeletePicturesConfirm}
        onCancel={() => setShowDeletePicturesConfirm(false)}
        onConfirm={() => {
          void (async () => {
            if (!userData) return;

            try {
              await apiService.deleteAllPictures();
              useStore.setState({ pictures: [] });

              setShowDeletePicturesConfirm(false);
              toast.info(t('delete_pictures.success'));
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Delete failed');
            }
          })();
        }}
        title={t('delete_pictures.title')}
        message={t('delete_pictures.description')}
        confirmText={t('delete_pictures.button')}
      />

      <ConfirmModal
        isOpen={showDisableTotpConfirm}
        onCancel={() => setShowDisableTotpConfirm(false)}
        onConfirm={handleDisableTotp}
        title={t('security.totp_disable_title')}
        message={t('security.totp_disable_description')}
        confirmText={t('security.totp_disable')}
      />

      <ConfirmModal
        isOpen={showDeleteAccountConfirm}
        onCancel={() => setShowDeleteAccountConfirm(false)}
        onConfirm={() => {
          void (async () => {
            if (!userData) return;

            try {
              await apiService.deleteAccount();
              await logout();
              setShowDeleteAccountConfirm(false);
              onClose();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Delete failed');
            }
          })();
        }}
        title={t('delete_account_title')}
        message={t('delete_account_description')}
        confirmText={t('delete_account')}
      />
    </Dialog>
  );
};
