/**
 * Validation rules cho toàn bộ hệ thống HR.
 * Sử dụng ngôn ngữ nghiệp vụ, không dùng thuật ngữ kỹ thuật.
 */

// ───────── Phone Validation ─────────

export function validatePhone(value: string): string | null {
    const trimmed = value.trim();

    if (!trimmed) {
        return 'Vui lòng nhập số điện thoại.';
    }

    // Chỉ cho phép chữ số
    if (!/^\d+$/.test(trimmed)) {
        return 'Số điện thoại chỉ được chứa chữ số.';
    }

    if (trimmed.length < 9) {
        return 'Số điện thoại phải gồm đủ 10 chữ số.';
    }

    if (trimmed.length > 10) {
        return 'Số điện thoại tối đa 10 chữ số.';
    }

    if (trimmed.length === 9) {
        return 'Số điện thoại phải gồm đủ 10 chữ số.';
    }

    return null;
}

export function sanitizePhone(value: string): string {
    return value.replace(/[^\d]/g, '').slice(0, 10);
}

// ───────── Name Validation ─────────

export function validateFullName(value: string): string | null {
    const trimmed = value.trim();

    if (!trimmed) {
        return 'Vui lòng nhập họ và tên nhân viên.';
    }

    // Kiểm tra tên tiếng Việt hợp lý — chỉ cho phép chữ, khoảng trắng, dấu
    if (!/^[\p{L}\s\u0300-\u036F]+$/u.test(trimmed)) {
        return 'Họ và tên chỉ được chứa ký tự chữ và khoảng trắng.';
    }

    if (trimmed.split(/\s+/).filter(Boolean).length < 2) {
        return 'Họ và tên phải có ít nhất hai từ.';
    }

    return null;
}

// ───────── Email Validation ─────────

export function validateEmail(value: string): string | null {
    const trimmed = value.trim();

    if (!trimmed) {
        return 'Vui lòng nhập email.';
    }

    // Regex email chuẩn RFC 5322 simplified
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(trimmed)) {
        return 'Email chưa đúng định dạng. Ví dụ: nguyenvana@gmail.com';
    }

    return null;
}

// ───────── Date Validation ─────────

export function validateDateNotFuture(value: string, label: string): string | null {
    if (!value.trim()) {
        return `Vui lòng chọn ${label}.`;
    }

    const date = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(date.getTime())) {
        return `Ngày ${label} không hợp lệ.`;
    }

    if (date > today) {
        return `Ngày ${label} không thể lớn hơn ngày hiện tại.`;
    }

    return null;
}

export function validateDateAfter(value: string, afterValue: string, label: string): string | null {
    if (!value.trim()) {
        return `Vui lòng chọn ${label}.`;
    }

    if (!afterValue.trim()) {
        return null; // Để trường sau tự báo lỗi
    }

    const date = new Date(value);
    const afterDate = new Date(afterValue);

    if (Number.isNaN(date.getTime()) || Number.isNaN(afterDate.getTime())) {
        return `Ngày ${label} không hợp lệ.`;
    }

    if (date <= afterDate) {
        return `Ngày ${label} phải sau ngày bắt đầu hợp đồng.`;
    }

    return null;
}

export function validateJoinDate(value: string): string | null {
    if (!value.trim()) {
        return 'Vui lòng chọn ngày vào làm.';
    }

    // Parse YYYY-MM-DD thành ngày cục bộ để tránh lệch múi giờ UTC
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(date.getTime())) {
        return 'Ngày vào làm không hợp lệ.';
    }

    if (date > today) {
        return 'Ngày vào làm không thể lớn hơn ngày hiện tại.';
    }

    return null;
}

// ───────── Required Field Validation ─────────

export function validateRequired(value: string, fieldName: string): string | null {
    const trimmed = value.trim();

    if (!trimmed) {
        return `Vui lòng chọn ${fieldName}.`;
    }

    return null;
}

// ───────── Employee Code Validation ─────────

export function validateEmployeeCode(value: string): string | null {
    const trimmed = value.trim();

    if (!trimmed) {
        return 'Vui lòng nhập mã nhân viên.';
    }

    if (trimmed.length < 3) {
        return 'Mã nhân viên phải có ít nhất 3 ký tự.';
    }

    if (trimmed.length > 32) {
        return 'Mã nhân viên tối đa 32 ký tự.';
    }

    return null;
}

// ───────── Department / Position Validation ─────────

export function validateDepartmentId(value: string): string | null {
    if (!value.trim()) {
        return 'Vui lòng chọn phòng ban.';
    }
    return null;
}

export function validatePositionId(value: string): string | null {
    if (!value.trim()) {
        return 'Vui lòng chọn chức danh.';
    }
    return null;
}

// ───────── Salary / Number Validation ─────────

export function validatePositiveNumber(value: string, fieldName: string): string | null {
    const trimmed = value.trim();

    if (!trimmed) {
        return `Vui lòng nhập ${fieldName}.`;
    }

    const num = Number(trimmed);

    if (Number.isNaN(num)) {
        return `${fieldName} phải là một số hợp lệ.`;
    }

    if (num <= 0) {
        return `${fieldName} phải lớn hơn 0.`;
    }

    return null;
}

// ───────── Citizen ID / Tax Code Validation ─────────

export function validateCitizenId(value: string): string | null {
    const trimmed = value.trim();

    if (!trimmed) {
        return null; // Không bắt buộc
    }

    if (!/^\d{9,12}$/.test(trimmed)) {
        return 'CCCD/CMND phải gồm 9 đến 12 chữ số.';
    }

    return null;
}

export function validateTaxCode(value: string): string | null {
    const trimmed = value.trim();

    if (!trimmed) {
        return null; // Không bắt buộc
    }

    if (!/^\d{10,12}$/.test(trimmed)) {
        return 'Mã số thuế phải gồm 10 đến 12 chữ số.';
    }

    return null;
}

// ───────── Social Insurance / Bank Account Validation ─────────

export function validateSocialInsuranceCode(value: string): string | null {
    const trimmed = value.trim();

    if (!trimmed) {
        return null; // Không bắt buộc
    }

    if (!/^\d{1,12}$/.test(trimmed)) {
        return 'Số BHXH phải gồm tối đa 12 chữ số.';
    }

    return null;
}

export function validateBankAccount(value: string): string | null {
    const trimmed = value.trim();

    if (!trimmed) {
        return null; // Không bắt buộc
    }

    if (!/^\d{6,17}$/.test(trimmed)) {
        return 'Tài khoản ngân hàng phải gồm từ 6 đến 17 chữ số.';
    }

    return null;
}
