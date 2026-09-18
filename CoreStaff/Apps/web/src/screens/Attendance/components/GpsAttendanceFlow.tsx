import * as React from 'react';
import { Clock, MapPin, Crosshair, Fingerprint, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import type { DayAttendance } from '../types';
import type { LocationCoords } from '../verification/useLocation';
import type { useGpsVerification } from '../verification/useGpsVerification';
import { StickyActionBar } from './StickyActionBar';

export interface GpsAttendanceFlowProps {
  today: DayAttendance;
  coords: LocationCoords | null;
  gpsVerification: ReturnType<typeof useGpsVerification>;
  submitting: boolean;
  onSubmit: () => void;
  onOpenSuccessModal?: () => void;
}

export function GpsAttendanceFlow({
  today,
  coords,
  gpsVerification,
  submitting,
  onSubmit,
  onOpenSuccessModal,
}: GpsAttendanceFlowProps) {
  const isCheckedIn = today.status === 'CHECKED_IN' || today.status === 'COMPLETED';
  const isCompleted = today.status === 'COMPLETED';

  const dateFormatted = React.useMemo(() => {
    const now = new Date();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    return `${dayName}, ${day} Tháng ${month}, ${year}`;
  }, []);

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

  const statusText = isCompleted
    ? 'Hoàn thành'
    : isCheckedIn
      ? 'Đã điểm danh'
      : 'Chưa điểm danh';

  const isInside = gpsVerification.canAttend;
  const accuracyMeters = coords?.accuracyMeters ? Math.round(coords.accuracyMeters) : 18;

  const isCheckOutAction = today.availableAction === 'CHECK_OUT';
  const buttonLabel = isCompleted
    ? 'Đã hoàn thành ca hôm nay'
    : isCheckOutAction
      ? 'Ghi nhận Tan ca (Check-out)'
      : 'Ghi nhận Vào ca (Check-in)';

  const isDisabled = !isInside || submitting || today.availableAction === 'NONE' || isCompleted;

  return (
    <div className="space-y-4 md:space-y-5 animate-in fade-in duration-200">
      {/* Page Title */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
          Chấm công hôm nay
        </h1>
        <p className="text-sm font-medium text-muted-foreground">
          {dateFormatted}
        </p>
      </div>

      {/* Responsive Grid: 1 column on mobile, 2 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start">
        {/* Left Column: Shift Details, Location Info, Action Button */}
        <div className="md:col-span-5 flex flex-col gap-4">
          {/* Card 1: Ca làm việc */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 md:p-5 shadow-xs">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />

            <div className="flex items-center justify-between pb-3.5">
              <div className="flex items-center gap-2">
                <Clock className="size-5 text-primary" />
                <span className="font-semibold text-primary text-sm">{today.shiftName}</span>
              </div>
              <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {today.shiftHours}
              </span>
            </div>

            {/* Time Grid (Giờ vào | Giờ ra) */}
            <div className="grid grid-cols-2 items-center py-2 text-center">
              <div className="space-y-1">
                <p className="text-xs font-normal text-muted-foreground">Giờ vào</p>
                <p className="text-2xl font-extrabold text-foreground tracking-wider font-mono">
                  {checkInTime}
                </p>
              </div>
              <div className="space-y-1 border-l border-border">
                <p className="text-xs font-normal text-muted-foreground">Giờ ra</p>
                <p className="text-2xl font-extrabold text-foreground tracking-wider font-mono">
                  {checkOutTime}
                </p>
              </div>
            </div>

            {/* Status Row */}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">Trạng thái</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-foreground">{statusText}</span>
                {isCheckedIn ? (
                  <button
                    type="button"
                    onClick={onOpenSuccessModal}
                    className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/20 active:scale-95 transition-all"
                  >
                    Chi tiết
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Card 2: Location Details & Accuracy Card */}
          <div className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-xs space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-emerald-50 p-1.5 text-emerald-600">
                <MapPin className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-foreground">
                  {today.workplace}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {today.workplaceAddress}
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Crosshair className="size-3.5" />
                  <span>Độ chính xác GPS: ±{accuracyMeters}m</span>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Action Button — inline on desktop, sticky on mobile */}
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
                  <CheckCircle className="size-5 text-emerald-600" />
                  <span>Đã hoàn thành ca hôm nay</span>
                </>
              ) : (
                <>
                  <Fingerprint className="size-5 stroke-[2.2]" />
                  <span>{buttonLabel}</span>
                </>
              )}
            </button>
          </StickyActionBar>
        </div>

        {/* Right Column: GPS Map Area */}
        <div className="md:col-span-7 flex flex-col gap-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            {/* Map View Area */}
            <div className="relative h-56 md:h-96 w-full overflow-hidden bg-slate-100 select-none">
              <svg
                className="absolute inset-0 size-full"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 400 240"
                preserveAspectRatio="xMidYMid slice"
              >
                <defs>
                  <pattern id="gps-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#cbd5e1" strokeWidth="0.8" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="#f1f5f9" />
                <rect width="100%" height="100%" fill="url(#gps-grid)" />

                {/* River / Water waterway */}
                <path
                  d="M 320 0 C 310 60, 315 140, 340 240 L 370 240 C 345 140, 340 60, 350 0 Z"
                  fill="#dbeafe"
                  stroke="#bfdbfe"
                  strokeWidth="1"
                />
                <text x="330" y="90" fill="#93c5fd" fontSize="7" transform="rotate(75 330 90)">
                  Kênh Tàu Hũ
                </text>

                {/* Streets */}
                <path d="M 0 45 Q 200 65 400 50" fill="none" stroke="#ffffff" strokeWidth="10" />
                <path d="M 0 45 Q 200 65 400 50" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />

                <path d="M 0 170 Q 200 160 400 180" fill="none" stroke="#ffffff" strokeWidth="12" />
                <path d="M 0 170 Q 200 160 400 180" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
                <text x="120" y="176" fill="#94a3b8" fontSize="7">
                  Tạ Quang Bửu
                </text>

                <path d="M 80 0 L 110 240" fill="none" stroke="#ffffff" strokeWidth="8" />
                <path d="M 80 0 L 110 240" fill="none" stroke="#cbd5e1" strokeWidth="1" />
                <text x="75" y="100" fill="#94a3b8" fontSize="6" transform="rotate(80 75 100)">
                  Phạm Thế Hiển
                </text>

                <path d="M 230 0 L 200 240" fill="none" stroke="#ffffff" strokeWidth="9" />
                <path d="M 230 0 L 200 240" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />

                {/* Building blocks */}
                <rect x="130" y="80" width="55" height="50" rx="4" fill="#e2e8f0" opacity="0.6" />
                <rect x="220" y="75" width="60" height="55" rx="4" fill="#e2e8f0" opacity="0.6" />
                <rect x="145" y="15" width="70" height="20" rx="3" fill="#e2e8f0" opacity="0.5" />

                {/* Geofence Radar Circle */}
                <circle cx="200" cy="115" r="60" fill="#86efac" fillOpacity="0.32" />
                <circle cx="200" cy="115" r="60" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="3 3" />
                <circle cx="200" cy="115" r="26" fill="#4ade80" fillOpacity="0.25" />

                {/* Animated Beacon Pin */}
                <circle cx="200" cy="115" r="6" fill="#16a34a" />
                <circle cx="200" cy="115" r="2.5" fill="#ffffff" />
              </svg>

              {/* Badge: Đang ở trong / ngoài vùng chấm công */}
              <div className="absolute top-3 left-3 z-10">
                {isInside ? (
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md">
                    <CheckCircle className="size-3.5" />
                    <span>Đang ở trong vùng chấm công</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md">
                    <AlertCircle className="size-3.5" />
                    <span>Ngoài vùng chấm công</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
