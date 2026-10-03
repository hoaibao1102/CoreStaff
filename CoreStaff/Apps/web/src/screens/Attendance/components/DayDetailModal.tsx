import { X, Clock, Calendar, Briefcase, CheckCircle2 } from 'lucide-react';
import type { DayAttendance } from '../types';
import { EvidenceCard } from './EvidenceCard';
import { Badge } from '../../../components/badge';
import { AppLink } from '../../../components/AppLink';
import { getAttendanceHistoryStatus } from '../historyStatus';

export interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: DayAttendance | null;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
      return <Badge variant="default">Hoàn thành</Badge>;
    case 'CHECKED_IN':
      return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Đang làm việc</Badge>;
    case 'PENDING_APPROVAL':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Chờ duyệt</Badge>;
    case 'LATE':
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Đi trễ</Badge>;
    case 'DAY_OFF':
      return <Badge variant="outline">Nghỉ phép</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function DayDetailModal({ isOpen, onClose, day }: DayDetailModalProps) {
  if (!isOpen || !day) return null;
  const historyStatus = getAttendanceHistoryStatus(day);
  const adjustmentType = day.checkInAt || day.checkIn?.recordedAt ? 'CHECK_OUT' : 'CHECK_IN';
  const adjustmentHref = `/app/ot?${new URLSearchParams({
    type: 'ATTENDANCE',
    workDate: day.workDate,
    adjustmentType,
  })}`;

  const checkInTime = day.checkIn?.recordedAt
    ? new Date(day.checkIn.recordedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  const checkOutTime = day.checkOut?.recordedAt
    ? new Date(day.checkOut.recordedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  let workingHours = 'Chưa chốt';
  const mins = day.totalWorkingMinutes ?? day.workingMinutes;
  if (historyStatus === 'FORFEITED') {
    workingHours = '0 phút';
  } else if (day.status === 'COMPLETED' || (day.checkIn && day.checkOut)) {
    if (typeof mins === 'number' && mins > 0) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      workingHours = h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
    } else if (day.checkIn?.recordedAt && day.checkOut?.recordedAt) {
      const diffMs = new Date(day.checkOut.recordedAt).getTime() - new Date(day.checkIn.recordedAt).getTime();
      const diffMins = Math.max(0, Math.floor(diffMs / 60000));
      const diffSecs = Math.max(0, Math.floor((diffMs % 60000) / 1000));
      if (diffMins > 0) {
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        workingHours = h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
      } else {
        workingHours = `${diffSecs} giây`;
      }
    } else {
      workingHours = '0 phút';
    }
  } else if (typeof mins === 'number' && mins > 0) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    workingHours = h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-card p-5 shadow-2xl border border-border space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Calendar className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Chi tiết ngày {day.workDate}
              </h3>
              <p className="text-xs text-muted-foreground">{day.shiftName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Status & Work Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-border bg-muted/30">
            <span className="text-[11px] text-muted-foreground block">Trạng thái</span>
            <div className="mt-1">
              {historyStatus === 'FORFEITED'
                ? <Badge variant="secondary" className="bg-red-100 text-red-800">Mất ngày công</Badge>
                : historyStatus === 'FORGOTTEN'
                  ? <Badge variant="secondary" className="bg-amber-100 text-amber-800">Quên chấm công</Badge>
                  : historyStatus === 'LATE'
                    ? <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                        Đi trễ{(day.lateMinutes ?? 0) > 0 ? ` · ${day.lateMinutes} phút` : ''}
                      </Badge>
                    : getStatusBadge(day.status)}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-border bg-muted/30">
            <span className="text-[11px] text-muted-foreground block">Tổng thời gian</span>
            <span className="text-sm font-bold text-foreground mt-1 block font-mono">{workingHours}</span>
          </div>
        </div>

        {historyStatus === 'FORFEITED' && day.resolution && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <p className="font-semibold">Ngày này đã được xác nhận vắng và không tính công.</p>
            <p className="mt-1">Lý do: {day.resolution.reason}</p>
          </div>
        )}

        {/* Timeline Events & Evidence */}
        <div className="space-y-3">
          {/* Check-in event */}
          <div className="p-3 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-2.5 rounded-full bg-emerald-600" />
                <span className="text-xs font-bold text-foreground">Giờ vào (Check-in)</span>
              </div>
              <span className="font-mono text-xs font-bold text-foreground">{checkInTime}</span>
            </div>
            {day.checkIn ? (
              <EvidenceCard event={day.checkIn} slot="checkIn" />
            ) : (
              <p className="text-xs text-muted-foreground italic">Chưa ghi nhận giờ vào</p>
            )}
          </div>

          {/* Check-out event */}
          <div className="p-3 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-2.5 rounded-full bg-emerald-600" />
                <span className="text-xs font-bold text-foreground">Giờ ra (Check-out)</span>
              </div>
              <span className="font-mono text-xs font-bold text-foreground">{checkOutTime}</span>
            </div>
            {day.checkOut ? (
              <EvidenceCard event={day.checkOut} slot="checkOut" />
            ) : (
              <p className="text-xs text-muted-foreground italic">Chưa ghi nhận giờ ra</p>
            )}
          </div>
        </div>

        {/* Overtime (OT) section */}
        {day.overtime && (
          <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-950">Làm thêm giờ (OT) được duyệt</span>
              </div>
              <Badge className="bg-emerald-600 text-white text-[10px]">Đã duyệt</Badge>
            </div>
            <div className="text-xs text-indigo-900 space-y-1">
              <p className="font-semibold">
                Thời gian:{' '}
                {day.overtime.approvedStart
                  ? new Date(day.overtime.approvedStart).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : day.overtime.requestedStart
                  ? new Date(day.overtime.requestedStart).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
                {' → '}
                {day.overtime.approvedEnd
                  ? new Date(day.overtime.approvedEnd).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : day.overtime.requestedEnd
                  ? new Date(day.overtime.requestedEnd).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
                {day.overtime.otMinutes ? ` (${Math.floor(day.overtime.otMinutes / 60)}h${day.overtime.otMinutes % 60 > 0 ? ` ${day.overtime.otMinutes % 60}p` : ''})` : ''}
              </p>
              {day.overtime.reason && (
                <p className="text-indigo-800/80">Lý do: {day.overtime.reason}</p>
              )}
              {day.overtime.reviewComment && (
                <p className="text-indigo-950 italic text-[11px] bg-white/70 rounded p-1.5 border border-indigo-100">
                  Ý kiến Quản lý: "{day.overtime.reviewComment}"
                </p>
              )}
            </div>
          </div>
        )}

        {historyStatus === 'FORGOTTEN' && (
          <AppLink
            href={adjustmentHref}
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            <Calendar className="size-4" aria-hidden="true" />
            Gửi yêu cầu điều chỉnh công
          </AppLink>
        )}

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className={`w-full rounded-xl py-3 text-xs font-bold transition-colors ${
            historyStatus === 'FORGOTTEN'
              ? 'border border-border text-foreground hover:bg-muted'
              : 'bg-primary text-primary-foreground shadow hover:bg-primary/90'
          }`}
        >
          Đóng chi tiết
        </button>
      </div>
    </div>
  );
}
