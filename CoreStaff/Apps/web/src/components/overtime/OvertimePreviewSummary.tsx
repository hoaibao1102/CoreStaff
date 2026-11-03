import * as React from 'react';
import { type OvertimePreview } from '../../services/overtime.service';
import { OvertimeNoticeAlert } from './OvertimeSuggestions';

export function OvertimePreviewSummary({ preview, loading }: { preview?: OvertimePreview | null; loading: boolean }) {
  if (loading) return <p role="status" aria-live="polite" className="text-xs text-muted-foreground">Đang tính OT…</p>;
  if (!preview) return null;
  return (
    <section aria-label="Dự tính OT" aria-live="polite" className="space-y-3">
      <dl className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3 text-xs">
        <div>
          <dt className="text-muted-foreground">Thời gian thực tế đủ điều kiện</dt>
          <dd className="font-semibold text-foreground">{preview.rawEligibleMinutes ?? 0} phút</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Thời gian được tính OT</dt>
          <dd className="font-semibold text-foreground">{preview.payableMinutes ?? 0} phút</dd>
        </div>
        <div className="col-span-2 border-t pt-1.5 mt-1">
          <dt className="text-muted-foreground">Phần không được tính theo ngưỡng/làm tròn</dt>
          <dd className="font-semibold text-foreground">{preview.roundingDroppedMinutes ?? 0} phút</dd>
        </div>
      </dl>
      {preview.policy && (
        <p className="text-xs text-muted-foreground">
          Chính sách v{preview.policy.version}: tối thiểu {preview.policy.minimumOvertimeMinutes} phút mỗi đơn; {preview.policy.overtimeRoundingMinutes === 0 ? 'tính từng phút' : `làm tròn xuống theo ${preview.policy.overtimeRoundingMinutes} phút`}.
        </p>
      )}
      {preview.blockedReasons.map((code) => (
        <OvertimeNoticeAlert key={code} code={code} />
      ))}
    </section>
  );
}
