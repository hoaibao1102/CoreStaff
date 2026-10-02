import { apiUrl } from '../config/api';
import { notifySignedOut, tryRefreshSession } from './auth';
import type {
    ContractStatus,
    ContractType,
    EmploymentStatus,
    EmploymentType,
    Gender,
    InsuranceContributionType,
} from '../lib/types';

// ───────── API Response Types ─────────

export interface DependentItem {
    _id?: string;
    fullName: string;
    dateOfBirth: string;
    idCardNumber?: string;
    relationship: DependentRelationship;
    isDisabled: boolean;
    active?: boolean;
    version?: number;
    /** Trạng thái: ACTIVE = đang tính giảm trừ, INACTIVE = đã vô hiệu hóa (audit trail).
     * Chỉ update qua Edit dialog, không có button vô hiệu hóa riêng. */
    status?: 'ACTIVE' | 'INACTIVE';
}

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
    dependents?: DependentItem[];
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
    /** Owning department — a position lives inside exactly one department. */
    departmentId: string;
    createdAt?: string;
    updatedAt?: string;
}

export type CreatePositionPayload = Pick<Position, 'code' | 'name' | 'departmentId'>;
export type UpdatePositionPayload = Partial<Pick<Position, 'code' | 'name'>>;

/** Department detail — the department plus its positions and active managers. */
export interface DepartmentDetail extends Department {
    positions: Position[];
    managers: Array<{ id: string; fullName: string }>;
}

export interface EligibleEmployeeAccount {
    _id: string;
    fullName: string;
    email: string;
    phone?: string;
    employeeCode?: string;
}

export interface Workplace {
    _id: string;
    code: string;
    name: string;
    address?: string;
    active: boolean;
    organizationId: string;
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

// ── EmploymentContract (TASK-028) ─────────────────────────────────────

export interface EmploymentContract {
    _id: string;
    organizationId: string;
    employeeProfileId: string;
    contractType: ContractType;
    status: ContractStatus;
    effectiveDate: string;
    expiryDate?: string;
    endDate?: string;
    statusReason?: string;
    statusChangedAt?: string;
    note?: string;
    createdAt?: string;
    updatedAt?: string;
    // Derived on-read (TASK-030), and resolved names by the backend.
    isExpiringSoon: boolean;
    isExpired: boolean;
    expiryWarningDays: number | null;
    employeeCode?: string | null;
    employeeFullName?: string | null;
}

export interface ContractCreateDto {
    employeeId: string;
    contractType: ContractType;
    effectiveDate: string;
    expiryDate?: string;
    note?: string;
}

export interface ContractUpdateDto {
    effectiveDate?: string;
    expiryDate?: string;
    note?: string;
}

export interface ContractStatusUpdateDto {
    newStatus: ContractStatus;
    effectiveDate?: string;
    expiryDate?: string;
    reason?: string;
}

// ── InsuranceProfile (TASK-038) — per-employee participation, versioned ──

export interface InsuranceProfile {
    _id: string;
    organizationId: string;
    employeeId: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    participatesSocialInsurance: boolean;
    participatesHealthInsurance: boolean;
    participatesUnemploymentInsurance: boolean;
    note?: string;
    version: number;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface InsuranceProfileCreateDto {
    employeeId: string;
    effectiveFrom: string;
    effectiveTo?: string;
    // Bắt buộc theo luật (D40) — mặc định true ở server nếu bỏ trống; UI luôn gửi true.
    participatesSocialInsurance?: boolean;
    participatesHealthInsurance?: boolean;
    participatesUnemploymentInsurance?: boolean;
    note?: string;
}

// ── InsurancePolicy (TASK-039) — org-wide rate/base/cap, versioned ──────

export interface InsuranceSalaryBaseRule {
    type: InsuranceContributionType;
    floorAmount?: number | null;
}

export interface InsuranceCapRule {
    type: InsuranceContributionType;
    capAmount?: number | null;
}

export interface InsuranceEmployerContributionRate {
    type: InsuranceContributionType;
    rate: number;
}

export interface InsurancePolicy {
    _id: string;
    organizationId: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    version: number;
    legalReference: string;
    socialInsuranceEmployeeRate: number;
    healthInsuranceEmployeeRate: number;
    unemploymentInsuranceEmployeeRate: number;
    salaryBaseRules: InsuranceSalaryBaseRule[];
    capRules: InsuranceCapRule[];
    employerContributionRates: InsuranceEmployerContributionRate[];
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface InsurancePolicyCreateDto {
    effectiveFrom: string;
    effectiveTo?: string;
    legalReference: string;
    socialInsuranceEmployeeRate: number;
    healthInsuranceEmployeeRate: number;
    unemploymentInsuranceEmployeeRate: number;
    salaryBaseRules: InsuranceSalaryBaseRule[];
    capRules: InsuranceCapRule[];
    employerContributionRates: InsuranceEmployerContributionRate[];
}

// ── Dependent (người phụ thuộc) — stored in employee_profiles.dependents ─

/** Dependent relationship codes (theo luật thuế TNCN Việt Nam). */
export type DependentRelationship = 'CHILD' | 'SPOUSE' | 'PARENT' | 'SIBLING';

/** Relationship labels in Vietnamese. */
export const DEPENDENT_RELATIONSHIP_LABELS: Record<DependentRelationship, string> = {
	CHILD: 'Con',
	SPOUSE: 'Vợ/Chồng',
	PARENT: 'Bố/Mẹ',
	SIBLING: 'Anh/Chị/Em ruột',
};
// ── EnterpriseInsurancePolicy (D40) — bảo hiểm thương mại tự nguyện, khác BHXH/BHYT/BHTN ──

export type EnterpriseInsuranceCostBearer = 'EMPLOYER' | 'EMPLOYEE' | 'SHARED';

export interface EnterpriseInsurancePolicy {
    _id: string;
    organizationId: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    version: number;
    provider: string;
    policyNumber?: string;
    coverageDescription: string;
    premiumPerEmployee?: number | null;
    costBearer: EnterpriseInsuranceCostBearer;
    employeeContributionAmount?: number | null;
    note?: string;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface EnterpriseInsurancePolicyCreateDto {
    effectiveFrom: string;
    effectiveTo?: string;
    provider: string;
    policyNumber?: string;
    coverageDescription: string;
    premiumPerEmployee?: number | null;
    costBearer: EnterpriseInsuranceCostBearer;
    employeeContributionAmount?: number | null;
    note?: string;
}

// ── EmployeeDocument (TASK-029) ───────────────────────────────────────

export interface EmployeeDocument {
    _id: string;
    organizationId: string;
    employeeProfileId: string;
    contractId?: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
    createdAt: string;
}

// ───────── API Error Codes ─────────

/**
 * HR_ERROR_CODES — ánh xạ lỗi kỹ thuật từ API sang ngôn ngữ nghiệp vụ HR.
 * Tuyệt đối không hiển thị thông báo kỹ thuật cho người dùng cuối.
 */
export const HR_ERROR_CODES: Record<string, string> = {
    // Assignment errors
    AT_LEAST_ONE_FILTER_REQUIRED: 'Vui lòng chọn trạng thái hoặc nơi làm việc để lọc dữ liệu.',
    USER_NOT_FOUND_IN_TENANT: 'Không tìm thấy nhân viên trong tổ chức hiện tại.',
    DEPARTMENT_NOT_FOUND_OR_NOT_IN_TENANT: 'Phòng ban không tồn tại hoặc không thuộc tổ chức hiện tại.',
    WORKPLACE_NOT_FOUND_OR_NOT_IN_TENANT: 'Nơi làm việc không tồn tại hoặc không thuộc tổ chức hiện tại.',
    ASSIGNMENT_NOT_FOUND: 'Không tìm thấy phân công.',
    OVERLAPPING_ASSIGNMENT_EXISTS: 'Khoảng thời gian phân công bị trùng với phân công hiện có.',
    EMPLOYEE_ASSIGNMENT_ALREADY_EXISTS: 'Nhân viên đã có phân công tương ứng.',

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
    POSITION_CODE_TAKEN: 'Mã chức danh này đã tồn tại trong phòng ban. Vui lòng chọn mã khác.',
    POSITION_DEPARTMENT_MISMATCH: 'Chức danh không thuộc phòng ban đã chọn.',
    MANAGER_NOT_FOUND: 'Không tìm thấy quản lý trực tiếp này trong tổ chức.',
    WORKPLACE_NOT_FOUND: 'Nơi làm việc đã chọn không còn tồn tại.',

    // Status transition errors
    EMPLOYMENT_STATUS_TRANSITION_INVALID: 'Trạng thái không thể chuyển đổi theo quy định nhân sự.',

    // Contract errors (TASK-028/030)
    EMPLOYMENT_CONTRACT_NOT_FOUND: 'Không tìm thấy hợp đồng lao động.',
    EMPLOYMENT_CONTRACT_ALREADY_EXISTS: 'Hợp đồng cho nhân viên này đã tồn tại.',
    CONTRACT_EXPIRY_REQUIRED: 'Hợp đồng có thời hạn phải có ngày hết hạn.',
    CONTRACT_INDEFINITE_TERM_NO_EXPIRY: 'Hợp đồng không thời hạn không được có ngày hết hạn.',
    CONTRACT_EXPIRY_BEFORE_EFFECTIVE: 'Ngày hết hạn phải sau ngày hiệu lực.',
    EMPLOYMENT_CONTRACT_STATUS_TRANSITION_INVALID: 'Trạng thái hợp đồng không thể chuyển đổi như yêu cầu.',
    CONTRACT_TERMINATION_DATE_REQUIRED: 'Khi chấm dứt hợp đồng cần cung cấp ngày hiệu lực (ngày chấm dứt).',
    CONTRACT_RENEWAL_DATES_REQUIRED: 'Khi gia hạn hợp đồng cần cung cấp ngày hiệu lực và ngày hết hạn mới.',
    EMPLOYMENT_CONTRACT_OVERLAPS_ACTIVE: 'Nhân viên này đã có hợp đồng đang hiệu lực trùng khoảng thời gian đó.',

    // Document errors (TASK-029)
    EMPLOYEE_DOCUMENT_NOT_FOUND: 'Không tìm thấy tài liệu của nhân viên.',
    EMPLOYEE_DOCUMENT_FILE_REQUIRED: 'Vui lòng chọn tệp để tải lên.',
    EMPLOYEE_DOCUMENT_FILE_TOO_LARGE: 'Tệp quá lớn. Giới hạn tải lên là 10 MB.',
    EMPLOYEE_DOCUMENT_TYPE_NOT_ALLOWED: 'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, ảnh hoặc tài liệu văn phòng.',

    // Compensation errors (TASK-031..035)
    SALARY_PROFILE_NOT_FOUND: 'Không tìm thấy hồ sơ lương.',
    INVALID_PROBATION_SALARY: 'Lương thử việc không hợp lệ.',
    PROBATION_SALARY_BELOW_MINIMUM: 'Lương thử việc thấp hơn mức tối thiểu theo quy định chính sách lao động.',
    EFFECTIVE_DATE_RANGE_INVALID: 'Khoảng thời gian hiệu lực không hợp lệ.',
    EFFECTIVE_DATE_OVERLAP: 'Khoảng thời gian hiệu lực bị trùng với hồ sơ hiện có.',
    ALLOWANCE_CROSS_TENANT_FORBIDDEN: 'Phụ cấp được chọn không thuộc tổ chức hiện tại hoặc đã hết hiệu lực.',
    ATTENDANCE_BONUS_POLICY_INVALID: 'Chính sách thưởng chuyên cần không hợp lệ.',
    LABOR_POLICY_NOT_FOUND: 'Không tìm thấy chính sách tuân thủ lao động có hiệu lực.',
    ALLOWANCE_CATALOG_NOT_FOUND: 'Không tìm thấy phụ cấp trong danh mục chuẩn.',
    ALLOWANCE_CODE_NAME_REQUIRED: 'Vui lòng nhập mã và tên phụ cấp.',
    ALLOWANCE_CODE_TAKEN: 'Mã phụ cấp này đã được sử dụng trong tổ chức.',
    ORGANIZATION_ALLOWANCE_NOT_FOUND: 'Không tìm thấy phụ cấp của tổ chức.',
    ATTENDANCE_BONUS_TEMPLATE_NOT_FOUND: 'Không tìm thấy mẫu thưởng chuyên cần.',
    ATTENDANCE_BONUS_POLICY_NOT_FOUND: 'Không tìm thấy chính sách thưởng chuyên cần.',
    ATTENDANCE_BONUS_AMOUNT_INVALID: 'Số tiền thưởng chuyên cần không hợp lệ.',
    ATTENDANCE_BONUS_PERCENTAGE_INVALID: 'Tỷ lệ phần trăm thưởng chuyên cần phải từ 0 đến 100%.',
    KPI_INPUT_NOT_FOUND: 'Không tìm thấy dữ liệu KPI.',
    KPI_INPUT_ALREADY_EXISTS: 'Nhân viên này đã có dữ liệu KPI trong kỳ lương được chọn.',
    KPI_INPUT_CONFIRMED_IMMUTABLE: 'Dữ liệu KPI đã được xác nhận và không thể chỉnh sửa.',
    KPI_INPUT_NOT_DRAFT: 'Chỉ có thể xác nhận bản ghi KPI ở trạng thái Nháp.',

    // Insurance Profile errors (TASK-038)
    INSURANCE_PROFILE_NOT_FOUND: 'Không tìm thấy hồ sơ tham gia bảo hiểm.',
    INSURANCE_PROFILE_NOT_EFFECTIVE: 'Nhân viên chưa có hồ sơ tham gia bảo hiểm hiệu lực tại thời điểm này.',
    INSURANCE_PROFILE_DATE_RANGE_INVALID: 'Ngày hiệu lực đến phải sau ngày hiệu lực từ.',
    INSURANCE_PROFILE_PERIOD_OVERLAPS: 'Khoảng thời gian hiệu lực bị trùng với hồ sơ bảo hiểm hiện có của nhân viên này.',
    INSURANCE_PROFILE_ALREADY_CLOSED: 'Hồ sơ này đã có ngày kết thúc hiệu lực rồi.',

    // Insurance Policy errors (TASK-039)
    INSURANCE_POLICY_NOT_FOUND: 'Không tìm thấy chính sách bảo hiểm.',
    INSURANCE_POLICY_NOT_CONFIGURED: 'Chưa có chính sách bảo hiểm hiệu lực tại thời điểm tính.',
    INSURANCE_POLICY_DATE_RANGE_INVALID: 'Ngày hiệu lực đến phải sau ngày hiệu lực từ.',
    INSURANCE_POLICY_PERIOD_OVERLAPS: 'Khoảng thời gian hiệu lực bị trùng với chính sách bảo hiểm hiện có.',
    INSURANCE_POLICY_FLOOR_ABOVE_CAP: 'Mức sàn của một khoản bảo hiểm đang lớn hơn mức trần. Vui lòng kiểm tra lại.',
    SALARYBASERULES_MUST_COVER_ALL_TYPES: 'Vui lòng cấu hình mức sàn cho đủ cả 3 khoản BHXH, BHYT, BHTN.',
    CAPRULES_MUST_COVER_ALL_TYPES: 'Vui lòng cấu hình mức trần cho đủ cả 3 khoản BHXH, BHYT, BHTN.',
    EMPLOYERCONTRIBUTIONRATES_MUST_COVER_ALL_TYPES: 'Vui lòng cấu hình tỷ lệ đóng của doanh nghiệp cho đủ cả 3 khoản BHXH, BHYT, BHTN.',
    INSURANCE_POLICY_ALREADY_CLOSED: 'Chính sách này đã có ngày kết thúc hiệu lực rồi.',

    // Enterprise Insurance Policy errors (D40)
    ENTERPRISE_INSURANCE_POLICY_NOT_FOUND: 'Không tìm thấy bảo hiểm doanh nghiệp.',
    ENTERPRISE_INSURANCE_POLICY_NOT_CONFIGURED: 'Chưa có bảo hiểm doanh nghiệp hiệu lực tại thời điểm này.',
    ENTERPRISE_INSURANCE_POLICY_DATE_RANGE_INVALID: 'Ngày hiệu lực đến phải sau ngày hiệu lực từ.',
    ENTERPRISE_INSURANCE_POLICY_PERIOD_OVERLAPS: 'Khoảng thời gian hiệu lực bị trùng với bảo hiểm doanh nghiệp hiện có.',
    ENTERPRISE_INSURANCE_EMPLOYEE_CONTRIBUTION_NOT_ALLOWED: 'Công ty đã chọn tự chi trả toàn bộ — không thể nhập số tiền nhân viên đóng góp.',
    ENTERPRISE_INSURANCE_POLICY_ALREADY_CLOSED: 'Bảo hiểm doanh nghiệp này đã có ngày kết thúc hiệu lực rồi.',

    // Overtime errors (TASK-066..071, D38/D39)
    OVERTIME_SELF_TYPE_FORBIDDEN: 'Hệ thống tự xác định loại tăng ca từ lịch và calendar, bạn không chọn thủ công.',
    OVERTIME_WINDOW_INVALID: 'Giờ kết thúc phải sau giờ bắt đầu.',
    OVERTIME_REQUEST_WINDOW_INVALID: 'Khung giờ tăng ca đề xuất không hợp lệ. Vui lòng kiểm tra lại giờ bắt đầu và kết thúc.',
    OVERTIME_OVERLAP: 'Khoảng thời gian này trùng với một yêu cầu tăng ca đang chờ hoặc đã duyệt trong ngày.',
    OVERTIME_OVERLAPS_SCHEDULE: 'Giờ tăng ca không được nằm trong ca làm việc được phân công của ngày này. Hãy đăng ký phần ngoài ca (trước hoặc sau ca).',
    OVERTIME_FILING_WINDOW_CLOSED: 'Đã quá hạn cho phép để bổ sung yêu cầu tăng ca của ngày này. Vui lòng liên hệ HR.',
    OVERTIME_RETROACTIVE_REASON_REQUIRED: 'Yêu cầu gửi trễ hạn, vui lòng nhập lý do bổ sung (tối thiểu 10 ký tự).',
    OVERTIME_DEPARTMENT_UNKNOWN: 'Chưa xác định được phòng ban của nhân viên để tính tăng ca.',
    OVERTIME_RESULT_NOT_FOUND: 'Không tìm thấy kết quả tính tăng ca cho yêu cầu này.',
    OVERTIME_NOT_APPROVED: 'Chưa có yêu cầu tăng ca được duyệt cho khoảng thời gian này.',
    OVERTIME_RECALCULATION_REQUIRED: 'Lịch hoặc calendar của ngày này đã thay đổi, hệ thống cần tính lại tăng ca.',
    OVERTIME_DATE_RANGE_INVALID: 'Khoảng ngày không hợp lệ.',
    OVERTIME_DATE_RANGE_TOO_LARGE: 'Khoảng ngày yêu cầu quá dài, tối đa 366 ngày.',
    NORMAL_HOURS_LIMIT_EXCEEDED: 'Giờ làm việc bình thường đã vượt giới hạn theo Chính sách tuân thủ lao động.',
    OVERTIME_DAILY_LIMIT_EXCEEDED: 'Tổng giờ làm việc trong ngày (gồm tăng ca) vượt giới hạn theo chính sách lao động.',
    OVERTIME_MONTHLY_LIMIT_EXCEEDED: 'Giờ tăng ca trong tháng vượt giới hạn theo chính sách lao động.',
    OVERTIME_ANNUAL_LIMIT_EXCEEDED: 'Giờ tăng ca trong năm vượt giới hạn theo chính sách lao động.',
    // `LABOR_POLICY_NOT_FOUND` already maps in the salary/policy block above.
    SELF_APPROVAL_FORBIDDEN: 'Bạn không thể tự duyệt yêu cầu của chính mình.',
    REVIEW_REASON_REQUIRED: 'Vui lòng nhập lý do (tối thiểu 10 ký tự) khi từ chối hoặc yêu cầu giải trình.',
    REQUEST_STATE_CHANGED: 'Yêu cầu đã được xử lý bởi người khác. Vui lòng tải lại danh sách.',

    // Validation errors
    VALIDATION_FAILED: 'Thông tin bạn nhập chưa hợp lệ. Vui lòng kiểm tra lại các trường có đánh dấu lỗi.',

    // Payroll export errors
    PAYROLL_RUN_NOT_EXPORTABLE: 'Chỉ có thể xuất Excel khi bảng lương ở trạng thái Đã khóa hoặc Đã phát hành.',

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
    return send<T>(base, path, options, true);
}

/**
 * Same 401 → refresh → retry-once dance as services/auth.ts, so every HR call
 * survives an expired session cookie the way the SRS §4.4 refresh is meant to.
 * `allowRefresh=false` on the retry stops a second expiry from looping.
 */
async function send<T>(base: string, path: string, options: RequestInit | undefined, allowRefresh: boolean): Promise<T> {
    const res = await fetch(apiUrl(base, path), {
        ...options,
        credentials: 'include',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            ...(options?.headers || {}),
        },
    });

    // `allowRefresh` is what bounds the loop: a retry that still gets 401 (a
    // real permission error behind a valid session) must not refresh again.
    if (res.status === 401 && allowRefresh) {
        // Same rule as services/auth.ts: renewal failed for good, so the app
        // must drop to the login screen rather than show a dead page.
        if (await tryRefreshSession(base)) return send<T>(base, path, options, false);
        notifySignedOut();
    }

    // HTTP 304 Not Modified: browser cache hit, no body. Return empty array
    // so callers like listTaxPolicies don't receive null and crash.
    if (res.status === 304) return [] as unknown as T;

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

    // Backend có thể trả về { success: true, data: T } hoặc trực tiếp T (array/object)
    if (body && typeof body === 'object' && 'success' in body) {
        // Có wrapper { success: true, data: ... }
        if (body.success !== true) {
            throw new Error('Phản hồi từ máy chủ không hợp lệ.');
        }
        return (body as ApiSuccess<T>).data as T;
    }
    // Không có wrapper — trả về luôn body
    return body as T;
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

export async function getDepartmentById(base: string, id: string): Promise<DepartmentDetail> {
    return hrRequest<DepartmentDetail>(base, `/api/hr/departments/${encodeURIComponent(id)}`, { method: 'GET' });
}

export async function getWorkplaces(base: string): Promise<Workplace[]> {
    return hrRequest<Workplace[]>(base, '/api/hr/workplaces', { method: 'GET' });
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

export async function getPositions(base: string, opts: { departmentId?: string; activeOnly?: boolean } = {}): Promise<Position[]> {
    const params = new URLSearchParams();
    if (opts.activeOnly !== undefined) params.set('active', String(opts.activeOnly));
    if (opts.departmentId) params.set('departmentId', opts.departmentId);
    return hrRequest<Position[]>(
        base,
        `/api/hr/positions${params.size ? `?${params}` : ''}`,
        { method: 'GET' },
    );
}

export async function getPositionById(base: string, id: string): Promise<Position> { return hrRequest<Position>(base, `/api/hr/positions/${encodeURIComponent(id)}`, { method: 'GET' }); }
export async function createPosition(base: string, payload: CreatePositionPayload): Promise<Position> { return hrRequest<Position>(base, '/api/hr/positions', { method: 'POST', body: JSON.stringify(payload) }); }
export async function updatePosition(base: string, id: string, payload: UpdatePositionPayload): Promise<Position> { return hrRequest<Position>(base, `/api/hr/positions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }); }
export async function activatePosition(base: string, id: string): Promise<Position> { return hrRequest<Position>(base, `/api/hr/positions/${encodeURIComponent(id)}/activate`, { method: 'PATCH' }); }
export async function deactivatePosition(base: string, id: string): Promise<Position> { return hrRequest<Position>(base, `/api/hr/positions/${encodeURIComponent(id)}/deactivate`, { method: 'PATCH' }); }

// ── Timesheet Period (TASK-072) ───────────────────────────────────────

export type TimesheetPeriodStatus = 'OPEN' | 'REVIEWING' | 'READY_TO_CLOSE' | 'CLOSED';

export interface TimesheetPeriod {
    _id: string;
    organizationId: string;
    period: string; // YYYY-MM
    status: TimesheetPeriodStatus;
    version: number;
    startDate: string;
    endDate: string;
    managerSnapshotClosed?: boolean;
    managerSnapshotClosedBy?: string;
    managerSnapshotClosedAt?: string;
    departmentSnapshots?: Array<{ departmentId: string; managerUserId: string; closedAt: string }>;
    closedBy?: string;
    closedAt?: string;
    reopenReason?: string;
    reopenedBy?: string;
    reopenedAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateTimesheetPeriodDto {
    period: string; // YYYY-MM
    startDate: string;
    endDate: string;
}

export interface ReopenTimesheetPeriodDto {
    reason: string;
}

export async function getTimesheetPeriods(
    base: string,
    status?: TimesheetPeriodStatus,
): Promise<TimesheetPeriod[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    return hrRequest<TimesheetPeriod[]>(
        base,
        `/api/hr/timesheet-periods${params.size ? `?${params}` : ''}`,
        { method: 'GET' },
    );
}

export async function getTimesheetPeriodById(
    base: string,
    id: string,
): Promise<TimesheetPeriod> {
    return hrRequest<TimesheetPeriod>(base, `/api/hr/timesheet-periods/${encodeURIComponent(id)}`, { method: 'GET' });
}

export async function createTimesheetPeriod(
    base: string,
    dto: CreateTimesheetPeriodDto,
): Promise<TimesheetPeriod> {
    return hrRequest<TimesheetPeriod>(base, '/api/hr/timesheet-periods', {
        method: 'POST',
        body: JSON.stringify(dto),
    });
}

export async function updateTimesheetPeriodStatus(
    base: string,
    id: string,
    status: TimesheetPeriodStatus,
): Promise<TimesheetPeriod> {
    return hrRequest<TimesheetPeriod>(base, `/api/hr/timesheet-periods/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}

export async function reopenTimesheetPeriod(
    base: string,
    id: string,
    dto: ReopenTimesheetPeriodDto,
): Promise<TimesheetPeriod> {
    return hrRequest<TimesheetPeriod>(base, `/api/hr/timesheet-periods/${encodeURIComponent(id)}/reopen`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
    });
}

export async function previewManagerSnapshot(
    base: string,
    id: string,
    departmentId: string,
): Promise<{ summaries: any[] }> {
    return hrRequest<{ summaries: any[] }>(
        base,
        `/api/hr/timesheet-periods/${encodeURIComponent(id)}/snapshot-preview?departmentId=${encodeURIComponent(departmentId)}`,
        { method: 'GET' },
    );
}

export async function closeManagerSnapshot(
    base: string,
    id: string,
    departmentId: string,
): Promise<{ period: TimesheetPeriod; summariesCreated: number; snapshotsCreated: number }> {
    return hrRequest<{ period: TimesheetPeriod; summariesCreated: number; snapshotsCreated: number }>(
        base,
        `/api/hr/timesheet-periods/${encodeURIComponent(id)}/close-snapshot`,
        {
            method: 'POST',
            body: JSON.stringify({ departmentId }),
        },
    );
}

export async function hrClosePeriod(base: string, id: string): Promise<{ period: TimesheetPeriod }> {
    return hrRequest<{ period: TimesheetPeriod }>(base, `/api/hr/timesheet-periods/${encodeURIComponent(id)}/close`, {
        method: 'POST',
    });
}

// ── Period blockers (TASK-074) ────────────────────────────────────────

export type PeriodBlockerType =
    | 'MISSING_CHECK_IN'
    | 'MISSING_CHECK_OUT'
    | 'PENDING_APPROVAL'
    | 'PENDING_CLARIFICATION'
    | 'REJECTED';

export interface PeriodBlockerRow {
    id: string;
    type: PeriodBlockerType;
    attendanceDayId: string;
    employeeId: string;
    employee: { code?: string; name?: string; departmentId?: string; department?: string };
    date: string;
    note: string;
    dayResult?: string;
    attendanceStatus?: string;
    overallApprovalStatus?: string;
    checkInAt?: string | null;
    checkOutAt?: string | null;
}

export interface PeriodBlockerPage {
    total: number;
    page: number;
    limit: number;
    items: PeriodBlockerRow[];
    summary: Array<{ type: PeriodBlockerType; message: string; count: number }>;
}

export async function getPeriodBlockers(
    base: string,
    id: string,
    opts: { type?: PeriodBlockerType; departmentId?: string; page?: number; limit?: number } = {},
): Promise<PeriodBlockerPage> {
    const params = new URLSearchParams();
    if (opts.type) params.set('type', opts.type);
    if (opts.departmentId) params.set('departmentId', opts.departmentId);
    if (opts.page) params.set('page', String(opts.page));
    if (opts.limit) params.set('limit', String(opts.limit));
    return hrRequest<PeriodBlockerPage>(
        base,
        `/api/hr/timesheet-periods/${encodeURIComponent(id)}/blockers${params.size ? `?${params}` : ''}`,
        { method: 'GET' },
    );
}

export interface AttendanceDayDetail {
    day: {
        _id: string;
        workDate: string;
        workdayType?: string;
        dayResult?: string;
        attendanceStatus?: string;
        overallApprovalStatus?: string;
        checkInAt?: string | null;
        checkOutAt?: string | null;
        workingMinutes?: number;
        lateMinutes?: number;
        earlyMinutes?: number;
        employeeSnapshot?: { employeeCode?: string; fullName?: string; departmentName?: string };
    };
    events: Array<{
        _id: string;
        eventType: string;
        method: string;
        recordedAt: string;
        approvalStatus?: string;
        evidenceId?: string;
        address?: string;
    }>;
    request: {
        _id: string;
        status: string;
        reason?: string;
        reviewComment?: string;
        reviewedAt?: string;
    } | null;
}

export async function getPeriodDayDetail(
    base: string,
    id: string,
    dayId: string,
): Promise<AttendanceDayDetail> {
    return hrRequest<AttendanceDayDetail>(
        base,
        `/api/hr/timesheet-periods/${encodeURIComponent(id)}/days/${encodeURIComponent(dayId)}`,
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

// ── Employment Contracts (HR-only, TASK-028/030) ──────────────────────

export async function listContracts(
    base: string,
    options?: { employeeId?: string; status?: string },
): Promise<EmploymentContract[]> {
    const params = new URLSearchParams();
    if (options?.employeeId) params.set('employeeId', options.employeeId);
    if (options?.status) params.set('status', options.status);
    return hrRequest<EmploymentContract[]>(base, `/api/hr/contracts?${params}`, { method: 'GET' });
}

export async function getContractById(base: string, id: string): Promise<EmploymentContract> {
    return hrRequest<EmploymentContract>(base, `/api/hr/contracts/${encodeURIComponent(id)}`, { method: 'GET' });
}

/** Read-only compliance findings (mirrors api `ContractFindingCode`). */
export type ContractFindingCode = 'NO_CONTRACT' | 'EXPIRED_NOT_RENEWED' | 'ACTIVE_PAST_EXPIRY' | 'PROBATION_OVERDUE';

export interface ContractFinding {
    code: ContractFindingCode;
    employeeProfileId: string;
    employeeCode?: string | null;
    employeeFullName?: string | null;
    employmentStatus?: string;
    contractId?: string;
    contractType?: string;
    lastExpiryDate?: string;
    daysPastExpiry?: number;
}

export interface ContractCompliance {
    findings: ContractFinding[];
    counts: Partial<Record<ContractFindingCode, number>>;
}

export async function getContractCompliance(base: string): Promise<ContractCompliance> {
    return hrRequest<ContractCompliance>(base, '/api/hr/contracts/compliance', { method: 'GET' });
}

export async function createContract(base: string, dto: ContractCreateDto): Promise<EmploymentContract> {
    return hrRequest<EmploymentContract>(base, '/api/hr/contracts', {
        method: 'POST',
        body: JSON.stringify(dto),
    });
}

export async function updateContract(base: string, id: string, dto: ContractUpdateDto): Promise<EmploymentContract> {
    return hrRequest<EmploymentContract>(base, `/api/hr/contracts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
    });
}

export async function updateContractStatus(
    base: string,
    id: string,
    dto: ContractStatusUpdateDto,
): Promise<EmploymentContract> {
    return hrRequest<EmploymentContract>(base, `/api/hr/contracts/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
    });
}

/* ── Employee Documents (TASK-029) ────────────────────────────────────
 * Uploads and downloads must NOT go through hrRequest: hrRequest forces
 * `Content-Type: application/json`, which breaks the multipart boundary that
 * the browser generates for FormData. Raw fetch keeps `credentials` and omits
 * the header; the server parses the multipart fields via multer. */

export async function listDocuments(
    base: string,
    options?: { employeeId?: string; contractId?: string },
): Promise<EmployeeDocument[]> {
    const params = new URLSearchParams();
    if (options?.employeeId) params.set('employeeId', options.employeeId);
    if (options?.contractId) params.set('contractId', options.contractId);
    return hrRequest<EmployeeDocument[]>(base, `/api/hr/documents?${params}`, { method: 'GET' });
}

export async function getMyDocuments(base: string): Promise<EmployeeDocument[]> {
    return hrRequest<EmployeeDocument[]>(base, '/api/app/documents', { method: 'GET' });
}

export interface UploadDocumentResult {
    _id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    employeeProfileId: string;
    contractId?: string;
}

/** Multipart upload via raw fetch — never set Content-Type manually. */
export function uploadDocument(
    base: string,
    dto: { employeeProfileId: string; contractId?: string },
    file: File,
): Promise<UploadDocumentResult> {
    const form = new FormData();
    form.append('employeeProfileId', dto.employeeProfileId);
    if (dto.contractId) form.append('contractId', dto.contractId);
    form.append('file', file);

    // Raw fetch keeps multipart's boundary out of our hands; the same
    // 401 → refresh → retry-once applies, so it goes through `fetchRaw`.
    return fetchRaw<UploadDocumentResult>(base, '/api/hr/documents/upload', { method: 'POST', body: form }, true);
}

async function fetchRaw<T>(base: string, path: string, options: RequestInit, allowRefresh: boolean): Promise<T> {
    const res = await fetch(apiUrl(base, path), { ...options, credentials: 'include' });

    if (res.status === 401 && allowRefresh) {
        if (await tryRefreshSession(base)) return fetchRaw<T>(base, path, options, false);
        notifySignedOut();
    }

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

/** Get a signed-out-of-band download: fetch the blob, open an object URL, click
 * the anchor with `download` set, then revoke. Safe against path-tampering —
 * the server derives Content-Disposition from the stored originalName, and the
 * endpoint is tenant+owner scoped. */
export async function downloadDocument(base: string, id: string): Promise<void> {
    const res = await fetch(apiUrl(base, `/api/hr/documents/${encodeURIComponent(id)}/download`), {
        method: 'GET',
        credentials: 'include',
    });
    if (!res.ok) {
        const body = await parseJson<ApiFailure>(res);
        const code = body?.success === false ? body.error?.code : undefined;
        const error = new Error(body?.success === false ? body.error?.message : `HTTP ${res.status}`);
        (error as any).code = code;
        (error as any).status = res.status;
        throw error;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function deleteDocument(base: string, id: string): Promise<void> {
    return hrRequest<undefined>(base, `/api/hr/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ── Insurance Profiles (HR-only, TASK-038) ─────────────────────────────
// Never updated in place — a correction is a new effective-dated version.

export async function listInsuranceProfiles(base: string, employeeId?: string): Promise<InsuranceProfile[]> {
    const params = new URLSearchParams();
    if (employeeId) params.set('employeeId', employeeId);
    return hrRequest<InsuranceProfile[]>(base, `/api/hr/insurance-profiles?${params}`, { method: 'GET' });
}

export async function getInsuranceProfileById(base: string, id: string): Promise<InsuranceProfile> {
    return hrRequest<InsuranceProfile>(base, `/api/hr/insurance-profiles/${encodeURIComponent(id)}`, { method: 'GET' });
}

export async function createInsuranceProfile(base: string, dto: InsuranceProfileCreateDto): Promise<InsuranceProfile> {
    return hrRequest<InsuranceProfile>(base, '/api/hr/insurance-profiles', {
        method: 'POST',
        body: JSON.stringify(dto),
    });
}

/** D42 — the only allowed mutation on an existing record: closes an open-ended one so a next version can be created. */
export async function closeInsuranceProfile(base: string, id: string, effectiveTo: string): Promise<InsuranceProfile> {
    return hrRequest<InsuranceProfile>(base, `/api/hr/insurance-profiles/${encodeURIComponent(id)}/close`, {
        method: 'PATCH',
        body: JSON.stringify({ effectiveTo }),
    });
}

// ── Insurance Policy (HR-only, TASK-039) ───────────────────────────────
// Org-wide rate/base/cap engine input — never updated in place.

export async function listInsurancePolicies(base: string): Promise<InsurancePolicy[]> {
    return hrRequest<InsurancePolicy[]>(base, '/api/hr/policies/insurance', { method: 'GET' });
}

export async function getInsurancePolicyById(base: string, id: string): Promise<InsurancePolicy> {
    return hrRequest<InsurancePolicy>(base, `/api/hr/policies/insurance/${encodeURIComponent(id)}`, { method: 'GET' });
}

export async function createInsurancePolicy(base: string, dto: InsurancePolicyCreateDto): Promise<InsurancePolicy> {
    return hrRequest<InsurancePolicy>(base, '/api/hr/policies/insurance', {
        method: 'POST',
        body: JSON.stringify(dto),
    });
}

// ── Dependent CRUD (embedded in EmployeeProfile) ───────────────────────

export async function addDependent(
    base: string,
    employeeId: string,
    dependent: {
        fullName: string;
        dateOfBirth: string;
        idCardNumber?: string;
        relationship: DependentRelationship;
        isDisabled: boolean;
    },
): Promise<DependentItem> {
    return hrRequest<DependentItem>(base, `/api/hr/employees/${employeeId}/dependents`, {
        method: 'POST',
        body: JSON.stringify(dependent),
    });
}

export async function updateDependent(
    base: string,
    dependentId: string,
    dependent: {
        fullName?: string;
        dateOfBirth?: string;
        idCardNumber?: string;
        relationship?: DependentRelationship;
        isDisabled?: boolean;
        status?: 'ACTIVE' | 'INACTIVE';
    },
): Promise<DependentItem> {
    return hrRequest<DependentItem>(base, `/api/hr/dependents/${encodeURIComponent(dependentId)}`, {
        method: 'PUT',
        body: JSON.stringify(dependent),
    });
}

export async function removeDependent(
    base: string,
    employeeId: string,
    index: number,
): Promise<EmployeeProfile> {
    return hrRequest<EmployeeProfile>(base, `/api/hr/employees/${employeeId}/dependents/${index}`, {
        method: 'DELETE',
    });
}

// ── Tax Policy (HR-only, TASK-041) ─────────────────────────────────────

export interface TaxBracket {
    upperLimit: number | null;
    rate: number;
}

export interface TaxPolicy {
    _id: string;
    organizationId: string;
    effectiveFrom: string;
    effectiveTo?: string;
    personalDeduction: number;
    standardDeduction?: number;
    dependentDeduction: number;
    progressiveBrackets: TaxBracket[];
    roundingRule: string;
    legalReference: string;
    version: number;
    active: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface PitCalculationParams {
    grossEarnings: number;
    insuranceBaseSalary: number;
    personalDeduction: number;
    dependentDeduction: number;
    dependentCount: number;
    brackets: TaxBracket[];
    roundingRule?: string;
    earningBreakdown?: Record<string, number>;
}

export interface PitResult {
    taxableIncome: number;
    insuranceDeduction: number;
    personalDeduction: number;
    dependentDeduction: number;
    totalDeductions: number;
    taxableEarnings: number;
    pit: number;
    roundingRule: string;
}

/** List all tax policies for the organization */
export async function listTaxPolicies(base: string): Promise<TaxPolicy[]> {
    return hrRequest<TaxPolicy[]>(base, '/api/hr/policies/tax', { method: 'GET' });
}

/** Create a new TaxPolicy version */
export async function createTaxPolicy(
    base: string,
    dto: {
        effectiveFrom: string;
        effectiveTo?: string;
        standardDeduction: number;
        personalDeduction: number;
        dependentDeduction: number;
        progressiveBrackets: TaxBracket[];
        roundingRule?: string;
        legalReference: string;
    },
): Promise<TaxPolicy> {
    return hrRequest<TaxPolicy>(base, '/api/hr/policies/tax', {
        method: 'POST',
        body: JSON.stringify(dto),
    });
}

/** Update TaxPolicy (creates new version) */
export async function updateTaxPolicy(
    base: string,
    id: string,
    dto: Partial<{
        effectiveFrom: string;
        effectiveTo: string;
        standardDeduction: number;
        personalDeduction: number;
        dependentDeduction: number;
        progressiveBrackets: TaxBracket[];
        roundingRule: string;
        legalReference: string;
    }>,
): Promise<TaxPolicy> {
    return hrRequest<TaxPolicy>(base, `/api/hr/policies/tax/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
    });
}

/** D42 — the only allowed mutation on an existing policy: closes an open-ended one so a next version can be created. */
export async function closeInsurancePolicy(base: string, id: string, effectiveTo: string): Promise<InsurancePolicy> {
    return hrRequest<InsurancePolicy>(base, `/api/hr/policies/insurance/${encodeURIComponent(id)}/close`, {
        method: 'PATCH',
        body: JSON.stringify({ effectiveTo }),
    });
}

// ── Enterprise Insurance Policy (HR-only, D40) ─────────────────────────
// Voluntary commercial policy (accident/health…), org-wide, never updated in place.

export async function listEnterpriseInsurancePolicies(base: string): Promise<EnterpriseInsurancePolicy[]> {
    return hrRequest<EnterpriseInsurancePolicy[]>(base, '/api/hr/policies/enterprise-insurance', { method: 'GET' });
}

export async function getEnterpriseInsurancePolicyById(base: string, id: string): Promise<EnterpriseInsurancePolicy> {
    return hrRequest<EnterpriseInsurancePolicy>(base, `/api/hr/policies/enterprise-insurance/${encodeURIComponent(id)}`, { method: 'GET' });
}

export async function createEnterpriseInsurancePolicy(base: string, dto: EnterpriseInsurancePolicyCreateDto): Promise<EnterpriseInsurancePolicy> {
    return hrRequest<EnterpriseInsurancePolicy>(base, '/api/hr/policies/enterprise-insurance', {
        method: 'POST',
        body: JSON.stringify(dto),
    });
}
    
/** Get effective TaxPolicy at a specific date */
export async function getEffectiveTaxPolicy(base: string, date?: string): Promise<TaxPolicy | null> {
    const params = date ? `?date=${date}` : '';
    return hrRequest<TaxPolicy | null>(base, `/api/hr/policies/tax/effective${params}`, { method: 'GET' });
}

/** Preview PIT calculation using current effective policy */
export async function previewPIT(
    base: string,
    params: Omit<PitCalculationParams, 'brackets' | 'personalDeduction' | 'dependentDeduction' | 'roundingRule'>,
): Promise<PitResult> {
    return hrRequest<PitResult>(base, '/api/hr/policies/tax/preview-pit', {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

/** D42 — the only allowed mutation on an existing policy: closes an open-ended one so a next version can be created. */
export async function closeEnterpriseInsurancePolicy(base: string, id: string, effectiveTo: string): Promise<EnterpriseInsurancePolicy> {
    return hrRequest<EnterpriseInsurancePolicy>(base, `/api/hr/policies/enterprise-insurance/${encodeURIComponent(id)}/close`, {
        method: 'PATCH',
        body: JSON.stringify({ effectiveTo }),
    });
}
