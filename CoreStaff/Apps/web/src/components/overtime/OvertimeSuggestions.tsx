import * as React from 'react';
import { AlertCircle, Clock3, Sparkles } from 'lucide-react';
import { overtimeErrorMessage, type OvertimeSchedule, type OvertimeSuggestion } from '../../services/overtime.service';

export function OvertimeNoticeAlert({ code }: { code: string }) {
  const fullMessage = overtimeErrorMessage(code);
  const splitIndex = fullMessage.indexOf('. ');
  const hasTitle = splitIndex !== -1;
  const title = hasTitle ? fullMessage.substring(0, splitIndex + 1) : null;
  const description = hasTitle ? fullMessage.substring(splitIndex + 2) : fullMessage;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-orange-50/40 p-3.5 text-xs text-amber-900 shadow-sm dark:border-amber-800/40 dark:from-amber-950/30 dark:to-orange-950/10 dark:text-amber-200 transition-all"
    >
      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
        <AlertCircle className="size-3.5" />
      </div>
      <div className="space-y-1 leading-relaxed">
        {title ? (
          <>
            <p className="font-semibold text-amber-950 dark:text-amber-100 tracking-tight">
              {title}
            </p>
            <p className="text-amber-800/90 dark:text-amber-200/80">
              {description}
            </p>
          </>
        ) : (
          <p className="font-medium text-amber-900 dark:text-amber-100">
            {fullMessage}
          </p>
        )}
      </div>
    </div>
  );
}

export function OvertimeSuggestions({ workDate, schedule, loading, submitting = false, onSelect }: {
  workDate: string;
  schedule?: OvertimeSchedule | null;
  loading: boolean;
  submitting?: boolean;
  onSelect: (suggestion: OvertimeSuggestion) => void;
}) {
  if (!schedule || schedule.workDate !== workDate) return null;
  const time = (instant: string) =>
    new Date(instant).toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
    });

  const blockedReasons = schedule.blockedReasons ?? [];
  const suggestions = schedule.suggestedOvertimeIntervals ?? [];

  if (blockedReasons.length === 0 && suggestions.length === 0) return null;

  return (
    <section aria-label="Khoảng OT được gợi ý" aria-busy={loading} className="space-y-3">
      {blockedReasons.map((code) => (
        <OvertimeNoticeAlert key={code} code={code} />
      ))}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-indigo-500" />
            Khung giờ gợi ý theo mốc chấm công thực tế:
          </p>
          <div className="flex flex-col gap-2">
            {suggestions.map((suggestion) => {
              const isBlocked = suggestion.canFile !== true || Boolean(suggestion.blockedReasons?.length);
              return (
                <div key={`${suggestion.from}/${suggestion.to}`} className="w-full space-y-1.5">
                  <button
                    type="button"
                    disabled={loading || submitting || isBlocked}
                    onClick={() => onSelect(suggestion)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2 text-left text-xs font-medium transition-all ${
                      isBlocked
                        ? 'border-border/60 bg-muted/30 text-muted-foreground cursor-not-allowed opacity-70'
                        : 'border-indigo-200/90 bg-indigo-50/60 text-indigo-950 hover:bg-indigo-100/80 hover:border-indigo-300 cursor-pointer shadow-sm active:scale-[0.99]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Clock3 className="size-3.5 shrink-0 text-indigo-600" />
                      <span>{time(suggestion.from)}–{time(suggestion.to)}</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      Thực tế {suggestion.rawEligibleMinutes ?? 0} phút / tính OT {suggestion.payableMinutes ?? 0} phút
                    </span>
                  </button>
                  {(suggestion.blockedReasons ?? []).map((code) => (
                    <OvertimeNoticeAlert key={code} code={code} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
