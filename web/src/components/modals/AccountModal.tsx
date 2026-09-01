import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiService } from '@/lib/apiService';
import { useStore } from '@/lib/store';
import type { AccountDeviceSummary } from '@/lib/apiv1';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Called when the user picks a device to actually log into (this modal
  // never has device encryption keys, so the parent still has to drive the
  // normal device login flow -- typically by prefilling the device login
  // form with the chosen username).
  onSelectDevice: (deviceUsername: string) => void;
}

export const AccountModal = ({ isOpen, onClose, onSelectDevice }: AccountModalProps) => {
  const { t } = useTranslation(['account', 'common', 'errors']);
  const { isAccountLoggedIn, accountData, accountLogout } = useStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const [devices, setDevices] = useState<AccountDeviceSummary[] | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(false);

  const [linkUsername, setLinkUsername] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);

  const loadDevices = () => {
    setDevicesLoading(true);
    void apiService
      .getAccountDevices()
      .then(setDevices)
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t('errors:generic'));
      })
      .finally(() => setDevicesLoading(false));
  };

  useEffect(() => {
    if (isOpen && isAccountLoggedIn) {
      loadDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isAccountLoggedIn]);

  const handleLogin = () => {
    setBusy(true);
    void apiService
      .loginAccount(username, password, true)
      .then(() => {
        setPassword('');
        toast.success(t('login_success'));
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t('errors:generic'));
      })
      .finally(() => setBusy(false));
  };

  const handleRegister = () => {
    setBusy(true);
    void apiService
      .registerAccount(username, password)
      .then(() => {
        toast.success(t('register_success'));
        return apiService.loginAccount(username, password, true);
      })
      .then(() => setPassword(''))
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t('errors:generic'));
      })
      .finally(() => setBusy(false));
  };

  const handleLink = () => {
    setLinkBusy(true);
    void apiService
      .linkDeviceToAccount(linkUsername, linkPassword)
      .then(() => {
        toast.success(t('link_success'));
        setLinkUsername('');
        setLinkPassword('');
        loadDevices();
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t('errors:generic'));
      })
      .finally(() => setLinkBusy(false));
  };

  const handleUnlink = (deviceUsername: string) => {
    void apiService
      .unlinkDeviceFromAccount(deviceUsername)
      .then(() => {
        toast.success(t('unlink_success'));
        loadDevices();
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t('errors:generic'));
      });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        {!isAccountLoggedIn ? (
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t('common:login')}</TabsTrigger>
              <TabsTrigger value="register">{t('common:register')}</TabsTrigger>
            </TabsList>

            <div className="space-y-3 pt-3">
              <Input
                placeholder={t('username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
              <Input
                type="password"
                placeholder={t('common:password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <TabsContent value="login">
              <Button
                className="mt-3 w-full"
                disabled={busy || !username || !password}
                onClick={handleLogin}
              >
                {t('common:login')}
              </Button>
            </TabsContent>
            <TabsContent value="register">
              <p className="pb-2 text-sm text-muted-foreground">{t('register_hint')}</p>
              <Button
                className="w-full"
                disabled={busy || !username || !password}
                onClick={handleRegister}
              >
                {t('common:register')}
              </Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {t('signed_in_as')} <span className="font-medium">{accountData?.accountUsername}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={accountLogout}>
                {t('common:logout')}
              </Button>
            </div>

            <div>
              <div className="pb-1 text-sm font-medium">{t('your_devices')}</div>
              {devicesLoading && (
                <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
              )}
              {!devicesLoading && devices?.length === 0 && (
                <div className="text-sm text-muted-foreground">{t('no_devices')}</div>
              )}
              <ul className="space-y-1">
                {devices?.map((d) => (
                  <li
                    key={d.Username}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <button
                      className="text-left text-sm hover:underline"
                      onClick={() => onSelectDevice(d.Username)}
                    >
                      <div className="font-medium">{d.DisplayName || d.Username}</div>
                      <div className="text-xs text-muted-foreground">{d.Username}</div>
                    </button>
                    <Button variant="ghost" size="sm" onClick={() => handleUnlink(d.Username)}>
                      {t('unlink')}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t pt-3">
              <div className="pb-1 text-sm font-medium">{t('link_a_device')}</div>
              <p className="pb-2 text-xs text-muted-foreground">{t('link_hint')}</p>
              <div className="space-y-2">
                <Input
                  placeholder={t('device_username')}
                  value={linkUsername}
                  onChange={(e) => setLinkUsername(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder={t('device_password')}
                  value={linkPassword}
                  onChange={(e) => setLinkPassword(e.target.value)}
                />
                <Button
                  className="w-full"
                  disabled={linkBusy || !linkUsername || !linkPassword}
                  onClick={handleLink}
                >
                  {t('link_a_device')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
