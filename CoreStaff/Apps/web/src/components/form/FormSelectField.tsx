import { FormLabel } from './FormLabel';
import { FormError } from './FormError';

interface FormSelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    id: string;
    label: string;
    required?: boolean;
    error?: string | null;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
}

/**
 * FormSelectField — select chuẩn cho dropdown trong hệ thống HR.
 */
export function FormSelectField({
    id,
    label,
    required,
    error,
    options,
    placeholder = 'Chọn',
    disabled,
    ...props
}: FormSelectFieldProps) {
    return (
        <div className="space-y-1.5">
            <FormLabel htmlFor={id} required={required}>
                {label}
            </FormLabel>
            <select
                id={id}
                className="block min-h-11 w-full rounded-lg border border-input aria-invalid:border-destructive aria-invalid:ring-destructive/20 bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                disabled={disabled}
                required={required}
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-error` : undefined}
                {...props}
            >
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <FormError id={`${id}-error`} message={error} />
        </div>
    );
}
