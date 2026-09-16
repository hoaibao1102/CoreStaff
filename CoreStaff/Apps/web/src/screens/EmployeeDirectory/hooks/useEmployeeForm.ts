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
} from '../validation';

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

        // Xóa lỗi field khi người dùng sửa
        setErrors((prev) => ({ ...prev, [field]: null, general: prev.general }));
    }, []);

    const blurField = useCallback((field: keyof EmployeeFormState) => {
        setTouched((prev) => ({ ...prev, [field]: true }));

        // Validate field khi blur
        const newErrors = { ...errors };
        let errorMessage: string | null = null;

        switch (field) {
            case 'phone':
                errorMessage = validatePhone(form.phone);
                break;
            case 'email':
                errorMessage = validateEmail(form.email);
                break;
            case 'joinDate':
                errorMessage = validateJoinDate(form.joinDate);
                break;
            case 'employeeCode':
                errorMessage = validateEmployeeCode(form.employeeCode);
                break;
            case 'departmentId':
                errorMessage = validateDepartmentId(form.departmentId);
                break;
            case 'positionId':
                errorMessage = validatePositionId(form.positionId);
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

        if (errorMessage) {
            newErrors[field as keyof EmployeeFormErrors] = errorMessage;
        } else {
            delete newErrors[field as keyof EmployeeFormErrors];
        }

        setErrors(newErrors);
    }, [errors, form]);

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

        // Required fields
        const userIdError = !form.userId.trim() ? 'Vui lòng nhập User ID.' : null;
        const employeeCodeError = validateEmployeeCode(form.employeeCode);
        const joinDateError = validateJoinDate(form.joinDate);
        const phoneError = validatePhone(form.phone);
        const emailError = validateEmail(form.email);
        const departmentError = validateDepartmentId(form.departmentId);
        const positionError = validatePositionId(form.positionId);

        // Optional but validated fields
        const citizenIdError = form.citizenId.trim() ? validateCitizenId(form.citizenId) : null;
        const taxCodeError = form.taxCode.trim() ? validateTaxCode(form.taxCode) : null;
        const socialInsuranceError = form.socialInsuranceCode.trim() ? validateSocialInsuranceCode(form.socialInsuranceCode) : null;
        const bankAccountError = form.bankAccount.trim() ? validateBankAccount(form.bankAccount) : null;

        // Collect all errors
        if (userIdError) validationErrors.userId = userIdError;
        if (employeeCodeError) validationErrors.employeeCode = employeeCodeError;
        if (joinDateError) validationErrors.joinDate = joinDateError;
        if (phoneError) validationErrors.phone = phoneError;
        if (emailError) validationErrors.email = emailError;
        if (departmentError) validationErrors.departmentId = departmentError;
        if (positionError) validationErrors.positionId = positionError;
        if (citizenIdError) validationErrors.citizenId = citizenIdError;
        if (taxCodeError) validationErrors.taxCode = taxCodeError;
        if (socialInsuranceError) validationErrors.socialInsuranceCode = socialInsuranceError;
        if (bankAccountError) validationErrors.bankAccount = bankAccountError;

        setErrors(validationErrors);
        setTouched(Object.keys(form).reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<string, boolean>));

        return Object.keys(validationErrors).length === 0;
    }, [form]);

    const buildPayload = useCallback((): EmployeeCreatePayload => {
        const sanitized = sanitizeForm();
        return {
            userId: sanitized.userId,
            employeeCode: sanitized.employeeCode,
            employmentType: sanitized.employmentType,
            joinDate: sanitized.joinDate,
            dateOfBirth: sanitized.dateOfBirth || undefined,
            gender: sanitized.gender || undefined,
            phone: sanitized.phone || undefined,
            email: sanitized.email || undefined,
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
