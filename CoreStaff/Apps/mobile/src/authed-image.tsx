import { useEffect, useState } from 'react';
import { Image, type ImageProps } from 'react-native';
import { tryRefreshSession } from './auth';

/**
 * Evidence photos are private: the API authenticates them with the session
 * cookie, which React Native's <Image> does not send reliably (and cannot
 * refresh). So we fetch the bytes ourselves, with the same cookie + one
 * refresh retry as apiRequest, and hand <Image> a data URI.
 */
const PRIVATE_PATH = '/api/attendance/evidence/';
const cache = new Map<string, string>();

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('read failed')));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

async function fetchPhoto(url: string, retry = true): Promise<string> {
  const res = await fetch(url, { credentials: 'include' });
  if (res.status === 401 && retry) {
    const base = url.slice(0, url.indexOf(PRIVATE_PATH));
    if (await tryRefreshSession(base)) return fetchPhoto(url, false);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return blobToDataUri(await res.blob());
}

export type AuthedImageState = { uri: string | null; loading: boolean; failed: boolean };

export function useAuthedImage(url: string | null | undefined): AuthedImageState {
  const isPrivate = !!url && url.includes(PRIVATE_PATH);
  const [state, setState] = useState<AuthedImageState>(() => ({
    uri: url ? (isPrivate ? cache.get(url) ?? null : url) : null,
    loading: isPrivate && !cache.has(url!),
    failed: false,
  }));

  useEffect(() => {
    if (!url) return setState({ uri: null, loading: false, failed: false });
    if (!isPrivate) return setState({ uri: url, loading: false, failed: false });
    const hit = cache.get(url);
    if (hit) return setState({ uri: hit, loading: false, failed: false });
    let alive = true;
    setState({ uri: null, loading: true, failed: false });
    fetchPhoto(url)
      .then((uri) => { cache.set(url, uri); if (alive) setState({ uri, loading: false, failed: false }); })
      .catch(() => { if (alive) setState({ uri: null, loading: false, failed: true }); });
    return () => { alive = false; };
  }, [url, isPrivate]);

  return state;
}

type Props = Omit<ImageProps, 'source'> & {
  url: string | null | undefined;
  /** Called when the photo could not be fetched or decoded. */
  onFail?: () => void;
  /** Called once the bitmap is on screen. */
  onReady?: () => void;
};

/** <Image> for a possibly private evidence URL. Renders nothing until it has bytes. */
export function AuthedImage({ url, onFail, onReady, onError, onLoad, ...rest }: Props) {
  const { uri, failed } = useAuthedImage(url);
  useEffect(() => { if (failed) onFail?.(); }, [failed, onFail]);
  if (!uri) return null;
  return <Image {...rest} source={{ uri }} onLoad={(e) => { onReady?.(); onLoad?.(e); }} onError={(e) => { onFail?.(); onError?.(e); }} />;
}
