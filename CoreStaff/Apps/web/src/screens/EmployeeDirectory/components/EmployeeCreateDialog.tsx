import { useState, useCallback, useRef } from 'react';
import { LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/dialog';
import { Button } from '../../../components/button';
import { Alert, AlertDescription, AlertTitle } from '../../../components/alert';
import { FormInputField } from '../../../components/form/FormInputField';
import { FormSelectField } from '../../../components/form/FormSelectField';
import { useFormEmployee } from '../hooks/useEmployeeForm';
import type { EmployeeCreateDialogProps } from '../types';
import { EMPLOYMENT_TYPE_LABELS, GENDER_LABELS, type EmploymentType, type Gender } from '../../../lib/types';
import { createEmployee } from '../../../services/hrService';
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
    } = useFormEmployee();

    const handleCreated = useCallback(async () => {
        onCreated(await createEmployee(apiBase, buildPayload()));
    }, [apiBase, buildPayload, onCreated]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting.current) return;

        if (!validateAll()) {
            toast.warning('Vui lòng kiểm tra thông tin', 'Một số trường chưa đầy đủ hoặc chưa đúng.');
            requestAnimationFrame(() => {
                const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
                field?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                field?.focus();
            });
            return;
        }

        setErrors({ general: null });
        submitting.current = true;
        setIsSubmitting(true);
        try {
            await handleCreated();
            resetForm();
            toast.success('Tạo hồ sơ thành công', 'Hồ sơ nhân sự đã được tạo.');
        } catch (err) {
            const apiError = mapApiError(err);
            const fieldErrors = mapEmployeeValidationErrors(err);
            const firstField = Object.keys(fieldErrors)[0] || apiError.field;
            setErrors((prev: typeof errors) => ({ ...prev, [apiError.field || 'general']: apiError.message, ...fieldErrors }));
            toast.error(apiError.title, apiError.message);
            if (firstField) requestAnimationFrame(() => {
                const field = document.getElementById(`create-${firstField}`);
                field?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                field?.focus();
            });
        } finally {
            submitting.current = false;
            setIsSubmitting(false);
        }
    }, [validateAll, handleCreated, resetForm, setErrors, submitting]);


    return (
        <Dialog
            open={open}
            onOpenChange={(next: boolean) => {
                if (!submitting.current) {
                    if (!next) resetForm();
                    onOpenChange(next);
                }
            }}
        >
            <DialogContent className="max-w-3xl gap-0">
                <DialogHeader className="border-b border-border px-5 py-5 pr-16 sm:px-6">
                    <DialogTitle className="text-xl font-semibold">Tạo hồ sơ nhân sự</DialogTitle>
                    <DialogDescription className="mt-1.5 max-w-xl">
                        Liên kết tài khoản đăng nhập với hồ sơ nghiệp vụ. Hồ sơ mới sẽ bắt đầu ở trạng thái Thử việc.
                    </DialogDescription>
                </DialogHeader>

                <form ref={formRef} className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
                    <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-6">
                        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Các trường có dấu <span className="font-semibold text-destructive">*</span> là bắt buộc. Những trường còn lại có thể bổ sung sau.</p>
                        {/* Account & Code Section */}
                        <section className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-foreground">Tài khoản và mã nhân viên</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Chọn tài khoản đã tồn tại trong tổ chức và nhập mã nhân viên duy nhất.</p>
                            </div>
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
                                <FormSelectField
                                    id="create-userId"
                                    label="Tài khoản nhân viên"
                                    required
                                    value={form.userId}
                                    onChange={(e) => {
                                        const account = accounts.find(item => item._id === e.target.value);
                                        updateField('userId', e.target.value);
                                        if (!form.email || form.email === accounts.find(item => item._id === form.userId)?.email) updateField('email', account?.email ?? '');
                                        if (!form.phone || form.phone === accounts.find(item => item._id === form.userId)?.phone) updateField('phone', account?.phone ?? '');
                                    }}
                                    onBlur={() => blurField('userId')}
                                    options={accountOptions(accounts)}
                                    placeholder={accountsFailed ? 'Không thể tải danh sách tài khoản' : accounts.length ? 'Chọn tài khoản nhân viên' : 'Không có tài khoản phù hợp'}
                                    disabled={isSubmitting || accountsFailed}
                                    error={errors.userId}
                                />
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
                            <div><h3 className="font-semibold text-foreground">Thông tin liên hệ</h3><p className="mt-1 text-sm text-muted-foreground">Thông tin liên hệ nghiệp vụ; email và số điện thoại được gợi ý từ tài khoản đã chọn.</p></div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormInputField id="create-phone" label="Số điện thoại" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => updateField('phone', e.target.value.replace(/[^\d]/g, '').slice(0, 10))} onBlur={() => blurField('phone')} placeholder="Ví dụ: 0912345678" disabled={submitting.current} error={errors.phone} helperText="Chỉ nhập số, đủ 10 chữ số." />
                                <FormInputField id="create-email" label="Email nhân sự" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} onBlur={() => blurField('email')} placeholder="nhanvien@company.com" disabled={submitting.current} error={errors.email} />
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
            </DialogContent>
        </Dialog>
    );
}
