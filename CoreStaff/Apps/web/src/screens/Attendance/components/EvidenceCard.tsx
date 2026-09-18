import { Camera, Crosshair, MapPin, Wifi, CheckCircle2 } from 'lucide-react';
import type { AttendanceEvent } from '../types';

export interface EvidenceCardProps {
  event: AttendanceEvent;
  slot: 'checkIn' | 'checkOut';
}

export function EvidenceCard({ event, slot }: EvidenceCardProps) {
  const isSelfie = event.method === 'SELFIE';
  const isGps = event.method === 'GPS';
  const isNetwork = event.method === 'NETWORK';

  if (isSelfie && 'location' in event) {
    const photoUrl = event.evidence?.previewUrl;
    const loc = event.location;

    return (
      <div className="flex items-start gap-3 mt-2 bg-muted/40 border border-border p-3 rounded-xl">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={slot === 'checkIn' ? 'Selfie Vào ca' : 'Selfie Tan ca'}
            className="size-16 rounded-lg object-cover shrink-0 shadow-xs border border-border"
          />
        ) : (
          <div className="size-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-border">
            <Camera className="size-7 text-primary" aria-hidden="true" />
          </div>
        )}
        <div className="flex flex-col gap-1 text-xs min-w-0">
          <span className="font-semibold text-foreground flex items-center gap-1">
            <Camera className="size-3.5 text-primary" />
            Bằng chứng Selfie ({slot === 'checkIn' ? 'Vào ca' : 'Tan ca'})
          </span>
          <div className="flex items-start gap-1 text-muted-foreground text-[11px]">
            <MapPin className="size-3.5 shrink-0 mt-0.5" />
            <span className="leading-snug">{loc?.address || '123 Đường mẫu, Quận 8, TP.HCM'}</span>
          </div>
          {loc?.accuracyMeters != null && (
            <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
              <Crosshair className="size-3.5 shrink-0" />
              <span>Độ chính xác GPS: ±{Math.round(loc.accuracyMeters)}m</span>
            </div>
          )}
        </div>
      </div>
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
