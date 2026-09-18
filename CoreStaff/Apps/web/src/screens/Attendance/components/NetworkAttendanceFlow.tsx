import * as React from 'react';
import { Clock, MapPin, CheckCircle2, AlertCircle, Fingerprint, RefreshCw, RotateCcw } from 'lucide-react';
import type { DayAttendance } from '../types';
import { StickyActionBar } from './StickyActionBar';

export interface NetworkAttendanceFlowProps {
  today: DayAttendance;
  employeeName: string;
  employeeCode: string;
  department: string;
  submitting: boolean;
  onSubmit: () => void;
  onOpenPolicy: () => void;
  onOpenSuccessModal?: () => void;
  roleTitle?: string;
}

export function NetworkAttendanceFlow({
  today,
  employeeName,
  employeeCode,
  department,
  submitting,
  onSubmit,
  onOpenPolicy,
  onOpenSuccessModal,
  roleTitle,
}: NetworkAttendanceFlowProps) {
  const [timeStr, setTimeStr] = React.useState('07 : 45 : 12');

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setTimeStr(`${h} : ${m} : ${s}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const dateFormatted = React.useMemo(() => {
    const now = new Date();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    return `${dayName}, ${day} Tháng ${month}, ${year}`;
  }, []);

  const ctx = today.verificationContext;
  const isNetworkConnected = ctx.method === 'NETWORK' && ctx.canAttend;
  const isCheckOut = today.availableAction === 'CHECK_OUT';
  const isCompleted = today.status === 'COMPLETED';
  const isCheckedIn = today.status === 'CHECKED_IN' || isCompleted;

  const checkInText = today.checkIn?.recordedAt
    ? `Check-in: ${new Date(today.checkIn.recordedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
    : 'Check-in: chưa ghi nhận';

  const checkOutText = today.checkOut?.recordedAt
    ? `Check-out: ${new Date(today.checkOut.recordedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
    : 'Check-out: chưa ghi nhận';

  const statusBadgeLabel = isCompleted
    ? 'Đã hoàn thành'
    : isCheckedIn
      ? 'Đã Check-in'
      : 'Chưa Check-in';

  const buttonLabel = isCompleted
    ? 'Đã hoàn thành ca làm việc'
    : isCheckOut
      ? 'Ghi nhận Tan ca (Check-out)'
      : 'Ghi nhận Vào ca (Check-in)';

  const isDisabled = !isNetworkConnected || submitting || today.availableAction === 'NONE' || isCompleted;

  return (
    <div className="space-y-4 md:space-y-5 animate-in fade-in duration-200">
      {/* Greeting Header */}
      <div className="space-y-1">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">
          Chào buổi sáng, {employeeName || 'Nhân viên CoreStaff'}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-medium">
          <span>ID: {employeeCode || 'CS-0123'} • {department || 'Văn phòng'}</span>
          {roleTitle && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
              {roleTitle}
            </span>
          )}
        </div>
      </div>

      {/* Responsive Grid: 1 column on mobile, 2 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start">
        {/* Left Column: Clock + Network Status + Primary Action */}
        <div className="md:col-span-5 flex flex-col gap-4">
          {/* Card 1: Server Time Clock */}
          <div className="rounded-2xl border border-border bg-card p-4 md:p-5 text-center shadow-xs space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">{dateFormatted}</p>
            <p className="text-3xl md:text-4xl font-extrabold text-foreground tracking-wider font-mono py-1">
              {timeStr}
            </p>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <RotateCcw className="size-3" />
              <span>Đồng bộ giờ máy chủ</span>
            </div>
          </div>

          {/* Card 2: Network Status Banner */}
          {isNetworkConnected ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-900">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
              <span className="leading-relaxed">
                Đã kết nối mạng Wi-Fi/LAN của văn phòng. Bạn có thể tiến hành chấm công.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-900">
              <AlertCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="leading-relaxed">
                Chưa kết nối đúng mạng văn phòng được ủy quyền. Vui lòng kết nối Wi-Fi/LAN công ty.
              </span>
            </div>
          )}

          {/* Primary Action Button + Policy Link */}
          <StickyActionBar>
            <button
              id={`btn-primary-${today.availableAction.toLowerCase()}`}
              type="button"
              disabled={isDisabled}
              onClick={onSubmit}
              className={`w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 px-4 font-bold text-base text-primary-foreground shadow-md transition-all active:scale-[0.98] ${
                isDisabled
                  ? 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
                  : 'bg-primary hover:bg-primary/90'
              }`}
            >
              {submitting ? (
                <>
                  <RefreshCw className="size-5 animate-spin" />
                  <span>Đang ghi nhận...</span>
                </>
              ) : isCompleted ? (
                <>
                  <CheckCircle2 className="size-5 text-emerald-600" />
                  <span>Đã hoàn thành ca hôm nay</span>
                </>
              ) : (
                <>
                  <Fingerprint className="size-5 stroke-[2.2]" />
                  <span>{buttonLabel}</span>
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onOpenPolicy}
                className="text-xs font-semibold text-primary underline hover:text-primary/80 transition-colors"
              >
                Xem chính sách chấm công hôm nay
              </button>
            </div>
          </StickyActionBar>
        </div>

        {/* Right Column: Shift Card + Status & Timeline */}
        <div className="md:col-span-7 flex flex-col gap-4">
          {/* Card 3: Ca hành chính & Địa điểm */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 md:p-5 shadow-xs space-y-2.5">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />

            <div className="flex items-center gap-2.5 text-sm md:text-base font-semibold text-foreground">
              <Clock className="size-4 md:size-5 text-muted-foreground" />
              <span>{today.shiftName}: {today.shiftHours}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <MapPin className="size-4 md:size-5 text-muted-foreground" />
              <span>{today.workplace} — {today.workplaceAddress}</span>
            </div>
          </div>

          {/* Card 4: Trạng thái Check-in Timeline */}
          <div className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm md:text-base font-bold text-foreground">Trạng thái chấm công</span>
              <button
                type="button"
                onClick={today.checkIn ? onOpenSuccessModal : undefined}
                disabled={!today.checkIn}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  today.checkIn
                    ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {statusBadgeLabel}
              </button>
            </div>

            <div className="border-t border-border pt-3">
              <div className="relative pl-6 space-y-4">
                <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />

                {/* Check-in step */}
                <div
                  onClick={today.checkIn ? onOpenSuccessModal : undefined}
                  className={`relative flex items-center gap-2.5 ${
                    today.checkIn ? 'cursor-pointer group hover:opacity-85 transition-opacity' : ''
                  }`}
                >
                  <div
                    className={`absolute -left-6 size-4 rounded-full border-2 border-card ${
                      today.checkIn ? 'bg-primary' : 'bg-muted-foreground/40'
                    }`}
                  />
                  <div>
                    <span className={`text-xs md:text-sm font-medium ${today.checkIn ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                      {checkInText}
                    </span>
                    {today.checkIn && (
                      <p className="text-[11px] text-primary font-semibold mt-0.5 group-hover:underline">
                        Xem chi tiết thẻ chấm công
                      </p>
                    )}
                  </div>
                </div>

                {/* Check-out step */}
                <div
                  onClick={today.checkOut ? onOpenSuccessModal : undefined}
                  className={`relative flex items-center gap-2.5 ${
                    today.checkOut ? 'cursor-pointer group hover:opacity-85 transition-opacity' : ''
                  }`}
                >
                  <div
                    className={`absolute -left-6 size-4 rounded-full border-2 border-card ${
                      today.checkOut ? 'bg-primary' : 'bg-muted-foreground/40'
                    }`}
                  />
                  <div>
                    <span className={`text-xs md:text-sm font-medium ${today.checkOut ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                      {checkOutText}
                    </span>
                    {today.checkOut && (
                      <p className="text-[11px] text-primary font-semibold mt-0.5 group-hover:underline">
                        Xem chi tiết thẻ chấm công
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
