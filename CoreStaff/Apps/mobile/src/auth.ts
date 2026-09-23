import { apiUrl } from './config';

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

export interface LoginResult { user: AuthUser; mustChangePassword: boolean; }
interface ApiSuccess<T> { success: true; data?: T; }
interface ApiFailure { success: false; error?: { code?: string; message?: string }; }

export class AuthApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'AuthApiError';
  }
}

/**
 * Credential endpoints. A 401 from these answers the credential the call just
 * sent, not an expired session — renewing first would be pointless (and for
 * login, wrong: there is no session to renew yet).
 */
const NO_REFRESH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]);

/** App registers this so the UI drops to the login screen when `rt` is dead too. */
let signedOutHandler: (() => void) | null = null;
export function setSignedOutHandler(handler: (() => void) | null): void {
  signedOutHandler = handler;
}

async function request<T>(base: string, path: string, init?: RequestInit, allowRefresh = true): Promise<T> {
  const response = await fetch(apiUrl(base, path), {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  // SRS §4.4: the session cookie is short-lived, so a 401 usually means
  // "renew me", not "log in again". Retry once behind the refresh cookie.
  if (response.status === 401 && allowRefresh && !NO_REFRESH_PATHS.has(path)) {
    if (await tryRefreshSession(base)) {
      return request<T>(base, path, init, false);
    }
    signedOutHandler?.();
  }

  const text = await response.text();
  let body: ApiSuccess<T> | ApiFailure | null = null;
  try { body = text ? JSON.parse(text) as ApiSuccess<T> | ApiFailure : null; } catch { body = null; }
  if (!response.ok || body?.success === false) {
    const code = body?.success === false ? body.error?.code : undefined;
    const message = body?.success === false ? body.error?.message : undefined;
    throw new AuthApiError(message || `HTTP ${response.status}`, response.status, code);
  }
  if (!body || body.success !== true) throw new AuthApiError('Phản hồi từ máy chủ không hợp lệ.', response.status);
  return body.data as T;
}

/**
 * One refresh in flight at a time: several requests failing on an expired
 * cookie must send one refresh, not one each, or they race to rewrite the
 * session token. Same contract as the web client (services/auth.ts).
 */
let refreshInflight: Promise<boolean> | null = null;

export function tryRefreshSession(base: string): Promise<boolean> {
  refreshInflight ??= request<LoginResult>(base, '/api/auth/refresh', { method: 'POST' })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshInflight = null;
    });
  return refreshInflight;
}

export const login = (base: string, identifier: string, password: string) => request<LoginResult>(base, '/api/auth/login', {
  method: 'POST', body: JSON.stringify({ identifier: identifier.trim(), password }),
});
export const getCurrentUser = (base: string) => request<AuthUser>(base, '/api/auth/me');
export const changePassword = (base: string, currentPassword: string, newPassword: string, confirmPassword: string) => request<void>(base, '/api/auth/change-password', {
  method: 'POST', body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
});
export const forgotPassword = (base: string, email: string) => request<void>(base, '/api/auth/forgot-password', {
  method: 'POST', body: JSON.stringify({ email: email.trim() }),
});
export const resetPassword = (base: string, token: string, newPassword: string) => request<void>(base, '/api/auth/reset-password', {
  method: 'POST', body: JSON.stringify({ token: token.trim(), newPassword }),
});
export const logout = (base: string) => request<void>(base, '/api/auth/logout', { method: 'POST' });

export function friendlyAuthError(error: unknown): string {
  if (error instanceof AuthApiError) {
    if (error.code === 'VALIDATION_FAILED') return 'Thông tin bạn nhập chưa hợp lệ.';
    if (error.code === 'AUTH_INVALID_CREDENTIALS' || error.status === 401) return 'Tài khoản hoặc mật khẩu không đúng.';
    if (error.code === 'AUTH_ACCOUNT_DISABLED') return 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ HR.';
    if (error.code === 'AUTH_ACCOUNT_LOCKED') return 'Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau.';
    if (error.code === 'AUTH_SESSION_EXPIRED') return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (error.code === 'AUTH_CURRENT_PASSWORD_INVALID') return 'Mật khẩu hiện tại không đúng.';
    if (error.code === 'AUTH_PASSWORD_POLICY_FAILED') return 'Mật khẩu mới cần ít nhất 8 ký tự, gồm chữ và số, và không trùng mật khẩu hiện tại.';
    if (error.code === 'AUTH_RESET_TOKEN_INVALID') return 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';
  }
  return error instanceof Error ? error.message : 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
}
