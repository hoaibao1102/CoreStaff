import { useState, useCallback } from 'react';
import { CircleAlert, LoaderCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/dialog';
import { Alert, AlertDescription, AlertTitle } from '../../../components/alert';
import { Button } from '../../../components/button';
import { FormInputField } from '../../../components/form/FormInputField';
import { FormSelectField } from '../../../components/form/FormSelectField';
import { useFormEmployee } from '../hooks/useEmployeeForm';
import type { EmployeeCreateDialogProps } from '../types';
import { EMPLOYMENT_TYPE_LABELS, GENDER_LABELS, type EmploymentType, type Gender } from '../../../lib/types';
import { createEmployee } from '../../../services/hrService';

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
            message: 'User ID không tồn tại trong tổ chức hiện tại. Hãy kiểm tra lại ID của tài khoản đăng nhập.',
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
            message: 'User ID quản lý không tồn tại trong tổ chức. Hãy kiểm tra lại.',
            field: 'directManagerId',
        },
        VALIDATION_FAILED: {
            title: 'Thông tin chưa hợp lệ',
            message: 'Hãy kiểm tra lại các trường có dấu * và sửa theo hướng dẫn.',
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

/* ───────── Main Dialog Component ───────── */

export function EmployeeCreateDialog({
    apiBase,
    open,
    departments,
    positions,
    onOpenChange,
    onCreated,
}: EmployeeCreateDialogProps) {
    const {
        form,
        errors,
        touched,
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

        if (!validateAll()) {
            // Focus vào field lỗi đầu tiên
            const firstErrorField = Object.keys(errors).find((key) => key !== 'general' && errors[key as keyof typeof errors]);
            if (firstErrorField) {
                setTimeout(() => document.getElementById(`create-${firstErrorField}`)?.focus(), 0);
            }
            return;
        }

        setErrors({ general: null });
        try {
            await handleCreated();
            resetForm();
        } catch (err) {
            const apiError = mapApiError(err);
            setErrors((prev: typeof errors) => ({ ...prev, [apiError.field || 'general']: apiError.message }));
            if (apiError.field) {
                setTimeout(() => document.getElementById(`create-${apiError.field}`)?.focus(), 0);
            }
        }
    }, [validateAll, errors, handleCreated, resetForm, setErrors]);

    const selectClass = 'block min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm';

    return (
        <Dialog
            open={open}
            onOpenChange={(next: boolean) => {
                if (!submitting.current) onOpenChange(next);
            }}
        >
            <DialogContent className="max-w-3xl gap-0">
                <DialogHeader className="border-b border-border px-5 py-5 pr-16 sm:px-6">
                    <DialogTitle className="text-xl font-semibold">Tạo hồ sơ nhân sự</DialogTitle>
                    <DialogDescription className="mt-1.5 max-w-xl">
                        Liên kết tài khoản đăng nhập với hồ sơ nghiệp vụ. Hồ sơ mới sẽ bắt đầu ở trạng thái Thử việc.
                    </DialogDescription>
                </DialogHeader>

                <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit} noValidate aria-busy={submitting.current}>
                    <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-6">
                        {/* General error */}
                        {errors.general && (
                            <Alert variant="destructive" tabIndex={-1} className="border-destructive/30 bg-destructive/5 px-4 py-3">
                                <CircleAlert aria-hidden="true" />
                                <AlertTitle>{errors.general}</AlertTitle>
                                <AlertDescription>Hãy kiểm tra các trường có đánh dấu lỗi phía dưới.</AlertDescription>
                            </Alert>
                        )}

                        {/* Account & Code Section */}
                        <section className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-foreground">Tài khoản và mã nhân viên</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Nhập tài khoản đã tồn tại trong tổ chức và mã nhân viên duy nhất.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormInputField
                                    id="create-userId"
                                    label="User ID"
                                    required
                                    value={form.userId}
                                    onChange={(e) => updateField('userId', e.target.value)}
                                    onBlur={() => blurField('userId')}
                                    placeholder="ObjectId tài khoản đăng nhập"
                                    disabled={submitting.current}
                                    error={touched.userId ? errors.userId : null}
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
                                    error={touched.employeeCode ? errors.employeeCode : null}
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
                                    error={touched.joinDate ? errors.joinDate : null}
                                />
                                <FormSelectField
                                    id="create-employmentType"
                                    label="Loại lao động"
                                    required
                                    value={form.employmentType}
                                    onChange={(e) => updateField('employmentType', e.target.value as EmploymentType)}
                                    options={employmentTypeOptions}
                                    disabled={submitting.current}
                                    error={touched.employmentType ? errors.employmentType : null}
                                />
                                <FormSelectField
                                    id="create-departmentId"
                                    label="Phòng ban"
                                    required
                                    value={form.departmentId}
                                    onChange={(e) => updateField('departmentId', e.target.value)}
                                    onBlur={() => blurField('departmentId')}
                                    options={departmentOptions(departments)}
                                    disabled={submitting.current}
                                    error={touched.departmentId ? errors.departmentId : null}
                                />
                                <FormSelectField
                                    id="create-positionId"
                                    label="Chức danh"
                                    required
                                    value={form.positionId}
                                    onChange={(e) => updateField('positionId', e.target.value)}
                                    onBlur={() => blurField('positionId')}
                                    options={positionOptions(positions)}
                                    disabled={submitting.current}
                                    error={touched.positionId ? errors.positionId : null}
                                />
                            </div>
                        </section>

                        {/* Personal Info Section */}
                        <section className="space-y-4 border-t border-border pt-6">
                            <div>
                                <h3 className="font-semibold text-foreground">Thông tin cá nhân</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Thông tin liên hệ và nhận diện của nhân viên.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormInputField
                                    id="create-dateOfBirth"
                                    label="Ngày sinh"
                                    type="date"
                                    value={form.dateOfBirth}
                                    onChange={(e) => updateField('dateOfBirth', e.target.value)}
                                    disabled={submitting.current}
                                />
                                <FormSelectField
                                    id="create-gender"
                                    label="Giới tính"
                                    value={form.gender}
                                    onChange={(e) => updateField('gender', e.target.value as Gender)}
                                    options={genderOptions}
                                    disabled={submitting.current}
                                />
                                <FormInputField
                                    id="create-phone"
                                    label="Số điện thoại"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={form.phone}
                                    onChange={(e) => updateField('phone', e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
                                    onBlur={() => blurField('phone')}
                                    placeholder="Ví dụ: 0912345678"
                                    disabled={submitting.current}
                                    error={touched.phone ? errors.phone : null}
                                    helperText={touched.phone && !errors.phone ? 'Chỉ nhập số, đủ 10 chữ số.' : undefined}
                                />
                                <FormInputField
                                    id="create-email"
                                    label="Email nhân sự"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => updateField('email', e.target.value)}
                                    onBlur={() => blurField('email')}
                                    placeholder="nguyenvana@company.com"
                                    disabled={submitting.current}
                                    error={touched.email ? errors.email : null}
                                />
                                <div className="sm:col-span-2">
                                    <FormInputField
                                        id="create-address"
                                        label="Địa chỉ"
                                        value={form.address}
                                        onChange={(e) => updateField('address', e.target.value)}
                                        disabled={submitting.current}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Legal & Payroll Section */}
                        <section className="space-y-4 border-t border-border pt-6">
                            <div>
                                <h3 className="font-semibold text-foreground">Pháp lý và thanh toán</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Các mã định danh dùng cho nghiệp vụ nhân sự và lương.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormInputField
                                    id="create-citizenId"
                                    label="CCCD/CMND"
                                    value={form.citizenId}
                                    onChange={(e) => updateField('citizenId', e.target.value.replace(/[^\d]/g, '').slice(0, 12))}
                                    onBlur={() => blurField('citizenId')}
                                    placeholder="9 đến 12 chữ số"
                                    disabled={submitting.current}
                                    error={touched.citizenId ? errors.citizenId : null}
                                />
                                <FormInputField
                                    id="create-taxCode"
                                    label="Mã số thuế"
                                    value={form.taxCode}
                                    onChange={(e) => updateField('taxCode', e.target.value.replace(/[^\d]/g, '').slice(0, 12))}
                                    onBlur={() => blurField('taxCode')}
                                    placeholder="10 đến 12 chữ số"
                                    disabled={submitting.current}
                                    error={touched.taxCode ? errors.taxCode : null}
                                />
                                <FormInputField
                                    id="create-socialInsuranceCode"
                                    label="Số BHXH"
                                    value={form.socialInsuranceCode}
                                    onChange={(e) => updateField('socialInsuranceCode', e.target.value.replace(/[^\d]/g, '').slice(0, 12))}
                                    onBlur={() => blurField('socialInsuranceCode')}
                                    disabled={submitting.current}
                                    error={touched.socialInsuranceCode ? errors.socialInsuranceCode : null}
                                />
                                <FormInputField
                                    id="create-bankAccount"
                                    label="Tài khoản ngân hàng"
                                    value={form.bankAccount}
                                    onChange={(e) => updateField('bankAccount', e.target.value.replace(/[^\d]/g, '').slice(0, 17))}
                                    onBlur={() => blurField('bankAccount')}
                                    placeholder="6 đến 17 chữ số"
                                    disabled={submitting.current}
                                    error={touched.bankAccount ? errors.bankAccount : null}
                                />
                            </div>
                        </section>

                        {/* Advanced Section */}
                        <details className="group rounded-xl border border-border">
                            <summary className="cursor-pointer list-none px-4 py-3 font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                                Liên kết nâng cao <span className="ml-1 text-sm font-normal text-muted-foreground">(không bắt buộc)</span>
                            </summary>
                            <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
                                <FormInputField
                                    id="create-directManagerId"
                                    label="User ID quản lý trực tiếp"
                                    value={form.directManagerId}
                                    onChange={(e) => updateField('directManagerId', e.target.value)}
                                    onBlur={() => blurField('directManagerId')}
                                    placeholder="ObjectId tài khoản quản lý"
                                    disabled={submitting.current}
                                    error={touched.directManagerId ? errors.directManagerId : null}
                                />
                                <FormInputField
                                    id="create-workplaceId"
                                    label="Workplace ID"
                                    value={form.workplaceId}
                                    onChange={(e) => updateField('workplaceId', e.target.value)}
                                    onBlur={() => blurField('workplaceId')}
                                    placeholder="ObjectId nơi làm việc"
                                    disabled={submitting.current}
                                />
                            </div>
                        </details>
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
                            disabled={submitting.current || !form.userId.trim() || !form.employeeCode.trim() || !form.joinDate}
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
