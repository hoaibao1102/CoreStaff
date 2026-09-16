import { forwardRef } from 'react';
import { Input } from '../input';
import { FormLabel } from './FormLabel';
import { FormError } from './FormError';

interface FormInputFieldProps extends Omit<React.ComponentProps<typeof Input>, 'label' | 'onBlur'> {
    id: string;
    label: string;
    required?: boolean;
    error?: string | null;
    helperText?: string;
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

/**
 * FormInputField — field chuẩn cho tất cả input trong hệ thống HR.
 * Tự động gắn label có dấu *, hiển thị lỗi inline dưới input.
 */
export const FormInputField = forwardRef<HTMLInputElement, FormInputFieldProps>(
    ({ id, label, required, error, helperText, type = 'text', ...props }, ref) => {
        return (
            <div className="space-y-1.5">
                <FormLabel htmlFor={id} required={required}>
                    {label}
                </FormLabel>
                <Input
                    id={id}
                    ref={ref}
                    type={type}
                    aria-invalid={!!error}
                    aria-describedby={helperText ? `${id}-hint` : undefined}
                    {...props}
                />
                {helperText && !error && (
                    <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                        {helperText}
                    </p>
                )}
                <FormError message={error} />
            </div>
        );
    },
);

FormInputField.displayName = 'FormInputField';
