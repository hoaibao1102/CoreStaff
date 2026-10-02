import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/dialog';
import { hrErrorMessage, getPeriodDayDetail, AttendanceDayDetail, PeriodBlockerRow } from '@/services/hrService';

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
  return new Date(value).toLocaleDateString('vi-VN');
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiBase: string;
  periodId: string;
  blocker: PeriodBlockerRow | null;
}) {
  const [detail, setDetail] = useState<AttendanceDayDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !blocker) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    void getPeriodDayDetail(apiBase, periodId, blocker.attendanceDayId)
      .then((data) => { if (!cancelled) setDetail(data); })
      .catch((err) => { if (!cancelled) setError(hrErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, blocker, apiBase, periodId]);

  const day = detail?.day;

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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
