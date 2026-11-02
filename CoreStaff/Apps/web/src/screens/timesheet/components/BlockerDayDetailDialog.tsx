import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Textarea } from '@/components/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/dialog';
import {
  hrErrorMessage,
  hrRequest,
  getPeriodDayDetail,
  resolveMissingPunchAsAbsent,
  AttendanceDayDetail,
  PeriodBlockerRow,
} from '@/services/hrService';
import { toast } from '@/components/toast';
import { formatVN } from '@/lib/datetime';

const DAY_RESULT_LABEL: Record<string, string> = {
  PRESENT: 'Có mặt',
  ABSENT: 'Vắng',
  INCOMPLETE: 'Thiếu giờ',
};

const APPROVAL_LABEL: Record<string, string> = {
  NOT_REQUIRED: 'Không cần duyệt',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
  CLARIFICATION_REQUESTED: 'Chờ giải trình',
};

const METHOD_LABEL: Record<string, string> = {
  NETWORK: 'Network',
  GPS: 'GPS',
  SELFIE: 'Selfie',
};

function formatTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value?: string): string {
  if (!value) return '—';
  return formatVN(value);
}

/**
 * TASK-074 — drill-down for one blocked attendance day.
 * Shows the day summary, its punches, and the linked approval request so the
 * reviewer can see why the day is blocking the close.
 */
export function BlockerDayDetailDialog({
  open,
  onOpenChange,
  apiBase,
  periodId,
  blocker,
  onResolved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiBase: string;
  periodId: string;
  blocker: PeriodBlockerRow | null;
  onResolved?: () => void | Promise<void>;
}) {
  const [detail, setDetail] = useState<AttendanceDayDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAbsenceResolution, setShowAbsenceResolution] = useState(false);
  const [resolutionReason, setResolutionReason] = useState('');
  const [resolving, setResolving] = useState(false);
  const [showExplanationForm, setShowExplanationForm] = useState(false);
  const [explanationNote, setExplanationNote] = useState('');
  const [requestingExplanation, setRequestingExplanation] = useState(false);

  useEffect(() => {
    if (!open || !blocker) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    setShowAbsenceResolution(false);
    setResolutionReason('');
    setShowExplanationForm(false);
    setExplanationNote('');
    void getPeriodDayDetail(apiBase, periodId, blocker.attendanceDayId)
      .then((data) => { if (!cancelled) setDetail(data); })
      .catch((err) => { if (!cancelled) setError(hrErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, blocker, apiBase, periodId]);

  const day = detail?.day;
  const canResolveAsAbsent = blocker?.type === 'MISSING_CHECK_IN' || blocker?.type === 'MISSING_CHECK_OUT';

  async function handleRequestExplanation() {
    if (!blocker) return;
    setRequestingExplanation(true);
    setError(null);
    try {
      await hrRequest(apiBase, `/api/hr/timesheet-periods/${periodId}/days/${blocker.attendanceDayId}/request-explanation`, {
        method: 'POST',
        body: JSON.stringify({ note: explanationNote.trim() || undefined }),
      });
      toast.success('Đã gửi yêu cầu giải trình về cho nhân viên.');
      onOpenChange(false);
      await onResolved?.();
    } catch (err) {
      setError(hrErrorMessage(err));
    } finally {
      setRequestingExplanation(false);
    }
  }

  async function handleResolveAsAbsent() {
    if (!blocker) return;
    const reason = resolutionReason.trim();
    if (reason.length < 10) {
      setError('Lý do phải có ít nhất 10 ký tự.');
      return;
    }
    setResolving(true);
    setError(null);
    try {
      await resolveMissingPunchAsAbsent(apiBase, periodId, blocker.attendanceDayId, reason);
      toast.success('Đã ghi nhận nhân viên vắng và không tính công ngày này.');
      onOpenChange(false);
      await onResolved?.();
    } catch (err) {
      setError(hrErrorMessage(err));
    } finally {
      setResolving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Chi tiết ngày công</DialogTitle>
          <DialogDescription>
            {blocker
              ? `${blocker.employee.name ?? blocker.employeeId} · ${formatDate(blocker.date)}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 pb-6">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && day && (
            <div className="space-y-4">
              {/* Blocker reason */}
              {blocker && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <span className="font-semibold">{blocker.note}</span>
                </div>
              )}

              {/* Day summary */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Ngày công</div>
                  <div className="font-medium">{day.workDate}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Kết quả</div>
                  <div className="font-medium">{DAY_RESULT_LABEL[day.dayResult ?? ''] ?? '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Loại ngày</div>
                  <div className="font-medium">{day.workdayType ?? '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Trạng thái duyệt</div>
                  <div className="font-medium">
                    {APPROVAL_LABEL[day.overallApprovalStatus ?? ''] ?? day.overallApprovalStatus ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Check-in</div>
                  <div className="font-medium">{formatTime(day.checkInAt)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Check-out</div>
                  <div className="font-medium">{formatTime(day.checkOutAt)}</div>
                </div>
              </div>

              {/* Punch events */}
              <div>
                <div className="mb-2 text-sm font-semibold">Lần chấm công</div>
                {detail!.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có lần chấm công nào.</p>
                ) : (
                  <div className="space-y-2">
                    {detail!.events.map((event) => (
                      <div
                        key={event._id}
                        className="flex items-center justify-between rounded-lg border p-3 text-sm"
                      >
                        <div>
                          <div className="font-medium">
                            {event.eventType === 'CHECK_IN' ? 'Check-in' : 'Check-out'} ·{' '}
                            {METHOD_LABEL[event.method] ?? event.method}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatTime(event.recordedAt)}
                            {event.address ? ` · ${event.address}` : ''}
                          </div>
                        </div>
                        {event.approvalStatus && (
                          <Badge variant={event.approvalStatus === 'REJECTED' ? 'destructive' : 'secondary'}>
                            {APPROVAL_LABEL[event.approvalStatus] ?? event.approvalStatus}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked request */}
              {detail!.request && (
                <div className="rounded-lg border p-3 text-sm">
                  <div className="font-semibold">Yêu cầu liên quan</div>
                  <div className="mt-1 text-muted-foreground">
                    Trạng thái: {APPROVAL_LABEL[detail!.request.status] ?? detail!.request.status}
                  </div>
                  {detail!.request.reviewComment && (
                    <div className="mt-1">Lý do: {detail!.request.reviewComment}</div>
                  )}
                </div>
              )}

              {canResolveAsAbsent && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm space-y-3">
                  <div className="font-semibold text-amber-900">Xử lý trường hợp quên chấm công</div>
                  <p className="text-amber-800">
                    HR có thể yêu cầu nhân viên giải trình lý do quên chấm công để quản lý duyệt bổ sung, hoặc trực tiếp xác nhận vắng không tính công.
                  </p>

                  {!showAbsenceResolution && !showExplanationForm && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => { setShowExplanationForm(true); setShowAbsenceResolution(false); }}
                      >
                        Yêu cầu NV giải trình
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => { setShowAbsenceResolution(true); setShowExplanationForm(false); }}
                      >
                        Xác nhận mất ngày công
                      </Button>
                    </div>
                  )}

                  {showExplanationForm && (
                    <div className="space-y-3 pt-2 border-t border-amber-200">
                      <div>
                        <label htmlFor="explanation-note" className="font-medium text-amber-950">
                          Ghi chú yêu cầu giải trình cho nhân viên:
                        </label>
                        <Textarea
                          id="explanation-note"
                          className="mt-1 bg-white"
                          value={explanationNote}
                          onChange={(e) => setExplanationNote(e.target.value)}
                          placeholder="Ví dụ: Ngày 29 thiếu chấm công ra ca. Vui lòng trình bày lý do để quản lý duyệt."
                          disabled={requestingExplanation}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={requestingExplanation}
                          onClick={() => setShowExplanationForm(false)}
                        >
                          Hủy
                        </Button>
                        <Button
                          type="button"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={requestingExplanation}
                          onClick={handleRequestExplanation}
                        >
                          {requestingExplanation && <Loader2 className="mr-2 size-4 animate-spin" />}
                          Gửi yêu cầu về cho nhân viên
                        </Button>
                      </div>
                    </div>
                  )}

                  {showAbsenceResolution && (
                    <div className="space-y-3 pt-2 border-t border-amber-200">
                      <div>
                        <label htmlFor="absence-resolution-reason" className="font-medium text-amber-950">
                          Lý do xử lý <span className="text-destructive">*</span>
                        </label>
                        <Textarea
                          id="absence-resolution-reason"
                          className="mt-1 bg-white"
                          value={resolutionReason}
                          onChange={(event) => setResolutionReason(event.target.value)}
                          minLength={10}
                          maxLength={1000}
                          placeholder="Ví dụ: Nhân viên quên chấm công và quản lý xác nhận vắng ngày này."
                          disabled={resolving}
                        />
                        <div className="mt-1 text-xs text-amber-700">Tối thiểu 10 ký tự.</div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={resolving}
                          onClick={() => setShowAbsenceResolution(false)}
                        >
                          Hủy
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={resolving || resolutionReason.trim().length < 10}
                          onClick={handleResolveAsAbsent}
                        >
                          {resolving && <Loader2 className="mr-2 size-4 animate-spin" />}
                          Xác nhận vắng, không tính công
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
