import type { AuthUser } from '../../services/auth';
import type { EmployeeProfile, Department, Position, EmployeeCreateDto, EligibleEmployeeAccount } from '../../services/hrService';

export type { EmployeeProfile, Department, Position };

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

/** State của form tạo nhân viên */
export interface EmployeeFormState {
    userId: string;
    fullName: string;
    employeeCode: string;
    employmentType: EmploymentType | '';
    joinDate: string;
    dateOfBirth: string;
    gender: Gender | '';
    phone: string;
    email: string;
    address: string;
    citizenId: string;
    taxCode: string;
    socialInsuranceCode: string;
    bankAccount: string;
    departmentId: string;
    positionId: string;
    directManagerId: string;
    workplaceId: string;
}

/** Validation errors của từng field trong form */
export interface EmployeeFormErrors {
    userId?: string | null;
    fullName?: string | null;
    employeeCode?: string | null;
    employmentType?: string | null;
    joinDate?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    citizenId?: string | null;
    taxCode?: string | null;
    socialInsuranceCode?: string | null;
    bankAccount?: string | null;
    departmentId?: string | null;
    positionId?: string | null;
    directManagerId?: string | null;
    workplaceId?: string | null;
    general?: string | null;
}

/** DTO gửi lên server khi tạo nhân viên */
export type EmployeeCreatePayload = EmployeeCreateDto;

/** Props của dialog tạo nhân viên */
export interface EmployeeCreateDialogProps {
    apiBase: string;
    open: boolean;
    /** Phase C: render the form for the caller's own profile (`/hr/employees/me`).
     * No account picker, no mode toggle; fullName is locked to the session name
     * and the server copies email/phone from the account. Requires `user`. */
    meMode?: boolean;
    user?: AuthUser;
    departments: Department[];
    positions: Position[];
    accounts: EligibleEmployeeAccount[];
    managers: EmployeeProfile[];
    accountsFailed?: boolean;
    onRetryAccounts?: () => void;
    onOpenChange: (open: boolean) => void;
    /** Result: link mode → the profile; provisioning mode → profile + tempPassword (once). */
    onCreated: (employee: EmployeeProfile & { tempPassword?: string }) => void;
}

/** Props của dialog tự tạo hồ sơ (Phase C) — dùng chung form, chặn mode tài
 * khoản. Tự tải danh mục (phòng ban/chức danh/manager) khi mở. */
export interface SelfProvisionDialogProps {
    apiBase: string;
    open: boolean;
    user: AuthUser;
    onOpenChange: (open: boolean) => void;
    onCreated: () => void;
}

/** Props của dialog chỉnh sửa nhân viên */
export interface EmployeeEditDialogProps {
    apiBase: string;
    open: boolean;
    employee: EmployeeProfile;
    departments: Department[];
    positions: Position[];
    managers: EmployeeProfile[];
    onOpenChange: (open: boolean) => void;
    onSave: (employee: EmployeeProfile) => void;
}
