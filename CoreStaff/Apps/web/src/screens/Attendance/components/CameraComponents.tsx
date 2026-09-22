import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Camera,
  Clock,
  Info,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sun,
  Video,
  X,
} from 'lucide-react';

interface MockLocation {
  address: string;
  accuracyMeters: number;
  latitude?: number;
  longitude?: number;
}

function formatVietnameseDate(d: Date = new Date()) {
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayOfWeek = days[d.getDay()];
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const dateFormatted = `${day}/${month}/${year}`;
  const dateStr = `${d.getDate()} Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const timeAmPm = `${String(h).padStart(2, '0')}:${minutes} ${ampm}`;
  const timeStr = `${hours}:${minutes}`;
  const fullTimeStr = `${hours}:${minutes}:${seconds}`;
  return { dayOfWeek, dateStr, dateFormatted, timeStr, timeAmPm, fullTimeStr };
}

const FALLBACK_PORTRAIT = {
  CHECK_IN: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
  CHECK_OUT: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
};

// ---------------------------------------------------------------------------
// CameraCapture — fullscreen camera UI with live canvas watermark
// ---------------------------------------------------------------------------

export interface CameraCaptureProps {
  mode: 'CHECK_IN' | 'CHECK_OUT';
  mockLocation: MockLocation;
  onClose: () => void;
  onCapture: (capturedDataUrl?: string) => void;
}

export function CameraCapture({
  mode,
  mockLocation,
  onClose,
  onCapture,
}: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(formatVietnameseDate());
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(formatVietnameseDate());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    async function startCamera() {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1080 },
              height: { ideal: 1440 },
            },
            audio: false,
          });
          if (active) {
            setStream(mediaStream);
            setIsCameraActive(true);
            setCameraError(null);
          } else {
            mediaStream.getTracks().forEach((t) => t.stop());
          }
        } else {
          setCameraError('Trình duyệt không hỗ trợ truy cập máy ảnh');
        }
      } catch (err: unknown) {
        console.warn('Real webcam not accessed:', err);
        setCameraError(
          err instanceof Error ? err.message : 'Không thể truy cập máy ảnh'
        );
        setIsCameraActive(false);
      }
    }

    startCamera();

    return () => {
      active = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bindVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && stream) {
        el.srcObject = stream;
        el.play().catch((err) => console.warn('Video auto-play failed:', err));
      }
    },
    [stream]
  );

  const handleCapture = () => {
    setIsFlashActive(true);
    window.setTimeout(() => setIsFlashActive(false), 200);

    if (videoRef.current && isCameraActive) {
      try {
        const video = videoRef.current;
        const videoW = video.videoWidth || 720;
        const videoH = video.videoHeight || 960;

        const targetRatio = 3 / 4;
        let sWidth = videoW;
        let sHeight = videoH;
        let sx = 0;
        let sy = 0;

        if (videoW / videoH > targetRatio) {
          sWidth = Math.round(videoH * targetRatio);
          sx = Math.round((videoW - sWidth) / 2);
        } else {
          sHeight = Math.round(videoW / targetRatio);
          sy = Math.round((videoH - sHeight) / 2);
        }

        const outWidth = 720;
        const outHeight = 960;
        const canvas = document.createElement('canvas');
        canvas.width = outWidth;
        canvas.height = outHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.translate(outWidth, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, outWidth, outHeight);
          ctx.restore();

          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          onCapture(dataUrl);
          return;
        }
      } catch (err) {
        console.error('Error capturing camera snapshot:', err);
      }
    }

    onCapture();
  };

  return (
    <div
      id="camera-fullscreen-frame"
      className="fixed inset-0 z-50 flex max-w-md mx-auto flex-col justify-between overflow-hidden bg-black select-none"
    >
      {/* Shutter flash effect */}
      {isFlashActive ? (
        <div className="pointer-events-none absolute inset-0 z-50 bg-white opacity-80 transition-opacity duration-200" />
      ) : null}

      {/* Top Header Controls */}
      <div className="z-20 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 text-white">
        <button
          id="btn-close-camera"
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 bg-stone-900/80 p-2.5 text-white transition-colors hover:bg-stone-800"
          aria-label="Đóng camera"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="text-center">
          <h3 className="flex items-center justify-center gap-1.5 text-sm font-bold tracking-wide">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {mode === 'CHECK_IN' ? 'Chụp ảnh Check-in' : 'Chụp ảnh Check-out'}
          </h3>
          <p className="text-[11px] text-stone-300">Camera trực tiếp • CoreStaff Verified</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-amber-400" />
        </div>
      </div>

      {/* Main Viewfinder */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-stone-950">
        <video
          ref={bindVideoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            isCameraActive ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transform: 'scaleX(-1)' }}
        />

        {!isCameraActive ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900 p-6 text-center">
            <img
              src={FALLBACK_PORTRAIT[mode]}
              alt="Simulated Camera Stream"
              className="absolute inset-0 h-full w-full object-cover opacity-60 brightness-90"
            />
            <div className="relative z-10 max-w-xs space-y-2 rounded-2xl border border-white/20 bg-black/75 p-4 text-white backdrop-blur-md">
              <Video className="mx-auto h-8 w-8 animate-bounce text-amber-400" />
              <p className="text-xs font-semibold">Đang chuẩn bị Camera...</p>
              {cameraError ? (
                <p className="text-[11px] leading-relaxed text-stone-300">
                  (Nếu chưa thấy hình, hãy cho phép quyền Camera trên trình duyệt)
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Face Oval Overlay Guide */}
        <div className="pointer-events-none relative z-10 flex h-80 w-64 flex-col items-center justify-center rounded-[50%/40%] border-2 border-dashed border-white/80 p-4 shadow-2xl">
          <div className="rounded-full border border-white/20 bg-black/60 px-3.5 py-1.5 text-center text-[11px] font-medium text-white shadow-lg backdrop-blur-md">
            Căn khuôn mặt vào giữa khung hình
          </div>
        </div>

        {/* Lighting guidance badge */}
        <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] text-stone-200 backdrop-blur-md">
          <Sun className="h-3.5 w-3.5 text-amber-400" />
          <span>Đảm bảo đủ ánh sáng & nhìn thẳng</span>
        </div>

        {/* Live watermark */}
        <div className="pointer-events-none absolute inset-x-4 bottom-3 z-10 flex items-end justify-between text-white drop-shadow-md">
          <div className="space-y-1">
            <div className="flex items-center">
              <span className="font-mono text-3xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-4xl">
                {currentTime.timeStr}
              </span>
              <span className="mx-2.5 h-7 w-[2.5px] rounded-full bg-amber-400 drop-shadow" />
              <div className="flex flex-col justify-center leading-none">
                <span className="font-mono text-[11px] font-bold text-white drop-shadow">
                  {currentTime.dateFormatted}
                </span>
                <span className="mt-0.5 text-[10px] font-semibold text-stone-200 drop-shadow">
                  {currentTime.dayOfWeek}
                </span>
              </div>
            </div>
            <p className="max-w-[280px] text-xs font-medium leading-snug text-white drop-shadow line-clamp-2">
              {mockLocation.address ||
                (typeof mockLocation.latitude === 'number' && typeof mockLocation.longitude === 'number'
                  ? `📍 ${mockLocation.latitude.toFixed(5)}, ${mockLocation.longitude.toFixed(5)}`
                  : 'Đang định vị GPS...')}
            </p>
          </div>
          <div className="text-right">
            <span className="block text-xs font-black text-amber-400">CoreStaff</span>
            <span className="text-[9px] text-stone-300">
              {mockLocation.accuracyMeters
                ? `GPS ±${Math.round(mockLocation.accuracyMeters)}m`
                : 'Đang lấy GPS'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Shutter & Location Status Area */}
      <div className="z-20 flex flex-col items-center gap-4 bg-gradient-to-t from-black via-black/95 to-transparent p-5 text-white">
        <div className="flex items-center gap-1.5 rounded-full border border-stone-800 bg-stone-900/90 px-3.5 py-1.5 text-[11px] text-stone-300 shadow-md backdrop-blur-md">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span className="max-w-[280px] truncate">
            {mockLocation.address ||
              (typeof mockLocation.latitude === 'number' && typeof mockLocation.longitude === 'number'
                ? `📍 ${mockLocation.latitude.toFixed(5)}, ${mockLocation.longitude.toFixed(5)}`
                : 'Đang định vị GPS...')}
          </span>
        </div>

        <div className="flex w-full items-center justify-center py-1">
          <button
            id="btn-capture-shutter"
            type="button"
            onClick={handleCapture}
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 shadow-2xl transition-transform hover:bg-white/30 active:scale-95"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-inner transition-transform hover:scale-105">
              <Camera className="h-7 w-7 text-stone-900" />
            </div>
          </button>
        </div>

        <p className="text-center text-[10px] text-stone-400">
          * Ảnh chụp trực tiếp kèm thời gian thực & vị trí GPS xác thực.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SelfiePreview — captured photo review screen with watermark details
// ---------------------------------------------------------------------------

export interface SelfiePreviewProps {
  mode: 'CHECK_IN' | 'CHECK_OUT';
  photoUrl: string;
  serverTime?: string;
  address?: string;
  accuracy?: number;
  employeeCode: string;
  employeeName: string;
  isSubmitting?: boolean;
  onRetake: () => void;
  onConfirmUse: () => void;
}

export function SelfiePreview({
  mode,
  photoUrl,
  serverTime,
  address,
  accuracy,
  isSubmitting = false,
  onRetake,
  onConfirmUse,
}: SelfiePreviewProps) {
  const parsedDate = formatVietnameseDate();
  const timeFormatted = serverTime ? serverTime.slice(0, 5) : parsedDate.timeAmPm;

  return (
    <div
      id="selfie-preview-frame"
      className="fixed inset-0 z-50 bg-background flex flex-col max-w-[430px] mx-auto overflow-y-auto animate-in fade-in duration-200 border-x border-border"
    >
      {/* Top Navigation AppBar */}
      <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRetake}
            className="size-11 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
            aria-label="Quay lại"
          >
            <ArrowLeft className="size-6" />
          </button>
        </div>
        <h1 className="text-lg font-bold text-foreground tracking-tight text-center">
          {mode === 'CHECK_IN' ? 'Xác nhận Check-in' : 'Xác nhận Check-out'}
        </h1>
        <div className="w-10" />
      </header>

      {/* Main Canvas */}
      <main className="flex-1 flex flex-col justify-center items-center py-4 px-4 max-w-md mx-auto w-full">
        <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-lg border border-border bg-muted">
          <img
            src={photoUrl}
            alt="Selfie preview"
            className="absolute inset-0 size-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

          {/* Metadata Overlay */}
          <div className="absolute bottom-0 left-0 w-full p-4 flex flex-col gap-2 text-white pointer-events-none drop-shadow-md">
            <div className="flex items-center gap-2">
              <Calendar className="size-[18px] shrink-0" />
              <span className="text-sm font-semibold">
                Ngày: {parsedDate.dayOfWeek}, {parsedDate.dateFormatted}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-[18px] shrink-0" />
              <span className="text-sm font-semibold">
                Thời gian: {timeFormatted}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="size-[18px] shrink-0 mt-0.5" />
              <span className="text-xs leading-snug line-clamp-2">
                Địa chỉ: {address || (typeof accuracy === 'number' ? `Văn phòng CoreStaff Quận 8 (±${Math.round(accuracy)}m)` : '123 Đường mẫu, Phường 4, Quận 8, TP.HCM')}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3 bg-primary/5 p-4 rounded-xl w-full border border-primary/20">
          <Info className="size-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-foreground leading-relaxed">
            Ảnh khuôn mặt và vị trí GPS sẽ được gửi làm bằng chứng duyệt công của bạn.
          </p>
        </div>
      </main>

      {/* Action Bottom Bar */}
      <div className="sticky bottom-0 left-0 w-full bg-card border-t border-border p-4 flex gap-3 shadow-lg z-40">
        <button
          id="btn-retake-photo"
          type="button"
          disabled={isSubmitting}
          onClick={onRetake}
          className="flex-1 h-11 flex items-center justify-center text-sm font-semibold border border-border rounded-xl text-foreground bg-background hover:bg-muted transition-colors disabled:opacity-50 active:scale-[0.98]"
        >
          Chụp lại
        </button>
        <button
          id="btn-confirm-use-photo"
          type="button"
          disabled={isSubmitting}
          onClick={onConfirmUse}
          className="flex-[2] h-11 flex items-center justify-center text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50 active:scale-[0.98]"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="size-4 animate-spin mr-1.5" />
              Đang gửi dữ liệu...
            </>
          ) : (
            'Sử dụng ảnh này'
          )}
        </button>
      </div>
    </div>
  );
}
