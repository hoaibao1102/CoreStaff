import { useState } from 'react';
import { X, Clock, Calendar, Briefcase, CheckCircle2, Calculator, ChevronDown, AlertCircle } from 'lucide-react';
import type { DayAttendance } from '../types';
import { EvidenceCard } from './EvidenceCard';
import { Badge } from '../../../components/badge';
import { AppLink } from '../../../components/AppLink';
import { getAttendanceHistoryStatus, type AttendanceHistoryStatus } from '../historyStatus';

export interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: DayAttendance | null;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
      return <Badge variant="default" className="bg-emerald-600 text-white">Hoàn thành</Badge>;
    case 'CHECKED_IN':
      return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Đang làm việc</Badge>;
    case 'PENDING_APPROVAL':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Chờ duyệt</Badge>;
    case 'LATE':
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Đi trễ</Badge>;
    case 'EARLY_LEAVE':
      return <Badge variant="secondary" className="bg-rose-100 text-rose-800">Về sớm</Badge>;
    case 'DAY_OFF':
      return <Badge variant="outline">Nghỉ phép</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export interface DayWorkCreditDetail {
  credit: number;
  label: string;
  isProvisional: boolean;
  statusText: string;
  obligationMinutes: number;
  workedMinutes: number;
  leaveMinutes: number;
  ratioPercent: number;
  ruleExplanation: string;
}

export function calculateDayWorkCredit(
  day: DayAttendance,
  historyStatus: AttendanceHistoryStatus,
): DayWorkCreditDetail {
  const obligationMinutes = day.attendanceRequirements?.requiredWorkingMinutes ?? 480;
  const leaveMinutes = day.attendanceRequirements?.approvedLeaveMinutes ?? 0;
  let workedMinutes = day.totalWorkingMinutes ?? day.workingMinutes ?? 0;

  if (historyStatus === 'FORFEITED') {
    workedMinutes = 0;
  } else if (workedMinutes === 0 && day.checkIn?.recordedAt && day.checkOut?.recordedAt) {
    const diffMs = new Date(day.checkOut.recordedAt).getTime() - new Date(day.checkIn.recordedAt).getTime();
    workedMinutes = Math.max(0, Math.floor(diffMs / 60000));
  }

  // 1. Ngày nghỉ tuần
  if (day.workdayType === 'WEEKLY_OFF') {
    return {
      credit: 0,
      label: '0 công',
      isProvisional: false,
      statusText: 'Nghỉ tuần',
      obligationMinutes: 0,
      workedMinutes: 0,
      leaveMinutes: 0,
      ratioPercent: 0,
      ruleExplanation: 'Ngày nghỉ hàng tuần theo quy định, không phát sinh nghĩa vụ làm việc.',
    };
  }

  // 2. Ngày lễ
  if (day.workdayType === 'PUBLIC_HOLIDAY') {
    return {
      credit: 1,
      label: '1.0 công',
      isProvisional: false,
      statusText: 'Nghỉ lễ',
      obligationMinutes,
      workedMinutes,
      leaveMinutes,
      ratioPercent: 100,
      ruleExplanation: 'Nghỉ lễ theo quy định Nhà nước, được hưởng nguyên lương (1.0 ngày công).',
    };
  }

  // 3. Nghỉ phép có lương
  if (day.workdayType === 'PAID_LEAVE') {
    return {
      credit: 1,
      label: '1.0 công',
      isProvisional: false,
      statusText: 'Nghỉ phép có lương',
      obligationMinutes,
      workedMinutes,
      leaveMinutes: obligationMinutes,
      ratioPercent: 100,
      ruleExplanation: 'Nghỉ phép hưởng lương đã được duyệt, tính đủ 1.0 ngày công.',
    };
  }

  // 4. Nghỉ không lương
  if (day.workdayType === 'UNPAID_LEAVE') {
    return {
      credit: 0,
      label: '0 công',
      isProvisional: false,
      statusText: 'Nghỉ không lương',
      obligationMinutes,
      workedMinutes: 0,
      leaveMinutes: 0,
      ratioPercent: 0,
      ruleExplanation: 'Nghỉ không hưởng lương theo đơn đề nghị đã phê duyệt.',
    };
  }

  // 5. Mất ngày công
  if (historyStatus === 'FORFEITED') {
    return {
      credit: 0,
      label: '0 công',
      isProvisional: false,
      statusText: 'Mất ngày công',
      obligationMinutes,
      workedMinutes: 0,
      leaveMinutes: 0,
      ratioPercent: 0,
      ruleExplanation: 'Đã xác nhận vắng (không tính công do thiếu mốc chấm công và không giải trình).',
    };
  }

  // 6. Quên chấm công (thiếu check-in hoặc check-out)
  if (historyStatus === 'FORGOTTEN') {
    return {
      credit: 0,
      label: '0 công',
      isProvisional: true,
      statusText: 'Chưa đủ mốc chấm',
      obligationMinutes,
      workedMinutes,
      leaveMinutes,
      ratioPercent: obligationMinutes > 0 ? Math.min(100, Math.round((workedMinutes / obligationMinutes) * 100)) : 0,
      ruleExplanation: 'Chưa đủ 2 mốc check-in và check-out. Theo chính sách công ty, ngày công tạm tính là 0 công cho đến khi gửi đơn Xác nhận công và được Quản lý duyệt.',
    };
  }

  // 7. Đang làm việc hôm nay
  if (day.status === 'CHECKED_IN') {
    return {
      credit: 0,
      label: 'Đang làm việc',
      isProvisional: true,
      statusText: 'Chưa kết thúc ca',
      obligationMinutes,
      workedMinutes,
      leaveMinutes,
      ratioPercent: obligationMinutes > 0 ? Math.min(100, Math.round((workedMinutes / obligationMinutes) * 100)) : 0,
      ruleExplanation: 'Ca làm việc đang diễn ra. Ngày công sẽ được chốt sau khi bạn hoàn tất check-out.',
    };
  }

  // 8. Đã hoàn thành hoặc ngày làm việc bình thường
  const creditedMinutes = Math.min(obligationMinutes, workedMinutes + leaveMinutes);
  const ratio = obligationMinutes > 0 ? creditedMinutes / obligationMinutes : 0;
  const ratioPercent = Math.min(100, Math.round(ratio * 100));

  if (ratio >= 0.9) {
    return {
      credit: 1,
      label: '1.0 công',
      isProvisional: false,
      statusText: 'Đạt 1 công',
      obligationMinutes,
      workedMinutes,
      leaveMinutes,
      ratioPercent,
      ruleExplanation: `Thời gian làm việc đạt ${ratioPercent}% ca quy định (yêu cầu tối thiểu 90%), được ghi nhận trọn vẹn 1.0 ngày công.`,
    };
  }

  if (ratio >= 0.5) {
    return {
      credit: 0.5,
      label: '0.5 công',
      isProvisional: false,
      statusText: 'Đạt nửa công',
      obligationMinutes,
      workedMinutes,
      leaveMinutes,
      ratioPercent,
      ruleExplanation: `Thời gian làm việc đạt ${ratioPercent}% ca quy định (từ 50% đến dưới 90%), được ghi nhận 0.5 ngày công.`,
    };
  }

  return {
    credit: 0,
    label: '0 công',
    isProvisional: false,
    statusText: 'Dưới nửa công',
    obligationMinutes,
    workedMinutes,
    leaveMinutes,
    ratioPercent,
    ruleExplanation: `Thời gian làm việc đạt ${ratioPercent}% ca (dưới 50%), không đủ điều kiện ghi nhận ngày công.`,
  };
}

export function DayDetailModal({ isOpen, onClose, day }: DayDetailModalProps) {
  const [showCreditDetail, setShowCreditDetail] = useState(false);

  if (!isOpen || !day) return null;
  const historyStatus = getAttendanceHistoryStatus(day);
  const creditDetail = calculateDayWorkCredit(day, historyStatus);

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

        {/* Status & Work Duration & Work Credit (3 thẻ) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {/* Card 1: Trạng thái (chỉ hiện nhãn, không hiện số phút) */}
          <div className="p-2.5 sm:p-3 rounded-xl border border-border bg-muted/30 flex flex-col justify-between">
            <span className="text-[11px] text-muted-foreground block font-medium">Trạng thái</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {historyStatus === 'FORFEITED' ? (
                <Badge variant="secondary" className="bg-red-100 text-red-800 text-[11px] px-2 py-0.5">Mất ngày công</Badge>
              ) : historyStatus === 'FORGOTTEN' ? (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5">Quên chấm công</Badge>
              ) : historyStatus === 'LATE' ? (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-[11px] px-2 py-0.5">Đi trễ</Badge>
              ) : historyStatus === 'EARLY_LEAVE' ? (
                <Badge variant="secondary" className="bg-rose-100 text-rose-800 text-[11px] px-2 py-0.5">Về sớm</Badge>
              ) : (
                getStatusBadge(day.status)
              )}
              {(day.earlyMinutes ?? 0) > 0 && historyStatus === 'LATE' && (
                <Badge variant="secondary" className="bg-rose-100 text-rose-800 text-[11px] px-2 py-0.5">Về sớm</Badge>
              )}
            </div>
          </div>

          {/* Card 2: Tổng thời gian */}
          <div className="p-2.5 sm:p-3 rounded-xl border border-border bg-muted/30 flex flex-col justify-between">
            <span className="text-[11px] text-muted-foreground block font-medium">Tổng thời gian</span>
            <span className="text-sm font-bold text-foreground mt-1 block font-mono">{workingHours}</span>
          </div>

          {/* Card 3: Ngày công */}
          <div className="p-2.5 sm:p-3 rounded-xl border border-border bg-muted/30 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] text-muted-foreground block font-medium">Ngày công</span>
              {creditDetail.isProvisional && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold whitespace-nowrap">Tạm tính</span>
              )}
            </div>
            <span className={`text-sm font-bold font-mono mt-1 block ${
              creditDetail.credit === 1
                ? 'text-emerald-600'
                : creditDetail.credit === 0.5
                ? 'text-blue-600'
                : 'text-amber-600'
            }`}>
              {creditDetail.label}
            </span>
          </div>
        </div>

        {/* Accordion Chi tiết quy đổi công */}
        <div className="rounded-xl border border-border bg-card overflow-hidden transition-all shadow-xs">
          <button
            type="button"
            onClick={() => setShowCreditDetail(prev => !prev)}
            className="w-full flex items-center justify-between p-3 text-left text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-primary" />
              <span>Chi tiết quy đổi công:</span>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                creditDetail.credit === 1
                  ? 'bg-emerald-100 text-emerald-800'
                  : creditDetail.credit === 0.5
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {creditDetail.label}
              </span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
              <span>{showCreditDetail ? 'Thu gọn' : 'Xem giải trình'}</span>
              <ChevronDown className={`size-4 transition-transform duration-200 ${showCreditDetail ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {showCreditDetail && (
            <div className="p-3 pt-0 border-t border-border/60 bg-muted/10 text-xs space-y-3 animate-in fade-in duration-150">
              {/* Progress bar hoàn thành ca */}
              <div className="mt-2.5 space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Tỷ lệ hoàn thành ca ({creditDetail.ratioPercent}%)</span>
                  <span>{creditDetail.workedMinutes}p / {creditDetail.obligationMinutes}p quy định</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      creditDetail.credit === 1
                        ? 'bg-emerald-500'
                        : creditDetail.credit === 0.5
                        ? 'bg-blue-500'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(creditDetail.ratioPercent, creditDetail.credit > 0 ? 10 : 0))}%` }}
                  />
                </div>
              </div>

              {/* Giải trình điều kiện quy đổi */}
              <div className="rounded-lg bg-background p-2.5 border border-border/80 text-[11px] space-y-1.5">
                <p className="font-medium text-foreground">{creditDetail.ruleExplanation}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-muted-foreground pt-1 border-t border-border/60">
                  <div>• Tiêu chuẩn 1.0 công: ≥ 90% ca ({Math.round(creditDetail.obligationMinutes * 0.9)} phút)</div>
                  <div>• Tiêu chuẩn 0.5 công: ≥ 50% ca ({Math.round(creditDetail.obligationMinutes * 0.5)} phút)</div>
                </div>
              </div>

              {/* Gợi ý xác nhận công khi thiếu mốc */}
              {creditDetail.isProvisional && historyStatus === 'FORGOTTEN' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-800 flex items-start gap-2">
                  <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-semibold">Lưu ý ngày công: </span>
                    Ngày này bị thiếu mốc chấm công. Bạn có thể gửi yêu cầu <strong>Xác nhận công</strong> để Quản lý duyệt và ghi nhận đủ công.
                  </div>
                </div>
              )}
            </div>
          )}
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
