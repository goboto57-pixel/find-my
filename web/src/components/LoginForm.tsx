import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { getVersion, TotpRequiredError } from '@/lib/api';
import { apiService } from '@/lib/apiService';
import { hashPasswordForLogin } from '@/lib/crypto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/PasswordInput';
import { Checkbox } from '@/components/Checkbox';
import { WebCryptoWarningModal } from './modals/WebCryptoWarningModal';
import { LanguageNativeSelect } from './LanguageNativeSelect';
import { useStore } from '@/lib/store';

const SLOW_LOGIN_THRESHOLD_MS = 10_000;
const SLOW_LOGIN_TOAST_DURATION_MS = 30_000;

interface LoginFormProps {
  onSwitchDeviceClick?: () => void;
}

export const LoginForm = ({ onSwitchDeviceClick }: LoginFormProps = {}) => {
  const { t } = useTranslation(['login', 'errors']);

  const prefillDeviceUsername = useStore((s) => s.prefillDeviceUsername);

  const [fmdId, setFmdId] = useState(prefillDeviceUsername ?? '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState('');
  // Set once the server responds "2FA required" for this login attempt.
  // We keep the already-hashed password around so submitting the code
  // doesn't require the user to retype their password.
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [pendingPasswordHash, setPendingPasswordHash] = useState('');

  useEffect(() => {
    if (prefillDeviceUsername) {
      useStore.setState({ prefillDeviceUsername: null });
    }
    // Only run once on mount to consume the transient prefill value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const ver = await getVersion();
        setVersion(ver);
      } catch {
        // Failed to fetch version, ignore
      }
    })();
  }, []);

  // Hash the password on a Web Worker background thread
  const hashPasswordInWorker = (password: string, salt: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../workers/passwordHashing.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (ev) => {
        resolve(ev.data as string);
        worker.terminate();
      };

      worker.onerror = (err) => {
        reject(new Error(err.message));
        worker.terminate();
      };

      worker.postMessage([password, salt]);
    });

  // Send the login request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let passwordHash = pendingPasswordHash;

      if (!totpRequired) {
        const salt = await apiService.getSalt(fmdId);

        if (!salt) {
          toast.error(t('errors:account_not_found'));
          setLoading(false);
          return;
        }

        // When JavaScript JIT is disabled (Jitless mode), password hashing is very slow (>= 2 mins)
        // https://gitlab.com/fmd-foss/fmd-server/-/issues/142
        const timeOut = setTimeout(() => {
          const msg = t(`login_slow`);
          toast.warning(msg, { duration: SLOW_LOGIN_TOAST_DURATION_MS });
        }, SLOW_LOGIN_THRESHOLD_MS);

        if (window.Worker) {
          // We need to launch the hashing in a background thread.
          // Otherwise, the timeout won't run, since the UI thread is blocked by the hashing.
          passwordHash = await hashPasswordInWorker(password, salt);
        } else {
          // Browser does not support Web Workers
          toast.warning(
            'Web Workers are not supported by this browser. Hashing password on main thread.'
          );
          passwordHash = hashPasswordForLogin(password, salt);
        }

        clearTimeout(timeOut);
        setPendingPasswordHash(passwordHash);
      }

      await apiService.login(fmdId, password, passwordHash, rememberMe, totpCode || undefined);
    } catch (error) {
      if (error instanceof TotpRequiredError) {
        setTotpRequired(true);
        if (totpCode) {
          // A code was already submitted and rejected -- clear it so the
          // input doesn't silently look accepted while asking to retry.
          toast.error(t('errors:totp_invalid'));
          setTotpCode('');
        }
        setLoading(false);
        return;
      }
      toast.error(error instanceof Error ? error.message : t('errors:login_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="from-fmd-green/5 via-background to-background flex min-h-full flex-col bg-gradient-to-b px-4">
      <div className="flex justify-end pt-8">
        <LanguageNativeSelect />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-8">
        <div className="w-full max-w-md rounded-xl border border-border bg-background p-8 shadow-lg shadow-black/[0.03] dark:shadow-black/20">
          <div className="mb-6 flex flex-col items-center gap-3">
            <span className="bg-fmd-green/10 flex h-14 w-14 items-center justify-center rounded-2xl">
              <img src="./icon.svg" alt="FMD" width="30" height="30" className="text-fmd-green" />
            </span>
            <h1 className="text-center text-2xl font-bold tracking-tight text-foreground">
              FMD Server
            </h1>
          </div>

          <p className="mb-2 text-center text-sm text-muted-foreground">{t('subtitle')}</p>
          <p className="mb-8 text-center text-sm text-muted-foreground">
            {t('setup_instruction_1')}{' '}
            <a
              href="https://f-droid.org/packages/de.nulide.findmydevice/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-fmd-green text-foreground underline decoration-border underline-offset-2 transition-colors duration-200"
            >
              {t('setup_instruction_2')}
            </a>{' '}
            {t('setup_instruction_3')}
          </p>

          {/* https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete */}
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            {!totpRequired ? (
              <>
                <Input
                  type="text"
                  value={fmdId}
                  onChange={(e) => setFmdId(e.target.value)}
                  placeholder={t('username_placeholder')}
                  autoComplete="username"
                  required
                />

                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('password_placeholder')}
                  autoComplete="current-password"
                  required
                />

                <Checkbox
                  id="rememberMe"
                  label={t('remember_me')}
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
              </>
            ) : (
              <>
                <p className="text-center text-sm text-muted-foreground">{t('totp_prompt')}</p>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder={t('totp_code_placeholder')}
                  autoFocus
                  required
                  className="text-center font-mono text-lg tracking-[0.3em]"
                />
                <button
                  type="button"
                  className="hover:text-fmd-green block w-full text-center text-sm text-muted-foreground underline transition-colors duration-200"
                  onClick={() => {
                    setTotpRequired(false);
                    setTotpCode('');
                    setPendingPasswordHash('');
                  }}
                >
                  {t('totp_back')}
                </button>
              </>
            )}

            <Button type="submit" disabled={loading} size="lg" className="w-full text-lg">
              {loading ? t('logging_in') : t('log_in')}
            </Button>

            {!totpRequired && onSwitchDeviceClick && (
              <button
                type="button"
                className="hover:text-fmd-green block w-full text-center text-sm text-muted-foreground underline transition-colors duration-200"
                onClick={onSwitchDeviceClick}
              >
                {t('switch_device_account')}
              </button>
            )}
          </form>

          <WebCryptoWarningModal />
        </div>
      </div>

      <footer className="pb-4 text-center text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <a
            href="https://fmd-foss.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-fmd-green text-muted-foreground transition-colors duration-200"
          >
            {t('project_website')}
          </a>
          <span>·</span>
          <a
            href="https://gitlab.com/fmd-foss/fmd-server/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-fmd-green text-muted-foreground transition-colors duration-200"
          >
            {t('source_code')}
          </a>
          <span>·</span>
          <Link
            to="/privacy"
            className="hover:text-fmd-green text-muted-foreground transition-colors duration-200"
          >
            {t('privacy_notice')}
          </Link>
        </div>

        <div className="mt-2 h-4">
          {version && (
            <a
              href="https://gitlab.com/fmd-foss/fmd-server/-/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-fmd-green font-mono text-xs text-muted-foreground transition-colors duration-200"
            >
              v{version}
            </a>
          )}
        </div>
      </footer>
    </div>
  );
};
