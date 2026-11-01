import * as React from 'react';
import { overtimeErrorMessage, type OvertimePreview } from '../../services/overtime.service';

export function OvertimePreviewSummary({ preview, loading }: { preview?: OvertimePreview | null; loading: boolean }) {
  if (loading) return <p role="status" aria-live="polite">Đang tính OT…</p>;
  if (!preview) return null;
  return <section aria-label="Dự tính OT" aria-live="polite">
    <dl>
      <dt>Thời gian thực tế đủ điều kiện</dt><dd>{preview.rawEligibleMinutes ?? 0} phút</dd>
      <dt>Thời gian được tính OT</dt><dd>{preview.payableMinutes ?? 0} phút</dd>
      <dt>Phần không được tính theo ngưỡng/làm tròn</dt><dd>{preview.roundingDroppedMinutes ?? 0} phút</dd>
    </dl>
    {preview.policy && <p>Chính sách v{preview.policy.version}: tối thiểu {preview.policy.minimumOvertimeMinutes} phút mỗi đơn; {preview.policy.overtimeRoundingMinutes === 0 ? 'tính từng phút' : `làm tròn xuống theo ${preview.policy.overtimeRoundingMinutes} phút`}.</p>}
    {preview.blockedReasons.map(code => <p role="alert" key={code}>{overtimeErrorMessage(code)}</p>)}
  </section>;
}
