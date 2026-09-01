import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storeKeys, clearKeys, getKeys } from '@/lib/keystore';
import type { Location } from '@/lib/api';
import type { Language } from '@/lib/i18n';

export type Theme = 'light' | 'dark' | 'system';
export type UnitSystem = 'metric' | 'imperial';
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
  setLanguage: (language: Language) => void;

  setAccountData: (data: AccountData, persistent: boolean) => Promise<void>;
  accountLogout: () => void;
  restoreAccountAuth: () => void;
}

const KEY_AUTH = 'fmd-auth';
const KEY_ACCOUNT_AUTH = 'fmd-account-auth';
const KEY_SETTINGS = 'fmd-settings';

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

        const isDark =
          theme === 'dark' ||
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

        document.documentElement.classList.toggle('dark', isDark);
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
        units: state.units,
        language: state.language,
      }),
    }
  )
);

export const logout = () => useStore.getState().logout();
