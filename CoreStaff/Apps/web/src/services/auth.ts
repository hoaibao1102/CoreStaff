import { apiUrl } from '../config/api';

export type Role = 'SYSTEM_ADMIN' | 'HR' | 'DEPARTMENT_MANAGER' | 'EMPLOYEE';

export interface AuthUser {
  _id?: string;
  id?: string;
  organizationId?: string;
  email: string;
  employeeCode?: string;
  fullName: string;
  role: Role;
  status: string;
  mustChangePassword?: boolean;
}

export interface LoginResult {
  user: AuthUser;
  mustChangePassword: boolean;
  token?: string;
}

const TOKEN_KEY = 'corestaff_session_token';
// Shared sign-in/out identity stays stable across access-token renewal.
const SESSION_ID_KEY = 'corestaff_session_identity';
let sessionGeneration = 0;

function sessionIdentity(): string | null {
  try { return localStorage.getItem(SESSION_ID_KEY); } catch { return null; }
}

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token?: string | null): void {
  sessionGeneration++;
  try {
    localStorage.setItem(SESSION_ID_KEY, globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
  } catch {}
  storeSessionToken(token);
}

function storeSessionToken(token?: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

interface ApiSuccess<T> {
  success: true;
  data?: T;
}

interface ApiFailure {
  success: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

/** Broadcast when the refresh token is gone too: the app drops to the login screen. */
export const signedOutEvent = 'corestaff:signed-out';

/** Guarded: the service modules are also imported by unit tests with no DOM. */
export function notifySignedOut(): void {
  setSessionToken(null);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(signedOutEvent));
}

async function parseJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Credential endpoints. A 401 from these is the answer to the credential the
 * call just sent, not an expired session, so renewing first would be pointless
 * (and for login, actively wrong — it would fire a refresh before there is a
 * session to refresh).
 */
const NO_REFRESH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]);

/** Shared transport: preserve the original body/headers and retry only auth rejection. */
export async function authenticatedFetch(base: string, path: string, init: RequestInit = {}): Promise<Response> {
  const credentialEndpoint = NO_REFRESH_PATHS.has(path.split('?')[0]);
  const initialToken = getSessionToken();
  const generation = sessionGeneration;
  const identity = sessionIdentity();
  const send = async () => {
    const headers = new Headers(init.headers);
    const token = getSessionToken();
    if (credentialEndpoint) headers.delete('Authorization');
    else if (token) headers.set('Authorization', `Bearer ${token}`);
    if (!(typeof FormData !== 'undefined' && init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(apiUrl(base, path), { ...init, credentials: 'include', headers: [...headers].length ? headers : undefined });
    if (!credentialEndpoint && (generation !== sessionGeneration || identity !== sessionIdentity())) {
      throw new AuthApiError('Phiên đã thay đổi. Vui lòng thử lại.', 409, 'AUTH_SESSION_CHANGED');
    }
    return response;
  };
  const res = await send();
  if (!credentialEndpoint && (generation !== sessionGeneration || identity !== sessionIdentity())) {
    throw new AuthApiError('Phiên đã thay đổi. Vui lòng thử lại.', 409, 'AUTH_SESSION_CHANGED');
  }
  if (res.status === 401 && !credentialEndpoint) {
    if (generation !== sessionGeneration) throw new AuthApiError('Phiên đã thay đổi. Vui lòng thử lại.', 409, 'AUTH_SESSION_CHANGED');
    if (getSessionToken() && getSessionToken() !== initialToken) return send();
    const refresh = await refreshSession(base);
    if ((generation !== sessionGeneration || identity !== sessionIdentity()) && refresh.status !== 'invalid-session') throw new AuthApiError('Phiên đã thay đổi. Vui lòng thử lại.', 409, 'AUTH_SESSION_CHANGED');
    if (refresh.status === 'success') return send();
    if (refresh.status === 'transient-failure') {
      throw new AuthApiError('Không thể kết nối để gia hạn phiên. Vui lòng thử lại.', 503, 'AUTH_REFRESH_UNAVAILABLE');
    }
  }
  return res;
}

async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const res = await authenticatedFetch(base, path, init);

  const body = await parseJson<ApiSuccess<T> | ApiFailure>(res);

  if (!res.ok || body?.success === false) {
    const code = body?.success === false ? body.error?.code : undefined;
    const message = body?.success === false ? body.error?.message : undefined;
    throw new AuthApiError(message || `HTTP ${res.status}`, res.status, code);
  }

  if (!body || body.success !== true) {
    throw new AuthApiError('Phản hồi từ máy chủ không hợp lệ.', res.status);
  }

  return body.data as T;
}

/**
 * One refresh in flight at a time: a screen that fires five requests after the
 * cookie expired must send one refresh, not five, or they race each other to
 * rewrite the session token.
 */
export type RefreshResult = { status: 'success' | 'invalid-session' | 'transient-failure' };
let refreshInflight: Promise<RefreshResult> | null = null;

export function refreshSession(base: string): Promise<RefreshResult> {
  const generation = sessionGeneration;
  const identity = sessionIdentity();
  const token = getSessionToken();
  const renew = async (): Promise<RefreshResult> => {
    if (generation !== sessionGeneration || identity !== sessionIdentity()) return { status: 'transient-failure' };
    // Another tab may have completed renewal while we waited for its lock.
    if (token !== getSessionToken()) return { status: getSessionToken() ? 'success' : 'invalid-session' };
    return request<LoginResult>(base, '/api/auth/refresh', { method: 'POST' })
    .then((result): RefreshResult => {
      if (generation !== sessionGeneration || identity !== sessionIdentity() || token !== getSessionToken()) return { status: 'transient-failure' };
      if (!result?.token || typeof result.token !== 'string') return { status: 'transient-failure' };
      storeSessionToken(result.token);
      return { status: 'success' };
    })
    .catch((error): RefreshResult => {
      if (generation !== sessionGeneration || identity !== sessionIdentity() || token !== getSessionToken()) return { status: 'transient-failure' };
      if (error instanceof AuthApiError && error.status === 401) {
        notifySignedOut();
        return { status: 'invalid-session' };
      }
      return { status: 'transient-failure' };
    });
  };
  refreshInflight ??= Promise.resolve(typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('corestaff:session-refresh', renew)
    : renew())
    .finally(() => {
      refreshInflight = null;
    });
  return refreshInflight;
}

/** Compatibility for callers that only need a success flag; transport uses the typed outcome. */
export async function tryRefreshSession(base: string): Promise<boolean> {
  return (await refreshSession(base)).status === 'success';
}

export async function login(base: string, identifier: string, password: string): Promise<LoginResult> {
  const result = await request<LoginResult>(base, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: identifier.trim(), password }),
  });
  if (result.token) setSessionToken(result.token);
  return result;
}

export function me(base: string): Promise<AuthUser> {
  return request<AuthUser>(base, '/api/auth/me');
}

export function changePassword(
  base: string,
  newPassword: string,
  confirmPassword: string,
  currentPassword?: string,
): Promise<void> {
  return request<void>(base, '/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ ...(currentPassword ? { currentPassword } : {}), newPassword, confirmPassword }),
  });
}

export function forgotPassword(base: string, email: string): Promise<void> {
  return request<void>(base, '/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(base: string, token: string, newPassword: string): Promise<void> {
  return request<void>(base, '/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function logout(base: string): Promise<void> {
  const token = getSessionToken();
  setSessionToken(null);
  await fetch(apiUrl(base, '/api/auth/logout'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export function friendlyAuthError(error: unknown): string {
  if (error instanceof AuthApiError) {
    if (error.code === 'VALIDATION_FAILED') return 'Thông tin đăng nhập chưa hợp lệ.';
    if (error.code === 'AUTH_INVALID_CREDENTIALS' || error.status === 401) {
      return 'Tài khoản hoặc mật khẩu không đúng.';
    }
    if (error.code === 'AUTH_ACCOUNT_DISABLED') return 'Tài khoản đã bị vô hiệu hóa.';
    if (error.code === 'AUTH_ACCOUNT_LOCKED') return 'Tài khoản đang bị khóa tạm thời.';
    if (error.code === 'AUTH_SESSION_EXPIRED') return 'Phiên đăng nhập đã hết hạn.';
  }

  return error instanceof Error ? error.message : 'Không thể đăng nhập. Vui lòng thử lại.';
}

export function friendlyPasswordError(error: unknown): string {
  if (error instanceof AuthApiError) {
    if (error.code === 'AUTH_CURRENT_PASSWORD_INVALID') return 'Mật khẩu hiện tại không đúng.';
    if (error.code === 'AUTH_PASSWORD_POLICY_FAILED') return 'Mật khẩu mới chưa đạt chính sách hoặc trùng mật khẩu hiện tại.';
    if (error.code === 'AUTH_RESET_TOKEN_INVALID') return 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';
    if (error.code === 'AUTH_SESSION_EXPIRED' || error.status === 401) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    if (error.code === 'VALIDATION_FAILED') return error.message || 'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số.';
  }

  return error instanceof Error ? error.message : 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
}
