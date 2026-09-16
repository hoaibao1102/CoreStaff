import { apiUrl } from '../config/api';
import { AuthApiError } from './auth';

/*
 * Platform / Organizations (SYSTEM_ADMIN).
 *
 * Reuses the cookie/envelope handling from hrService via `hrRequest`; the
 * platform module only adds its own DTOs and error codes. No screen here ever
 * shows the team a technical message.
 */

export interface Organization {
    _id: string;
    code: string;
    name: string;
    status: 'ACTIVE' | 'SUSPENDED';
    timezone?: string;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface InitialHrResult {
    _id: string;
    organizationId: string;
    email: string;
    fullName: string;
    role: 'HR';
    mustChangePassword: true;
    tempPassword?: string;
}

/** Client-side validation only; the server remains the source of truth. */
export function validateOrganizationCode(value: string): string | null {
    if (!value.trim()) return 'Vui lòng nhập mã tổ chức.';
    if (!/^[A-Za-z0-9-]{2,20}$/.test(value.trim())) {
        return 'Mã tổ chức từ 2–20 ký tự, chỉ gồm chữ, số và dấu gạch ngang.';
    }
    return null;
}

export const PLATFORM_ERROR_CODES: Record<string, string> = {
    ORGANIZATION_CODE_TAKEN: 'Mã tổ chức này đã tồn tại trên nền tảng. Vui lòng dùng mã khác.',
    ORGANIZATION_CODE_INVALID: 'Mã tổ chức chưa đúng định dạng.',
    ORGANIZATION_NOT_FOUND: 'Tổ chức không còn tồn tại.',
    EMAIL_TAKEN: 'Email này đã được dùng cho một tài khoản trong tổ chức.',
    EMAIL_INVALID: 'Email chưa đúng định dạng.',
    TENANT_SUSPENDED: 'Tổ chức này đang bị tạm ngưng hoạt động.',
};

export function platformErrorMessage(error: unknown, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.'): string {
    if (error instanceof AuthApiError && error.code && PLATFORM_ERROR_CODES[error.code]) {
        return PLATFORM_ERROR_CODES[error.code];
    }
    if (error instanceof AuthApiError && error.status === 401) {
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    if (error instanceof AuthApiError && error.status === 403) {
        return 'Bạn không có quyền truy cập tính năng này.';
    }
    if (error instanceof AuthApiError && error.status && error.status >= 500) {
        return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
    }
    return error instanceof Error ? error.message : fallback;
}

/** Platform routes carry a tenant-prefixed path but use the same helper. */
function platformRequest<T>(base: string, path: string, options?: RequestInit): Promise<T> {
    return import('./hrService').then(m => m.hrRequest<T>(base, `/${path}`, options));
}

export async function listOrganizations(base: string): Promise<Organization[]> {
    return platformRequest<Organization[]>(base, 'api/platform/organizations', { method: 'GET' });
}

export async function createOrganization(base: string, dto: { code: string; name: string }): Promise<Organization> {
    return platformRequest<Organization>(base, 'api/platform/organizations', {
        method: 'POST',
        body: JSON.stringify({ code: dto.code.toUpperCase(), name: dto.name.trim() }),
    });
}

export async function createInitialHr(base: string, organizationId: string, dto: { email: string; fullName: string }): Promise<InitialHrResult> {
    return platformRequest<InitialHrResult>(base, `api/platform/organizations/${encodeURIComponent(organizationId)}/initial-hr`, {
        method: 'POST',
        body: JSON.stringify(dto),
    });
}

export async function setOrganizationStatus(base: string, organizationId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<Organization> {
    return platformRequest<Organization>(base, `api/platform/organizations/${encodeURIComponent(organizationId)}/${status === 'SUSPENDED' ? 'suspend' : 'activate'}`, {
        method: 'POST',
    });
}