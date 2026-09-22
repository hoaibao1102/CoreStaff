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
    Coins,
    Plus,
} from 'lucide-react';
import {
    listSalaryProfiles,
    getOrganizationAllowances,
    type SalaryProfile,
    type OrganizationAllowance,
} from '../../services/compensation.service';
import {
    SalaryProfileCreateDialog,
    SalaryProfileEditDialog,
} from '../Compensation/SalaryProfileDialogs';

function formatVnd(val?: number | null): string {
    if (val === undefined || val === null || Number.isNaN(val)) return '—';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}
import { cn } from 'cn';
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
    getWorkplaces,
    getEmployees,
    type EmployeeProfile,
    type EmploymentHistoryRecord,
    type Department,
    type Position,
    type Workplace,
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
    action?: React.ReactNode;
}

function ProfileSection({ title, description, icon: Icon, children, loading, action }: ProfileSectionProps) {
    return (
        <Card className="rounded-xl border-border shadow-none">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div>
                            <CardTitle className="text-base">{title}</CardTitle>
                            {description && <p className="text-sm text-muted-foreground">{description}</p>}
                        </div>
                    </div>
                    {action && <div>{action}</div>}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
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

type TabType = 'personal' | 'employment' | 'compensation' | 'status';

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

    // Active sub-tab
    const [activeTab, setActiveTab] = useState<TabType>('personal');

    // Reference data for lookups & selects
    const [departments, setDepartments] = useState<Department[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
    const [managers, setManagers] = useState<EmployeeProfile[]>([]);

    // Mode states per tab
    const [personalEditMode, setPersonalEditMode] = useState(false);
    const [savingPersonal, setSavingPersonal] = useState(false);

    const [employmentEditMode, setEmploymentEditMode] = useState(false);
    const [savingEmployment, setSavingEmployment] = useState(false);

    const [statusChangeMode, setStatusChangeMode] = useState(false);
    const [savingStatus, setSavingStatus] = useState(false);

    /* Tab 1: Personal info form state */
    const [personalForm, setPersonalForm] = useState({
        employeeCode: '',
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
    });
    const [personalErrors, setPersonalErrors] = useState<Record<string, string | null>>({});

    /* Tab 2: Employment info form state */
    const [employmentForm, setEmploymentForm] = useState({
        employmentType: '' as EmploymentType | '',
        joinDate: '',
        departmentId: '',
        positionId: '',
        directManagerId: '',
        workplaceId: '',
    });
    const [employmentErrors, setEmploymentErrors] = useState<Record<string, string | null>>({});

    /* Tab 3: Status change form state */
    const [statusForm, setStatusForm] = useState({
        newStatus: '' as EmploymentStatus | '',
        effectiveDate: '',
        reason: '',
    });
    const [statusErrors, setStatusErrors] = useState<Record<string, string | null>>({});

    const loadEmployee = useCallback(async () => {
        if (!apiBase || !employeeId) return;
        setLoading(true);
        setError(null);
        try {
            const [data, deptList, posList, workplaceList, empList] = await Promise.all([
                getEmployeeById(apiBase, employeeId),
                getDepartments(apiBase, true).catch(() => []),
                getPositions(apiBase, true).catch(() => []),
                getWorkplaces(apiBase).catch(() => []),
                getEmployees(apiBase).catch(() => ({ employees: [] })),
            ]);

            setDepartments(Array.isArray(deptList) ? deptList : []);
            setPositions(Array.isArray(posList) ? posList : []);
            setWorkplaces(Array.isArray(workplaceList) ? workplaceList : []);
            const allEmps: EmployeeProfile[] = Array.isArray(empList) ? empList : (empList?.employees ?? []);
            setManagers(allEmps.filter(e => e.userId !== data.userId));

            // Build lookup maps for client-side name resolution
            const deptMap = new Map((Array.isArray(deptList) ? deptList : []).map(d => [d._id, d.name]));
            const posMap = new Map((Array.isArray(posList) ? posList : []).map(p => [p._id, p.name]));
            const wpMap = new Map((Array.isArray(workplaceList) ? workplaceList : []).map(w => [w._id, w.name]));
            const mgrMap = new Map(allEmps.map(e => [e.userId, e.fullName || e.employeeCode]));

            const enriched: EmployeeProfile = {
                ...data,
                departmentName: data.departmentId ? (deptMap.get(data.departmentId) ?? data.departmentName) : undefined,
                positionName: data.positionId ? (posMap.get(data.positionId) ?? data.positionName) : undefined,
                workplaceName: data.workplaceId ? (wpMap.get(data.workplaceId) ?? data.workplaceName) : undefined,
                managerName: data.directManagerId ? (mgrMap.get(data.directManagerId) ?? data.managerName) : undefined,
            };

            setEmployee(enriched);

            const formattedJoinDate = data.joinDate ? new Date(data.joinDate).toISOString().split('T')[0] : '';
            const formattedDob = data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().split('T')[0] : '';

            setPersonalForm({
                employeeCode: data.employeeCode || '',
                joinDate: formattedJoinDate,
                dateOfBirth: formattedDob,
                gender: data.gender || '',
                phone: data.phone || '',
                email: data.email || '',
                address: data.address || '',
                citizenId: data.citizenId || '',
                taxCode: data.taxCode || '',
                socialInsuranceCode: data.socialInsuranceCode || '',
                bankAccount: data.bankAccount || '',
            });

            setEmploymentForm({
                employmentType: data.employmentType || '',
                joinDate: formattedJoinDate,
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

    // Compensation state
    const [salaryProfile, setSalaryProfile] = useState<SalaryProfile | null>(null);
    const [allOrgAllowances, setAllOrgAllowances] = useState<OrganizationAllowance[]>([]);
    const [compLoading, setCompLoading] = useState(false);
    const [createSalaryOpen, setCreateSalaryOpen] = useState(false);
    const [editSalaryOpen, setEditSalaryOpen] = useState(false);

    const loadCompensation = useCallback(async () => {
        if (!apiBase || !employeeId) return;
        setCompLoading(true);
        try {
            const [profiles, orgAllowances] = await Promise.all([
                listSalaryProfiles(apiBase, employeeId).catch(() => []),
                getOrganizationAllowances(apiBase).catch(() => []),
            ]);
            const active = profiles.find(p => p.active) || profiles[0] || null;
            setSalaryProfile(active);
            setAllOrgAllowances(orgAllowances);
        } catch {
            // Keep existing state
        } finally {
            setCompLoading(false);
        }
    }, [apiBase, employeeId]);

    useEffect(() => {
        loadEmployee();
        loadHistory();
        loadCompensation();
    }, [loadEmployee, loadHistory, loadCompensation]);

    /* ── Tab 1: Personal Info Validation & Save ── */
    const handlePersonalBlur = useCallback((field: string) => {
        let error: string | null = null;
        if (field === 'phone') error = validateEditPhone(personalForm.phone);
        else if (field === 'email') error = validateEditEmail(personalForm.email);
        else if (field === 'dateOfBirth') error = validateEditDateOfBirth(personalForm.dateOfBirth);
        else if (field === 'joinDate') error = validateEditJoinDate(personalForm.joinDate);

        setPersonalErrors(prev => ({ ...prev, [field]: error }));
    }, [personalForm]);

    const handleSavePersonal = async () => {
        if (!apiBase || !employeeId) return;

        const errors: Record<string, string | null> = {};
        const phoneError = validateEditPhone(personalForm.phone);
        if (phoneError) errors.phone = phoneError;

        const emailError = validateEditEmail(personalForm.email);
        if (emailError) errors.email = emailError;

        const dobError = validateEditDateOfBirth(personalForm.dateOfBirth);
        if (dobError) errors.dateOfBirth = dobError;

        const joinDateError = validateEditJoinDate(personalForm.joinDate);
        if (joinDateError) errors.joinDate = joinDateError;

        if (Object.keys(errors).length > 0) {
            setPersonalErrors(errors);
            toast.warning('Vui lòng kiểm tra thông tin', 'Một số trường chưa đầy đủ hoặc chưa đúng định dạng.');
            return;
        }

        setPersonalErrors({});
        setSavingPersonal(true);
        try {
            const updates: Record<string, string | undefined> = {};
            for (const [key, value] of Object.entries(personalForm)) {
                if (key !== 'employeeCode' && value !== '' && value !== undefined) {
                    updates[key] = value as string;
                }
            }

            const updated = await updateEmployee(apiBase, employeeId, updates as any);
            setEmployee(prev => prev ? { ...prev, ...updated } : updated);
            setPersonalEditMode(false);
            onChanged?.();
            toast.success('Cập nhật thành công', 'Thông tin cá nhân đã được lưu.');
        } catch (err: unknown) {
            const code = (err as any)?.code;
            toast.error('Không thể cập nhật hồ sơ', mapHrError(code, 'Không thể cập nhật thông tin cá nhân lúc này.'));
        } finally {
            setSavingPersonal(false);
        }
    };

    /* ── Tab 2: Employment Info Validation & Save ── */
    const handleSaveEmployment = async () => {
        if (!apiBase || !employeeId) return;

        const errors: Record<string, string | null> = {};
        const joinDateError = validateEditJoinDate(employmentForm.joinDate);
        if (joinDateError) errors.joinDate = joinDateError;

        if (Object.keys(errors).length > 0) {
            setEmploymentErrors(errors);
            toast.warning('Vui lòng kiểm tra thông tin', 'Ngày vào làm chưa hợp lệ.');
            return;
        }

        setEmploymentErrors({});
        setSavingEmployment(true);
        try {
            const updates: Record<string, string | undefined> = {};
            for (const [key, value] of Object.entries(employmentForm)) {
                if (value !== '' && value !== undefined) {
                    updates[key] = value as string;
                }
            }

            const updated = await updateEmployee(apiBase, employeeId, updates as any);

            // Re-resolve names
            const deptMap = new Map(departments.map(d => [d._id, d.name]));
            const posMap = new Map(positions.map(p => [p._id, p.name]));
            const wpMap = new Map(workplaces.map(w => [w._id, w.name]));
            const mgrMap = new Map(managers.map(m => [m.userId, m.fullName || m.employeeCode]));

            const enriched: EmployeeProfile = {
                ...updated,
                departmentName: updated.departmentId ? (deptMap.get(updated.departmentId) ?? updated.departmentName) : undefined,
                positionName: updated.positionId ? (posMap.get(updated.positionId) ?? updated.positionName) : undefined,
                workplaceName: updated.workplaceId ? (wpMap.get(updated.workplaceId) ?? updated.workplaceName) : undefined,
                managerName: updated.directManagerId ? (mgrMap.get(updated.directManagerId) ?? updated.managerName) : undefined,
            };

            setEmployee(prev => prev ? { ...prev, ...enriched } : enriched);
            setEmploymentEditMode(false);
            onChanged?.();
            toast.success('Cập nhật thành công', 'Thông tin công việc đã được lưu.');
        } catch (err: unknown) {
            const code = (err as any)?.code;
            toast.error('Không thể cập nhật công việc', mapHrError(code, 'Không thể cập nhật thông tin công việc lúc này.'));
        } finally {
            setSavingEmployment(false);
        }
    };

    /* ── Tab 3: Status Change Validation & Save ── */
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
        setSavingStatus(true);
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
            setSavingStatus(false);
        }
    };

    const closeStatusDialog = () => {
        if (savingStatus) return;
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

    return (
        <>
            <div className="space-y-5">
                {/* Loading state */}
                {loading ? (
                    <div className="space-y-6">
                        <ProfileSection title="Thông tin cá nhân" icon={User} loading>
                            <div />
                        </ProfileSection>
                    </div>
                ) : employee ? (
                    <>
                        {/* Profile Summary Card */}
                        <Card className="rounded-xl border-border shadow-none">
                            <CardContent className="flex items-center gap-4 p-5 sm:p-6">
                                <div className="rounded-full bg-primary/10 p-3.5 text-primary">
                                    <User className="h-7 w-7" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2.5">
                                        <h2 className="text-xl font-semibold text-foreground truncate">
                                            {employee.fullName || employee.employeeCode}
                                        </h2>
                                        {employee.fullName && (
                                            <span className="text-sm text-muted-foreground font-mono">
                                                ({employee.employeeCode})
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        {(EMPLOYMENT_TYPE_LABELS as Record<string, string>)[employee.employmentType]}
                                        {employee.departmentName && ` · ${employee.departmentName}`}
                                        {employee.positionName && ` · ${employee.positionName}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${(EMPLOYMENT_STATUS_BADGE as Record<string, string>)[employee.employmentStatus]}`}>
                                        {(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[employee.employmentStatus]}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 3 Sub-Tabs Navigation */}
                        <div className="flex border-b border-border/80 gap-1 sm:gap-2">
                            <button
                                type="button"
                                className={cn(
                                    "flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-all",
                                    activeTab === 'personal'
                                        ? "border-primary text-primary font-semibold"
                                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                                )}
                                onClick={() => setActiveTab('personal')}
                            >
                                <User className="h-4 w-4" />
                                <span>Thông tin cá nhân</span>
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    "flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-all",
                                    activeTab === 'employment'
                                        ? "border-primary text-primary font-semibold"
                                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                                )}
                                onClick={() => setActiveTab('employment')}
                            >
                                <Briefcase className="h-4 w-4" />
                                <span>Thông tin công việc</span>
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    "flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-all",
                                    activeTab === 'compensation'
                                        ? "border-primary text-primary font-semibold"
                                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                                )}
                                onClick={() => setActiveTab('compensation')}
                            >
                                <Coins className="h-4 w-4" />
                                <span>Đãi ngộ & Phụ cấp</span>
                                {salaryProfile?.allowances && salaryProfile.allowances.length > 0 && (
                                    <span className="ml-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">
                                        {salaryProfile.allowances.length}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    "flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-all",
                                    activeTab === 'status'
                                        ? "border-primary text-primary font-semibold"
                                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                                )}
                                onClick={() => setActiveTab('status')}
                            >
                                <History className="h-4 w-4" />
                                <span>Trạng thái & Lịch sử</span>
                                {history.length > 0 && (
                                    <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                        {history.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* ───────── TAB 1: THÔNG TIN CÁ NHÂN ───────── */}
                        <div className={activeTab === 'personal' ? 'block space-y-4' : 'hidden'}>
                            {personalEditMode ? (
                                <Card className="rounded-xl border-border shadow-none">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-base">Chỉnh sửa thông tin cá nhân</CardTitle>
                                                    <p className="text-sm text-muted-foreground">Cập nhật thông tin định danh và liên hệ của nhân viên.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" onClick={handleSavePersonal} disabled={savingPersonal}>
                                                    <Save className="mr-1.5 h-4 w-4" />
                                                    {savingPersonal ? 'Đang lưu…' : 'Lưu'}
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => { setPersonalEditMode(false); setPersonalErrors({}); }}>
                                                    <X className="mr-1.5 h-4 w-4" />
                                                    Hủy
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                            <EditField
                                                label="Mã nhân viên"
                                                value={personalForm.employeeCode}
                                                onChange={(v) => setPersonalForm(prev => ({ ...prev, employeeCode: v }))}
                                                disabled
                                            />
                                            <EditField
                                                label="Ngày vào làm"
                                                required
                                                value={personalForm.joinDate}
                                                onChange={(v) => setPersonalForm(prev => ({ ...prev, joinDate: v }))}
                                                onBlur={() => handlePersonalBlur('joinDate')}
                                                type="date"
                                                error={personalErrors.joinDate}
                                            />
                                            <EditField
                                                label="Ngày sinh"
                                                value={personalForm.dateOfBirth}
                                                onChange={(v) => setPersonalForm(prev => ({ ...prev, dateOfBirth: v }))}
                                                onBlur={() => handlePersonalBlur('dateOfBirth')}
                                                type="date"
                                                error={personalErrors.dateOfBirth}
                                            />
                                            <div className="space-y-1.5">
                                                <FormLabel htmlFor="edit-gender">Giới tính</FormLabel>
                                                <select
                                                    id="edit-gender"
                                                    className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    value={personalForm.gender}
                                                    onChange={(event) => setPersonalForm(prev => ({ ...prev, gender: event.target.value as Gender }))}
                                                >
                                                    <option value="">Chọn giới tính</option>
                                                    {Object.entries(GENDER_LABELS).map(([key, label]) => (
                                                        <option key={key} value={key}>{label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <EditField
                                                label="Số điện thoại"
                                                value={personalForm.phone}
                                                onChange={(v) => setPersonalForm(prev => ({ ...prev, phone: v.replace(/[^\d]/g, '').slice(0, 10) }))}
                                                onBlur={() => handlePersonalBlur('phone')}
                                                inputMode="numeric"
                                                maxLength={10}
                                                error={personalErrors.phone}
                                                helperText={personalErrors.phone ? undefined : 'Chỉ nhập số, đủ 10 chữ số.'}
                                            />
                                            <EditField
                                                label="Email"
                                                value={personalForm.email}
                                                onChange={(v) => setPersonalForm(prev => ({ ...prev, email: v }))}
                                                onBlur={() => handlePersonalBlur('email')}
                                                type="email"
                                                error={personalErrors.email}
                                            />
                                            <EditField
                                                label="Địa chỉ"
                                                value={personalForm.address}
                                                onChange={(v) => setPersonalForm(prev => ({ ...prev, address: v }))}
                                            />
                                            <EditField
                                                label="CCCD/CMND"
                                                value={personalForm.citizenId}
                                                onChange={(v) => setPersonalForm(prev => ({ ...prev, citizenId: v.replace(/[^\d]/g, '').slice(0, 12) }))}
                                            />
                                            <EditField
                                                label="Mã số thuế"
                                                value={personalForm.taxCode}
                                                onChange={(v) => setPersonalForm(prev => ({ ...prev, taxCode: v.replace(/[^\d]/g, '').slice(0, 12) }))}
                                            />
                                            <EditField
                                                label="Số BHXH"
                                                value={personalForm.socialInsuranceCode}
                                                onChange={(v) => setPersonalForm(prev => ({ ...prev, socialInsuranceCode: v.replace(/[^\d]/g, '').slice(0, 12) }))}
                                            />
                                            <EditField
                                                label="Tài khoản ngân hàng"
                                                value={personalForm.bankAccount}
                                                onChange={(v) => setPersonalForm(prev => ({ ...prev, bankAccount: v.replace(/[^\d]/g, '').slice(0, 17) }))}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <ProfileSection
                                    title="Thông tin cá nhân"
                                    description="Thông tin cá nhân của nhân viên"
                                    icon={User}
                                    action={
                                        <Button id="employee-detail-edit" variant="outline" size="sm" onClick={() => setPersonalEditMode(true)}>
                                            <Pencil className="mr-1.5 h-4 w-4" />
                                            Chỉnh sửa
                                        </Button>
                                    }
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
                        </div>

                        {/* ───────── TAB 2: THÔNG TIN CÔNG VIỆC ───────── */}
                        <div className={activeTab === 'employment' ? 'block space-y-4' : 'hidden'}>
                            {employmentEditMode ? (
                                <Card className="rounded-xl border-border shadow-none">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                                    <Briefcase className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-base">Chỉnh sửa thông tin công việc</CardTitle>
                                                    <p className="text-sm text-muted-foreground">Cập nhật phòng ban, chức danh, quản lý và nơi làm việc.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" onClick={handleSaveEmployment} disabled={savingEmployment}>
                                                    <Save className="mr-1.5 h-4 w-4" />
                                                    {savingEmployment ? 'Đang lưu…' : 'Lưu thông tin công việc'}
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => { setEmploymentEditMode(false); setEmploymentErrors({}); }}>
                                                    <X className="mr-1.5 h-4 w-4" />
                                                    Hủy
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                            {/* Loại lao động */}
                                            <div className="space-y-1.5">
                                                <FormLabel htmlFor="edit-employmentType" required>Loại lao động</FormLabel>
                                                <select
                                                    id="edit-employmentType"
                                                    className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    value={employmentForm.employmentType}
                                                    onChange={(e) => setEmploymentForm(prev => ({ ...prev, employmentType: e.target.value as EmploymentType }))}
                                                >
                                                    {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([key, label]) => (
                                                        <option key={key} value={key}>{label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Ngày vào làm */}
                                            <EditField
                                                label="Ngày vào làm"
                                                required
                                                value={employmentForm.joinDate}
                                                onChange={(v) => setEmploymentForm(prev => ({ ...prev, joinDate: v }))}
                                                type="date"
                                                error={employmentErrors.joinDate}
                                            />

                                            {/* Phòng ban */}
                                            <div className="space-y-1.5">
                                                <FormLabel htmlFor="edit-departmentId">Phòng ban</FormLabel>
                                                <select
                                                    id="edit-departmentId"
                                                    className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    value={employmentForm.departmentId}
                                                    onChange={(e) => setEmploymentForm(prev => ({ ...prev, departmentId: e.target.value }))}
                                                >
                                                    <option value="">Chưa chọn phòng ban</option>
                                                    {departments.map((d) => (
                                                        <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Chức danh */}
                                            <div className="space-y-1.5">
                                                <FormLabel htmlFor="edit-positionId">Chức danh</FormLabel>
                                                <select
                                                    id="edit-positionId"
                                                    className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    value={employmentForm.positionId}
                                                    onChange={(e) => setEmploymentForm(prev => ({ ...prev, positionId: e.target.value }))}
                                                >
                                                    <option value="">Chưa chọn chức danh</option>
                                                    {positions.map((p) => (
                                                        <option key={p._id} value={p._id}>{p.name} ({p.code})</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Quản lý trực tiếp */}
                                            <div className="space-y-1.5">
                                                <FormLabel htmlFor="edit-directManagerId">Quản lý trực tiếp</FormLabel>
                                                <select
                                                    id="edit-directManagerId"
                                                    className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    value={employmentForm.directManagerId}
                                                    onChange={(e) => setEmploymentForm(prev => ({ ...prev, directManagerId: e.target.value }))}
                                                >
                                                    <option value="">Chưa chọn quản lý</option>
                                                    {managers.map((m) => (
                                                        <option key={m.userId} value={m.userId}>
                                                            {m.fullName || m.employeeCode} ({m.employeeCode})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Nơi làm việc */}
                                            <div className="space-y-1.5">
                                                <FormLabel htmlFor="edit-workplaceId">Nơi làm việc</FormLabel>
                                                <select
                                                    id="edit-workplaceId"
                                                    className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    value={employmentForm.workplaceId}
                                                    onChange={(e) => setEmploymentForm(prev => ({ ...prev, workplaceId: e.target.value }))}
                                                >
                                                    <option value="">Chưa chọn nơi làm việc</option>
                                                    {workplaces.map((w) => (
                                                        <option key={w._id} value={w._id}>{w.name} ({w.code})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <ProfileSection
                                    title="Thông tin tuyển dụng & công việc"
                                    description="Thông tin công việc và tổ chức"
                                    icon={Briefcase}
                                    action={
                                        <Button variant="outline" size="sm" onClick={() => setEmploymentEditMode(true)}>
                                            <Pencil className="mr-1.5 h-4 w-4" />
                                            Chỉnh sửa
                                        </Button>
                                    }
                                >
                                    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        <FieldRow label="Loại lao động" value={(EMPLOYMENT_TYPE_LABELS as Record<string, string>)[employee.employmentType]} />
                                        <FieldRow label="Trạng thái" value={(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[employee.employmentStatus]} />
                                        <FieldRow label="Ngày vào làm" value={employee.joinDate ? new Date(employee.joinDate).toLocaleDateString('vi-VN') : undefined} />
                                        <FieldRow label="Ngày kết thúc" value={employee.endDate ? new Date(employee.endDate).toLocaleDateString('vi-VN') : undefined} />
                                        <FieldRow label="Phòng ban" value={employee.departmentName || undefined} />
                                        <FieldRow label="Chức danh" value={employee.positionName || undefined} />
                                        <FieldRow label="Quản lý trực tiếp" value={employee.managerName || undefined} />
                                        <FieldRow label="Nơi làm việc" value={employee.workplaceName || undefined} />
                                    </dl>
                                </ProfileSection>
                            )}
                        </div>

                        {/* ───────── TAB 4: ĐÃI NGỘ & PHỤ CẤP ───────── */}
                        <div className={activeTab === 'compensation' ? 'block space-y-4' : 'hidden'}>
                            {compLoading ? (
                                <EmployeeDataState status="loading" />
                            ) : !salaryProfile ? (
                                <Card className="rounded-xl border-dashed border-border p-8 text-center">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                                        <Coins className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-base font-semibold text-foreground">Chưa có hồ sơ lương & phụ cấp</h3>
                                    <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                                        Nhân viên này chưa được thiết lập mức lương cơ bản và các khoản phụ cấp hàng tháng.
                                    </p>
                                    <Button
                                        type="button"
                                        className="mt-4 gap-2"
                                        onClick={() => setCreateSalaryOpen(true)}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Thiết lập hồ sơ lương & phụ cấp
                                    </Button>
                                </Card>
                            ) : (
                                <>
                                    {/* Summary & Actions Card */}
                                    <Card className="rounded-xl border-border shadow-none">
                                        <CardHeader className="pb-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                                        <Coins className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-base">Mức lương & Đóng bảo hiểm</CardTitle>
                                                        <p className="text-sm text-muted-foreground">
                                                            Hiệu lực từ: {new Date(salaryProfile.effectiveFrom).toLocaleDateString('vi-VN')}
                                                            {salaryProfile.effectiveTo ? ` đến ${new Date(salaryProfile.effectiveTo).toLocaleDateString('vi-VN')}` : ' (Hiện tại)'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2 shrink-0 self-start sm:self-auto"
                                                    onClick={() => setEditSalaryOpen(true)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                    Chỉnh sửa phụ cấp & lương
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                                <FieldRow label="Lương cơ bản" value={formatVnd(salaryProfile.baseSalary)} />
                                                <FieldRow label="Lương đóng BHXH" value={formatVnd(salaryProfile.insuranceSalary)} />
                                                {salaryProfile.probationJobSalary ? (
                                                    <FieldRow label="Lương theo công việc thử việc" value={formatVnd(salaryProfile.probationJobSalary)} />
                                                ) : null}
                                                {salaryProfile.probationAgreedSalary ? (
                                                    <FieldRow label="Lương thỏa thuận thử việc" value={formatVnd(salaryProfile.probationAgreedSalary)} />
                                                ) : null}
                                                <FieldRow
                                                    label="Tổng phụ cấp hàng tháng"
                                                    value={formatVnd(
                                                        (salaryProfile.allowances || []).reduce((acc, a) => acc + (a.amount || 0), 0)
                                                    )}
                                                />
                                            </dl>
                                        </CardContent>
                                    </Card>

                                    {/* Assigned Allowances Card */}
                                    <Card className="rounded-xl border-border shadow-none">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-base">Danh sách phụ cấp của nhân viên</CardTitle>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-xs text-primary hover:text-primary gap-1"
                                                    onClick={() => setEditSalaryOpen(true)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                    Gán / Đổi mức phụ cấp
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Các mục phụ cấp công ty được gán riêng kèm số tiền cho nhân viên này. Bạn có thể thay đổi số tiền hoặc bật/tắt mục phụ cấp bất kỳ lúc nào.
                                            </p>
                                        </CardHeader>
                                        <CardContent>
                                            {(!salaryProfile.allowances || salaryProfile.allowances.length === 0) ? (
                                                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                                                    Nhân viên hiện chưa được gán mục phụ cấp nào. Bấm <b>"Gán / Đổi mức phụ cấp"</b> để thêm.
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                                                    {salaryProfile.allowances.map(a => {
                                                        const orgAllowance = allOrgAllowances.find(oa => oa._id === a.allowanceId);
                                                        return (
                                                            <div key={a.allowanceId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-2 hover:bg-muted/30 transition-colors">
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-semibold text-sm text-foreground">
                                                                            {orgAllowance?.name || 'Phụ cấp'}
                                                                        </span>
                                                                        {orgAllowance?.code && (
                                                                            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                                                                {orgAllowance.code}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {orgAllowance?.description && (
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {orgAllowance.description}
                                                                        </p>
                                                                    )}
                                                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                                        <span className={cn(
                                                                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                                                                            orgAllowance?.taxable ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                                                        )}>
                                                                            {orgAllowance?.taxable ? 'Chịu thuế TNCN' : 'Miễn thuế TNCN'}
                                                                        </span>
                                                                        <span className={cn(
                                                                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                                                                            orgAllowance?.insuranceBased ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                                                        )}>
                                                                            {orgAllowance?.insuranceBased ? 'Tính đóng BHXH' : 'Không đóng BHXH'}
                                                                        </span>
                                                                        {orgAllowance?.prorated && (
                                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                                                                                Tính theo ngày công
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <span className="text-base font-bold text-primary">
                                                                        {formatVnd(a.amount)}
                                                                    </span>
                                                                    <span className="block text-[11px] text-muted-foreground">/ tháng</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </div>

                        {/* ───────── TAB 3: TRẠNG THÁI & LỊCH SỬ ───────── */}
                        <div className={activeTab === 'status' ? 'block space-y-4' : 'hidden'}>
                            {/* Current Status Overview Card */}
                            <Card className="rounded-xl border-border shadow-none">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                                <Shield className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base">Trạng thái hiện tại</CardTitle>
                                                <p className="text-sm text-muted-foreground">Trạng thái nhân sự và quyền chuyển tiếp.</p>
                                            </div>
                                        </div>
                                        <Button
                                            id="employee-status-trigger"
                                            size="sm"
                                            onClick={() => setStatusChangeMode(true)}
                                            disabled={!validTransitions.length}
                                            title={!validTransitions.length ? 'Nhân viên đang ở trạng thái kết thúc và không thể chuyển tiếp.' : undefined}
                                        >
                                            <Shield className="mr-1.5 h-4 w-4" />
                                            Thay đổi trạng thái
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap items-center gap-6">
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trạng thái</p>
                                            <div className="mt-1">
                                                <span className={`inline-flex rounded-full px-3.5 py-1 text-sm font-semibold ${(EMPLOYMENT_STATUS_BADGE as Record<string, string>)[employee.employmentStatus]}`}>
                                                    {(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[employee.employmentStatus]}
                                                </span>
                                            </div>
                                        </div>
                                        {employee.endDate && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ngày kết thúc</p>
                                                <p className="text-sm font-medium text-foreground mt-1">
                                                    {new Date(employee.endDate).toLocaleDateString('vi-VN')}
                                                </p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trạng thái có thể chuyển</p>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {validTransitions.length > 0
                                                    ? validTransitions.map(s => (EMPLOYMENT_STATUS_LABELS as Record<string, string>)[s]).join(', ')
                                                    : 'Không có trạng thái chuyển tiếp tiếp theo'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Employment History Timeline */}
                            <Card className="rounded-xl border-border shadow-none">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                            <History className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">Lịch sử trạng thái</CardTitle>
                                            <p className="text-sm text-muted-foreground">Toàn bộ lịch sử các lần chuyển đổi trạng thái của nhân viên.</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {historyLoading ? (
                                        <EmployeeDataState status="loading" />
                                    ) : historyError ? (
                                        <EmployeeDataState status="error" onRetry={loadHistory} />
                                    ) : history.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-4 text-center">Chưa có lịch sử thay đổi trạng thái.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {history.map((record) => (
                                                <div key={record._id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3.5 transition-colors hover:border-border">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium text-foreground">
                                                                {(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[record.previousStatus]}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">→</span>
                                                            <span className="text-sm font-semibold text-primary">
                                                                {(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[record.newStatus]}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Hiệu lực: {new Date(record.effectiveDate).toLocaleDateString('vi-VN')}
                                                            {record.reason && ` · Lý do: ${record.reason}`}
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-xs font-medium text-muted-foreground">
                                                            Bởi {record.changedByName || record.changedBy}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground/80 mt-0.5">
                                                            {new Date(record.createdAt).toLocaleDateString('vi-VN')}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                ) : null}
            </div>

            {/* Status Change Modal */}
            <Dialog open={statusChangeMode} onOpenChange={(open) => { if (!open) closeStatusDialog(); }}>
                <DialogContent
                    className="max-w-[520px] gap-0"
                    backdropClassName="bg-black/35 backdrop-blur-[5px]"
                    showCloseButton={!savingStatus}
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
                                disabled={savingStatus || !validTransitions.length}
                                aria-invalid={!!statusErrors.newStatus}
                            >
                                <option value="">Chọn trạng thái mới</option>
                                {validTransitions.map((status) => (
                                    <option key={status} value={status}>
                                        {(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[status]}
                                    </option>
                                ))}
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
                                disabled={savingStatus}
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
                                disabled={savingStatus}
                                placeholder="Nhập lý do thay đổi trạng thái..."
                            />
                            <p className="text-right text-xs text-muted-foreground">{statusForm.reason.length}/500</p>
                        </div>
                    </div>

                    <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-muted/30 px-6 py-5">
                        <Button type="button" variant="outline" onClick={closeStatusDialog} disabled={savingStatus}>Hủy</Button>
                        <Button type="button" onClick={handleStatusChange} disabled={savingStatus || !validTransitions.length}>
                            {savingStatus ? 'Đang xử lý…' : 'Xác nhận'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Salary Profile Dialogs */}
            <SalaryProfileCreateDialog
                apiBase={apiBase}
                open={createSalaryOpen}
                defaultEmployeeId={employeeId}
                onClose={() => setCreateSalaryOpen(false)}
                onCreated={() => {
                    setCreateSalaryOpen(false);
                    loadCompensation();
                }}
            />
            {salaryProfile && (
                <SalaryProfileEditDialog
                    apiBase={apiBase}
                    profile={salaryProfile}
                    open={editSalaryOpen}
                    onClose={() => setEditSalaryOpen(false)}
                    onUpdated={() => {
                        setEditSalaryOpen(false);
                        loadCompensation();
                    }}
                />
            )}
        </>
    );
}
