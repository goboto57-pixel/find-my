import { useCallback, useEffect, useState } from 'react';
import { apiService } from '@/lib/apiService';

// Standard conversion needed because PushManager.subscribe() wants the
// VAPID key as a raw Uint8Array, but the server hands it to us base64url
// encoded.
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function subscriptionKeys(sub: PushSubscription): { p256dh: string; auth: string } | null {
  const p256dhBuf = sub.getKey('p256dh');
  const authBuf = sub.getKey('auth');
  if (!p256dhBuf || !authBuf) return null;

  const toBase64 = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  return { p256dh: toBase64(p256dhBuf), auth: toBase64(authBuf) };
}

export const isWebPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function useWebPush() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isWebPushSupported()) return;
    void (async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const existing = await registration?.pushManager.getSubscription();
      setEnabled(!!existing);
    })();
  }, []);

  const subscribe = useCallback(async () => {
    if (!isWebPushSupported()) {
      setError('Push notifications are not supported in this browser.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission denied.');
        return;
      }

      const registration = await navigator.serviceWorker.register('sw.js');
      const publicKey = await apiService.getWebPushVapidPublicKey();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const keys = subscriptionKeys(subscription);
      if (!keys) throw new Error('Failed to read subscription keys');

      await apiService.subscribeWebPush(subscription.endpoint, keys.p256dh, keys.auth);
      setEnabled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enable push notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await apiService.unsubscribeWebPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEnabled(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disable push notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  return { enabled, loading, error, subscribe, unsubscribe, supported: isWebPushSupported() };
}
