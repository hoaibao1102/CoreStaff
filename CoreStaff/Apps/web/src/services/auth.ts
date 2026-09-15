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

async function parseJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(base, path), {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

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

export function login(base: string, identifier: string, password: string): Promise<LoginResult> {
  return request<LoginResult>(base, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: identifier.trim(), password }),
  });
}

export function me(base: string): Promise<AuthUser> {
  return request<AuthUser>(base, '/api/auth/me');
}

export function changePassword(
  base: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> {
  return request<void>(base, '/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
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
  await fetch(apiUrl(base, '/api/auth/logout'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
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
