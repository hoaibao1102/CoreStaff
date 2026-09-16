import { cn } from "cn";

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    required?: boolean;
}

/**
 * FormLabel — nhãn chuẩn cho tất cả field trong hệ thống HR.
 * Tự động hiển thị dấu * đỏ khi required.
 */
export function FormLabel({ required, className, children, ...props }: FormLabelProps) {
    return (
        <label
            className={cn(
                'text-sm font-medium text-foreground',
                required && 'after:ml-0.5 after:text-destructive after:content-["*"]',
                className,
            )}
            {...props}
        >
            {children}
        </label>
    );
}
