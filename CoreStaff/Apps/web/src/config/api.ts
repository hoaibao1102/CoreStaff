const DEFAULT_REMOTE = 'https://becorestaff.vercel.app';
const DEFAULT_LOCAL = 'http://localhost:3000';

function stripSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export const REMOTE_API_URL = stripSlash(
  import.meta.env.VITE_API_URL || DEFAULT_REMOTE,
);

export const FALLBACK_API_URL = stripSlash(
  import.meta.env.VITE_API_FALLBACK_URL || DEFAULT_LOCAL,
);

async function isHealthy(base: string, timeoutMs = 4000): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/healthz`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dev: thử API remote (Vercel), hỏng thì fallback local.
 * Production build: chỉ dùng VITE_API_URL (không trỏ localhost của máy user).
 */
export async function resolveApiBase(): Promise<{ base: string; source: 'remote' | 'local' }> {
  if (import.meta.env.PROD) {
    return { base: REMOTE_API_URL, source: 'remote' };
  }
  if (await isHealthy(REMOTE_API_URL)) {
    return { base: REMOTE_API_URL, source: 'remote' };
  }
  return { base: FALLBACK_API_URL, source: 'local' };
}

export function apiUrl(base: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${stripSlash(base)}${p}`;
}
