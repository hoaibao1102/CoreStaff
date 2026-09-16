import { hrErrorMessage, mapHrError } from '../../services/hrService';
import { useState, useCallback, useEffect } from 'react';
import {
    User,
    Briefcase,
    Shield,
    Pencil,
    Save,
    X,
    History,
    AlertCircle,
} from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/card';
import { Button } from '../../components/button';
import { Input } from '../../components/input';
import { Label } from '../../components/label';
import { Select } from '../../components/select';
import { Skeleton } from '../../components/skeleton';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { FormLabel } from '../../components/form/FormLabel';
import { FormError } from '../../components/form/FormError';
import {
    EMPLOYMENT_STATUS_LABELS,
    EMPLOYMENT_STATUS_BADGE,
    EMPLOYMENT_STATUS_TRANSITIONS,
    EMPLOYMENT_TYPE_LABELS,
    GENDER_LABELS,
    type EmploymentStatus,
    type EmploymentType,
    type Gender,
} from '../../lib/types';
import {
    getEmployeeById,
    updateEmployee,
    changeEmploymentStatus,
    getEmployeeHistory,
    getDepartments,
    getPositions,
    type EmployeeProfile,
    type EmploymentHistoryRecord,
} from '../../services/hrService';
import {
    validateEditPhone,
    validateEditEmail,
    validateEditDateOfBirth,
    validateEditJoinDate,
    validateStatusEffectiveDate,
} from './validation';

/* ───────── Field Row (display mode) ───────── */
interface FieldRowProps {
    label: string;
    value: string | null | undefined;
}

function FieldRow({ label, value }: FieldRowProps) {
    return (
        <div className="space-y-1">
            <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
            <dd className="break-words font-medium text-foreground">
                {value?.trim() || (
                    <span className="text-muted-foreground italic">Chưa có thông tin</span>
                )}
            </dd>
        </div>
    );
}

/* ───────── Profile Section ───────── */
interface ProfileSectionProps {
    title: string;
    description?: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    loading?: boolean;
}

function ProfileSection({ title, description, icon: Icon, children, loading }: ProfileSectionProps) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                        <CardTitle className="text-base">{title}</CardTitle>
                        {description && <p className="text-sm text-muted-foreground">{description}</p>}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-5 w-full" />
                            </div>
                        ))}
                    </div>
                ) : (
                    children
                )}
            </CardContent>
        </Card>
    );
}

/* ───────── Edit Field (edit mode) ───────── */
interface EditFieldProps {
    label: string;
    required?: boolean;
    value: string | undefined;
    onChange: (value: string) => void;
    onBlur?: () => void;
    disabled?: boolean;
    type?: string;
    error?: string | null;
    helperText?: string;
    inputMode?: React.InputHTMLAttributes<HTMLInputElement>['inputMode'];
    maxLength?: number;
}

function EditField({ label, required, value, onChange, onBlur, disabled, type = 'text', error, helperText, inputMode, maxLength }: EditFieldProps) {
    const fieldId = `edit-${label}`;
    return (
        <div className="space-y-1.5">
            <FormLabel htmlFor={fieldId} required={required}>
                {label}
            </FormLabel>
            <Input
                id={fieldId}
                className="h-10"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                disabled={disabled}
                type={type}
                inputMode={inputMode}
                maxLength={maxLength}
                aria-invalid={!!error}
                aria-describedby={helperText ? `${fieldId}-hint` : undefined}
            />
            {helperText && !error && (
                <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
                    {helperText}
                </p>
            )}
            <FormError message={error} />
        </div>
    );
}

/* ───────── Detail Modal ───────── */
export function EmployeeDetailDialog(props: {
    user: AuthUser;
    apiBase: string;
    employeeId: string;
    onClose: () => void;
    onChanged?: () => void;
}) {
    return (
        <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
            <DialogContent className="max-w-4xl gap-0" initialFocus={() => document.getElementById('employee-detail-edit')}>
                <DialogHeader className="border-b border-border px-5 py-5 pr-16 sm:px-6">
                    <DialogTitle className="text-xl font-semibold">Chi tiết nhân viên</DialogTitle>
                    <DialogDescription className="mt-1.5">
                        Thông tin hồ sơ, công việc và lịch sử trạng thái nhân sự.
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
                    <EmployeeDetailContent key={`${props.apiBase}:${props.employeeId}:${props.user.organizationId}:${props.user._id ?? props.user.id}`} {...props} />
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ───────── Main Content ───────── */
function EmployeeDetailContent({
    user,
    apiBase,
    employeeId,
    onChanged,
}: {
    user: AuthUser;
    apiBase: string;
    employeeId: string;
    onChanged?: () => void;
}) {
    const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
    const [history, setHistory] = useState<EmploymentHistoryRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [statusChangeMode, setStatusChangeMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    /* Edit form state */
    const [formData, setFormData] = useState({
        employeeCode: '',
        employmentType: '' as EmploymentType | '',
        joinDate: '',
        dateOfBirth: '',
        gender: '' as Gender | '',
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
    });

    /* Edit validation errors */
    const [editErrors, setEditErrors] = useState<Record<string, string | null>>({});

    /* Status change form state */
    const [statusForm, setStatusForm] = useState({
        newStatus: '' as EmploymentStatus | '',
        effectiveDate: '',
        reason: '',
    });

    /* Status validation errors */
    const [statusErrors, setStatusErrors] = useState<Record<string, string | null>>({});

    const loadEmployee = useCallback(async () => {
        if (!apiBase || !employeeId) return;
        setLoading(true);
        setError(null);
        try {
            const [data, departments, positions] = await Promise.all([
                getEmployeeById(apiBase, employeeId),
                getDepartments(apiBase, true),
                getPositions(apiBase, true),
            ]);
            // Build lookup maps for client-side name resolution
            const deptMap = new Map(departments.map(d => [d._id, d.name]));
            const posMap = new Map(positions.map(p => [p._id, p.name]));
            // Resolve names from IDs
            const enriched: EmployeeProfile = {
                ...data,
                departmentName: data.departmentId ? (deptMap.get(data.departmentId) ?? data.departmentName) : undefined,
                positionName: data.positionId ? (posMap.get(data.positionId) ?? data.positionName) : undefined,
            };
            setEmployee(enriched);
            setFormData({
                employeeCode: data.employeeCode,
                employmentType: data.employmentType,
                joinDate: data.joinDate ? new Date(data.joinDate).toISOString().split('T')[0] : '',
                dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().split('T')[0] : '',
                gender: data.gender || '',
                phone: data.phone || '',
                email: data.email || '',
                address: data.address || '',
                citizenId: data.citizenId || '',
                taxCode: data.taxCode || '',
                socialInsuranceCode: data.socialInsuranceCode || '',
                bankAccount: data.bankAccount || '',
                departmentId: data.departmentId || '',
                positionId: data.positionId || '',
                directManagerId: data.directManagerId || '',
                workplaceId: data.workplaceId || '',
            });
        } catch (err: unknown) {
            const status = (err as any)?.status;
            if (status === 404) {
                setError(mapHrError((err as any)?.code, 'Không tìm thấy hồ sơ nhân viên.'));
            } else if (status === 401) {
                setError(hrErrorMessage(err));
            } else if (status === 403) {
                setError('Bạn không có quyền xem hồ sơ này.');
            } else {
                setError(mapHrError((err as any)?.code, 'Không thể tải thông tin nhân viên.'));
            }
        } finally {
            setLoading(false);
        }
    }, [apiBase, employeeId]);

    const loadHistory = useCallback(async () => {
        if (!apiBase || !employeeId) return;
        try {
            setHistoryLoading(true);
            setHistoryError(false);
            const data = await getEmployeeHistory(apiBase, employeeId);
            setHistory(data);
        } catch {
            setHistoryError(true);
        } finally {
            setHistoryLoading(false);
        }
    }, [apiBase, employeeId]);

    useEffect(() => {
        loadEmployee();
        loadHistory();
    }, [loadEmployee, loadHistory]);

    /* ── Edit Validation ── */
    const validateEditField = useCallback((field: string, value: string): string | null => {
        switch (field) {
            case 'phone':
                return validateEditPhone(value);
            case 'email':
                return validateEditEmail(value);
            case 'dateOfBirth':
                return validateEditDateOfBirth(value);
            case 'joinDate':
                return validateEditJoinDate(value);
            default:
                return null;
        }
    }, []);

    const handleEditBlur = useCallback((field: string) => {
        const value = formData[field as keyof typeof formData] as string;
        const error = validateEditField(field, value);
        setEditErrors(prev => ({
            ...prev,
            [field]: error,
        }));
    }, [formData, validateEditField]);

    const handleSave = async () => {
        if (!apiBase || !employeeId) return;

        // Validate all editable fields
        const errors: Record<string, string | null> = {};
        const phoneError = validateEditPhone(formData.phone);
        if (phoneError) errors.phone = phoneError;

        const emailError = validateEditEmail(formData.email);
        if (emailError) errors.email = emailError;

        const dobError = validateEditDateOfBirth(formData.dateOfBirth);
        if (dobError) errors.dateOfBirth = dobError;

        const joinDateError = validateEditJoinDate(formData.joinDate);
        if (joinDateError) errors.joinDate = joinDateError;

        if (Object.keys(errors).length > 0) {
            setEditErrors(errors);
            const firstErrorField = Object.keys(errors)[0];
            setTimeout(() => document.getElementById(`edit-${firstErrorField}`)?.focus(), 0);
            return;
        }

        setEditErrors({});
        setSaving(true);
        setActionError(null);
        try {
            const updates: Record<string, string | undefined> = {};
            for (const [key, value] of Object.entries(formData)) {
                if (key !== 'employeeCode' && value !== '' && value !== undefined) {
                    updates[key] = value as string;
                }
            }
            const updated = await updateEmployee(apiBase, employeeId, updates as any);
            setEmployee(previous => previous ? { ...previous, ...updated } : updated);
            setEditMode(false);
            onChanged?.();
        } catch (err: unknown) {
            const code = (err as any)?.code;
            if (code === 'EMPLOYEE_CODE_TAKEN') {
                setActionError('Mã nhân viên này đã được sử dụng. Vui lòng nhập mã khác.');
            } else if (code === 'DEPARTMENT_NOT_FOUND') {
                setActionError('Phòng ban đã chọn không còn tồn tại. Vui lòng chọn lại.');
            } else if (code === 'POSITION_NOT_FOUND') {
                setActionError('Chức danh đã chọn không còn tồn tại. Vui lòng chọn lại.');
            } else {
                setActionError(mapHrError(code, 'Không thể cập nhật hồ sơ nhân viên lúc này. Vui lòng thử lại.'));
            }
        } finally {
            setSaving(false);
        }
    };

    /* ── Status Change Validation ── */
    const validateStatusChange = useCallback((): boolean => {
        const errors: Record<string, string | null> = {};

        if (!statusForm.newStatus) {
            errors.newStatus = 'Vui lòng chọn trạng thái mới.';
        }

        const effectiveDateError = validateStatusEffectiveDate(statusForm.effectiveDate);
        if (effectiveDateError) errors.effectiveDate = effectiveDateError;

        setStatusErrors(errors);
        return Object.keys(errors).length === 0;
    }, [statusForm]);

    const handleStatusChange = async () => {
        if (!validateStatusChange()) return;

        if (!apiBase || !employeeId || !statusForm.newStatus || !statusForm.effectiveDate) return;

        setStatusErrors({});
        setSaving(true);
        setActionError(null);
        try {
            const updated = await changeEmploymentStatus(
                apiBase,
                employeeId,
                statusForm.newStatus,
                statusForm.effectiveDate,
                statusForm.reason || undefined,
            );
            setEmployee(previous => previous ? { ...previous, ...updated } : updated);
            setStatusChangeMode(false);
            onChanged?.();
            loadHistory();
        } catch (err: unknown) {
            const code = (err as any)?.code;
            if (code === 'EMPLOYMENT_STATUS_TRANSITION_INVALID') {
                setActionError('Trạng thái không thể chuyển đổi theo quy định. Vui lòng kiểm tra lại.');
            } else {
                setActionError(mapHrError(code, 'Không thể thay đổi trạng thái nhân sự lúc này. Vui lòng thử lại.'));
            }
        } finally {
            setSaving(false);
        }
    };

    /* Error state */
    if (error && !loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                        Chi tiết nhân viên
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Thông tin chi tiết và lịch sử nhân sự.
                    </p>
                </div>
                <EmployeeDataState
                    status="error"
                    message={error}
                    onRetry={loadEmployee}
                />
            </div>
        );
    }

    /* Forbidden state */
    if (!loading && !employee && !error) {
        return <EmployeeDataState status="forbidden" />;
    }

    const validTransitions = employee
        ? (EMPLOYMENT_STATUS_TRANSITIONS as Record<string, string[]>)[employee.employmentStatus] || []
        : [];

    return (
        <div className="space-y-6">
            {/* Loading state */}
            {loading ? (
                <div className="space-y-6">
                    <ProfileSection title="Thông tin cá nhân" icon={User} loading>
                        <dl className="grid gap-4 sm:grid-cols-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-5 w-full" />
                                </div>
                            ))}
                        </dl>
                    </ProfileSection>
                </div>
            ) : employee ? (
                <>
                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                        {!editMode && !statusChangeMode && (
                            <>
                                <Button id="employee-detail-edit" variant="outline" size="sm" onClick={() => setEditMode(true)}>
                                    <Pencil className="mr-1.5 h-4 w-4" />
                                    Chỉnh sửa
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setStatusChangeMode(true)}>
                                    <Shield className="mr-1.5 h-4 w-4" />
                                    Thay đổi trạng thái
                                </Button>
                            </>
                        )}
                        {editMode && (
                            <>
                                <Button size="sm" onClick={handleSave} disabled={saving}>
                                    <Save className="mr-1.5 h-4 w-4" />
                                    {saving ? 'Đang lưu…' : 'Lưu'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { setEditMode(false); setActionError(null); setEditErrors({}); }}>
                                    <X className="mr-1.5 h-4 w-4" />
                                    Hủy
                                </Button>
                            </>
                        )}
                        {statusChangeMode && (
                            <>
                                <Button size="sm" onClick={handleStatusChange} disabled={saving || !statusForm.newStatus || !statusForm.effectiveDate}>
                                    <Save className="mr-1.5 h-4 w-4" />
                                    {saving ? 'Đang xử lý…' : 'Xác nhận'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { setStatusChangeMode(false); setActionError(null); setStatusErrors({}); }}>
                                    <X className="mr-1.5 h-4 w-4" />
                                    Hủy
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Action error */}
                    {actionError && (
                        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {actionError}
                        </div>
                    )}

                    {/* Profile Summary */}
                    <Card className="rounded-xl border-border shadow-none">
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className="rounded-full bg-primary/10 p-4 text-primary">
                                <User className="h-8 w-8" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-semibold text-foreground">{employee.employeeCode}</h2>
                                <p className="text-sm text-muted-foreground">
                                    {(EMPLOYMENT_TYPE_LABELS as Record<string, string>)[employee.employmentType]}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${(EMPLOYMENT_STATUS_BADGE as Record<string, string>)[employee.employmentStatus]}`}>
                                    {(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[employee.employmentStatus]}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Personal Information */}
                    {editMode ? (
                        <Card className="rounded-xl border-border shadow-none">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <CardTitle className="text-base">Chỉnh sửa thông tin</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    <EditField
                                        label="Mã nhân viên"
                                        value={formData.employeeCode}
                                        onChange={(v) => setFormData(prev => ({ ...prev, employeeCode: v }))}
                                        disabled
                                    />
                                    <EditField
                                        label="Ngày vào làm"
                                        required
                                        value={formData.joinDate}
                                        onChange={(v) => setFormData(prev => ({ ...prev, joinDate: v }))}
                                        onBlur={() => handleEditBlur('joinDate')}
                                        type="date"
                                        error={editErrors.joinDate}
                                    />
                                    <EditField
                                        label="Ngày sinh"
                                        value={formData.dateOfBirth}
                                        onChange={(v) => setFormData(prev => ({ ...prev, dateOfBirth: v }))}
                                        onBlur={() => handleEditBlur('dateOfBirth')}
                                        type="date"
                                        error={editErrors.dateOfBirth}
                                    />
                                    <div className="space-y-1.5">
                                        <FormLabel htmlFor="edit-gender">Giới tính</FormLabel>
                                        <Select
                                            id="edit-gender"
                                            value={formData.gender}
                                            onValueChange={(v) => setFormData(prev => ({ ...prev, gender: v as Gender }))}
                                            disabled={false}
                                        >
                                            <option value="">Chọn giới tính</option>
                                            {Object.entries(GENDER_LABELS).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </Select>
                                    </div>
                                    <EditField
                                        label="Số điện thoại"
                                        value={formData.phone}
                                        onChange={(v) => setFormData(prev => ({ ...prev, phone: v.replace(/[^\d]/g, '').slice(0, 10) }))}
                                        onBlur={() => handleEditBlur('phone')}
                                        inputMode="numeric"
                                        maxLength={10}
                                        error={editErrors.phone}
                                        helperText={editErrors.phone ? undefined : 'Chỉ nhập số, đủ 10 chữ số.'}
                                    />
                                    <EditField
                                        label="Email"
                                        value={formData.email}
                                        onChange={(v) => setFormData(prev => ({ ...prev, email: v }))}
                                        onBlur={() => handleEditBlur('email')}
                                        type="email"
                                        error={editErrors.email}
                                    />
                                    <EditField
                                        label="Địa chỉ"
                                        value={formData.address}
                                        onChange={(v) => setFormData(prev => ({ ...prev, address: v }))}
                                    />
                                    <EditField
                                        label="CCCD/CMND"
                                        value={formData.citizenId}
                                        onChange={(v) => setFormData(prev => ({ ...prev, citizenId: v.replace(/[^\d]/g, '').slice(0, 12) }))}
                                    />
                                    <EditField
                                        label="Mã số thuế"
                                        value={formData.taxCode}
                                        onChange={(v) => setFormData(prev => ({ ...prev, taxCode: v.replace(/[^\d]/g, '').slice(0, 12) }))}
                                    />
                                    <EditField
                                        label="Số BHXH"
                                        value={formData.socialInsuranceCode}
                                        onChange={(v) => setFormData(prev => ({ ...prev, socialInsuranceCode: v.replace(/[^\d]/g, '').slice(0, 12) }))}
                                    />
                                    <EditField
                                        label="Tài khoản ngân hàng"
                                        value={formData.bankAccount}
                                        onChange={(v) => setFormData(prev => ({ ...prev, bankAccount: v.replace(/[^\d]/g, '').slice(0, 17) }))}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <ProfileSection
                            title="Thông tin cá nhân"
                            description="Thông tin cá nhân của nhân viên"
                            icon={User}
                        >
                            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <FieldRow label="Mã nhân viên" value={employee.employeeCode} />
                                <FieldRow label="Ngày vào làm" value={employee.joinDate ? new Date(employee.joinDate).toLocaleDateString('vi-VN') : undefined} />
                                <FieldRow label="Ngày sinh" value={employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString('vi-VN') : undefined} />
                                <FieldRow label="Giới tính" value={employee.gender ? (GENDER_LABELS as Record<string, string>)[employee.gender] : undefined} />
                                <FieldRow label="Số điện thoại" value={employee.phone} />
                                <FieldRow label="Email" value={employee.email} />
                                <FieldRow label="Địa chỉ" value={employee.address} />
                                <FieldRow label="CCCD/CMND" value={employee.citizenId} />
                                <FieldRow label="Mã số thuế" value={employee.taxCode} />
                                <FieldRow label="Số BHXH" value={employee.socialInsuranceCode} />
                                <FieldRow label="Tài khoản ngân hàng" value={employee.bankAccount} />
                            </dl>
                        </ProfileSection>
                    )}

                    {/* Employment Information */}
                    <ProfileSection
                        title="Thông tin tuyển dụng"
                        description="Thông tin công việc và tổ chức"
                        icon={Briefcase}
                    >
                        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <FieldRow label="Loại lao động" value={(EMPLOYMENT_TYPE_LABELS as Record<string, string>)[employee.employmentType]} />
                            <FieldRow label="Trạng thái" value={(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[employee.employmentStatus]} />
                            <FieldRow label="Phòng ban" value={employee.departmentName || undefined} />
                            <FieldRow label="Chức danh" value={employee.positionName || undefined} />
                            <FieldRow label="Quản lý trực tiếp" value={employee.managerName || undefined} />
                            <FieldRow label="Nơi làm việc" value={employee.workplaceName || undefined} />
                        </dl>
                    </ProfileSection>

                    {/* Employment History */}
                    <Card className="rounded-xl border-border shadow-none">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                    <History className="h-4 w-4" />
                                </div>
                                <CardTitle className="text-base">Lịch sử trạng thái</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {historyLoading ? <EmployeeDataState status="loading" /> : historyError ? <EmployeeDataState status="error" onRetry={loadHistory} /> : history.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Chưa có lịch sử thay đổi trạng thái.</p>
                            ) : (
                                <div className="space-y-3">
                                    {history.map((record) => (
                                        <div key={record._id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-foreground">
                                                    {(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[record.previousStatus]} → {(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[record.newStatus]}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(record.effectiveDate).toLocaleDateString('vi-VN')}
                                                    {record.reason && ` · ${record.reason}`}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">Bởi {record.changedBy}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(record.createdAt).toLocaleDateString('vi-VN')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Status Change Form */}
                    {statusChangeMode && (
                        <Card className="rounded-xl border-border shadow-none">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                        <Shield className="h-4 w-4" />
                                    </div>
                                    <CardTitle className="text-base">Thay đổi trạng thái nhân sự</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <FormLabel htmlFor="status-new" required>
                                            Trạng thái mới
                                        </FormLabel>
                                        <Select
                                            id="status-new"
                                            value={statusForm.newStatus}
                                            onValueChange={(v) => setStatusForm(prev => ({ ...prev, newStatus: v as EmploymentStatus }))}
                                            disabled={!validTransitions.length}
                                        >
                                            <option value="">Chọn trạng thái mới</option>
                                            {validTransitions.map((status) => (
                                                <option key={status} value={status}>
                                                    {(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[status]}
                                                </option>
                                            ))}
                                        </Select>
                                        {!validTransitions.length && (
                                            <p className="text-xs text-muted-foreground">
                                                Không có trạng thái nào có thể chuyển đổi từ {(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[employee.employmentStatus]}.
                                            </p>
                                        )}
                                        <FormError message={statusErrors.newStatus} />
                                    </div>
                                    <EditField
                                        label="Ngày hiệu lực"
                                        required
                                        value={statusForm.effectiveDate}
                                        onChange={(v) => setStatusForm(prev => ({ ...prev, effectiveDate: v }))}
                                        onBlur={() => {
                                            const error = validateStatusEffectiveDate(statusForm.effectiveDate);
                                            setStatusErrors(prev => ({ ...prev, effectiveDate: error }));
                                        }}
                                        type="date"
                                        error={statusErrors.effectiveDate}
                                    />
                                    <div className="space-y-1.5 sm:col-span-2">
                                        <Label htmlFor="status-reason" className="text-xs font-medium text-muted-foreground">
                                            Lý do
                                        </Label>
                                        <textarea
                                            id="status-reason"
                                            className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                                            rows={3}
                                            value={statusForm.reason}
                                            onChange={(e) => setStatusForm(prev => ({ ...prev, reason: e.target.value }))}
                                            placeholder="Nhập lý do thay đổi trạng thái..."
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            ) : null}
        </div>
    );
}
