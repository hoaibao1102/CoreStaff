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
} from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/card';
import { Button } from '../../components/button';
import { Input } from '../../components/input';
import { Label } from '../../components/label';
import { Skeleton } from '../../components/skeleton';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { FormLabel } from '../../components/form/FormLabel';
import { FormError } from '../../components/form/FormError';
import { toast } from '../../components/toast';
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
            <DialogContent className="group/detail max-h-[90dvh] max-w-4xl gap-0" initialFocus={() => document.getElementById('employee-detail-edit')}>
                <DialogHeader className="border-b border-border px-5 py-5 pr-16 sm:px-6">
                    <DialogTitle className="text-xl font-semibold">Chi tiết nhân viên</DialogTitle>
                    <DialogDescription className="mt-1.5">
                        Thông tin hồ sơ, công việc và lịch sử trạng thái nhân sự.
                    </DialogDescription>
                </DialogHeader>
                <div data-slot="employee-detail-body" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 group-data-[nested-dialog-open]/detail:overflow-hidden sm:px-6">
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
            toast.warning('Vui lòng kiểm tra thông tin', 'Một số trường chưa đầy đủ hoặc chưa đúng.');
            requestAnimationFrame(() => {
                const field = document.getElementById(`edit-${firstErrorField}`);
                field?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                field?.focus();
            });
            return;
        }

        setEditErrors({});
        setSaving(true);
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
            toast.success('Cập nhật hồ sơ thành công', 'Thông tin hồ sơ nhân sự đã được cập nhật.');
        } catch (err: unknown) {
            const code = (err as any)?.code;
            let message: string;
            if (code === 'EMPLOYEE_CODE_TAKEN') {
                message = 'Mã nhân viên này đã được sử dụng. Vui lòng nhập mã khác.';
            } else if (code === 'DEPARTMENT_NOT_FOUND') {
                message = 'Phòng ban đã chọn không còn tồn tại. Vui lòng chọn lại.';
            } else if (code === 'POSITION_NOT_FOUND') {
                message = 'Chức danh đã chọn không còn tồn tại. Vui lòng chọn lại.';
            } else {
                message = mapHrError(code, 'Không thể cập nhật hồ sơ nhân viên lúc này. Vui lòng thử lại.');
            }
            toast.error('Không thể cập nhật hồ sơ', message);
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
        if (!validateStatusChange()) {
            toast.warning('Vui lòng kiểm tra thông tin', 'Hãy hoàn tất các trường được đánh dấu.');
            requestAnimationFrame(() => document.querySelector<HTMLElement>('#status-new[aria-invalid="true"], #status-effective-date[aria-invalid="true"]')?.focus());
            return;
        }

        if (!apiBase || !employeeId || !statusForm.newStatus || !statusForm.effectiveDate) return;

        setStatusErrors({});
        setSaving(true);
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
            setStatusForm({ newStatus: '', effectiveDate: '', reason: '' });
            onChanged?.();
            await loadHistory();
            toast.success('Cập nhật trạng thái thành công', 'Trạng thái nhân sự và lịch sử thay đổi đã được cập nhật.');
        } catch (err: unknown) {
            const code = (err as any)?.code;
            const message = code === 'EMPLOYMENT_STATUS_TRANSITION_INVALID'
                ? 'Trạng thái không thể chuyển đổi theo quy định. Vui lòng kiểm tra lại.'
                : mapHrError(code, 'Không thể thay đổi trạng thái nhân sự lúc này. Vui lòng thử lại.');
            toast.error('Không thể chuyển trạng thái', message);
        } finally {
            setSaving(false);
        }
    };

    const closeStatusDialog = () => {
        if (saving) return;
        setStatusChangeMode(false);
        setStatusForm({ newStatus: '', effectiveDate: '', reason: '' });
        setStatusErrors({});
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

    return <>
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
                        {!editMode && (
                            <>
                                <Button id="employee-detail-edit" variant="outline" size="sm" onClick={() => setEditMode(true)}>
                                    <Pencil className="mr-1.5 h-4 w-4" />
                                    Chỉnh sửa
                                </Button>
                                <Button
                                    id="employee-status-trigger"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStatusChangeMode(true)}
                                    disabled={!validTransitions.length}
                                    title={!validTransitions.length ? 'Nhân viên đang ở trạng thái kết thúc và không thể chuyển tiếp.' : undefined}
                                >
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
                                <Button variant="outline" size="sm" onClick={() => { setEditMode(false); setEditErrors({}); }}>
                                    <X className="mr-1.5 h-4 w-4" />
                                    Hủy
                                </Button>
                            </>
                        )}
                    </div>

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
                                        <select
                                            id="edit-gender"
                                            className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            value={formData.gender}
                                            onChange={(event) => setFormData(prev => ({ ...prev, gender: event.target.value as Gender }))}
                                            disabled={false}
                                        >
                                            <option value="">Chọn giới tính</option>
                                            {Object.entries(GENDER_LABELS).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
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
                            <FieldRow label="Ngày kết thúc" value={employee.endDate ? new Date(employee.endDate).toLocaleDateString('vi-VN') : undefined} />
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
                                                <p className="text-xs text-muted-foreground">Bởi {record.changedByName || record.changedBy}</p>
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

                </>
            ) : null}
        </div>

        <Dialog open={statusChangeMode} onOpenChange={(open) => { if (!open) closeStatusDialog(); }}>
            <DialogContent
                className="max-w-[520px] gap-0"
                backdropClassName="bg-black/35 backdrop-blur-[5px]"
                showCloseButton={!saving}
                initialFocus={() => document.getElementById('status-new')}
                finalFocus={() => document.getElementById('employee-status-trigger')}
            >
                <DialogHeader className="border-b border-border px-5 py-5 pr-14">
                    <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Shield className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                            <DialogTitle>Thay đổi trạng thái</DialogTitle>
                            <DialogDescription className="mt-1.5">
                                Trạng thái hiện tại: {employee ? (EMPLOYMENT_STATUS_LABELS as Record<string, string>)[employee.employmentStatus] : '—'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-6">
                    <div className="space-y-1.5">
                        <FormLabel htmlFor="status-new" required>Trạng thái mới</FormLabel>
                        <select
                            id="status-new"
                            className="block h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={statusForm.newStatus}
                            onChange={(event) => {
                                setStatusForm(prev => ({ ...prev, newStatus: event.target.value as EmploymentStatus }));
                                setStatusErrors(prev => ({ ...prev, newStatus: null }));
                            }}
                            disabled={saving || !validTransitions.length}
                            aria-invalid={!!statusErrors.newStatus}
                        >
                            <option value="">Chọn trạng thái mới</option>
                            {validTransitions.map((status) => <option key={status} value={status}>{(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[status]}</option>)}
                        </select>
                        <FormError message={statusErrors.newStatus} />
                    </div>

                    <div className="space-y-1.5">
                        <FormLabel htmlFor="status-effective-date" required>Ngày hiệu lực</FormLabel>
                        <Input
                            id="status-effective-date"
                            type="date"
                            className="h-11"
                            value={statusForm.effectiveDate}
                            onChange={(event) => {
                                setStatusForm(prev => ({ ...prev, effectiveDate: event.target.value }));
                                setStatusErrors(prev => ({ ...prev, effectiveDate: null }));
                            }}
                            onBlur={() => setStatusErrors(prev => ({ ...prev, effectiveDate: validateStatusEffectiveDate(statusForm.effectiveDate) }))}
                            disabled={saving}
                            aria-invalid={!!statusErrors.effectiveDate}
                        />
                        <FormError message={statusErrors.effectiveDate} />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="status-reason" className="text-sm font-medium">Lý do</Label>
                        <textarea
                            id="status-reason"
                            className="block min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                            value={statusForm.reason}
                            onChange={(event) => setStatusForm(prev => ({ ...prev, reason: event.target.value }))}
                            maxLength={500}
                            disabled={saving}
                            placeholder="Nhập lý do thay đổi trạng thái..."
                        />
                        <p className="text-right text-xs text-muted-foreground">{statusForm.reason.length}/500</p>
                    </div>
                </div>

                <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-muted/30 px-6 py-5">
                    <Button type="button" variant="outline" onClick={closeStatusDialog} disabled={saving}>Hủy</Button>
                    <Button type="button" onClick={handleStatusChange} disabled={saving || !validTransitions.length}>
                        {saving ? 'Đang xử lý…' : 'Xác nhận'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>

    </>;
}
