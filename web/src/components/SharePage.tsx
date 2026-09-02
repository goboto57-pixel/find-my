import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decryptShareLinkPayload } from '@/lib/crypto';
import { Location, ENDPOINTS_SHARE_PUBLIC_URL } from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';

// Kept intentionally framework-light: no auth, no zustand store dependency,
// since anyone with the link (no account) should be able to load this page.
const SharePage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';

    if (!token || !key) {
      setError('This link is missing its token or decryption key.');
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`${ENDPOINTS_SHARE_PUBLIC_URL}/${token}`);
        if (!response.ok) {
          setError(
            response.status === 404
              ? 'This share link has expired or does not exist.'
              : 'Failed to load the shared location.'
          );
          return;
        }
        const data = (await response.json()) as { EncryptedPayload: string; ExpiresAt: number };
        const plaintext = await decryptShareLinkPayload(data.EncryptedPayload, key);
        setLocation(JSON.parse(plaintext) as Location);
      } catch {
        setError('Failed to decrypt the shared location. The link may be malformed.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">Shared location unavailable</h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  const mapsUrl = `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lon}#map=16/${location.lat}/${location.lon}`;

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold text-foreground">Shared device location</h1>
      <p className="text-muted-foreground">
        Last updated: {new Date(location.date * 1000).toLocaleString()}
      </p>
      <p className="font-mono text-sm text-muted-foreground">
        {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
      </p>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-fmd-green underline"
      >
        Open in map
      </a>
      <p className="max-w-sm text-xs text-muted-foreground">
        This is a one-time snapshot shared by the device owner, decrypted entirely in your
        browser. The server never had access to the coordinates above.
      </p>
    </div>
  );
};

export default SharePage;
