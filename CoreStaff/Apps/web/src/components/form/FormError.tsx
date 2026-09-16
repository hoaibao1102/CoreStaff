import { cn } from "cn";

interface FormErrorProps extends React.HTMLAttributes<HTMLDivElement> {
    message?: string | null;
}

/**
 * FormError — hiển thị lỗi inline ngay dưới input.
 * Chỉ hiện khi có message, tự động ẩn khi không có.
 */
export function FormError({ message, className, ...props }: FormErrorProps) {
    if (!message) return null;

    return (
        <div
            className={cn('text-sm text-destructive mt-1', className)}
            role="alert"
            aria-live="polite"
            {...props}
        >
            {message}
        </div>
    );
}
