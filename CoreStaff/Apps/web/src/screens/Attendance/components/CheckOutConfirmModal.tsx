import * as React from 'react';
import { X, Clock, AlertTriangle, CheckCircle2, LogOut, Building2, Calendar, MapPin } from 'lucide-react';
import type { DayAttendance } from '../types';

export interface CheckOutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  submitting?: boolean;
  today: DayAttendance;
  currentAddress?: string;
}

function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
}

function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

export function CheckOutConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  submitting = false,
  today,
  currentAddress,
}: CheckOutConfirmModalProps) {
  if (!isOpen) return null;

  const now = new Date();
  const currentHoursStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  // 1. Phân tích giờ Check-in sáng
  const checkInRecordedAt = today.checkIn?.recordedAt || today.checkInAt;
  const checkInTimeFormatted = React.useMemo(() => {
    if (!checkInRecordedAt) return '--:--';
    const d = new Date(checkInRecordedAt);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }, [checkInRecordedAt]);

  // 2. Phân tích giờ kết thúc ca theo lịch
  const scheduledEndTime = React.useMemo(() => {
    if (today.attendanceRequirements?.effectiveCheckOutTime) {
      return today.attendanceRequirements.effectiveCheckOutTime;
    }
    if (today.shiftHours) {
      const parts = today.shiftHours.split('-');
      if (parts.length > 1) {
        return parts[1].trim();
      }
    }
    return '17:00'; // Mặc định nếu không tìm thấy
  }, [today.attendanceRequirements?.effectiveCheckOutTime, today.shiftHours]);

  const scheduledEndMinutes = parseTimeToMinutes(scheduledEndTime);

  // 3. Kiểm tra có về sớm hay không
  const earlyMinutes = React.useMemo(() => {
    if (scheduledEndMinutes === null) return 0;
    const diff = scheduledEndMinutes - currentTotalMinutes;
    return diff > 0 ? diff : 0;
  }, [scheduledEndMinutes, currentTotalMinutes]);

  const isEarly = earlyMinutes > 0;

  // 4. Ước tính tổng thời gian làm việc hôm nay
  const estimatedWorkingDuration = React.useMemo(() => {
    if (!checkInRecordedAt) return null;
    const checkInDate = new Date(checkInRecordedAt);
    const diffMs = now.getTime() - checkInDate.getTime();
    if (diffMs <= 0) return '0 phút';
    const totalMins = Math.floor(diffMs / 60000);
    return formatMinutesToHours(totalMins);
  }, [checkInRecordedAt, now]);

  const todayDateFormatted = now.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 transition-all animate-in fade-in duration-200"
      onClick={!submitting ? onClose : undefined}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-card p-5 sm:p-6 shadow-2xl border border-border space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-3.5">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2.5 ${isEarly ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-primary/10 text-primary'}`}>
              <LogOut className="size-5" />
            </div>
            <div>
              <h3 id="checkout-modal-title" className="text-base sm:text-lg font-bold text-foreground">
                Xác nhận Tan ca (Check-out)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kiểm tra thông tin ca làm việc trước khi chốt ngày công
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Cảnh báo thông minh nếu về sớm hoặc Thông báo hoàn thành ca */}
        {isEarly ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 space-y-1.5 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="size-4.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>CẢNH BÁO KẾT THÚC CA SỚM</span>
            </div>
            <p className="leading-relaxed">
              Ca làm việc của bạn kết thúc lúc <strong>{scheduledEndTime}</strong>. Bạn đang ghi nhận tan ca sớm{' '}
              <strong className="text-destructive dark:text-amber-300 underline font-semibold">
                {formatMinutesToHours(earlyMinutes)}
              </strong>.
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              * Sau khi xác nhận, ngày công hôm nay sẽ được chốt lại và không thể sửa đổi trừ khi có đơn giải trình.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200 flex items-center gap-2.5 shadow-xs">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-300">
                Đã hoàn tất thời gian làm việc theo ca
              </p>
              <p className="text-muted-foreground text-[11px]">
                Bạn đã hoàn thành trọn vẹn ca làm việc quy định ({scheduledEndTime}).
              </p>
            </div>
          </div>
        )}

        {/* Bảng tóm tắt thông tin ca làm việc */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between text-muted-foreground pb-2 border-b border-border/60">
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar className="size-3.5" /> Ngày làm việc
            </span>
            <span className="font-semibold text-foreground capitalize">{todayDateFormatted}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-background p-2.5 border border-border/80">
              <span className="text-muted-foreground text-[11px] block">Ca phân công</span>
              <span className="font-bold text-foreground text-sm mt-0.5 block">
                {today.shiftName || 'Ca hành chính'}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                {today.shiftHours || '08:00 - 17:00'}
              </span>
            </div>

            <div className="rounded-lg bg-background p-2.5 border border-border/80">
              <span className="text-muted-foreground text-[11px] block">Nơi làm việc</span>
              <span className="font-bold text-foreground text-sm mt-0.5 block truncate" title={today.workplace}>
                {today.workplace || 'Văn phòng chính'}
              </span>
              <span className="text-[11px] text-muted-foreground truncate block">
                {currentAddress || today.workplaceAddress || 'Tại văn phòng'}
              </span>
            </div>
          </div>

          {/* Dữ liệu chấm công đối chiếu */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 p-2.5 border border-emerald-200/60 dark:border-emerald-800/40">
              <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                <Clock className="size-3" />
                <span>Giờ Vào ca (Check-in)</span>
              </div>
              <p className="text-base font-bold text-emerald-900 dark:text-emerald-200 font-mono mt-1">
                {checkInTimeFormatted}
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Đã ghi nhận</span>
            </div>

            <div className="rounded-lg bg-primary/5 p-2.5 border border-primary/20">
              <div className="flex items-center gap-1 text-primary font-semibold text-[11px]">
                <Clock className="size-3" />
                <span>Giờ Ra ca (Check-out)</span>
              </div>
              <p className="text-base font-bold text-primary font-mono mt-1">
                {currentHoursStr}
              </p>
              <span className="text-[10px] text-muted-foreground">Thời điểm hiện tại</span>
            </div>
          </div>

          {estimatedWorkingDuration && (
            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <span className="text-muted-foreground font-medium">Tổng thời gian có mặt ước tính:</span>
              <span className="font-bold text-foreground font-mono bg-muted px-2 py-0.5 rounded">
                {estimatedWorkingDuration}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 sm:justify-end">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border text-xs sm:text-sm font-semibold hover:bg-muted text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            Tiếp tục làm việc
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
              isEarly
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {submitting ? (
              <span>Đang xử lý tan ca...</span>
            ) : (
              <>
                <LogOut className="size-4" />
                <span>{isEarly ? 'Xác nhận Tan ca sớm' : 'Xác nhận Tan ca'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

