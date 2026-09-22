import * as React from 'react';
import {
  Clock,
  MapPin,
  Crosshair,
  Fingerprint,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Navigation,
} from 'lucide-react';
import type { DayAttendance, WorkplaceInfo } from '../types';
import type { LocationCoords } from '../verification/useLocation';
import type { useGpsVerification } from '../verification/useGpsVerification';
import { StickyActionBar } from './StickyActionBar';

export interface GpsAttendanceFlowProps {
  today: DayAttendance;
  coords: LocationCoords | null;
  gpsVerification: ReturnType<typeof useGpsVerification>;
  workplaceGps?: WorkplaceInfo | null;
  submitting: boolean;
  onSubmit: () => void;
  onOpenSuccessModal?: () => void;
}

export function GpsAttendanceFlow({
  today,
  coords,
  gpsVerification,
  workplaceGps,
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

  const workplaceLat = workplaceGps?.latitude;
  const workplaceLon = workplaceGps?.longitude;
  const allowedRadius = workplaceGps?.allowedRadiusMeters || 200;
  const distance = gpsVerification.distanceMeters;
  const distanceText =
    distance != null
      ? distance < 1000
        ? `${Math.round(distance)} m`
        : `${(distance / 1000).toFixed(2)} km`
      : 'Đang đo...';

  const hasCoordinates =
    typeof workplaceLat === 'number' &&
    typeof workplaceLon === 'number' &&
    (workplaceLat !== 0 || workplaceLon !== 0);

  const mapQuery = hasCoordinates
    ? `${workplaceLat},${workplaceLon}`
    : encodeURIComponent(today.workplaceAddress || today.workplace);
  const embedUrl = `https://maps.google.com/maps?q=${mapQuery}&hl=vi&z=17&output=embed`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`;

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
              <div className="mt-0.5 rounded-full bg-emerald-50 p-1.5 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
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

        {/* Right Column: Real GPS Map Area */}
        <div className="md:col-span-7 flex flex-col gap-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            {/* Map View Area */}
            <div className="relative h-64 md:h-[420px] w-full overflow-hidden bg-muted/40">
              {hasCoordinates || today.workplaceAddress ? (
                <iframe
                  title={`Bản đồ vị trí ${today.workplace}`}
                  className="size-full border-0 select-none"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={embedUrl}
                />
              ) : (
                <div className="size-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                  <MapPin className="size-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-semibold">Chưa có thông tin tọa độ nơi làm việc</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vui lòng liên hệ HR để thiết lập tọa độ cho nơi làm việc này
                  </p>
                </div>
              )}

              {/* Top Floating Badge: Trạng thái trong/ngoài vùng chấm công */}
              <div className="absolute top-3 left-3 z-10 pointer-events-none">
                {isInside ? (
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-600/95 backdrop-blur-md px-3.5 py-1.5 text-xs font-bold text-white shadow-lg border border-emerald-500/40">
                    <CheckCircle className="size-3.5" />
                    <span>Đang ở trong vùng chấm công (Cách {distanceText})</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-full bg-amber-500/95 backdrop-blur-md px-3.5 py-1.5 text-xs font-bold text-white shadow-lg border border-amber-400/40">
                    <AlertCircle className="size-3.5" />
                    <span>Ngoài vùng chấm công (Cách {distanceText} • Bán kính {allowedRadius}m)</span>
                  </div>
                )}
              </div>

              {/* Bottom Floating Bar: Thông tin nơi làm việc thực tế & Nút mở Google Maps chỉ đường */}
              <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-card/95 backdrop-blur-md border border-border p-3 shadow-lg text-xs">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    <MapPin className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{today.workplace}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {hasCoordinates ? (
                        <span className="font-mono text-foreground/80">
                          {workplaceLat?.toFixed(6)}, {workplaceLon?.toFixed(6)} • Bán kính: {allowedRadius}m
                        </span>
                      ) : (
                        today.workplaceAddress
                      )}
                    </p>
                  </div>
                </div>

                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline hover:text-primary/90 text-xs px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
                >
                  <Navigation className="size-3.5" />
                  <span>Chỉ đường</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
