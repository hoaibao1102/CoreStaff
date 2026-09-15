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
}

export interface Position {
    _id: string;
    code: string;
    name: string;
    active: boolean;
    organizationId: string;
}

// ───────── API Error Codes ─────────

export const HR_ERROR_CODES: Record<string, string> = {
    USER_NOT_FOUND: 'Không tìm thấy người dùng.',
    DEPARTMENT_NOT_FOUND: 'Không tìm thấy phòng ban.',
    POSITION_NOT_FOUND: 'Không tìm thấy chức danh.',
    MANAGER_NOT_FOUND: 'Không tìm thấy quản lý trực tiếp.',
    EMPLOYEE_PROFILE_ALREADY_EXISTS: 'Hồ sơ nhân viên đã tồn tại cho người dùng này.',
    EMPLOYEE_CODE_TAKEN: 'Mã nhân viên đã được sử dụng.',
    EMPLOYEE_PROFILE_NOT_FOUND: 'Không tìm thấy hồ sơ nhân viên.',
    EMPLOYMENT_STATUS_TRANSITION_INVALID: 'Trạng thái không thể chuyển đổi theo quy định.',
    POSITION_CODE_TAKEN: 'Mã chức danh đã được sử dụng.',
    DEPARTMENT_CODE_TAKEN: 'Mã phòng ban đã được sử dụng.',
};

export function mapHrError(code?: string, fallback?: string): string {
    return code && HR_ERROR_CODES[code] ? HR_ERROR_CODES[code] : fallback ?? 'Đã xảy ra lỗi.';
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
    };
}

async function hrRequest<T>(base: string, path: string, options?: RequestInit): Promise<T> {
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

export async function createEmployee(
    base: string,
    dto: {
        userId: string;
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
    },
): Promise<EmployeeProfile> {
    // NOTE: employmentStatus is NOT sent — backend sets it to PROBATION automatically
    return hrRequest<EmployeeProfile>(base, '/api/hr/employees', {
        method: 'POST',
        body: JSON.stringify(dto),
    });
}

// ── Update Employee (HR-only) ─────────────────────────────────────────

export async function updateEmployee(
    base: string,
    id: string,
    dto: Partial<Omit<
        Parameters<typeof createEmployee>[1],
        'userId' | 'employeeCode' // immutable after creation
    >>,
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
        `/api/hr/departments?${params.toString()}`,
        { method: 'GET' },
    );
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

export function hrErrorMessage(error: unknown) {
    const detail = error as { status?: number; code?: string };
    if (detail?.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (detail?.status === 403) return 'Bạn không có quyền xem dữ liệu này.';
    return mapHrError(detail?.code, 'Không thể tải dữ liệu nhân sự. Vui lòng thử lại.');
}
