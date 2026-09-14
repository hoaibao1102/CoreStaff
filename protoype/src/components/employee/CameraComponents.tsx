import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { SelfieEvidenceResponse } from '../../types';
import {
  X,
  Camera,
  RefreshCw,
  MapPin,
  CheckCircle2,
  Sun,
  RotateCcw,
  Video,
  ShieldCheck,
} from 'lucide-react';

interface CameraCaptureProps {
  mode: 'CHECK_IN' | 'CHECK_OUT';
  mockLocation: SelfieEvidenceResponse['location'];
  onClose: () => void;
  onCapture: (capturedDataUrl?: string) => void;
}

function formatVietnameseDate(d: Date = new Date()) {
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayOfWeek = days[d.getDay()];
  const dateStr = `${d.getDate()} Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  const fullTimeStr = `${hours}:${minutes}:${seconds}`;
  return { dayOfWeek, dateStr, timeStr, fullTimeStr };
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  mode,
  mockLocation,
  onClose,
  onCapture,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(formatVietnameseDate());
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Live clock tick
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatVietnameseDate());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize camera stream
  useEffect(() => {
    let active = true;
    async function startCamera() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
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
      } catch (err: any) {
        console.warn('Real webcam not accessed:', err);
        setCameraError(err.message || 'Không thể truy cập máy ảnh');
        setIsCameraActive(false);
      }
    }

    startCamera();

    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Ensure video element plays as soon as stream or ref is set
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
    setTimeout(() => setIsFlashActive(false), 200);

    // If real camera is active, snapshot current frame from video to canvas
    if (videoRef.current && isCameraActive) {
      try {
        const video = videoRef.current;
        const width = video.videoWidth || 720;
        const height = video.videoHeight || 960;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Mirror horizontal flip for front-facing camera
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          onCapture(dataUrl);
          return;
        }
      } catch (err) {
        console.error('Error capturing camera snapshot:', err);
      }
    }

    // Fallback if camera stream not available
    onCapture();
  };

  return (
    <div
      id="camera-fullscreen-frame"
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none overflow-hidden max-w-md mx-auto"
    >
      {/* Shutter flash effect */}
      {isFlashActive && (
        <div className="absolute inset-0 z-50 bg-white opacity-80 pointer-events-none transition-opacity duration-200" />
      )}

      {/* Top Header Controls */}
      <div className="p-4 flex items-center justify-between text-white z-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <button
          id="btn-close-camera"
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-full bg-stone-900/80 text-white hover:bg-stone-800 transition-colors border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h3 className="text-sm font-bold tracking-wide flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {mode === 'CHECK_IN' ? 'Chụp ảnh Check-in' : 'Chụp ảnh Check-out'}
          </h3>
          <p className="text-[11px] text-stone-300">Camera trực tiếp • TimeLock Verified</p>
        </div>
        <div className="w-10 h-10 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-amber-400" />
        </div>
      </div>

      {/* Main Viewfinder with Face Oval Guide */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-stone-950">
        {/* Live Camera Video (always mounted to bind stream directly) */}
        <video
          ref={bindVideoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover -scale-x-100 transition-opacity duration-300 ${
            isCameraActive ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Fallback Simulator if camera is not active/available */}
        {!isCameraActive && (
          <div className="absolute inset-0 bg-stone-900 flex flex-col items-center justify-center p-6 text-center">
            <img
              src={
                mode === 'CHECK_IN'
                  ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80'
                  : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80'
              }
              alt="Simulated Camera Stream"
              className="absolute inset-0 w-full h-full object-cover opacity-60 filter brightness-90"
            />
            <div className="relative z-10 bg-black/75 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-white max-w-xs space-y-2">
              <Video className="w-8 h-8 text-amber-400 mx-auto animate-bounce" />
              <p className="text-xs font-semibold">Đang chuẩn bị Camera...</p>
              {cameraError && (
                <p className="text-[11px] text-stone-300 leading-relaxed">
                  (Nếu chưa thấy hình, hãy cho phép quyền Camera trên trình duyệt)
                </p>
              )}
            </div>
          </div>
        )}

        {/* Face Oval Overlay Guide */}
        <div className="relative z-10 w-64 h-80 border-2 border-dashed border-white/80 rounded-[50%/40%] flex flex-col items-center justify-center p-4 shadow-2xl pointer-events-none">
          <div className="text-center bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full text-white text-[11px] font-medium border border-white/20 shadow-lg">
            Căn khuôn mặt vào giữa khung hình
          </div>
        </div>

        {/* Lighting guidance badge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-stone-200 text-[11px] border border-white/10">
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span>Đảm bảo đủ ánh sáng & nhìn thẳng</span>
        </div>

        {/* Live Watermark on Camera View */}
        <div className="absolute bottom-3 left-4 right-4 z-10 pointer-events-none flex items-end justify-between text-white drop-shadow-md">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-2xl tracking-tight text-white drop-shadow">
                {currentTime.timeStr}
              </span>
              <span className="w-0.5 h-4 bg-amber-400 rounded-full" />
              <span className="text-[11px] text-stone-200 font-medium">
                {currentTime.dateStr} • {currentTime.dayOfWeek}
              </span>
            </div>
            <p className="text-[11px] text-stone-300 font-medium truncate max-w-[240px]">
              {mockLocation.address || 'Lưu Hữu Phước, P. Đông Hòa, TP. Dĩ An / TP.HCM'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-amber-400 font-black text-xs block">TimeLock</span>
            <span className="text-[9px] text-stone-300">Live GPS ±{mockLocation.accuracyMeters}m</span>
          </div>
        </div>
      </div>

      {/* Bottom Shutter & Location Status Area */}
      <div className="p-5 bg-gradient-to-t from-black via-black/95 to-transparent text-white flex flex-col items-center gap-4 z-20">
        {/* GPS location pill */}
        <div className="flex items-center gap-1.5 text-[11px] text-stone-300 bg-stone-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-stone-800 shadow-md">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate max-w-[280px]">
            {mockLocation.address || 'Lưu Hữu Phước, Thành Phố Hồ Chí Minh, P. Đông Hòa'}
          </span>
        </div>

        {/* Large thumb-friendly capture button */}
        <div className="flex items-center justify-center w-full py-1">
          <button
            id="btn-capture-shutter"
            type="button"
            onClick={handleCapture}
            className="w-20 h-20 rounded-full border-4 border-white bg-white/20 flex items-center justify-center active:scale-95 transition-transform shadow-2xl hover:bg-white/30"
          >
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-inner hover:scale-105 transition-transform">
              <Camera className="w-7 h-7 text-stone-900" />
            </div>
          </button>
        </div>

        <p className="text-[10px] text-stone-400 text-center">
          * Ảnh chụp trực tiếp kèm thời gian thực & vị trí GPS xác thực.
        </p>
      </div>
    </div>
  );
};

interface SelfiePreviewProps {
  photoUrl: string;
  mode: 'CHECK_IN' | 'CHECK_OUT';
  serverTime?: string;
  address?: string;
  accuracy?: number;
  onRetake: () => void;
  onConfirmUse: () => void;
  isSubmitting?: boolean;
}

export const SelfiePreview: React.FC<SelfiePreviewProps> = ({
  photoUrl,
  mode,
  serverTime,
  address = 'Lưu Hữu Phước, Thành Phố Hồ Chí Minh, P. Đông Hòa',
  accuracy = 16,
  onRetake,
  onConfirmUse,
  isSubmitting = false,
}) => {
  const parsedDate = formatVietnameseDate();

  return (
    <div
      id="selfie-preview-frame"
      className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 sm:p-5 shadow-sm space-y-4 max-w-md mx-auto"
    >
      <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
        <div>
          <h3 className="text-sm font-bold text-on-surface">
            Xem trước ảnh bằng chứng ({mode === 'CHECK_IN' ? 'Check-in' : 'Check-out'})
          </h3>
          <p className="text-[11px] text-on-surface-variant">
            Bố cục đóng dấu thời gian TimeMark & định vị chuẩn
          </p>
        </div>
        <span className="text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full">
          Chờ xác nhận
        </span>
      </div>

      {/* Photo with TimeMark layout matching user reference */}
      <div className="relative rounded-2xl overflow-hidden bg-stone-950 border border-slate-200 shadow-md aspect-3/4 flex items-center justify-center select-none group">
        <img
          src={photoUrl}
          alt="Selfie preview"
          className="w-full h-full object-cover"
        />

        {/* Right side vertical watermark */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] rotate-180 text-[8px] sm:text-[9px] text-white/60 tracking-widest font-mono pointer-events-none drop-shadow">
          © UCM61HYUXXR91L Timemark Verified
        </div>

        {/* Bottom TimeMark watermark layout */}
        <div className="absolute inset-x-0 bottom-0 pt-12 pb-3.5 px-3.5 sm:px-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white">
          <div className="flex items-end justify-between gap-2">
            {/* Bottom-Left: Big Digital Time + Divider + Date & Day of week */}
            <div className="space-y-1">
              <div className="flex items-center">
                <span className="font-bold text-4xl sm:text-5xl text-white tracking-tight leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {parsedDate.timeStr}
                </span>
                <div className="w-[3px] bg-amber-400 self-stretch my-0.5 mx-2.5 rounded-full drop-shadow" />
                <div className="flex flex-col justify-between py-0.5">
                  <span className="text-xs sm:text-[13px] font-bold text-white/95 leading-none drop-shadow">
                    {parsedDate.dateStr}
                  </span>
                  <span className="text-xs text-white/80 font-normal leading-none pt-1 drop-shadow">
                    {parsedDate.dayOfWeek}
                  </span>
                </div>
              </div>

              {/* Address Line */}
              <p className="text-xs sm:text-[13px] text-white/95 font-medium leading-tight truncate max-w-[220px] sm:max-w-[260px] pt-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {address}
              </p>
            </div>

            {/* Bottom-Right: Brand + Verification Badge */}
            <div className="text-right shrink-0 pb-0.5">
              <span className="text-amber-400 font-extrabold text-sm sm:text-base tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] block leading-tight">
                Timemark
              </span>
              <span className="text-[10px] sm:text-[11px] text-white/90 font-medium drop-shadow leading-tight block">
                100% Chân thực
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Info card */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Thời gian ghi nhận:</span>
          <span className="font-mono font-bold text-slate-800">
            {serverTime || `${parsedDate.fullTimeStr} GMT+7`}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Độ chính xác GPS:</span>
          <span className="font-mono font-semibold text-emerald-700">±{accuracy} mét</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 gap-2.5 pt-1">
        <button
          id="btn-confirm-use-photo"
          type="button"
          disabled={isSubmitting}
          onClick={onConfirmUse}
          className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Đang gửi dữ liệu...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Sử dụng ảnh này để chấm công
            </>
          )}
        </button>
        <button
          id="btn-retake-photo"
          type="button"
          disabled={isSubmitting}
          onClick={onRetake}
          className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Chụp lại
        </button>
      </div>

      <p className="text-[10px] text-slate-400 text-center italic">
        * Ảnh và tọa độ GPS sẽ được chuyển thẳng vào danh sách phê duyệt của Quản lý.
      </p>
    </div>
  );
};

