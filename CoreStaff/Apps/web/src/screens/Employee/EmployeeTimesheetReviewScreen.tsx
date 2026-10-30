import { useEffect, useState } from 'react';
import { acknowledgeMyTimesheetReview, disputeMyTimesheetReview, getMyTimesheetReview, listMyTimesheetReviews, type EmployeeTimesheetReview } from '../../services/hrService';

export function EmployeeTimesheetReviewScreen({ apiBase }: { apiBase: string }) {
  const [review, setReview] = useState<EmployeeTimesheetReview | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try { const cards = await listMyTimesheetReviews(apiBase); setReview(cards[0] ? await getMyTimesheetReview(apiBase, cards[0].periodId) : null); }
    catch (e: any) { setError(e?.code === 'TIMESHEET_REVIEW_CHANGED' || e?.code === 'PERIOD_VERSION_CONFLICT' ? 'Bảng công đã thay đổi. Vui lòng tải lại và kiểm tra lại.' : 'Không tải được bảng công.'); }
  };
  useEffect(() => { void load(); }, [apiBase]);
  if (error) return <div role="alert">{error}</div>;
  if (!review) return <section><h1>Rà soát bảng công</h1><p>Chưa có kỳ công cần rà soát.</p></section>;
  const submitAck = async () => { setBusy(true); try { setReview(await acknowledgeMyTimesheetReview(apiBase, review.periodId, review.periodVersion, review.projectionHash)); setConfirming(false); } catch { await load(); } finally { setBusy(false); } };
  const submitDispute = async () => { if (reason.trim().length < 10) return; setBusy(true); try { setReview(await disputeMyTimesheetReview(apiBase, review.periodId, review.periodVersion, review.projectionHash, reason.trim())); setDisputing(false); } catch { await load(); } finally { setBusy(false); } };
  return <section className="mx-auto max-w-5xl space-y-5 px-4 py-8">
    <header><h1 className="text-2xl font-semibold">Rà soát bảng công</h1><p>Kỳ {review.periodKey} · phiên bản {review.periodVersion}</p><p>Trạng thái: {review.state === 'ACKNOWLEDGED' ? 'Đã xác nhận' : review.state === 'DISPUTED' ? 'Đã báo sai lệch' : 'Chờ rà soát'}</p></header>
    <div className="overflow-x-auto rounded border"><table className="w-full text-sm"><thead><tr><th>Ngày</th><th>Phút nghĩa vụ</th><th>Phút làm</th><th>Nghỉ hưởng lương</th><th>Tăng ca</th><th>Công dự kiến</th></tr></thead><tbody>{review.days.map(day => <tr key={day.workDate}><td>{day.workDate}</td><td>{day.scheduledObligationMinutes}</td><td>{day.workedScheduledMinutes}</td><td>{day.payableLeaveMinutes}</td><td>{day.overtimeMinutes}</td><td>{day.workCredit}</td></tr>)}</tbody></table></div>
    <p>Tổng công dự kiến: <strong>{review.payableWorkUnits}</strong> / {review.standardWorkUnits}</p>
    {review.history.length > 0 && <div><h2>Lịch sử xử lý</h2>{review.history.map((item, i) => <p key={i}>{item.action} {item.disputeReason ?? ''}</p>)}</div>}
    <div className="flex gap-3"><button disabled={busy || review.state === 'ACKNOWLEDGED'} onClick={() => setConfirming(true)}>Đã kiểm tra — thông tin chính xác</button><button disabled={busy} onClick={() => setDisputing(true)}>Báo sai lệch</button></div>
    {confirming && <div role="dialog"><h2>Xác nhận thông tin chính xác</h2><p>Xác nhận này gắn với đúng phiên bản và nội dung bạn vừa xem.</p><button onClick={submitAck}>Xác nhận</button><button onClick={() => setConfirming(false)}>Hủy</button></div>}
    {disputing && <div role="dialog"><label>Lý do sai lệch<textarea value={reason} onChange={e => setReason(e.target.value)} /></label>{reason.length > 0 && reason.trim().length < 10 && <p role="alert">Lý do cần ít nhất 10 ký tự.</p>}<button disabled={reason.trim().length < 10} onClick={submitDispute}>Gửi báo sai lệch</button><button onClick={() => setDisputing(false)}>Hủy</button></div>}
  </section>;
}
