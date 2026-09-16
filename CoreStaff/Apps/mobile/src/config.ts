import { Platform } from 'react-native';

const DEFAULT_REMOTE = 'https://18-141-68-40.sslip.io';

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

export type ApiSource = 'remote' | 'local';

export interface HealthResponse {
  status: 'ok';
  service: 'corestaff-api';
  mongo: 'configured' | 'missing';
  timezone: string;
}

/** Public health endpoint: the response is a plain object, without a data envelope. */
export async function getHealth(base: string, timeoutMs = 4000): Promise<HealthResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl(base, '/api/healthz'), { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Kiểm tra kết nối API thất bại (HTTP ${res.status}).`);
    const body: unknown = await res.json();
    if (
      !body || typeof body !== 'object' ||
      !('status' in body) || body.status !== 'ok' ||
      !('service' in body) || body.service !== 'corestaff-api' ||
      !('mongo' in body) || (body.mongo !== 'configured' && body.mongo !== 'missing') ||
      !('timezone' in body) || typeof body.timezone !== 'string' || !body.timezone.trim()
    ) {
      throw new Error('Phản hồi kiểm tra kết nối API không hợp lệ.');
    }
    return body as HealthResponse;
  } catch (error) {
    if (ctrl.signal.aborted) throw new Error('Hết thời gian chờ kết nối API. Vui lòng thử lại.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dev: thử API remote, hỏng thì fallback local (Android emulator → 10.0.2.2).
 * Release build: chỉ dùng EXPO_PUBLIC_API_URL.
 */
export async function resolveApiBase(): Promise<{ base: string; source: ApiSource; health: HealthResponse }> {
  if (!__DEV__) {
    return { base: REMOTE_API_URL, source: 'remote', health: await getHealth(REMOTE_API_URL) };
  }
  try {
    return { base: REMOTE_API_URL, source: 'remote', health: await getHealth(REMOTE_API_URL) };
  } catch {
    return { base: FALLBACK_API_URL, source: 'local', health: await getHealth(FALLBACK_API_URL) };
  }
}

export function apiUrl(base: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${stripSlash(base)}${p}`;
}

/** @deprecated Dùng resolveApiBase() — giữ export để không gãy import cũ. */
export const API_BASE_URL = REMOTE_API_URL;
