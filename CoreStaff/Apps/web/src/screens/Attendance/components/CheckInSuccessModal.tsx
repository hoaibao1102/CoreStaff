import * as React from 'react';
import { X, Clock, MapPin, Crosshair, Check, MoreHorizontal, CheckCircle2, Camera, Calendar, Info } from 'lucide-react';
import type { AttendanceEvent, AttendanceMethod } from '../types';

export interface CheckInSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkInEvent?: AttendanceEvent | null;
  checkOutEvent?: AttendanceEvent | null;
  method?: AttendanceMethod;
  accuracyMeters?: number;
  workplaceName?: string;
  workplaceAddress?: string;
  photoUrl?: string | null;
  mode?: 'CHECK_IN' | 'CHECK_OUT';
}

export function CheckInSuccessModal({
  isOpen,
  onClose,
  checkInEvent,
  checkOutEvent,
  method = 'GPS',
  accuracyMeters = 5,
  workplaceName,
  workplaceAddress,
  photoUrl,
  mode = 'CHECK_IN',
}: CheckInSuccessModalProps) {
  if (!isOpen) return null;

  const isCheckOutMode = mode === 'CHECK_OUT' || (checkOutEvent != null && checkInEvent != null);
  const activeEvent = isCheckOutMode ? checkOutEvent : checkInEvent;

  const timeFormatted = React.useMemo(() => {
    const timestamp = activeEvent?.recordedAt || checkInEvent?.recordedAt;
    if (timestamp) {
      const d = new Date(timestamp);
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  }, [activeEvent?.recordedAt, checkInEvent?.recordedAt]);

  const dateFormatted = React.useMemo(() => {
    const timestamp = activeEvent?.recordedAt || checkInEvent?.recordedAt;
    const d = timestamp ? new Date(timestamp) : new Date();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayOfWeek = days[d.getDay()];
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${dayOfWeek}, ${day}/${month}/${year}`;
  }, [activeEvent?.recordedAt, checkInEvent?.recordedAt]);

  const checkInTimeFormatted = React.useMemo(() => {
    if (checkInEvent?.recordedAt) {
      const d = new Date(checkInEvent.recordedAt);
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }
    return '--:--';
  }, [checkInEvent?.recordedAt]);

  const displayPlaceName =
    workplaceName ||
    (method === 'GPS'
      ? 'Văn phòng CoreStaff Quận 8'
      : method === 'SELFIE'
        ? 'Ca Hiện Trường / Khách Hàng'
        : 'Văn phòng CoreStaff Quận 8');

  const displayAddress =
    workplaceAddress ||
    (method === 'GPS'
      ? '123 Đường mẫu, Phường 4, Quận 8, TP.HCM'
      : method === 'SELFIE'
        ? 'Địa điểm công tác (vị trí GPS thực tế)'
        : '123 Đường mẫu, Phường 4, Quận 8, TP.HCM');

  const isPending = method === 'SELFIE' || activeEvent?.status === 'PENDING_APPROVAL';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center bg-black/60 backdrop-blur-xs p-0 md:p-4 animate-in fade-in duration-200"
    >
      {/* Modal Card: Bottom sheet on mobile, centered dialog on desktop */}
      <div className="bg-card rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col w-full md:max-w-xl max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-200 border border-border">
        {/* Drag handle on mobile only */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="size-1.5 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-3 pb-3">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <div className="size-6 rounded-full border-[2.5px] border-emerald-800 flex items-center justify-center">
                <Check className="size-4 text-emerald-800 stroke-[3]" />
              </div>
            </div>
            <div>
              <h2 id="success-modal-title" className="text-lg font-extrabold text-foreground tracking-tight leading-tight">
                {isCheckOutMode ? 'Tan ca thành công' : 'Check-in thành công'}
              </h2>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">
                {isCheckOutMode
                  ? 'Bạn đã ghi nhận thành công giờ tan ca làm việc.'
                  : 'Bạn đã ghi nhận thành công giờ vào làm việc.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-3">
          {/* Card 1: Attendance Details */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
            {/* Header Row with Time & Approval Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                  <Clock className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    GIỜ GHI NHẬN
                  </p>
                  <p className="text-xl font-extrabold text-foreground font-mono">
                    {timeFormatted}
                  </p>
                </div>
              </div>

              {/* Approval Status Badge */}
              {isPending ? (
                <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  <MoreHorizontal className="size-3.5" />
                  <span>Đang chờ duyệt</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="size-3.5" />
                  <span>Đã duyệt</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Timeline & Location Section */}
            <div className="space-y-1">
              {/* Step 1: Check-in Location */}
              <div className="flex items-start gap-3">
                <div className="mt-1 flex flex-col items-center">
                  <div className="size-3 rounded-full bg-emerald-600 ring-4 ring-emerald-100" />
                  <div className="w-0.5 bg-border h-7 mt-1" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-foreground">
                    {displayPlaceName}
                  </h4>
                  <div className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                    <span className="leading-snug">{displayAddress}</span>
                  </div>
                </div>
              </div>

              {/* Step 2: Check-out */}
              <div className="flex items-start gap-3">
                <div className="mt-1 flex items-center justify-center">
                  {isCheckOutMode ? (
                    <div className="size-3 rounded-full bg-emerald-600 ring-4 ring-emerald-100" />
                  ) : (
                    <div className="size-3 rounded-full border-2 border-border bg-card" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    {isCheckOutMode ? 'Đã Check-out' : 'Chưa Check-out'}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {isCheckOutMode
                      ? `Giờ vào: ${checkInTimeFormatted} • Giờ ra: ${timeFormatted}`
                      : 'Chưa có dữ liệu'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Mini Map or Selfie Evidence Card */}
          {photoUrl ? (
            <div className="space-y-2">
              <div className="relative aspect-[3/4] max-w-[360px] mx-auto w-full overflow-hidden rounded-2xl border border-border bg-muted shadow-md">
                <img
                  src={photoUrl}
                  alt="Selfie bằng chứng"
                  className="absolute inset-0 size-full object-cover"
                />

                {/* Gradient Overlay for Legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30 pointer-events-none" />

                {/* Top Badges */}
                <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                  <div className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white border border-white/10">
                    <Camera className="size-3.5 text-amber-400" />
                    <span>Ảnh selfie bằng chứng</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white border border-white/10">
                    <Crosshair className="size-3 text-emerald-400" />
                    <span>Độ chính xác: ±{accuracyMeters}m</span>
                  </div>
                </div>

                {/* Bottom Metadata Overlay (Matching SelfiePreview) */}
                <div className="absolute bottom-0 left-0 w-full p-4 flex flex-col gap-2 text-white pointer-events-none drop-shadow-md">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-[18px] shrink-0 text-white" />
                    <span className="text-sm font-semibold">
                      Ngày: {dateFormatted}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="size-[18px] shrink-0 text-white" />
                    <span className="text-sm font-semibold">
                      Thời gian: {timeFormatted}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="size-[18px] shrink-0 mt-0.5 text-white" />
                    <span className="text-xs leading-snug line-clamp-2">
                      Địa chỉ: {displayAddress}
                    </span>
                  </div>
                </div>
              </div>

              {/* Informational note below photo */}
              <div className="flex items-start gap-2.5 bg-primary/5 p-3 rounded-xl border border-primary/20 text-xs text-muted-foreground">
                <Info className="size-4 text-primary shrink-0 mt-0.5" />
                <span>Ảnh khuôn mặt và vị trí GPS đã được lưu làm bằng chứng xác thực thành công.</span>
              </div>
            </div>
          ) : (
            <div className="relative h-32 sm:h-36 w-full overflow-hidden rounded-2xl border border-border bg-slate-100 shadow-xs">
              <svg
                className="absolute inset-0 size-full"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 400 150"
                preserveAspectRatio="xMidYMid slice"
              >
                <defs>
                  <pattern id="modal-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                    <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#cbd5e1" strokeWidth="0.8" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="#f8fafc" />
                <rect width="100%" height="100%" fill="url(#modal-grid)" />

                <path d="M 310 0 C 300 40, 310 90, 330 150 L 360 150 C 340 90, 330 40, 340 0 Z" fill="#dbeafe" />

                <path d="M 0 35 Q 200 45 400 35" fill="none" stroke="#ffffff" strokeWidth="8" />
                <path d="M 0 35 Q 200 45 400 35" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />

                <path d="M 0 105 Q 200 95 400 110" fill="none" stroke="#ffffff" strokeWidth="9" />
                <path d="M 0 105 Q 200 95 400 110" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />

                <rect x="145" y="45" width="70" height="20" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.8" />
                <text x="180" y="58" fill="#1e293b" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                  CoreStaff Office
                </text>

                <circle cx="180" cy="78" r="9" fill="#22c55e" />
                <path d="M 177 78 L 179 80 L 183 76" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
              </svg>

              <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-card/95 px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-xs border border-border">
                <Crosshair className="size-3 text-muted-foreground" />
                <span>Độ chính xác: ±{accuracyMeters}m</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions - sticky footer */}
        <div className="px-5 pt-3 pb-5 border-t border-border bg-card">
          <button
            type="button"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 px-4 text-primary-foreground font-bold text-sm shadow-md hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            Quay lại Chấm công
          </button>
        </div>
      </div>
    </div>
  );
}
