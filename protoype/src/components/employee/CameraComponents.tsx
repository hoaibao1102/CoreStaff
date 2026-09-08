import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  RefreshCw,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sun,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

interface CameraCaptureProps {
  mode: 'CHECK_IN' | 'CHECK_OUT';
  onClose: () => void;
  onPhotoCaptured: (photoUrl: string) => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  mode,
  onClose,
  onPhotoCaptured,
}) => {
  const [useRealCamera, setUseRealCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Attempt real camera stream if available, otherwise fallback gracefully
  useEffect(() => {
    let active = true;
    async function startCamera() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
            audio: false,
          });
          if (active) {
            streamRef.current = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              setUseRealCamera(true);
            }
          }
        }
      } catch (err) {
        console.warn('Real webcam not accessed, fallback to high-fi simulator:', err);
        setUseRealCamera(false);
      }
    }

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (useRealCamera && videoRef.current) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          onPhotoCaptured(dataUrl);
          return;
        }
      } catch (e) {
        console.error('Canvas capture failed:', e);
      }
    }

    // High quality sample portrait fallback for wireframe prototype
    const fallbackImage =
      mode === 'CHECK_IN'
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80';
    onPhotoCaptured(fallbackImage);
  };

  return (
    <div
      id="camera-fullscreen-frame"
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none overflow-hidden max-w-md mx-auto"
    >
      {/* Top Header Controls */}
      <div className="p-4 flex items-center justify-between text-white z-10 bg-gradient-to-b from-black/80 to-transparent">
        <button
          id="btn-close-camera"
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-stone-800/80 text-white hover:bg-stone-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h3 className="text-sm font-bold tracking-wide">
            {mode === 'CHECK_IN' ? 'Chụp ảnh Check-in' : 'Chụp ảnh Check-out'}
          </h3>
          <p className="text-[11px] text-stone-300">Camera trước • Bằng chứng ERP</p>
        </div>
        <div className="w-9 h-9"></div> {/* Balancer */}
      </div>

      {/* Main Viewfinder with Face Oval Guide */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {useRealCamera ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover -scale-x-100"
          />
        ) : (
          <div className="absolute inset-0 bg-stone-900 flex items-center justify-center">
            <img
              src={
                mode === 'CHECK_IN'
                  ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80'
                  : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80'
              }
              alt="Simulated Camera Stream"
              className="w-full h-full object-cover opacity-70 filter brightness-90"
            />
          </div>
        )}

        {/* Face Oval Overlay Guide */}
        <div className="relative z-10 w-64 h-80 border-2 border-dashed border-white/70 rounded-[50%/40%] flex flex-col items-center justify-center p-4 shadow-2xl pointer-events-none">
          <div className="text-center bg-black/60 backdrop-blur-xs px-3 py-1.5 rounded-full text-white text-[11px] font-medium border border-white/20">
            Căn khuôn mặt vào giữa khung hình
          </div>
        </div>

        {/* Lighting guidance badge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 text-stone-200 text-[11px] border border-stone-700">
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span>Đảm bảo đủ ánh sáng & nhìn rõ thẻ</span>
        </div>
      </div>

      {/* Bottom Shutter & Location Status Area */}
      <div className="p-5 bg-gradient-to-t from-black via-black/90 to-transparent text-white flex flex-col items-center gap-4 z-10">
        {/* GPS location pill */}
        <div className="flex items-center gap-1.5 text-[11px] text-stone-300 bg-stone-900/80 px-3 py-1 rounded-full border border-stone-800">
          <MapPin className="w-3 h-3 text-emerald-400" />
          <span>
            {mode === 'CHECK_IN'
              ? 'Quận 7, TP.HCM (±18m)'
              : 'TP. Thủ Đức, TP.HCM (±15m)'}
          </span>
        </div>

        {/* Large thumb-friendly capture button - NO gallery button as per strict policy */}
        <div className="flex items-center justify-center w-full">
          <button
            id="btn-capture-shutter"
            type="button"
            onClick={handleCapture}
            className="w-20 h-20 rounded-full border-4 border-white bg-white/20 flex items-center justify-center active:scale-95 transition-transform shadow-2xl hover:bg-white/30"
          >
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-inner">
              <Camera className="w-7 h-7 text-stone-900" />
            </div>
          </button>
        </div>

        <p className="text-[10px] text-stone-400 text-center">
          * Không hỗ trợ tải ảnh từ thư viện. Yêu cầu chụp trực tiếp.
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
  serverTime = '08:15:24 GMT+7',
  address = 'Khu dân cư Him Lam, Phường Tân Hưng, Quận 7, TP.HCM',
  accuracy = 18,
  onRetake,
  onConfirmUse,
  isSubmitting = false,
}) => {
  return (
    <div
      id="selfie-preview-frame"
      className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
        <div>
          <h3 className="text-xs font-bold text-on-surface">
            Xem trước ảnh bằng chứng ({mode === 'CHECK_IN' ? 'Check-in' : 'Check-out'})
          </h3>
          <p className="text-[10px] text-on-surface-variant">Kiểm tra thông tin trước khi gửi phê duyệt</p>
        </div>
        <span className="text-[10px] font-semibold text-on-tertiary-fixed-variant bg-tertiary-fixed px-2 py-0.5 rounded-full">
          Chờ duyệt
        </span>
      </div>

      {/* Photo with simulated official timestamp & GPS watermark */}
      <div className="relative rounded-xl overflow-hidden bg-inverse-surface border border-outline-variant aspect-3/4 flex items-center justify-center">
        <img
          src={photoUrl}
          alt="Selfie preview"
          className="w-full h-full object-cover"
        />

        {/* Official Watermark overlay */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-on-background/90 via-on-background/60 to-transparent text-inverse-on-surface text-[10px] font-mono space-y-0.5">
          <div className="flex items-center justify-between text-tertiary-fixed font-bold text-[11px]">
            <span>TVS ERP VERIFIED EVIDENCE</span>
            <span>{serverTime}</span>
          </div>
          <p className="truncate text-inverse-on-surface/90">📍 {address}</p>
          <div className="flex items-center justify-between text-inverse-on-surface/70 text-[9px]">
            <span>GPS ACCURACY: ±{accuracy}M</span>
            <span>EMP: TVS-0248 (Nguyễn Văn An)</span>
          </div>
        </div>
      </div>

      {/* Info card */}
      <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant text-xs text-on-surface-variant space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px]">Thời gian Server ghi nhận:</span>
          <span className="font-mono font-bold text-on-surface">{serverTime}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px]">Độ chính xác GPS:</span>
          <span className="font-mono font-semibold text-secondary">±{accuracy} mét</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 gap-3 pt-1">
        <button
          id="btn-confirm-use-photo"
          type="button"
          disabled={isSubmitting}
          onClick={onConfirmUse}
          className="py-3 px-4 rounded-full bg-primary hover:bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Đang gửi...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Sử dụng ảnh này
            </>
          )}
        </button>
        <button
          id="btn-retake-photo"
          type="button"
          disabled={isSubmitting}
          onClick={onRetake}
          className="py-3 px-4 rounded-full border border-outline-variant text-on-surface hover:bg-surface-container-low font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Chụp lại
        </button>
      </div>

      <p className="text-[10px] text-on-surface-variant text-center italic">
        * Ảnh và tọa độ sẽ được chuyển trực tiếp vào danh sách phê duyệt của Cấp trên.
      </p>
    </div>
  );
};
