/**
 * Validation rules cho form chỉnh sửa nhân viên (Employee Detail).
 */

export function validateEditPhone(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null; // Không bắt buộc trong edit mode

    if (!/^\d+$/.test(trimmed)) {
        return 'Số điện thoại chỉ được chứa chữ số.';
    }

    if (trimmed.length < 9 || trimmed.length > 10) {
        return 'Số điện thoại phải gồm đủ 10 chữ số.';
    }

    return null;
}

export function validateEditEmail(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null; // Không bắt buộc trong edit mode

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmed)) {
        return 'Email chưa đúng định dạng. Ví dụ: nguyenvana@gmail.com';
    }

    return null;
}

export function validateEditDateOfBirth(value: string): string | null {
    if (!value.trim()) return null;

    const date = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(date.getTime())) {
        return 'Ngày sinh không hợp lệ.';
    }

    if (date > today) {
        return 'Ngày sinh không thể lớn hơn ngày hiện tại.';
    }

    return null;
}

export function validateEditJoinDate(value: string): string | null {
    if (!value.trim()) return 'Vui lòng chọn ngày vào làm.';

    const date = new Date(value);
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

export function validateStatusEffectiveDate(value: string): string | null {
    if (!value.trim()) {
        return 'Vui lòng chọn ngày hiệu lực.';
    }

    const date = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(date.getTime())) {
        return 'Ngày hiệu lực không hợp lệ.';
    }

    if (date > today) {
        return 'Ngày hiệu lực không thể lớn hơn ngày hiện tại.';
    }

    return null;
}
