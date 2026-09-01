import { useState, useEffect } from 'react';
import { LockKeyhole, Radio, ShieldCheck, Smartphone, Sparkles, Zap } from 'lucide-react';
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

const SLOW_LOGIN_THRESHOLD_MS = 10_000;
const SLOW_LOGIN_TOAST_DURATION_MS = 30_000;

export const LoginForm = () => {
  const { t } = useTranslation(['login', 'errors']);
  const [fmdId, setFmdId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState('');
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [pendingPasswordHash, setPendingPasswordHash] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const ver = await getVersion();
        setVersion(ver);
      } catch {
        // The version label is optional on the login screen.
      }
    })();
  }, []);

  const hashPasswordInWorker = (passwordValue: string, salt: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../workers/passwordHashing.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (event) => {
        resolve(event.data as string);
        worker.terminate();
      };
      worker.onerror = (error) => {
        reject(new Error(error.message));
        worker.terminate();
      };
      worker.postMessage([passwordValue, salt]);
    });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
        const timeout = setTimeout(
          () => toast.warning(t('login_slow'), { duration: SLOW_LOGIN_TOAST_DURATION_MS }),
          SLOW_LOGIN_THRESHOLD_MS
        );
        if (window.Worker) {
          passwordHash = await hashPasswordInWorker(password, salt);
        } else {
          toast.warning(
            'Web Workers are not supported by this browser. Hashing password on main thread.'
          );
          passwordHash = hashPasswordForLogin(password, salt);
        }
        clearTimeout(timeout);
        setPendingPasswordHash(passwordHash);
      }
      await apiService.login(fmdId, password, passwordHash, rememberMe, totpCode || undefined);
    } catch (error) {
      if (error instanceof TotpRequiredError) {
        setTotpRequired(true);
        if (totpCode) {
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
    <div className="login-page">
      <div className="login-topbar">
        <div className="login-brand">
          <span className="brand-mark">
            <Radio className="h-5 w-5" />
          </span>
          <span>
            FMD <em>OS</em>
          </span>
        </div>
        <LanguageNativeSelect />
      </div>
      <div className="login-content">
        <section className="login-story">
          <div className="eyebrow">
            <span className="live-dot" />
            Private device recovery
          </div>
          <h1>
            Know where your
            <br />
            <span>device is.</span>
          </h1>
          <p className="login-lede">{t('subtitle')}</p>
          <div className="story-points">
            <div>
              <span className="story-icon">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <strong>Encrypted by design</strong>
                <small>Your location history is protected by a local key.</small>
              </div>
            </div>
            <div>
              <span className="story-icon">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <strong>Fast, direct commands</strong>
                <small>Locate, ring or secure your phone from anywhere.</small>
              </div>
            </div>
            <div>
              <span className="story-icon">
                <Smartphone className="h-4 w-4" />
              </span>
              <div>
                <strong>Open source companion</strong>
                <small>Works with the FMD Android app from F-Droid.</small>
              </div>
            </div>
          </div>
          <div className="story-orbit orbit-one" />
          <div className="story-orbit orbit-two" />
          <div className="story-grid" />
        </section>
        <section className="login-card">
          <div className="login-card-top">
            <div className="login-card-icon">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <span className="secure-chip">
              <span className="live-dot" />
              Secure sign in
            </span>
          </div>
          <h2>{totpRequired ? 'Verify your identity' : 'Welcome back'}</h2>
          <p className="login-card-copy">
            {totpRequired
              ? t('totp_prompt')
              : 'Sign in to manage your device and view its latest signal.'}
          </p>
          {!totpRequired && (
            <p className="login-instruction">
              {t('setup_instruction_1')}{' '}
              <a
                href="https://f-droid.org/packages/de.nulide.findmydevice/"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('setup_instruction_2')}
              </a>{' '}
              {t('setup_instruction_3')}
            </p>
          )}
          <form onSubmit={(event) => void handleSubmit(event)} className="login-form">
            {!totpRequired ? (
              <>
                <label className="login-label" htmlFor="fmd-username">
                  Username
                </label>
                <Input
                  id="fmd-username"
                  type="text"
                  value={fmdId}
                  onChange={(event) => setFmdId(event.target.value)}
                  placeholder={t('username_placeholder')}
                  autoComplete="username"
                  required
                />
                <label className="login-label" htmlFor="fmd-password">
                  Password
                </label>
                <PasswordInput
                  id="fmd-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
                <label className="login-label" htmlFor="fmd-totp">
                  Authenticator code
                </label>
                <Input
                  id="fmd-totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value)}
                  placeholder={t('totp_code_placeholder')}
                  autoFocus
                  required
                />
                <button
                  type="button"
                  className="login-back"
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
            <Button type="submit" disabled={loading} size="lg" className="login-submit">
              {loading ? t('logging_in') : totpRequired ? 'Verify and continue' : t('log_in')}
              <Sparkles className="h-4 w-4" />
            </Button>
          </form>
          <div className="login-card-footer">
            <span>
              <span className="status-check">✓</span> No password leaves your browser
            </span>
            {version && <span className="version-label">v{version}</span>}
          </div>
          <WebCryptoWarningModal />
        </section>
      </div>
      <footer className="login-footer">
        <span>FMD OS · Open source device recovery</span>
        <span>
          <a href="https://fmd-foss.org" target="_blank" rel="noopener noreferrer">
            {t('project_website')}
          </a>
          <span>·</span>
          <a
            href="https://gitlab.com/fmd-foss/fmd-server/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('source_code')}
          </a>
          <span>·</span>
          <Link to="/privacy">{t('privacy_notice')}</Link>
        </span>
      </footer>
    </div>
  );
};
