import { FormLabel } from './FormLabel';
import { FormError } from './FormError';

interface FormSelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    id: string;
    label: string;
    required?: boolean;
    error?: string | null;
    options: Array<{ value: string; label: string }>;
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
                className="block min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                disabled={disabled}
                aria-invalid={!!error}
                {...props}
            >
                <option value="">{options[0]?.label ?? 'Chọn'}</option>
                {options.slice(1).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <FormError message={error} />
        </div>
    );
}
