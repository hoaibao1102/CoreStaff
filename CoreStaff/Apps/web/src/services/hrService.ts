import { apiUrl } from '../config/api';
import type {
    EmploymentStatus,
    EmploymentType,
    Gender,
} from '../lib/types';

// ───────── API Response Types ─────────

export interface EmployeeProfile {
    _id: string;
    fullName?: string | null;
    userId: string;
    organizationId: string;
    employeeCode: string;
    employmentType: EmploymentType;
    employmentStatus: EmploymentStatus;
    dateOfBirth?: string;
    gender?: Gender;
    phone?: string;
    email?: string;
    address?: string;
    citizenId?: string;
    taxCode?: string;
    socialInsuranceCode?: string;
    bankAccount?: string;
    departmentId?: string;
    positionId?: string;
    directManagerId?: string;
    workplaceId?: string;
    joinDate: string;
    endDate?: string;
    createdAt?: string;
    updatedAt?: string;
    // Resolved names (populated by backend or client-side resolution)
    departmentName?: string | null;
    positionName?: string | null;
    managerName?: string | null;
    workplaceName?: string | null;
}

export interface EmploymentHistoryRecord {
    _id: string;
    organizationId: string;
    employeeProfileId: string;
    previousStatus: EmploymentStatus;
    newStatus: EmploymentStatus;
    effectiveDate: string;
    reason?: string;
    changedBy: string;
    changedByName?: string | null;
    createdAt: string;
}

export interface Department {
    _id: string;
    code: string;
    name: string;
    active: boolean;
    organizationId: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface Position {
    _id: string;
    code: string;
    name: string;
    active: boolean;
    organizationId: string;
}

export interface EligibleEmployeeAccount {
    _id: string;
    fullName: string;
    email: string;
    phone?: string;
    employeeCode?: string;
}

export interface EmployeeCreateDto {
    /** Present = link an existing account (link mode). Omitted = provision a new
     * EMPLOYEE login (TASK-120); then `fullName` is required and the server
     * returns `tempPassword` once. */
    userId?: string;
    fullName?: string;
    employeeCode: string;
    employmentType?: EmploymentType;
    joinDate: string;
    dateOfBirth?: string;
    gender?: Gender;
    phone?: string;
    email?: string;
    address?: string;
    citizenId?: string;
    taxCode?: string;
    socialInsuranceCode?: string;
    bankAccount?: string;
    departmentId?: string;
    positionId?: string;
    directManagerId?: string;
    workplaceId?: string;
}

// ───────── API Error Codes ─────────

/**
 * HR_ERROR_CODES — ánh xạ lỗi kỹ thuật từ API sang ngôn ngữ nghiệp vụ HR.
 * Tuyệt đối không hiển thị thông báo kỹ thuật cho người dùng cuối.
 */
export const HR_ERROR_CODES: Record<string, string> = {
    // User / Auth errors
    USER_NOT_FOUND: 'Không tìm thấy tài khoản đăng nhập này trong tổ chức.',
    AUTHENTICATION_REQUIRED: 'Vui lòng đăng nhập để tiếp tục.',
    INSUFFICIENT_PERMISSIONS: 'Bạn không có quyền thực hiện thao tác này.',

    // Employee profile errors
    EMPLOYEE_PROFILE_ALREADY_EXISTS: 'Tài khoản này đã được liên kết với một hồ sơ nhân sự khác.',
    EMPLOYEE_CODE_TAKEN: 'Mã nhân viên này đã được sử dụng. Vui lòng nhập mã khác.',
    EMPLOYEE_PROFILE_NOT_FOUND: 'Không tìm thấy hồ sơ nhân viên.',
    EMAIL_TAKEN: 'Email này đã được sử dụng trong tổ chức.',
    FULLNAME_REQUIRED: 'Vui lòng nhập họ và tên khi tạo tài khoản mới.',
    USER_ID_NOT_ALLOWED: 'Route cá nhân không chấp nhận mã tài khoản nhập từ biểu mẫu.',

    // Reference entity errors
    DEPARTMENT_NOT_FOUND: 'Phòng ban đã chọn không còn tồn tại. Vui lòng chọn lại.',
    DEPARTMENT_CODE_TAKEN: 'Mã phòng ban này đã tồn tại trong tổ chức. Vui lòng chọn mã khác.',
    POSITION_NOT_FOUND: 'Chức danh đã chọn không còn tồn tại. Vui lòng chọn lại.',
    POSITION_CODE_TAKEN: 'Mã chức danh này đã tồn tại. Vui lòng chọn mã khác.',
    MANAGER_NOT_FOUND: 'Không tìm thấy quản lý trực tiếp này trong tổ chức.',
    WORKPLACE_NOT_FOUND: 'Nơi làm việc đã chọn không còn tồn tại.',

    // Status transition errors
    EMPLOYMENT_STATUS_TRANSITION_INVALID: 'Trạng thái không thể chuyển đổi theo quy định nhân sự.',

    // Validation errors
    VALIDATION_FAILED: 'Thông tin bạn nhập chưa hợp lệ. Vui lòng kiểm tra lại các trường có đánh dấu lỗi.',

    // System errors
    SERVER_ERROR: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.',
    SERVICE_UNAVAILABLE: 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại.',
};

/**
 * mapHrError — chuyển lỗi kỹ thuật từ API thành thông báo HR thân thiện.
 * @param code — Mã lỗi từ API (ví dụ: 'EMPLOYEE_CODE_TAKEN')
 * @param fallback — Thông báo mặc định nếu không tìm thấy code
 */
export function mapHrError(code?: string, fallback?: string): string {
    if (code && HR_ERROR_CODES[code]) return HR_ERROR_CODES[code];
    return fallback ?? 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.';
}

/**
 * hrErrorMessage — xử lý lỗi chung từ fetch/axios response.
 * Tự động phân biệt client error và server error.
 */
export function hrErrorMessage(error: unknown): string {
    const err = error as { code?: string; status?: number; message?: string };

    // Ưu tiên code lỗi từ backend
    if (err.code && HR_ERROR_CODES[err.code]) return HR_ERROR_CODES[err.code];

    // Xử lý theo HTTP status
    if (err.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (err.status === 403) return 'Bạn không có quyền truy cập tính năng này.';
    if (err.status === 404) return 'Không tìm thấy dữ liệu bạn yêu cầu.';
    if (err.status === 409) return 'Dữ liệu bạn nhập trùng với dữ liệu hiện có. Vui lòng kiểm tra lại.';
    if (err.status === 422) return 'Thông tin bạn nhập không hợp lệ. Vui lòng kiểm tra lại các trường bắt buộc.';
    if (err.status && err.status >= 500) return 'Máy chủ đang bảo trì. Vui lòng thử lại sau 5 phút.';

    // Fallback: nếu là string đơn thuần
    if (typeof error === 'string' && error.length > 0) {
        if (error.includes('Network') || error.includes('fetch')) {
            return 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng internet.';
        }
        return error;
    }

    return 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.';
}

// ───────── API Service Functions ─────────

async function parseJson<T>(res: Response): Promise<T | null> {
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text) as T;
    } catch {
        return null;
    }
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

export async function hrRequest<T>(base: string, path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(apiUrl(base, path), {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options?.headers || {}),
        },
    });

    const body = await parseJson<ApiSuccess<T> | ApiFailure>(res);

    if (!res.ok || body?.success === false) {
        const code = body?.success === false ? body.error?.code : undefined;
        const message = body?.success === false ? body.error?.message : `HTTP ${res.status}`;
        const error = new Error(message);
        (error as any).code = code;
        (error as any).status = res.status;
        (error as any).details = body?.success === false ? body.error?.details : undefined;
        throw error;
    }

    if (!body || body.success !== true) {
        throw new Error('Phản hồi từ máy chủ không hợp lệ.');
    }

    return body.data as T;
}

// ── Employee Directory (HR-only) ───────────────────────────────────────

export async function getEmployees(
    base: string,
    options?: { status?: string; departmentId?: string; query?: string; page?: number },
): Promise<{ employees: EmployeeProfile[]; total: number; page: number; totalPages: number }> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.departmentId) params.set('departmentId', options.departmentId);
    const data = await hrRequest<EmployeeProfile[]>(base, `/api/hr/employees?${params}`, { method: 'GET' });
    return paginateEmployees(data, options?.query ?? '', options?.page ?? 1);

}

// ── My Employee Profile (any authenticated user) ──────────────────────

export async function getMyEmployeeProfile(base: string): Promise<EmployeeProfile> {
    return hrRequest<EmployeeProfile>(base, '/api/hr/employees/me', { method: 'GET' });
}

// ── Employee Detail (HR-only) ─────────────────────────────────────────

export async function getEmployeeById(base: string, id: string): Promise<EmployeeProfile> {
    return hrRequest<EmployeeProfile>(base, `/api/hr/employees/${id}`, { method: 'GET' });
}

// ── Create Employee (HR-only) ─────────────────────────────────────────

export interface EmployeeCreateResult extends EmployeeProfile {
    tempPassword?: string;
}

export async function createEmployee(
    base: string,
    dto: EmployeeCreateDto,
): Promise<EmployeeCreateResult> {
    // NOTE: employmentStatus is NOT sent — backend sets it to PROBATION automatically
    return hrRequest<EmployeeCreateResult>(base, '/api/hr/employees', {
        method: 'POST',
        body: JSON.stringify(dto),
    });
}

/** Phase C — the caller creates their own profile. `userId` comes from the
 * session server-side; the payload carries only the business fields. Returns
 * the profile, never a password (no account is created). */
export async function createMyEmployeeProfile(
    base: string,
    dto: Omit<EmployeeCreateDto, 'userId' | 'fullName'>,
): Promise<EmployeeProfile> {
    return hrRequest<EmployeeProfile>(base, '/api/hr/employees/me', {
        method: 'POST',
        body: JSON.stringify(dto),
    });
}

export async function listEligibleEmployeeAccounts(base: string): Promise<EligibleEmployeeAccount[]> {
    return hrRequest<EligibleEmployeeAccount[]>(base, '/api/hr/employees/eligible-users');
}

// ── Update Employee (HR-only) ─────────────────────────────────────────

export async function updateEmployee(
    base: string,
    id: string,
    dto: Partial<Omit<EmployeeCreateDto, 'userId' | 'employeeCode'>>,
): Promise<EmployeeProfile> {
    return hrRequest<EmployeeProfile>(base, `/api/hr/employees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
    });
}

// ── Change Employment Status (HR-only) ────────────────────────────────

export async function changeEmploymentStatus(
    base: string,
    id: string,
    newStatus: EmploymentStatus,
    effectiveDate: string,
    reason?: string,
): Promise<EmployeeProfile> {
    return hrRequest<EmployeeProfile>(base, `/api/hr/employees/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ newStatus, effectiveDate, reason }),
    });
}

// ── Employment History (HR-only) ──────────────────────────────────────

export async function getEmployeeHistory(
    base: string,
    id: string,
): Promise<EmploymentHistoryRecord[]> {
    return hrRequest<EmploymentHistoryRecord[]>(base, `/api/hr/employees/${id}/history`, {
        method: 'GET',
    });
}

// ── Departments (public within tenant) ────────────────────────────────

export async function getDepartments(base: string, activeOnly?: boolean): Promise<Department[]> {
    const params = new URLSearchParams();
    if (activeOnly !== undefined) params.set('active', String(activeOnly));
    return hrRequest<Department[]>(
        base,
        `/api/hr/departments${params.size ? `?${params}` : ''}`,
        { method: 'GET' },
    );
}

export async function getDepartmentById(base: string, id: string): Promise<Department> {
    return hrRequest<Department>(base, `/api/hr/departments/${encodeURIComponent(id)}`, { method: 'GET' });
}

export async function createDepartment(base: string, dto: Pick<Department, 'code' | 'name'>): Promise<Department> {
    return hrRequest<Department>(base, '/api/hr/departments', { method: 'POST', body: JSON.stringify(dto) });
}

export async function updateDepartment(base: string, id: string, dto: Partial<Pick<Department, 'code' | 'name'>>): Promise<Department> {
    return hrRequest<Department>(base, `/api/hr/departments/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(dto),
    });
}

export async function setDepartmentActive(base: string, id: string, active: boolean): Promise<Department> {
    return hrRequest<Department>(base, `/api/hr/departments/${encodeURIComponent(id)}/${active ? 'activate' : 'deactivate'}`, {
        method: 'PATCH',
    });
}

// ── Positions (public within tenant) ──────────────────────────────────

export async function getPositions(base: string, activeOnly?: boolean): Promise<Position[]> {
    const params = new URLSearchParams();
    if (activeOnly !== undefined) params.set('active', String(activeOnly));
    return hrRequest<Position[]>(
        base,
        `/api/hr/positions?${params.toString()}`,
        { method: 'GET' },
    );
}

export function paginateEmployees(data: EmployeeProfile[], query: string, requestedPage: number) {
    const term = query.trim().toLocaleLowerCase('vi');
    const filtered = data.filter(row => !term || `${row.fullName ?? ''} ${row.employeeCode}`.toLocaleLowerCase('vi').includes(term));
    const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
    const page = Math.max(1, Math.min(requestedPage, totalPages));
    return { employees: filtered.slice((page - 1) * 10, page * 10), total: filtered.length, page, totalPages };
}

export async function listEmployees(base: string, status: string, departmentId: string) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (departmentId) params.set('departmentId', departmentId);
    return hrRequest<EmployeeProfile[]>(base, `/api/hr/employees?${params}`, { method: 'GET' });
}
