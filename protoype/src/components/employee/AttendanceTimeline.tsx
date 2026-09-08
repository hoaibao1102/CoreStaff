import React from 'react';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
} from 'lucide-react';
import { AttendanceEvent } from '../../types';
import { ApprovalStatusBadge, MethodBadge } from '../common/Badges';

interface AttendanceTimelineProps {
  checkIn?: AttendanceEvent;
  checkOut?: AttendanceEvent;
  isSelfieMode?: boolean;
}

export const AttendanceTimeline: React.FC<AttendanceTimelineProps> = ({
  checkIn,
  checkOut,
}) => {
  return (
    <div
      id="attendance-timeline"
      className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] space-y-4"
    >
      <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
        <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
          Tiến trình ngày công
        </h3>
        <span className="text-[11px] text-on-surface-variant">2 mốc thời gian</span>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-outline-variant">
        {/* CHECK-IN STEP */}
        <div id="timeline-step-checkin" className="relative group">
          <div
            className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 ${
              checkIn
                ? 'bg-secondary border-surface-container-lowest text-on-secondary'
                : 'bg-surface-variant border-outline-variant text-on-surface-variant'
            } shadow-sm`}
          >
            {checkIn ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3 h-3" />}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface">1. Check-in</span>
              {checkIn ? (
                <span className="font-mono text-xs font-bold text-on-surface bg-surface-variant px-1.5 py-0.5 rounded-md">
                  {checkIn.time}
                </span>
              ) : (
                <span className="text-[11px] text-on-surface-variant italic">Chưa thực hiện</span>
              )}
            </div>

            {checkIn && (
              <div className="text-xs text-on-surface-variant space-y-1 pt-1 bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/60">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <MethodBadge method={checkIn.method} />
                  <ApprovalStatusBadge status={checkIn.approvalStatus} size="sm" />
                </div>
                <p className="text-[11px] text-on-surface flex items-start gap-1">
                  <MapPin className="w-3 h-3 text-on-surface-variant shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{checkIn.address}</span>
                </p>
                {checkIn.accuracy && (
                  <p className="text-[10px] text-on-surface-variant">
                    Độ chính xác GPS: ±{checkIn.accuracy}m | Giờ Server: {checkIn.serverTime}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CHECK-OUT STEP */}
        <div id="timeline-step-checkout" className="relative group">
          <div
            className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 ${
              checkOut
                ? 'bg-secondary border-surface-container-lowest text-on-secondary'
                : 'bg-surface-variant border-outline-variant text-on-surface-variant'
            } shadow-sm`}
          >
            {checkOut ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3 h-3" />}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface">2. Check-out</span>
              {checkOut ? (
                <span className="font-mono text-xs font-bold text-on-surface bg-surface-variant px-1.5 py-0.5 rounded-md">
                  {checkOut.time}
                </span>
              ) : (
                <span className="text-[11px] text-on-surface-variant italic">Chưa thực hiện</span>
              )}
            </div>

            {checkOut && (
              <div className="text-xs text-on-surface-variant space-y-1 pt-1 bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/60">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <MethodBadge method={checkOut.method} />
                  <ApprovalStatusBadge status={checkOut.approvalStatus} size="sm" />
                </div>
                <p className="text-[11px] text-on-surface flex items-start gap-1">
                  <MapPin className="w-3 h-3 text-on-surface-variant shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{checkOut.address}</span>
                </p>
                {checkOut.accuracy && (
                  <p className="text-[10px] text-on-surface-variant">
                    Độ chính xác GPS: ±{checkOut.accuracy}m | Giờ Server: {checkOut.serverTime}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Distance Warning if checkin & checkout are far apart in Selfie mode */}
      {checkIn && checkOut && checkIn.method === 'SELFIE' && checkOut.method === 'SELFIE' && (
        <div className="p-2.5 rounded-lg bg-tertiary-fixed/40 border border-tertiary-fixed-dim text-xs text-on-tertiary-fixed-variant flex items-start gap-2">
          <Navigation className="w-4 h-4 text-tertiary-container shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Khoảng cách 2 điểm: 18,4 km</span>
            <p className="text-[11px] mt-0.5">
              Check-in (Quận 7) và Check-out (TP. Thủ Đức). Hệ thống chấp nhận 2 địa điểm khác nhau và gửi Approver xem xét theo chính sách thị trường.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};