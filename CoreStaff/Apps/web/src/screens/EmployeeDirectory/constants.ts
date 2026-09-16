/**
 * Constants cho Employee Directory module.
 * Chứa option lists, regex patterns và giá trị mặc định.
 */

export const EMPLOYEE_CODE_PREFIXES: Record<string, string> = {
    HR: 'HR',
    IT: 'IT',
    MKT: 'MKT',
    SALES: 'SALES',
    FIN: 'FIN',
    OPS: 'OPS',
};

export const DEFAULT_EMPLOYEE_FORM_VALUES = {
    userId: '',
    employeeCode: '',
    employmentType: 'FULL_TIME' as const,
    joinDate: new Date().toISOString().slice(0, 10),
    dateOfBirth: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    citizenId: '',
    taxCode: '',
    socialInsuranceCode: '',
    bankAccount: '',
    departmentId: '',
    positionId: '',
    directManagerId: '',
    workplaceId: '',
} as const;

export const EMPLOYEE_FORM_FIELDS = [
    { key: 'userId', label: 'User ID', required: true },
    { key: 'employeeCode', label: 'Mã nhân viên', required: true },
    { key: 'joinDate', label: 'Ngày vào làm', required: true },
    { key: 'dateOfBirth', label: 'Ngày sinh', required: false },
    { key: 'gender', label: 'Giới tính', required: false },
    { key: 'phone', label: 'Số điện thoại', required: false },
    { key: 'email', label: 'Email nhân sự', required: false },
    { key: 'address', label: 'Địa chỉ', required: false },
    { key: 'citizenId', label: 'CCCD/CMND', required: false },
    { key: 'taxCode', label: 'Mã số thuế', required: false },
    { key: 'socialInsuranceCode', label: 'Số BHXH', required: false },
    { key: 'bankAccount', label: 'Tài khoản ngân hàng', required: false },
    { key: 'departmentId', label: 'Phòng ban', required: false },
    { key: 'positionId', label: 'Chức danh', required: false },
    { key: 'directManagerId', label: 'Quản lý trực tiếp', required: false },
    { key: 'workplaceId', label: 'Nơi làm việc', required: false },
] as const;
