import * as React from 'react';
import { Camera, Info, MapPin, RefreshCw, Smile, Clock, CheckCircle2, LogOut } from 'lucide-react';
import type { DayAttendance } from '../types';
import { StickyActionBar } from './StickyActionBar';

export interface SelfieAttendanceFlowProps {
  today: DayAttendance;
  submitting: boolean;
  onStartCapture: () => void;
  previewPhotoUrl?: string | null;
  onOpenSuccessModal?: () => void;
}

export function SelfieAttendanceFlow({
  today,
  submitting,
  onStartCapture,
  previewPhotoUrl,
  onOpenSuccessModal,
}: SelfieAttendanceFlowProps) {
  const [timeAmPm, setTimeAmPm] = React.useState('08:25 AM');

  React.useEffect(() => {
    const update = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const strHours = String(hours).padStart(2, '0');
      setTimeAmPm(`${strHours}:${minutes} ${ampm}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const dateFormatted = React.useMemo(() => {
    const now = new Date();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[now.getDay()];
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${dayName}, ${day}/${month}/${year}`;
  }, []);

  const isCheckedIn = today.status === 'CHECKED_IN' || today.status === 'COMPLETED';
  const isCompleted = today.status === 'COMPLETED';
  const isCheckOut = today.availableAction === 'CHECK_OUT';

  const checkInTime = today.checkIn?.recordedAt
    ? new Date(today.checkIn.recordedAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '--:--';

  const checkOutTime = today.checkOut?.recordedAt
    ? new Date(today.checkOut.recordedAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '--:--';

  const isDisabled = submitting || today.availableAction === 'NONE' || isCompleted;

  return (
    <div className="w-full animate-in fade-in duration-200">
      {/* Header / Time */}
      <div className="flex flex-col items-center justify-center py-2 md:py-3 w-full text-center">
        <span className="text-2xl sm:text-[28px] md:text-3xl font-bold text-foreground tracking-tight">
          {timeAmPm}
        </span>
        <span className="text-sm sm:text-base text-muted-foreground mt-1 font-medium">
          {dateFormatted}
        </span>
      </div>

      {/* Responsive Grid: 1 column on mobile, 2 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start mt-2">
        {/* Left Column: Shift Info, Banners, Action Button */}
        <div className="md:col-span-5 flex flex-col gap-4">
          {/* Card: Ca làm việc & Trạng thái */}
          {isCheckedIn && (
            <div className="w-full relative overflow-hidden rounded-2xl border border-border bg-card p-4 md:p-5 shadow-xs space-y-3">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />

              {/* Card Header */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <Clock className="size-5 text-primary" />
                  <span className="font-semibold text-primary text-sm">{today.shiftName}</span>
                </div>
                <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {today.shiftHours}
                </span>
              </div>

              {/* Shift Details */}
              <div className="grid grid-cols-2 divide-x divide-border border-y border-border py-3 text-center">
                <div
                  onClick={today.checkIn ? onOpenSuccessModal : undefined}
                  className="cursor-pointer group hover:bg-muted/50 rounded-lg p-1 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xs text-muted-foreground font-medium">Giờ vào</span>
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                      Chờ duyệt
                    </span>
                  </div>
                  <p className="text-base font-bold text-foreground font-mono mt-0.5">
                    {checkInTime}
                  </p>
                  <p className="text-[10px] text-primary font-semibold mt-0.5 group-hover:underline flex items-center justify-center gap-0.5">
                    <Camera className="size-3" />
                    <span>Xem bằng chứng</span>
                  </p>
                </div>

                <div
                  onClick={today.checkOut ? onOpenSuccessModal : undefined}
                  className={`p-1 ${isCompleted ? 'cursor-pointer group hover:bg-muted/50 rounded-lg transition-colors' : ''}`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xs text-muted-foreground font-medium">Giờ ra</span>
                    {isCompleted ? (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                        Chờ duyệt
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-muted text-muted-foreground">
                        Chưa có
                      </span>
                    )}
                  </div>
                  <p className="text-base font-bold text-foreground font-mono mt-0.5">
                    {checkOutTime}
                  </p>
                  {isCompleted ? (
                    <p className="text-[10px] text-primary font-semibold mt-0.5 group-hover:underline flex items-center justify-center gap-0.5">
                      <Camera className="size-3" />
                      <span>Xem bằng chứng</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                      Sẵn sàng tan ca
                    </p>
                  )}
                </div>
              </div>

              {/* Status indicator row */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-muted-foreground">Trạng thái:</span>
                <span
                  onClick={today.checkIn ? onOpenSuccessModal : undefined}
                  className={`font-semibold flex items-center gap-1.5 cursor-pointer hover:underline ${
                    isCompleted ? 'text-emerald-600' : 'text-primary'
                  }`}
                >
                  <span className={`size-2 rounded-full ${isCompleted ? 'bg-emerald-600' : 'bg-primary animate-pulse'}`} />
                  {isCompleted ? 'Đã hoàn thành ngày công' : 'Đang làm việc (Chờ tan ca)'}
                </span>
              </div>
            </div>
          )}

          {/* Completed State Banner */}
          {isCompleted ? (
            <div className="w-full bg-emerald-50 rounded-xl p-4 border border-emerald-200 shadow-xs flex items-start gap-3 text-left">
              <CheckCircle2 className="size-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-emerald-900">Đã hoàn thành ca hôm nay</h4>
                <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                  Bạn đã ghi nhận đủ cả lượt Check-in và Check-out. Dữ liệu hình ảnh và GPS đã được đồng bộ lên hệ thống CoreStaff để quản lý phê duyệt.
                </p>
              </div>
            </div>
          ) : isCheckOut ? (
            <div className="w-full bg-amber-50/80 rounded-xl p-4 border border-amber-200 shadow-xs flex items-start gap-3 text-left">
              <Info className="size-5 text-amber-700 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">Sẵn sàng Check-out (Tan ca)</h4>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Bạn đã check-in lúc <strong>{checkInTime}</strong>. Khi kết thúc ca làm việc, vui lòng nhấn nút <strong>"Chụp ảnh Tan ca (Check-out)"</strong> bên dưới để chụp ảnh xác nhận.
                </p>
              </div>
            </div>
          ) : null}

          {/* Instructions when not checked in */}
          {!isCheckedIn && (
            <div className="w-full flex flex-col gap-3">
              <div className="bg-card rounded-xl p-4 md:p-5 border border-border shadow-xs flex items-start gap-3 text-left">
                <Info className="size-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm sm:text-base text-foreground leading-relaxed">
                  Yêu cầu chụp ảnh Selfie để chấm công. Đảm bảo ánh sáng tốt và nhìn thẳng rõ khuôn mặt.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-muted-foreground py-1">
                <MapPin className="size-4 sm:size-5 text-muted-foreground shrink-0" />
                <span className="text-xs sm:text-sm">
                  Tọa độ GPS sẽ được lấy tự động cùng với ảnh.
                </span>
              </div>
            </div>
          )}

          {/* Primary CTA — inline on desktop, sticky on mobile */}
          <StickyActionBar>
            <button
              id={`btn-primary-${today.availableAction.toLowerCase()}`}
              type="button"
              disabled={isDisabled}
              onClick={onStartCapture}
              className={`w-full h-[48px] font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:opacity-90 active:scale-[0.98] ${
                isCompleted
                  ? 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {submitting ? (
                <>
                  <RefreshCw className="size-5 animate-spin" />
                  <span>Đang gửi ảnh...</span>
                </>
              ) : isCompleted ? (
                <>
                  <CheckCircle2 className="size-5 text-emerald-600" />
                  <span>Đã hoàn thành ca hôm nay</span>
                </>
              ) : isCheckOut ? (
                <>
                  <LogOut className="size-5" />
                  <span>Chụp ảnh Tan ca (Check-out)</span>
                </>
              ) : (
                <>
                  <Camera className="size-5" />
                  <span>Chụp ảnh Check-in</span>
                </>
              )}
            </button>
          </StickyActionBar>
        </div>

        {/* Right Column: Selfie Viewfinder / Captured Photo Frame */}
        <div className="md:col-span-7 flex flex-col items-center justify-center">
          {!isCompleted ? (
            <div className="w-full aspect-[3/4] max-w-[340px] md:max-w-[380px] relative bg-muted rounded-2xl border border-border overflow-hidden shadow-md">
              <img
                src={
                  previewPhotoUrl ||
                  (isCheckOut && today.checkIn && 'evidence' in today.checkIn && today.checkIn.evidence?.previewUrl
                    ? today.checkIn.evidence.previewUrl
                    : null) ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=720&auto=format&fit=crop&q=80'
                }
                alt="Camera viewfinder preview"
                className="w-full h-full object-cover"
              />

              {isCheckOut && (
                <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-xs flex items-center gap-1.5">
                  <Camera className="size-3.5 text-amber-400" />
                  <span>Chuẩn bị chụp ảnh tan ca</span>
                </div>
              )}

              {/* Guidance Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-2/3 border-2 border-dashed border-primary opacity-60 rounded-[100px] flex items-center justify-center">
                  <Smile className="size-16 text-primary opacity-50 stroke-[1.5]" />
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full aspect-[3/4] max-w-[340px] md:max-w-[380px] relative bg-card rounded-2xl border border-border overflow-hidden shadow-xs flex flex-col items-center justify-center p-6 text-center">
              <CheckCircle2 className="size-16 text-emerald-600 mb-3" />
              <h4 className="text-base font-bold text-foreground">Hoàn thành cả 2 lượt chấm công</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Dữ liệu công hôm nay đã được ghi nhận đầy đủ trên hệ thống CoreStaff.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
