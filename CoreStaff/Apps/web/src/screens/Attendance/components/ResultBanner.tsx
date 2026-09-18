import { CheckCircle2, AlertCircle } from 'lucide-react';

export interface ResultBannerProps {
  status: 'success' | 'error';
  message: string;
  workingMinutes?: number | null;
}

function formatHoursMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} giờ ${minutes} phút`;
}

export function ResultBanner({ status, message, workingMinutes }: ResultBannerProps) {
  if (status === 'success') {
    const showWorking = typeof workingMinutes === 'number' && workingMinutes >= 0;
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-xs animate-in fade-in"
      >
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="flex flex-col">
          <span className="font-semibold">{message || 'Ghi nhận chấm công thành công.'}</span>
          {showWorking ? (
            <span className="text-xs font-medium text-emerald-700 mt-0.5">
              Thời gian làm việc: {formatHoursMinutes(workingMinutes as number)}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-xs animate-in fade-in"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-rose-600" />
      <div>
        <span className="font-semibold">Thao tác không thành công</span>
        <p className="text-xs text-rose-700 mt-0.5">{message}</p>
      </div>
    </div>
  );
}
