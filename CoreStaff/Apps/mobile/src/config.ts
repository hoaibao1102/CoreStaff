import { Platform } from 'react-native';

const DEFAULT_REMOTE = 'https://becorestaff.vercel.app';

function stripSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export const REMOTE_API_URL = stripSlash(
  process.env.EXPO_PUBLIC_API_URL || DEFAULT_REMOTE,
);

function localFallbackUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_FALLBACK_URL;
  if (Platform.OS === 'android') {
    if (fromEnv) {
      return stripSlash(fromEnv.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2'));
    }
    return 'http://10.0.2.2:3000';
  }
  return stripSlash(fromEnv || 'http://localhost:3000');
}

export const FALLBACK_API_URL = localFallbackUrl();

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
 * Dev: thử API remote (Vercel), hỏng thì fallback local (Android emulator → 10.0.2.2).
 * Release build: chỉ dùng EXPO_PUBLIC_API_URL.
 */
export async function resolveApiBase(): Promise<{ base: string; source: 'remote' | 'local' }> {
  if (!__DEV__) {
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

/** @deprecated Dùng resolveApiBase() — giữ export để không gãy import cũ. */
export const API_BASE_URL = REMOTE_API_URL;
