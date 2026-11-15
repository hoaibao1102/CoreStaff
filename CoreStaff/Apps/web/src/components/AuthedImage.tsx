import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { tryRefreshSession } from '../services/auth';

/** Evidence photos sit behind the session cookie, so a bare <img src> can't load them reliably. */
const PRIVATE_PATH = '/api/attendance/evidence/';

async function fetchPhoto(url: string, retry = true): Promise<Blob> {
  const res = await fetch(url, { credentials: 'include' });
  if (res.status === 401 && retry) {
    const origin = new URL(url, window.location.href).origin;
    if (await tryRefreshSession(origin)) return fetchPhoto(url, false);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

export type AuthedImageState = { src: string | null; loading: boolean; failed: boolean };

/** Resolves a (possibly private) image URL to something an <img> can show. */
export function useAuthedImage(url: string | null | undefined): AuthedImageState {
  const isPrivate = !!url && url.includes(PRIVATE_PATH);
  const [state, setState] = useState<AuthedImageState>({ src: null, loading: isPrivate, failed: false });

  useEffect(() => {
    if (!url) return setState({ src: null, loading: false, failed: false });
    if (!isPrivate) return setState({ src: url, loading: false, failed: false });
    let alive = true;
    let objectUrl: string | null = null;
    setState({ src: null, loading: true, failed: false });
    fetchPhoto(url)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ src: objectUrl, loading: false, failed: false });
      })
      .catch(() => alive && setState({ src: null, loading: false, failed: true }));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, isPrivate]);

  return state;
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string | null | undefined; fallback?: React.ReactNode };

/** Drop-in <img> that authenticates private evidence URLs. */
export function AuthedImage({ src, fallback = null, alt, ...rest }: Props) {
  const image = useAuthedImage(src);
  if (!image.src) return <>{image.loading ? null : fallback}</>;
  return <img src={image.src} alt={alt} {...rest} />;
}
