import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storeKeys, clearKeys, getKeys } from '@/lib/keystore';
import type { Location } from '@/lib/api';
import type { Language } from '@/lib/i18n';

export type Theme = 'light' | 'dark' | 'system' | 'scheduled';
export type UnitSystem = 'metric' | 'imperial';
export type AccentColor = 'emerald' | 'blue' | 'violet' | 'amber' | 'rose';

export const ACCENT_COLORS: Record<AccentColor, string> = {
  emerald: 'oklch(0.637 0.127 166.5)', // default FMD signal color
  blue: 'oklch(0.623 0.155 253.0)',
  violet: 'oklch(0.606 0.19 293.0)',
  amber: 'oklch(0.72 0.15 70.0)',
  rose: 'oklch(0.62 0.19 15.0)',
};
export type { Language } from '@/lib/i18n';

interface UserData {
  fmdId: string;
  sessionToken: string;
  rsaEncKey: CryptoKey;
  rsaSigKey: CryptoKey;
  fingerprint: string;
}

// Account is a separate, web-only identity used to group/switch between
// devices. It intentionally carries no encryption keys -- it never grants
// access to a device's E2E-encrypted data by itself.
interface AccountData {
  accountUsername: string;
  accountSessionToken: string;
}

interface AppState {
  isLoggedIn: boolean;
  userData: UserData | null;
  wasAuthRestoreTried: boolean;

  isAccountLoggedIn: boolean;
  accountData: AccountData | null;
  wasAccountAuthRestoreTried: boolean;
  // Transient (not persisted): set when the user picks a device from the
  // account device switcher, so LoginForm can prefill the username. The
  // account never has the device's password, so the user still has to
  // type it in to complete the actual device login.
  prefillDeviceUsername: string | null;
  theme: Theme;
  // Used only when theme === 'scheduled'. 24h "HH:mm" strings.
  darkStart: string;
  darkEnd: string;
  accentColor: AccentColor;
  units: UnitSystem;
  language: Language;
  pushUrl: string | null;
  isPushUrlLoading: boolean;

  locations: Location[];
  currentLocationIndex: number;
  isLocationsLoading: boolean;

  pictures: string[];
  isPicturesLoading: boolean;

  setUserData: (data: UserData, persistent: boolean) => Promise<void>;
  logout: () => Promise<void>;
  restoreAuth: () => Promise<void>;
  setTheme: (theme: Theme) => void;
  setThemeSchedule: (darkStart: string, darkEnd: string) => void;
  setAccentColor: (color: AccentColor) => void;
  applyThemeNow: () => void;
  setLanguage: (language: Language) => void;

  setAccountData: (data: AccountData, persistent: boolean) => Promise<void>;
  accountLogout: () => void;
  restoreAccountAuth: () => void;
}

const KEY_AUTH = 'fmd-auth';
const KEY_ACCOUNT_AUTH = 'fmd-account-auth';
const KEY_SETTINGS = 'fmd-settings';

// Returns true if "now" (HH:mm) falls within [start, end), wrapping past midnight
// when start > end (e.g. 20:00 -> 07:00).
function isWithinDarkWindow(start: string, end: string, now: Date = new Date()): boolean {
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const startM = toMinutes(start);
  const endM = toMinutes(end);
  const nowM = now.getHours() * 60 + now.getMinutes();

  if (startM === endM) return false;
  if (startM < endM) {
    return nowM >= startM && nowM < endM;
  }
  // Wraps past midnight
  return nowM >= startM || nowM < endM;
}

function applyThemeToDom(theme: Theme, darkStart: string, darkEnd: string) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
    (theme === 'scheduled' && isWithinDarkWindow(darkStart, darkEnd));

  document.documentElement.classList.toggle('dark', isDark);
}

function applyAccentToDom(color: AccentColor) {
  const value = ACCENT_COLORS[color];
  document.documentElement.style.setProperty('--primary', value);
  document.documentElement.style.setProperty('--ring', value);
}

// Re-check the schedule every minute so the theme flips live without a reload.
if (typeof window !== 'undefined') {
  setInterval(() => {
    const { theme, darkStart, darkEnd } = useStore.getState();
    if (theme === 'scheduled') {
      applyThemeToDom(theme, darkStart, darkEnd);
    }
  }, 60 * 1000);
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      userData: null,
      wasAuthRestoreTried: false,
      isAccountLoggedIn: false,
      accountData: null,
      wasAccountAuthRestoreTried: false,
      prefillDeviceUsername: null,
      theme: 'system',
      darkStart: '20:00',
      darkEnd: '07:00',
      accentColor: 'emerald',
      units: 'metric',
      language: 'en',
      pushUrl: null,
      locations: [],
      currentLocationIndex: 0,
      pictures: [],
      isPushUrlLoading: false,
      isLocationsLoading: false,
      isPicturesLoading: false,

      setUserData: async (data: UserData, persistent: boolean) => {
        if (persistent) {
          await storeKeys({
            rsaEncKey: data.rsaEncKey,
            rsaSigKey: data.rsaSigKey,
          });

          localStorage.setItem(
            KEY_AUTH,
            JSON.stringify({
              fmdId: data.fmdId,
              sessionToken: data.sessionToken,
              fingerprint: data.fingerprint,
            })
          );
        }

        set({
          userData: data,
          isLoggedIn: true,
        });
      },

      logout: async () => {
        localStorage.removeItem(KEY_AUTH);
        await clearKeys();
        set({
          userData: null,
          isLoggedIn: false,
          pushUrl: null,
          locations: [],
          pictures: [],
        });
      },

      restoreAuth: async () => {
        try {
          const authData = localStorage.getItem(KEY_AUTH);
          if (!authData) return;

          const parsed = JSON.parse(authData) as {
            fmdId: string;
            sessionToken: string;
            fingerprint: string;
          };
          const keys = await getKeys();

          if (keys) {
            set({
              userData: {
                fmdId: parsed.fmdId,
                sessionToken: parsed.sessionToken,
                rsaEncKey: keys.rsaEncKey,
                rsaSigKey: keys.rsaSigKey,
                fingerprint: parsed.fingerprint,
              },
              isLoggedIn: true,
            });
          }
        } catch {
          localStorage.removeItem(KEY_AUTH);
          await clearKeys();
        } finally {
          set({ wasAuthRestoreTried: true });
        }
      },

      setAccountData: async (data: AccountData, persistent: boolean) => {
        if (persistent) {
          localStorage.setItem(KEY_ACCOUNT_AUTH, JSON.stringify(data));
        }
        set({ accountData: data, isAccountLoggedIn: true });
      },

      accountLogout: () => {
        localStorage.removeItem(KEY_ACCOUNT_AUTH);
        set({ accountData: null, isAccountLoggedIn: false });
      },

      restoreAccountAuth: () => {
        try {
          const raw = localStorage.getItem(KEY_ACCOUNT_AUTH);
          if (!raw) return;
          const parsed = JSON.parse(raw) as AccountData;
          set({ accountData: parsed, isAccountLoggedIn: true });
        } catch {
          localStorage.removeItem(KEY_ACCOUNT_AUTH);
        } finally {
          set({ wasAccountAuthRestoreTried: true });
        }
      },

      setTheme: (theme: Theme) => {
        set({ theme });
        applyThemeToDom(theme, useStore.getState().darkStart, useStore.getState().darkEnd);
      },

      setThemeSchedule: (darkStart: string, darkEnd: string) => {
        set({ darkStart, darkEnd });
        if (useStore.getState().theme === 'scheduled') {
          applyThemeToDom('scheduled', darkStart, darkEnd);
        }
      },

      setAccentColor: (color: AccentColor) => {
        set({ accentColor: color });
        applyAccentToDom(color);
      },

      applyThemeNow: () => {
        const { theme, darkStart, darkEnd } = useStore.getState();
        applyThemeToDom(theme, darkStart, darkEnd);
      },

      setLanguage: (language: Language) => {
        set({ language });
        // Language change is synced from main.tsx Root component
      },
    }),

    // Persist some of the state
    // https://github.com/pmndrs/zustand/blob/main/docs/integrations/persisting-store-data.md
    {
      name: KEY_SETTINGS,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        darkStart: state.darkStart,
        darkEnd: state.darkEnd,
        accentColor: state.accentColor,
        units: state.units,
        language: state.language,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply persisted theme/accent to the DOM as soon as the store rehydrates,
        // so a saved 'scheduled' theme or custom accent takes effect on load.
        if (state) {
          applyThemeToDom(state.theme, state.darkStart, state.darkEnd);
          applyAccentToDom(state.accentColor);
        }
      },
    }
  )
);

export const logout = () => useStore.getState().logout();
