import { useStore } from './store';

export const HTTP = {
  POST: 'POST',
  PUT: 'PUT',
  GET: 'GET',
} as const;

export interface Location {
  lat: number;
  lon: number;
  bat: number;
  date: number;
  time: string;
  provider: string;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  bearing?: number;
}

export const JSON_HEADER = { 'Content-Type': 'application/json' } as const;

export const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60;

// Thrown by requestObject when the server responds 428 Precondition Required,
// which this API uses specifically to mean "this account has 2FA enabled,
// retry the request with a TOTP code".
export class TotpRequiredError extends Error {
  constructor() {
    super('2FA code required');
    this.name = 'TotpRequiredError';
  }
}

export abstract class BaseApiService {
  abstract getSalt(userName: string): Promise<string>;
  abstract login(
    userName: string,
    password: string,
    passwordAuthHash: string,
    rememberMe: boolean,
    totpCode?: string
  ): Promise<void>;
  abstract logout(): Promise<void>;
  abstract getPushUrl(): Promise<string>;

  abstract deleteAccount(): Promise<void>;
  abstract deleteAllLocations(): Promise<void>;
  abstract deleteAllPictures(): Promise<void>;

  abstract sendCommand(command: string): Promise<void>;

  abstract getLocations(): Promise<Location[]>;
  abstract getPictures(): Promise<string[]>;

  abstract getTileServerUrl(): Promise<string>;

  // Feature 5: device tags / display name (server-side metadata only)
  abstract getDeviceMeta(): Promise<{ displayName: string; tags: string }>;
  abstract setDeviceMeta(displayName: string, tags: string): Promise<void>;

  // Feature 6: audit log
  abstract getAuditLog(): Promise<{ event: string; remoteIp: string; createdAt: number }[]>;

  // Feature 7: TOTP (2FA)
  abstract getTotpStatus(): Promise<boolean>;
  abstract beginTotpSetup(): Promise<{ secret: string; qrCodePngB64: string }>;
  abstract confirmTotpSetup(code: string): Promise<void>;
  abstract disableTotp(): Promise<void>;
}

export const requestObject = async <T>(endpoint: string, method: string, body: object) => {
  const response = await fetch(endpoint, {
    method,
    headers: JSON_HEADER,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();

    if (response.status === 401) {
      void useStore.getState().logout();
      throw new Error('Session expired');
    }

    if (response.status === 428) {
      throw new TotpRequiredError();
    }

    throw new Error(text || 'Request failed');
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
};

export const getVersion = async () => {
  const response = await fetch('version');

  if (!response.ok) {
    throw new Error('Failed to fetch version');
  }

  return response.text();
};
