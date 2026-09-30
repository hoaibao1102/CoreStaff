import { BadgeVariant } from '@/components/badge';

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant; color: string }> = {
  OPEN: { label: 'Đang mở', variant: 'secondary', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  REVIEWING: { label: 'Đang rà soát', variant: 'secondary', color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' },
  READY_TO_CLOSE: { label: 'Sẵn sàng chốt', variant: 'secondary', color: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  CLOSED: { label: 'Đã chốt', variant: 'secondary', color: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
};

export function PeriodStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'text-muted-foreground' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}
