const DEFAULT_REMOTE = 'https://18-141-68-40.sslip.io';
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
 * Dev: use same-origin Vite proxies so the browser can retain session cookies.
 * Production build: chỉ dùng VITE_API_URL (không trỏ localhost của máy user).
 */
export async function resolveApiBase(): Promise<{ base: string; source: ApiSource; health: HealthResponse }> {
  if (import.meta.env.PROD) {
    return { base: REMOTE_API_URL, source: 'remote', health: await getHealth(REMOTE_API_URL) };
  }
  try {
    const base = window.location.origin;
    return { base, source: 'remote', health: await getHealth(base) };
  } catch {
    const base = `${window.location.origin}/local-api`;
    return { base, source: 'local', health: await getHealth(base) };
  }
}

export function apiUrl(base: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${stripSlash(base)}${p}`;
}
