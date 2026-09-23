import { useState, useEffect } from 'react';
import {
  Camera,
  Crosshair,
  MapPin,
  Wifi,
  CheckCircle2,
  Maximize2,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { AttendanceEvent } from '../types';

export interface EvidenceCardProps {
  event: AttendanceEvent;
  slot: 'checkIn' | 'checkOut';
}

export function EvidenceCard({ event, slot }: EvidenceCardProps) {
  const isSelfie = event.method === 'SELFIE';
  const isGps = event.method === 'GPS';
  const isNetwork = event.method === 'NETWORK';

  const photoUrl = event.evidenceUrl || ('evidence' in event ? event.evidence?.previewUrl : undefined);
  const locAddress = event.address || ('location' in event ? event.location?.address : undefined) || 'Vị trí GPS thực tế';
  const accuracy = event.accuracyMeters || ('location' in event ? event.location?.accuracyMeters : undefined);

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!photoUrl) {
      setBlobUrl(null);
      return;
    }

    if (photoUrl.startsWith('data:') || photoUrl.startsWith('blob:')) {
      setBlobUrl(photoUrl);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setLoadError(false);

    fetch(photoUrl, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (isMounted) {
          const objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
        }
      })
      .catch((err) => {
        console.warn('[EvidenceCard] Could not load evidence image directly via fetch:', err);
        if (isMounted) {
          // Fallback to direct URL in img tag
          setBlobUrl(photoUrl);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [photoUrl]);

  if (isSelfie) {
    const title = slot === 'checkIn' ? 'Bằng chứng Selfie (Vào ca)' : 'Bằng chứng Selfie (Tan ca)';

    return (
      <>
        <div className="flex items-start gap-3 mt-2 bg-muted/40 border border-border p-3 rounded-xl">
          {/* Thumbnail Box */}
          <div className="relative size-16 shrink-0 rounded-lg overflow-hidden border border-border bg-slate-100 flex items-center justify-center group">
            {isLoading ? (
              <Loader2 className="size-5 text-primary animate-spin" />
            ) : blobUrl && !loadError ? (
              <>
                <img
                  src={blobUrl}
                  alt={title}
                  onError={() => setLoadError(true)}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  aria-label="Xem ảnh phóng to"
                  onClick={() => setIsPreviewOpen(true)}
                  className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                  <Maximize2 className="size-4" />
                </button>
              </>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center text-amber-600 p-1">
                <AlertCircle className="size-5" />
                <span className="text-[9px] text-center mt-0.5">Lỗi ảnh</span>
              </div>
            ) : (
              <div className="size-full bg-primary/10 flex items-center justify-center">
                <Camera className="size-6 text-primary" aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col gap-1 text-xs min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1">
                <Camera className="size-3.5 text-primary" />
                {title}
              </span>
              {blobUrl && !loadError && (
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Maximize2 className="size-3" />
                  Xem ảnh
                </button>
              )}
            </div>

            <div className="flex items-start gap-1 text-muted-foreground text-[11px]">
              <MapPin className="size-3.5 shrink-0 mt-0.5 text-slate-500" />
              <span className="leading-snug">{locAddress}</span>
            </div>

            {accuracy != null && (
              <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                <Crosshair className="size-3.5 shrink-0 text-slate-500" />
                <span>Độ chính xác GPS: ±{Math.round(accuracy)}m</span>
              </div>
            )}
          </div>
        </div>

        {/* Enlarged Photo Modal / Lightbox */}
        {isPreviewOpen && blobUrl && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
            onClick={() => setIsPreviewOpen(false)}
          >
            <div
              className="relative max-w-lg w-full bg-card rounded-2xl p-4 shadow-2xl border border-border space-y-3 animate-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Camera className="size-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">{title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Big Image */}
              <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[65vh]">
                <img
                  src={blobUrl}
                  alt={title}
                  className="w-full h-auto max-h-[65vh] object-contain"
                />
              </div>

              {/* Metadata */}
              <div className="text-xs text-muted-foreground space-y-1 bg-muted/30 p-2.5 rounded-xl border border-border">
                <div className="flex items-start gap-1.5">
                  <MapPin className="size-3.5 shrink-0 mt-0.5 text-primary" />
                  <span className="text-foreground">{locAddress}</span>
                </div>
                {accuracy != null && (
                  <div className="flex items-center gap-1.5">
                    <Crosshair className="size-3.5 shrink-0 text-primary" />
                    <span>Độ chính xác GPS: ±{Math.round(accuracy)}m</span>
                  </div>
                )}
                {event.recordedAt && (
                  <div className="text-[11px] text-muted-foreground pt-0.5">
                    Thời điểm ghi nhận:{' '}
                    {new Date(event.recordedAt).toLocaleString('vi-VN')}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (isGps && 'accuracyMeters' in event) {
    return (
      <div className="flex items-start gap-3 mt-2 bg-muted/40 border border-border p-3 rounded-xl">
        <div className="size-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
          <MapPin className="size-5" />
        </div>
        <div className="flex flex-col gap-1 text-xs min-w-0">
          <span className="font-semibold text-foreground flex items-center gap-1">
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            Xác thực vị trí GPS Geofence
          </span>
          <p className="text-muted-foreground text-[11px] leading-snug">
            {event.address || event.workplaceName || 'Văn phòng CoreStaff Quận 8'}
          </p>
          <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
            {event.distanceMeters != null && (
              <span>Khoảng cách: {Math.round(event.distanceMeters)}m</span>
            )}
            {event.accuracyMeters != null && (
              <span>Sai số: ±{Math.round(event.accuracyMeters)}m</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isNetwork) {
    return (
      <div className="flex items-start gap-3 mt-2 bg-muted/40 border border-border p-3 rounded-xl">
        <div className="size-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
          <Wifi className="size-5" />
        </div>
        <div className="flex flex-col gap-1 text-xs min-w-0">
          <span className="font-semibold text-foreground flex items-center gap-1">
            <CheckCircle2 className="size-3.5 text-blue-600" />
            Xác thực Mạng nội bộ Wi-Fi/LAN
          </span>
          <p className="text-muted-foreground text-[11px]">
            Mạng kết nối: <strong>{'networkName' in event ? event.networkName : 'CoreStaff-Office-5G'}</strong>
          </p>
          <p className="text-muted-foreground text-[11px]">
            Địa điểm: {event.workplaceName || 'Văn phòng CoreStaff Quận 8'}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
