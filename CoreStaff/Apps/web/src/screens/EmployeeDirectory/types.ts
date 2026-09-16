import type { EmployeeProfile, Department, Position, EmployeeCreateDto } from '../../services/hrService';

export type { EmployeeProfile, Department, Position };

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

/** State của form tạo nhân viên */
export interface EmployeeFormState {
    userId: string;
    employeeCode: string;
    employmentType: EmploymentType;
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
    employeeCode?: string | null;
    joinDate?: string | null;
    dateOfBirth?: string | null;
    phone?: string | null;
    email?: string | null;
    citizenId?: string | null;
    taxCode?: string | null;
    socialInsuranceCode?: string | null;
    bankAccount?: string | null;
    departmentId?: string | null;
    positionId?: string | null;
    directManagerId?: string | null;
    general?: string | null;
}

/** DTO gửi lên server khi tạo nhân viên */
export interface EmployeeCreatePayload extends Omit<EmployeeCreateDto, 'employmentType'> {
    employmentType: EmploymentType;
}

/** Props của dialog tạo nhân viên */
export interface EmployeeCreateDialogProps {
    apiBase: string;
    open: boolean;
    departments: Department[];
    positions: Position[];
    onOpenChange: (open: boolean) => void;
    onCreated: (employee: EmployeeProfile) => void;
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
