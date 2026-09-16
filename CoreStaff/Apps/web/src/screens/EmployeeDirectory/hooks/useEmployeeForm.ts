import { useState, useCallback, useRef } from 'react';
import type { EmployeeFormState, EmployeeFormErrors, EmployeeCreatePayload } from '../types';
import { DEFAULT_EMPLOYEE_FORM_VALUES } from '../constants';
import {
    validatePhone,
    sanitizePhone,
    validateEmail,
    validateJoinDate,
    validateEmployeeCode,
    validateDepartmentId,
    validatePositionId,
    validateCitizenId,
    validateTaxCode,
    validateSocialInsuranceCode,
    validateBankAccount,
    validateOptionalDateOfBirth,
    validateAddress,
} from '../validation';

function validateField(field: keyof EmployeeFormState, form: EmployeeFormState): string | null {
    let errorMessage: string | null = null;
    switch (field) {
        case 'userId':
            errorMessage = form.userId.trim() ? null : 'Vui lòng chọn tài khoản nhân viên.';
            break;
        case 'phone':
            errorMessage = form.phone.trim() ? validatePhone(form.phone) : null;
            break;
        case 'email':
            errorMessage = form.email.trim() ? validateEmail(form.email) : null;
            break;
        case 'joinDate':
            errorMessage = validateJoinDate(form.joinDate);
            break;
        case 'employeeCode':
            errorMessage = validateEmployeeCode(form.employeeCode);
            break;
        case 'departmentId':
            errorMessage = form.departmentId.trim() ? validateDepartmentId(form.departmentId) : null;
            break;
        case 'dateOfBirth':
            errorMessage = validateOptionalDateOfBirth(form.dateOfBirth);
            break;
        case 'address':
            errorMessage = validateAddress(form.address);
            break;
        case 'positionId':
            errorMessage = form.positionId.trim() ? validatePositionId(form.positionId) : null;
            break;
        case 'citizenId':
            errorMessage = validateCitizenId(form.citizenId);
            break;
        case 'taxCode':
            errorMessage = validateTaxCode(form.taxCode);
            break;
        case 'socialInsuranceCode':
            errorMessage = validateSocialInsuranceCode(form.socialInsuranceCode);
            break;
        case 'bankAccount':
            errorMessage = validateBankAccount(form.bankAccount);
            break;
    }

    return errorMessage;
}

/**
 * useFormEmployee — hook quản lý state và validation cho form tạo/sửa nhân viên.
 * Tách biệt hoàn toàn logic validation khỏi UI component.
 */
export function useFormEmployee(initialValues?: Partial<EmployeeFormState>) {
    const [form, setForm] = useState<EmployeeFormState>({
        ...DEFAULT_EMPLOYEE_FORM_VALUES,
        ...initialValues,
    });
    const [errors, setErrors] = useState<EmployeeFormErrors>({ general: null });
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const submitting = useRef(false);

    const updateField = useCallback((field: keyof EmployeeFormState, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));

        // Chỉ xóa lỗi khi giá trị đã hợp lệ; chưa tương tác thì chưa báo lỗi.
        setErrors((prev) => ({ ...prev, [field]: touched[field] || prev[field] ? validateField(field, { ...form, [field]: value }) : null }));
    }, [form, touched]);

    const blurField = useCallback((field: keyof EmployeeFormState) => {
        setTouched((prev) => ({ ...prev, [field]: true }));

        // Validate field khi blur
        setErrors(prev => ({ ...prev, [field]: validateField(field, form) }));
    }, [form]);

    const sanitizeForm = useCallback(() => {
        return {
            ...form,
            phone: sanitizePhone(form.phone),
            employeeCode: form.employeeCode.trim(),
            userId: form.userId.trim(),
            joinDate: form.joinDate,
        };
    }, [form]);

    const validateAll = useCallback((): boolean => {
        const validationErrors: EmployeeFormErrors = {};

        for (const field of Object.keys(form) as (keyof EmployeeFormState)[]) {
            const message = validateField(field, form);
            if (message) validationErrors[field] = message;
        }

        setErrors(validationErrors);
        setTouched(Object.keys(form).reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<string, boolean>));

        return Object.keys(validationErrors).length === 0;
    }, [form]);

    const buildPayload = useCallback((): EmployeeCreatePayload => {
        const sanitized = sanitizeForm();
        return {
            userId: sanitized.userId,
            employeeCode: sanitized.employeeCode,
            employmentType: sanitized.employmentType || undefined,
            joinDate: sanitized.joinDate,
            dateOfBirth: sanitized.dateOfBirth || undefined,
            gender: sanitized.gender || undefined,
            phone: sanitized.phone || undefined,
            email: sanitized.email.trim() || undefined,
            address: sanitized.address.trim() || undefined,
            citizenId: sanitized.citizenId.trim() || undefined,
            taxCode: sanitized.taxCode.trim() || undefined,
            socialInsuranceCode: sanitized.socialInsuranceCode.trim() || undefined,
            bankAccount: sanitized.bankAccount.trim() || undefined,
            departmentId: sanitized.departmentId || undefined,
            positionId: sanitized.positionId || undefined,
            directManagerId: sanitized.directManagerId.trim() || undefined,
            workplaceId: sanitized.workplaceId.trim() || undefined,
        };
    }, [sanitizeForm]);

    const resetForm = useCallback(() => {
        setForm({ ...DEFAULT_EMPLOYEE_FORM_VALUES, ...initialValues });
        setErrors({ general: null });
        setTouched({});
    }, [initialValues]);

    return {
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
    };
}
