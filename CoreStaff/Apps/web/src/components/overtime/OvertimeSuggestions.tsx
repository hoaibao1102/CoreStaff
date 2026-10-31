import * as React from 'react';
import { overtimeErrorMessage, type OvertimeSchedule, type OvertimeSuggestion } from '../../services/overtime.service';

export function OvertimeSuggestions({ workDate, schedule, loading, submitting = false, onSelect }: {
  workDate: string; schedule?: OvertimeSchedule | null; loading: boolean; submitting?: boolean; onSelect: (suggestion: OvertimeSuggestion) => void;
}) {
  if (!schedule || schedule.workDate !== workDate) return null;
  const time = (instant: string) => new Date(instant).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
  return <section aria-label="Khoảng OT được gợi ý" aria-busy={loading}>
    {(schedule.blockedReasons ?? []).map(code => <p role="alert" key={code}>{overtimeErrorMessage(code)}</p>)}
    {(schedule.suggestedOvertimeIntervals ?? []).map(suggestion => <div key={`${suggestion.from}/${suggestion.to}`}>
      <button type="button" disabled={loading || submitting || suggestion.canFile !== true || Boolean(suggestion.blockedReasons?.length)} onClick={() => onSelect(suggestion)}>
        {time(suggestion.from)}–{time(suggestion.to)} · Thực tế {suggestion.rawEligibleMinutes ?? 0} phút / tính OT {suggestion.payableMinutes ?? 0} phút
      </button>
      {(suggestion.blockedReasons ?? []).map(code => <p role="alert" key={code}>{overtimeErrorMessage(code)}</p>)}
    </div>)}
  </section>;
}
