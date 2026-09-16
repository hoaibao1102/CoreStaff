import { EMPLOYEE_FORM_FIELDS } from './constants';
import type { EmployeeFormErrors } from './types';

const formatErrors: Record<string, [keyof EmployeeFormErrors, string]> = {
    PHONE_INVALID: ['phone', 'Số điện thoại phải gồm đúng 10 chữ số.'],
    EMAIL_INVALID: ['email', 'Email chưa đúng định dạng. Ví dụ: nhanvien@company.com'],
    CITIZEN_ID_INVALID: ['citizenId', 'CCCD/CMND phải gồm từ 9 đến 12 chữ số.'],
    TAX_CODE_INVALID: ['taxCode', 'Mã số thuế phải gồm 10 đến 12 chữ số.'],
    SOCIAL_INSURANCE_CODE_INVALID: ['socialInsuranceCode', 'Số BHXH phải gồm tối đa 12 chữ số.'],
    BANK_ACCOUNT_INVALID: ['bankAccount', 'Tài khoản ngân hàng phải gồm từ 6 đến 17 chữ số.'],
    EMAIL_TAKEN: ['email', 'Email nhân sự này đã được sử dụng.'],
    PHONE_TAKEN: ['phone', 'Số điện thoại này đã được sử dụng.'],
};

/** Translate only known API fields; never render raw database/validator messages. */
export function mapEmployeeValidationErrors(error: unknown): EmployeeFormErrors {
    const api = error as { code?: string; details?: unknown } | null;
    const messages = [api?.code, ...(Array.isArray(api?.details) ? api.details : [])];
    const result: EmployeeFormErrors = {};
    for (const message of messages) {
        if (typeof message !== 'string') continue;
        const format = formatErrors[message];
        if (format) { result[format[0]] = format[1]; continue; }
        const field = EMPLOYEE_FORM_FIELDS.find(item => message.startsWith(`${item.key} `));
        if (field) result[field.key] = `${field.label} chưa hợp lệ. Vui lòng kiểm tra lại.`;
        if (message.startsWith('employmentType ')) result.employmentType = 'Vui lòng chọn loại lao động trong danh sách.';
    }
    return result;
}
