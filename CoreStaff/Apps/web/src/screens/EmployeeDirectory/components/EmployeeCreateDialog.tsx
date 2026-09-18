import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, Eye, EyeOff, LoaderCircle, RefreshCw, TriangleAlert, UserRoundPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/dialog';
import { Button } from '../../../components/button';
import { Alert, AlertDescription, AlertTitle } from '../../../components/alert';
import { FormInputField } from '../../../components/form/FormInputField';
import { FormSelectField } from '../../../components/form/FormSelectField';
import { FormLabel } from '../../../components/form/FormLabel';
import { useFormEmployee, type CreateAccountMode } from '../hooks/useEmployeeForm';
import type { EmployeeCreateDialogProps, SelfProvisionDialogProps } from '../types';
import { EMPLOYMENT_TYPE_LABELS, GENDER_LABELS, type EmploymentType, type Gender } from '../../../lib/types';
import { createEmployee, createMyEmployeeProfile } from '../../../services/hrService';
import { mapEmployeeValidationErrors } from '../apiErrors';
import { toast } from '../../../components/toast';

/* ───────── API Error Mapping ───────── */

interface ApiErrorInfo {
    title: string;
    message: string;
    field?: string;
}

function mapApiError(error: unknown): ApiErrorInfo {
    const apiError = error as { code?: string; status?: number };

    const byCode: Record<string, ApiErrorInfo> = {
        USER_NOT_FOUND: {
            title: 'Không tìm thấy tài khoản',
            message: 'Tài khoản đã chọn không còn khả dụng trong tổ chức. Vui lòng chọn lại.',
            field: 'userId',
        },
        EMPLOYEE_PROFILE_ALREADY_EXISTS: {
            title: 'Tài khoản đã có hồ sơ nhân sự',
            message: 'Mỗi tài khoản chỉ được liên kết với một hồ sơ nhân sự trong tổ chức.',
            field: 'userId',
        },
        EMPLOYEE_CODE_TAKEN: {
            title: 'Mã nhân viên đã được sử dụng',
            message: 'Mã nhân viên này đã có người khác. Vui lòng nhập mã mới.',
            field: 'employeeCode',
        },
        DEPARTMENT_NOT_FOUND: {
            title: 'Phòng ban không còn tồn tại',
            message: 'Phòng ban đã chọn vừa bị thay đổi. Hãy tải lại danh sách và chọn lại.',
            field: 'departmentId',
        },
        POSITION_NOT_FOUND: {
            title: 'Chức danh không còn tồn tại',
            message: 'Chức danh vừa bị thay đổi. Hãy tải lại danh sách và chọn lại.',
            field: 'positionId',
        },
        MANAGER_NOT_FOUND: {
            title: 'Không tìm thấy quản lý trực tiếp',
            message: 'Quản lý trực tiếp đã chọn không còn khả dụng. Vui lòng chọn lại.',
            field: 'directManagerId',
        },
        VALIDATION_FAILED: {
            title: 'Vui lòng kiểm tra thông tin',
            message: 'Một số thông tin chưa hợp lệ. Vui lòng kiểm tra lại thông tin đã nhập.',
        },
    };

    if (apiError.code && byCode[apiError.code]) return byCode[apiError.code];
    if (apiError.status === 401) return { title: 'Phiên đăng nhập đã hết hạn', message: 'Vui lòng đăng nhập lại trước khi tạo hồ sơ.' };
    if (apiError.status === 403) return { title: 'Bạn không có quyền', message: 'Chỉ tài khoản nhân sự mới được tạo hồ sơ.' };
    if (apiError.status === 409) return { title: 'Dữ liệu bị trùng', message: 'Tài khoản hoặc mã nhân viên đã tồn tại. Hãy kiểm tra lại.' };
    if (apiError.status && apiError.status >= 500) return { title: 'Máy chủ đang gặp sự cố', message: 'Không thể lưu hồ sơ lúc này. Vui lòng thử lại sau.' };
    return { title: 'Không thể tạo hồ sơ', message: 'Đã xảy ra lỗi khi lưu. Hãy kiểm tra thông tin và thử lại.' };
}

/* ───────── Select Options ───────── */

const employmentTypeOptions = Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const genderOptions = Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label }));

function departmentOptions(departments: EmployeeCreateDialogProps['departments']) {
    return departments.map((dept) => ({
        value: dept._id,
        label: `${dept.code ? `${dept.code} — ` : ''}${dept.name}`,
    }));
}

function positionOptions(positions: EmployeeCreateDialogProps['positions']) {
    return positions.map((pos) => ({
        value: pos._id,
        label: `${pos.code ? `${pos.code} — ` : ''}${pos.name}`,
    }));
}

function accountOptions(accounts: EmployeeCreateDialogProps['accounts']) {
    return accounts.map(account => ({ value: account._id, label: `${account.fullName} — ${account.email}` }));
}

function managerOptions(managers: EmployeeCreateDialogProps['managers']) {
    return managers.map(manager => ({ value: manager.userId, label: `${manager.fullName || manager.employeeCode} — ${manager.employeeCode}` }));
}

/* ───────── Main Dialog Component ───────── */

export function EmployeeCreateDialog({
    apiBase,
    meMode = false,
    user,
    open,
    departments,
    positions,
    accounts,
    managers,
    accountsFailed,
    onRetryAccounts,
    onOpenChange,
    onCreated,
}: EmployeeCreateDialogProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tempPassword, setTempPassword] = useState<string | null>(null);
    const [showTempPassword, setShowTempPassword] = useState(false);
    const [copied, setCopied] = useState(false);
    // 'link' is the default so the existing eligible-accounts flow (and its
    // tests/e2e) is untouched; 'new' provisions an EMPLOYEE account (TASK-120).
    const [mode, setMode] = useState<CreateAccountMode>(meMode ? 'new' : 'link');
    const modeRef = useRef(mode); // the submit callback reads the value it was built with
    const {
        form,
        errors,
        submitting,
        updateField,
        blurField,
        validateAll,
        buildPayload,
        resetForm,
        setErrors,
    } = useFormEmployee(
        // In meMode the caller cannot change identity: prefill fullName/email
        // from the session so the 'new' validation (which omits userId from the
        // payload — the server takes it from the session) passes untouched.
        meMode ? { fullName: user?.fullName ?? '', email: user?.email ?? '' } : undefined,
        meMode ? 'new' : mode,
    );

    const fillFromAccount = useCallback((userId: string, current: typeof form) => {
        const account = accounts.find(item => item._id === userId);
        // Only fill contact fields the user hasn't changed.
        const next: Partial<typeof form> = { userId };
        if (!current.email || current.email === accounts.find(item => item._id === current.userId)?.email) next.email = account?.email ?? '';
        if (!current.phone || current.phone === accounts.find(item => item._id === current.userId)?.phone) next.phone = account?.phone ?? '';
        return { ...current, ...next };
    }, [accounts]);

    const handleCreated = useCallback(async () => {
        // meMode wraps the whole form; it never swaps the mode toggle under the
        // form after mount, so the hook's live mode is the right one here.
        if (meMode) return createMyEmployeeProfile(apiBase, buildPayload());
        return createEmployee(apiBase, buildPayload());
    }, [apiBase, buildPayload, meMode]);

    // The errored field is disabled while isSubmitting is true, so focus() during
    // the catch is a no-op and the dialog trap keeps the first slot (the mode
    // toggle). Focus the field after the state settles instead.
    const pendingFocusRef = useRef<string | null>(null);
    useEffect(() => {
        if (isSubmitting || !pendingFocusRef.current) return;
        const field = document.getElementById(`create-${pendingFocusRef.current}`);
        pendingFocusRef.current = null;
        field?.focus?.();
    }, [isSubmitting]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting.current) return;

        if (!validateAll()) {
            toast.warning('Vui lòng kiểm tra thông tin', 'Một số trường chưa đầy đủ hoặc chưa đúng.');
            const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
            field?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
            field?.focus();
            return;
        }

        setErrors({ general: null });
        submitting.current = true;
        setIsSubmitting(true);
        try {
            const created = await handleCreated();
            resetForm();
            // One-time password (provisioning mode) is rendered in the panel once
            // and never stored — not in a toast, not in localStorage, not in a data
            // holder on the parent. The panel dies with the dialog.
            const password = (created as { tempPassword?: string } | undefined)?.tempPassword;
            setTempPassword(password ?? null);
            setShowTempPassword(false);
            setCopied(false);
            toast.success('Tạo hồ sơ thành công', 'Hồ sơ nhân sự đã được tạo.');
            onCreated(created);
        } catch (err) {
            const apiError = mapApiError(err);
            const fieldErrors = mapEmployeeValidationErrors(err);
            const firstField = Object.keys(fieldErrors)[0] || apiError.field;
            setErrors((prev: typeof errors) => ({ ...prev, [apiError.field || 'general']: apiError.message, ...fieldErrors }));
            toast.error(apiError.title, apiError.message);
            if (firstField) pendingFocusRef.current = firstField;
        } finally {
            submitting.current = false;
            setIsSubmitting(false);
        }
    }, [validateAll, handleCreated, resetForm, setErrors, submitting, onCreated]);

    const copyPassword = useCallback(async () => {
        if (!tempPassword) return;
        try {
            await navigator.clipboard.writeText(tempPassword);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard may be unavailable in restricted contexts; the code is select-all by hand.
        }
    }, [tempPassword]);


    return (
        <Dialog
            open={open}
            onOpenChange={(next: boolean) => {
                if (!submitting.current) {
                    if (!next) {
                        resetForm();
                        // The one-time password dies with the dialog — never kept
                        // after close (not in localStorage, not in any holder).
                        setTempPassword(null);
                        setShowTempPassword(false);
                        setCopied(false);
                    }
                    onOpenChange(next);
                }
            }}
        >
            <DialogContent className="max-w-3xl gap-0">
                <DialogHeader className="border-b border-border px-5 py-5 pr-16 sm:px-6">
                    <DialogTitle className="text-xl font-semibold">{meMode ? 'Tạo hồ sơ của tôi' : 'Tạo hồ sơ nhân sự'}</DialogTitle>
                    <DialogDescription className="mt-1.5 max-w-xl">
                        {meMode
                            ? 'Nhập các thông tin nghiệp vụ của chính bạn. Hồ sơ sẽ bắt đầu ở trạng thái Thử việc và không tạo tài khoản mới.'
                            : 'Chọn tạo tài khoản mới hoặc liên kết tài khoản đã có. Hồ sơ mới sẽ bắt đầu ở trạng thái Thử việc.'}
                    </DialogDescription>
                </DialogHeader>

                {tempPassword !== null ? (
                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-6 sm:px-6">
                            <Alert>
                                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4" />
                                <AlertTitle>{meMode ? 'Đã tạo hồ sơ của bạn' : 'Đã tạo hồ sơ và tài khoản mới'}</AlertTitle>
                                <AlertDescription className="mt-0.5">
                                    Mật khẩu tạm thời bên dưới chỉ hiển thị đúng một lần. Hãy chép ngay và chuyển cho nhân viên ngoài hệ thống; mật khẩu sẽ phải đổi khi đăng nhập lần đầu.
                                </AlertDescription>
                            </Alert>
                            <div>
                                <FormLabel htmlFor="create-temp-password">Mật khẩu tạm thời (một lần)</FormLabel>
                                <div className="flex gap-2">
                                    <code id="create-temp-password" className="min-h-11 min-w-0 flex-1 select-all overflow-x-auto rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-base font-semibold tracking-wide">{showTempPassword ? tempPassword : '••••••••••••'}</code>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="min-h-11"
                                        onClick={() => setShowTempPassword((visible) => !visible)}
                                        aria-label={showTempPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                        title={showTempPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                    >
                                        {showTempPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                                        <span className="sr-only">{showTempPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</span>
                                    </Button>
                                    <Button type="button" variant="outline" className="min-h-11" onClick={() => void copyPassword()}>
                                        {copied ? 'Đã chép' : 'Chép'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-popover px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                            <Button type="button" className="min-h-11" onClick={() => onOpenChange(false)}>Đóng</Button>
                        </div>
                    </div>
                ) : (
                <form ref={formRef} className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
                    <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-6">
                        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Các trường có dấu <span className="font-semibold text-destructive">*</span> là bắt buộc. Những trường còn lại có thể bổ sung sau.</p>
                        {/* Phase C self-service note */}
                        {meMode && (
                            <Alert className="border-primary/30 bg-primary/5 text-foreground">
                                <UserRoundPlus aria-hidden="true" className="mt-0.5 size-4 text-primary" />
                                <div className="min-w-0">
                                    <AlertTitle>Hồ sơ nghiệp vụ của bạn</AlertTitle>
                                    <AlertDescription className="mt-0.5">
                                        Email và số điện thoại được lấy từ tài khoản đăng nhập — bạn không cần nhập lại.
                                    </AlertDescription>
                                </div>
                            </Alert>
                        )}
                        {/* Account & Code Section */}
                        <section className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-foreground">Tài khoản và mã nhân viên</h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {meMode ? 'Mã của bạn, gắn với tài khoản đã đăng nhập.' : 'Chọn tạo mới hoặc liên kết tài khoản đã tồn tại, rồi nhập mã nhân viên duy nhất.'}
                                </p>
                            </div>
                            {/* Mode toggle — link is the default; provisioning needs a name + email */}
                            {!meMode && (
                                <div role="tablist" aria-label="Cách tạo hồ sơ" className="inline-flex rounded-lg border border-border bg-muted p-1">
                                    {(['link', 'new'] as const).map(modeKey => (
                                        <button
                                            key={modeKey}
                                            type="button"
                                            role="tab"
                                            aria-selected={mode === modeKey}
                                            className={`min-h-9 rounded-md px-3 text-sm font-medium ${mode === modeKey ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                            onClick={() => { setMode(modeKey); setErrors({ general: null }); }}
                                        >
                                            {modeKey === 'link' ? 'Liên kết tài khoản' : 'Tạo tài khoản mới'}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {accountsFailed && (
                                <Alert className="border-amber-300 bg-amber-50/70 px-3 py-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                                    <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 text-amber-600 dark:text-amber-400" />
                                    <div className="min-w-0">
                                        <AlertTitle>Chưa tải được tài khoản nhân viên</AlertTitle>
                                        <AlertDescription className="mt-0.5 text-amber-800 dark:text-amber-200">
                                            Kiểm tra kết nối với máy chủ rồi thử lại.
                                        </AlertDescription>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="mt-3 min-h-9 border-amber-300 bg-background px-3 text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-950"
                                            onClick={onRetryAccounts}
                                        >
                                            <RefreshCw aria-hidden="true" className="size-4" />
                                            Thử tải lại
                                        </Button>
                                    </div>
                                </Alert>
                            )}
                            <div className="grid gap-4 sm:grid-cols-2">
                                {meMode || mode === 'new' ? (
                                    <FormInputField
                                        id="create-fullName"
                                        label="Họ và tên"
                                        required={mode === 'new'}
                                        value={meMode ? user?.fullName ?? '' : form.fullName}
                                        onChange={(e) => updateField('fullName', e.target.value)}
                                        onBlur={() => blurField('fullName')}
                                        placeholder="Ví dụ: Nguyễn Văn An"
                                        disabled={meMode || isSubmitting}
                                        error={meMode ? null : errors.fullName}
                                    />
                                ) : (
                                    <FormSelectField
                                        id="create-userId"
                                        label="Tài khoản nhân viên"
                                        required
                                        value={form.userId}
                                        onChange={(e) => {
                                            const userId = e.target.value;
                                            updateField('userId', userId);
                                            const next = fillFromAccount(userId, { ...form, userId });
                                            if (next.email !== form.email) updateField('email', next.email);
                                            if (next.phone !== form.phone) updateField('phone', next.phone);
                                        }}
                                        onBlur={() => blurField('userId')}
                                        options={accountOptions(accounts)}
                                        placeholder={accountsFailed ? 'Không thể tải danh sách tài khoản' : accounts.length ? 'Chọn tài khoản nhân viên' : 'Không có tài khoản phù hợp'}
                                        disabled={isSubmitting || accountsFailed}
                                        error={errors.userId}
                                    />
                                )}
                                <FormInputField
                                    id="create-employeeCode"
                                    label="Mã nhân viên"
                                    required
                                    value={form.employeeCode}
                                    onChange={(e) => updateField('employeeCode', e.target.value)}
                                    onBlur={() => blurField('employeeCode')}
                                    placeholder="Ví dụ: TVS-0248"
                                    disabled={submitting.current}
                                    error={errors.employeeCode}
                                />
                            </div>
                        </section>

                        {/* Work Info Section */}
                        <section className="space-y-4 border-t border-border pt-6">
                            <div>
                                <h3 className="font-semibold text-foreground">Thông tin công việc</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Ngày bắt đầu, loại lao động và đơn vị công tác.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormInputField
                                    id="create-joinDate"
                                    label="Ngày vào làm"
                                    type="date"
                                    required
                                    value={form.joinDate}
                                    onChange={(e) => updateField('joinDate', e.target.value)}
                                    onBlur={() => blurField('joinDate')}
                                    disabled={submitting.current}
                                    error={errors.joinDate}
                                />
                                <FormSelectField
                                    id="create-employmentType"
                                    label="Loại lao động"
                                    value={form.employmentType}
                                    onChange={(e) => updateField('employmentType', e.target.value as EmploymentType)}
                                    options={employmentTypeOptions}
                                    disabled={submitting.current}
                                    error={errors.employmentType}
                                />
                                <FormSelectField
                                    id="create-departmentId"
                                    label="Phòng ban"
                                    value={form.departmentId}
                                    onChange={(e) => updateField('departmentId', e.target.value)}
                                    onBlur={() => blurField('departmentId')}
                                    options={departmentOptions(departments)}
                                    disabled={submitting.current}
                                    error={errors.departmentId}
                                />
                                <FormSelectField
                                    id="create-positionId"
                                    label="Chức danh"
                                    value={form.positionId}
                                    onChange={(e) => updateField('positionId', e.target.value)}
                                    onBlur={() => blurField('positionId')}
                                    options={positionOptions(positions)}
                                    disabled={submitting.current}
                                    error={errors.positionId}
                                />
                            </div>
                        </section>

                        {/* Personal Info Section */}
                        <section className="space-y-4 border-t border-border pt-6">
                            <div>
                                <h3 className="font-semibold text-foreground">Thông tin cá nhân</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Thông tin nhận diện cơ bản của nhân viên.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormInputField
                                    id="create-dateOfBirth"
                                    label="Ngày sinh"
                                    type="date"
                                    value={form.dateOfBirth}
                                    onChange={(e) => updateField('dateOfBirth', e.target.value)}
                                    onBlur={() => blurField('dateOfBirth')}
                                    disabled={submitting.current}
                                    error={errors.dateOfBirth}
                                />
                                <FormSelectField
                                    id="create-gender"
                                    label="Giới tính"
                                    error={errors.gender}
                                    value={form.gender}
                                    onChange={(e) => updateField('gender', e.target.value as Gender)}
                                    options={genderOptions}
                                    disabled={submitting.current}
                                />
                            </div>
                        </section>

                        {/* Contact Section */}
                        <section className="space-y-4 border-t border-border pt-6">
                            <div><h3 className="font-semibold text-foreground">Thông tin liên hệ</h3><p className="mt-1 text-sm text-muted-foreground">{meMode ? 'Email và số điện thoại được lấy từ tài khoản đăng nhập của bạn.' : 'Thông tin liên hệ nghiệp vụ; email và số điện thoại được gợi ý từ tài khoản đã chọn.'}</p></div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormInputField id="create-phone" label="Số điện thoại" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => updateField('phone', e.target.value.replace(/[^\d]/g, '').slice(0, 10))} onBlur={() => blurField('phone')} placeholder="Ví dụ: 0912345678" disabled={meMode || submitting.current} error={meMode ? null : errors.phone} helperText={meMode ? 'Sẽ hiển thị từ tài khoản của bạn.' : 'Chỉ nhập số, đủ 10 chữ số.'} />
                                <FormInputField id="create-email" label="Email nhân sự" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} onBlur={() => blurField('email')} placeholder="nhanvien@company.com" disabled={meMode || submitting.current} error={meMode ? null : errors.email} />
                                <div className="sm:col-span-2"><FormInputField id="create-address" label="Địa chỉ" value={form.address} onChange={(e) => updateField('address', e.target.value)} onBlur={() => blurField('address')} maxLength={256} disabled={submitting.current} error={errors.address} /></div>
                            </div>
                        </section>

                        {/* Legal & Payroll Section */}
                        <section className="space-y-4 border-t border-border pt-6">
                            <div>
                                <h3 className="font-semibold text-foreground">Pháp lý và bảo hiểm</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Các mã định danh dùng cho nghiệp vụ nhân sự và bảo hiểm.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormInputField
                                    id="create-citizenId"
                                    label="CCCD/CMND"
                                    value={form.citizenId}
                                    onChange={(e) => updateField('citizenId', e.target.value.replace(/[^\d]/g, '').slice(0, 12))}
                                    onBlur={() => blurField('citizenId')}
                                    placeholder="9 đến 12 chữ số"
                                    inputMode="numeric"
                                    maxLength={12}
                                    disabled={submitting.current}
                                    error={errors.citizenId}
                                />
                                <FormInputField
                                    id="create-taxCode"
                                    label="Mã số thuế"
                                    value={form.taxCode}
                                    onChange={(e) => updateField('taxCode', e.target.value.replace(/[^\d]/g, '').slice(0, 12))}
                                    onBlur={() => blurField('taxCode')}
                                    placeholder="10 đến 12 chữ số"
                                    disabled={submitting.current}
                                    error={errors.taxCode}
                                />
                                <FormInputField
                                    id="create-socialInsuranceCode"
                                    label="Số BHXH"
                                    value={form.socialInsuranceCode}
                                    onChange={(e) => updateField('socialInsuranceCode', e.target.value.replace(/[^\d]/g, '').slice(0, 12))}
                                    onBlur={() => blurField('socialInsuranceCode')}
                                    disabled={submitting.current}
                                    error={errors.socialInsuranceCode}
                                />
                            </div>
                        </section>

                        <section className="space-y-4 border-t border-border pt-6">
                            <div><h3 className="font-semibold text-foreground">Thông tin ngân hàng</h3><p className="mt-1 text-sm text-muted-foreground">Thông tin phục vụ thanh toán lương, có thể bổ sung sau.</p></div>
                            <div className="grid gap-4 sm:grid-cols-2"><FormInputField id="create-bankAccount" label="Tài khoản ngân hàng" value={form.bankAccount} onChange={(e) => updateField('bankAccount', e.target.value.replace(/[^\d]/g, '').slice(0, 17))} onBlur={() => blurField('bankAccount')} placeholder="6 đến 17 chữ số" disabled={submitting.current} error={errors.bankAccount} /></div>
                        </section>

                        {/* Management Section */}
                        <section className="space-y-4 border-t border-border pt-6">
                            <div>
                                <h3 className="font-semibold text-foreground">Quản lý và nơi làm việc</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Có thể chọn quản lý trực tiếp ngay bây giờ; nơi làm việc sẽ được bổ sung khi danh mục sẵn sàng.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormSelectField
                                    id="create-directManagerId"
                                    label="Quản lý trực tiếp"
                                    value={form.directManagerId}
                                    onChange={(e) => updateField('directManagerId', e.target.value)}
                                    onBlur={() => blurField('directManagerId')}
                                    options={managerOptions(managers).filter(option => option.value !== form.userId)}
                                    placeholder="Chọn quản lý trực tiếp"
                                    disabled={submitting.current}
                                    error={errors.directManagerId}
                                />
                            </div>
                        </section>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-popover px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={submitting.current}
                            onClick={() => {
                                resetForm();
                                onOpenChange(false);
                            }}
                        >
                            Hủy
                        </Button>
                        <Button
                            type="submit"
                            className="min-h-11"
                            disabled={submitting.current}
                        >
                            {submitting.current && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                            {submitting.current ? 'Đang tạo…' : 'Tạo hồ sơ'}
                        </Button>
                    </div>
                </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
