import { X, Clock, Calendar, Briefcase, CheckCircle2 } from 'lucide-react';
import type { DayAttendance } from '../types';
import { EvidenceCard } from './EvidenceCard';
import { Badge } from '../../../components/badge';

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
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Đi muộn</Badge>;
    case 'DAY_OFF':
      return <Badge variant="outline">Nghỉ phép</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function DayDetailModal({ isOpen, onClose, day }: DayDetailModalProps) {
  if (!isOpen || !day) return null;

  const checkInTime = day.checkIn?.recordedAt
    ? new Date(day.checkIn.recordedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  const checkOutTime = day.checkOut?.recordedAt
    ? new Date(day.checkOut.recordedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  const workingHours = day.totalWorkingMinutes
    ? `${Math.floor(day.totalWorkingMinutes / 60)} giờ ${day.totalWorkingMinutes % 60} phút`
    : 'Chưa chốt';

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
            <div className="mt-1">{getStatusBadge(day.status)}</div>
          </div>
          <div className="p-3 rounded-xl border border-border bg-muted/30">
            <span className="text-[11px] text-muted-foreground block">Tổng thời gian</span>
            <span className="text-sm font-bold text-foreground mt-1 block font-mono">{workingHours}</span>
          </div>
        </div>

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

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          Đóng chi tiết
        </button>
      </div>
    </div>
  );
}
