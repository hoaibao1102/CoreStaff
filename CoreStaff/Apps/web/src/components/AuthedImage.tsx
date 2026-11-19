import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { authenticatedFetch } from '../services/auth';
import { getApiBaseSync } from '../config/api';

/** Evidence photos sit behind the session cookie, so a bare <img src> can't load them reliably. */
const PRIVATE_PATH = '/api/attendance/evidence/';

export async function fetchPhoto(url: string): Promise<Blob> {
  const target = new URL(url, window.location.href);
  const base = new URL(getApiBaseSync(), window.location.href);
  if (target.origin !== window.location.origin && target.origin !== base.origin) throw new Error('Untrusted evidence origin');
  const prefix = target.pathname.slice(0, target.pathname.indexOf(PRIVATE_PATH));
  if (!target.pathname.includes(PRIVATE_PATH)) throw new Error('Invalid evidence path');
  const res = await authenticatedFetch(target.origin + prefix, target.pathname.slice(prefix.length) + target.search);
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
