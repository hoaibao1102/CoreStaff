import { hrErrorMessage } from '../../services/hrService';
import { useState, useCallback, useEffect } from 'react';
import {
    ChevronLeft,
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
import { Card, CardContent, CardHeader, CardTitle } from '../../components/card';
import { Button } from '../../components/button';
import { Input } from '../../components/input';
import { Label } from '../../components/label';
import { Select } from '../../components/select';
import { Skeleton } from '../../components/skeleton';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { AppLink } from '../../components/AppLink';
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
    mapHrError,
    type EmployeeProfile,
    type EmploymentHistoryRecord,
} from '../../services/hrService';

/* ───────── Field Row ───────── */
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

/* ───────── Edit Mode Fields ───────── */
interface EditFieldProps {
    label: string;
    value: string | undefined;
    onChange: (value: string) => void;
    disabled?: boolean;
    type?: string;
}

function EditField({ label, value, onChange, disabled = false, type = 'text' }: EditFieldProps) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={`edit-${label}`} className="text-xs font-medium text-muted-foreground">
                {label}
            </Label>
            <Input
                id={`edit-${label}`}
                className="h-10"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                type={type}
            />
        </div>
    );
}

/* ───────── Main Screen ───────── */
export function EmployeeDetailScreen(props: { user: AuthUser; apiBase: string | null; employeeId: string }) {
    if (props.user.role !== 'HR' || !props.user.organizationId) return <EmployeeDataState status="forbidden" />;
    if (!props.apiBase) return <EmployeeDataState status="unavailable" />;
    return <EmployeeDetailContent key={`${props.apiBase}:${props.employeeId}:${props.user.organizationId}:${props.user._id ?? props.user.id}`} {...props} />;
}

function EmployeeDetailContent({
    user,
    apiBase,
    employeeId,
}: {
    user: AuthUser;
    apiBase: string | null;
    employeeId: string;
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

    /* Status change form state */
    const [statusForm, setStatusForm] = useState({
        newStatus: '' as EmploymentStatus | '',
        effectiveDate: '',
        reason: '',
    });

    const loadEmployee = useCallback(async () => {
        if (!apiBase || !employeeId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await getEmployeeById(apiBase, employeeId);
            setEmployee(data);
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

    const handleSave = async () => {
        if (!apiBase || !employeeId) return;
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
        } catch (err: unknown) {
            setActionError(mapHrError((err as any)?.code, 'Không thể cập nhật hồ sơ nhân viên.'));
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async () => {
        if (!apiBase || !employeeId || !statusForm.newStatus || !statusForm.effectiveDate) return;
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
            // Reload history to show new entry
            loadHistory();
        } catch (err: unknown) {
            const code = (err as any)?.code;
            if (code === 'EMPLOYMENT_STATUS_TRANSITION_INVALID') {
                setActionError('Trạng thái không thể chuyển đổi theo quy định. Vui lòng kiểm tra lại.');
            } else {
                setActionError(mapHrError(code, 'Không thể thay đổi trạng thái employment.'));
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
            {/* Page Header — follows Design Master D */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                        Chi tiết nhân viên
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Thông tin chi tiết và lịch sử nhân sự.
                    </p>
                </div>
                <AppLink href="/hr/employees" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline sm:mt-0">
                    <ChevronLeft className="h-4 w-4" />
                    Danh bạ nhân viên
                </AppLink>
            </div>

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
                                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
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
                                    Lưu
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { setEditMode(false); setActionError(null); }}>
                                    <X className="mr-1.5 h-4 w-4" />
                                    Hủy
                                </Button>
                            </>
                        )}
                        {statusChangeMode && (
                            <>
                                <Button size="sm" onClick={handleStatusChange} disabled={saving || !statusForm.newStatus || !statusForm.effectiveDate}>
                                    <Save className="mr-1.5 h-4 w-4" />
                                    Xác nhận
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { setStatusChangeMode(false); setActionError(null); }}>
                                    <X className="mr-1.5 h-4 w-4" />
                                    Hủy
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Action error */}
                    {actionError && (
                        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
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
                                        value={formData.joinDate}
                                        onChange={(v) => setFormData(prev => ({ ...prev, joinDate: v }))}
                                        type="date"
                                    />
                                    <EditField
                                        label="Ngày sinh"
                                        value={formData.dateOfBirth}
                                        onChange={(v) => setFormData(prev => ({ ...prev, dateOfBirth: v }))}
                                        type="date"
                                    />
                                    <div className="space-y-1.5">
                                        <Label htmlFor="edit-gender" className="text-xs font-medium text-muted-foreground">
                                            Giới tính
                                        </Label>
                                        <Select
                                            id="edit-gender"
                                            value={formData.gender}
                                            onValueChange={(v) => setFormData(prev => ({ ...prev, gender: v as Gender }))}
                                            disabled={false}
                                        >
                                            <option value="">Chọn</option>
                                            {Object.entries(GENDER_LABELS).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </Select>
                                    </div>
                                    <EditField
                                        label="Số điện thoại"
                                        value={formData.phone}
                                        onChange={(v) => setFormData(prev => ({ ...prev, phone: v }))}
                                    />
                                    <EditField
                                        label="Email"
                                        value={formData.email}
                                        onChange={(v) => setFormData(prev => ({ ...prev, email: v }))}
                                        type="email"
                                    />
                                    <EditField
                                        label="Địa chỉ"
                                        value={formData.address}
                                        onChange={(v) => setFormData(prev => ({ ...prev, address: v }))}
                                    />
                                    <EditField
                                        label="CCCD/CMND"
                                        value={formData.citizenId}
                                        onChange={(v) => setFormData(prev => ({ ...prev, citizenId: v }))}
                                    />
                                    <EditField
                                        label="Mã số thuế"
                                        value={formData.taxCode}
                                        onChange={(v) => setFormData(prev => ({ ...prev, taxCode: v }))}
                                    />
                                    <EditField
                                        label="Số BHXH"
                                        value={formData.socialInsuranceCode}
                                        onChange={(v) => setFormData(prev => ({ ...prev, socialInsuranceCode: v }))}
                                    />
                                    <EditField
                                        label="Tài khoản ngân hàng"
                                        value={formData.bankAccount}
                                        onChange={(v) => setFormData(prev => ({ ...prev, bankAccount: v }))}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
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
                        </>
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

                    {/* Status Change Modal */}
                    {statusChangeMode && (
                        <Card className="rounded-xl border-border shadow-none">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                        <Shield className="h-4 w-4" />
                                    </div>
                                    <CardTitle className="text-base">Thay đổi trạng thái employment</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="status-new" className="text-xs font-medium text-muted-foreground">
                                            Trạng thái mới
                                        </Label>
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
                                    </div>
                                    <EditField
                                        label="Ngày hiệu lực"
                                        value={statusForm.effectiveDate}
                                        onChange={(v) => setStatusForm(prev => ({ ...prev, effectiveDate: v }))}
                                        type="date"
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
