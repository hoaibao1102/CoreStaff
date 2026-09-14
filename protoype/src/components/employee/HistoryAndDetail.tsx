import React from 'react';
import {
  Calendar,
  ChevronRight,
  ArrowLeft,
  MapPin,
  FileEdit,
  XCircle,
} from 'lucide-react';
import { DayAttendance } from '../../types';
import { AttendanceStatusBadge, ApprovalStatusBadge, MethodBadge } from '../common/Badges';
import { AuditTimeline } from '../common/CommonStates';

interface HistorySummaryProps {
  records: DayAttendance[];
}

export const HistorySummary: React.FC<HistorySummaryProps> = ({ records }) => {
  const totalDays = records.filter(
    (r) => r.status === 'COMPLETED' || r.status === 'CHECKED_IN' || r.status === 'LATE' || r.status === 'EARLY_LEAVE'
  ).length;
  const lateCount = records.filter((r) => r.status === 'LATE' || (r.lateMinutes && r.lateMinutes > 0)).length;
  const earlyCount = records.filter((r) => r.status === 'EARLY_LEAVE' || (r.earlyMinutes && r.earlyMinutes > 0)).length;
  const absenceCount = records.filter((r) => r.status === 'HOLIDAY').length;

  const statCards = [
    { label: 'Số ngày công', value: totalDays, unit: '/ 22', accent: 'bg-primary', valueColor: 'text-primary' },
    { label: 'Đi trễ', value: lateCount, unit: 'lần', accent: 'bg-error', valueColor: lateCount > 0 ? 'text-error' : 'text-on-surface' },
    { label: 'Về sớm', value: earlyCount, unit: 'lần', accent: 'bg-tertiary', valueColor: earlyCount > 0 ? 'text-tertiary' : 'text-on-surface' },
    { label: 'Nghỉ', value: absenceCount, unit: 'ngày', accent: 'bg-outline', valueColor: 'text-on-surface' },
  ];

  return (
    <div id="history-summary-cards" className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {statCards.map((card) => (
        <div
          key={card.label}
          className="relative bg-surface-container-lowest p-2.5 rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col justify-between min-h-[76px]"
        >
          <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${card.accent}`}></div>
          <span className="text-[10px] text-on-surface-variant pl-1.5">{card.label}</span>
          <span className={`font-mono text-base font-bold pl-1.5 ${card.valueColor}`}>{card.value}</span>
          <span className="text-[9px] text-on-surface-variant pl-1.5">{card.unit}</span>
        </div>
      ))}
    </div>
  );
};

interface HistoryListItemProps {
  record: DayAttendance;
  onSelect: (record: DayAttendance) => void;
}

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'COMPLETED': return 'bg-secondary-container text-on-secondary-container';
    case 'LATE': return 'bg-error-container text-on-error-container';
    case 'EARLY_LEAVE': return 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
    case 'CHECKED_IN': return 'bg-primary-container text-on-primary-container';
    case 'HOLIDAY': return 'bg-surface-variant text-on-surface-variant';
    case 'LOCKED': return 'bg-surface-container text-on-surface';
    default: return 'bg-surface-variant text-on-surface-variant';
  }
};

const getStatusLabel = (record: DayAttendance) => {
  switch (record.status) {
    case 'COMPLETED': return 'Hoàn thành';
    case 'LATE': return 'Đi trễ';
    case 'EARLY_LEAVE': return 'Về sớm';
    case 'CHECKED_IN': return 'Đang trong ca';
    case 'HOLIDAY': return 'Nghỉ';
    case 'LOCKED': return 'Khóa';
    default: return 'Chưa check-in';
  }
};

export const HistoryListItem: React.FC<HistoryListItemProps> = ({
  record,
  onSelect,
}) => {
  const isHoliday = record.status === 'HOLIDAY';

  return (
    <div
      id={`history-item-${record.id}`}
      onClick={() => onSelect(record)}
      className="bg-surface-container-lowest rounded-xl border border-outline-variant p-3.5 shadow-card-sm hover:shadow-md transition-all cursor-pointer space-y-2 group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">
            {record.formattedDate}
          </span>
          {record.totalWorkingMinutes && !isHoliday && (
            <span className="text-[11px] text-on-surface-variant mt-0.5">
              Tổng: {Math.floor(record.totalWorkingMinutes / 60)}h {record.totalWorkingMinutes % 60}m
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusStyle(record.status)}`}>
            {getStatusLabel(record)}
          </span>
          <ChevronRight className="w-4 h-4 text-outline group-hover:text-primary transition-colors" />
        </div>
      </div>

      {!isHoliday ? (
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-outline-variant bg-surface-container-low rounded-lg p-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <div>
              <span className="text-[10px] text-on-surface-variant block">Giờ vào</span>
              <span className="font-mono font-medium text-on-surface">
                {record.checkIn ? record.checkIn.time : '—'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <div>
              <span className="text-[10px] text-on-surface-variant block">Giờ ra</span>
              <span className="font-mono font-medium text-on-surface">
                {record.checkOut ? record.checkOut.time : '—'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant italic pt-3 border-t border-outline-variant">
          Ngày nghỉ chính thức / Không có ca làm việc.
        </p>
      )}

      {record.overallApprovalStatus && record.overallApprovalStatus !== 'NOT_REQUIRED' && (
        <div className="pt-1 flex items-center justify-between text-[11px]">
          <span className="text-on-surface-variant">Trạng thái duyệt bằng chứng:</span>
          <ApprovalStatusBadge status={record.overallApprovalStatus} size="sm" />
        </div>
      )}
    </div>
  );
};

interface DayDetailViewProps {
  record: DayAttendance;
  onBack: () => void;
  onOpenAdjustment: () => void;
  onOpenClarification?: (record: DayAttendance) => void;
}

export const DayDetailView: React.FC<DayDetailViewProps> = ({
  record,
  onBack,
  onOpenAdjustment,
  onOpenClarification,
}) => {
  return (
    <div id="day-detail-view" className="space-y-4 pb-6">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
        <button
          id="btn-back-from-detail"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-container px-2.5 py-1.5 rounded-full transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>
        <span className="text-xs font-bold text-on-surface">Chi tiết ngày công</span>
        <AttendanceStatusBadge status={record.status} size="sm" />
      </div>

      {/* Date & Shift overview */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 space-y-2 shadow-card-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
        <h3 className="text-sm font-bold text-on-surface pl-1.5">{record.formattedDate}</h3>
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-surface-variant text-on-surface-variant pl-1.5">
          <div>
            <span className="text-[10px] block">Ca làm:</span>
            <span className="text-on-surface">{record.shiftName} ({record.shiftHours})</span>
          </div>
          <div>
            <span className="text-[10px] block">Tổng thời gian:</span>
            <span className="font-mono font-bold text-secondary">
              {record.totalWorkingMinutes
                ? `${Math.floor(record.totalWorkingMinutes / 60)} giờ ${record.totalWorkingMinutes % 60} phút`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Rejection Warning Banner if rejected */}
      {record.overallApprovalStatus === 'REJECTED' && (
        <div className="p-3.5 rounded-xl bg-error-container/25 border border-error-container text-on-error-container text-xs space-y-2">
          <div className="flex items-start gap-2">
            <XCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-on-error-container">Bằng chứng chấm công bị từ chối</h4>
              <p className="text-[11px] mt-0.5">
                {record.checkIn?.rejectionReason || 'Ảnh chụp không hợp lệ / không nhìn rõ khuôn mặt.'}
              </p>
            </div>
          </div>
          {onOpenClarification && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => onOpenClarification(record)}
                className="px-3 py-1.5 bg-error hover:bg-error-container text-on-error font-semibold rounded-lg text-xs transition-colors"
              >
                Gửi giải trình bổ sung
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detailed Check-in Event Card */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 space-y-3 shadow-card-sm">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-secondary"></div>
            <h4 className="text-xs font-bold text-on-surface">1. Sự kiện Check-in</h4>
          </div>
          <span className="font-mono text-xs font-bold text-on-surface">
            {record.checkIn?.time || '—'}
          </span>
        </div>

        {record.checkIn ? (
          <div className="space-y-2 text-xs text-on-surface-variant">
            <div className="flex items-center gap-2 flex-wrap">
              <MethodBadge method={record.checkIn.method} />
              <ApprovalStatusBadge status={record.checkIn.approvalStatus} size="sm" />
            </div>

            <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant space-y-1">
              <p className="text-[11px] text-on-surface flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-on-surface-variant shrink-0 mt-0.5" />
                <span>{record.checkIn.address}</span>
              </p>
              <div className="flex items-center justify-between text-[10px] pt-3 border-t border-outline-variant/60">
                <span>Giờ server: {record.checkIn.serverTime}</span>
                {record.checkIn.accuracy && <span>Độ chính xác: ±{record.checkIn.accuracy}m</span>}
              </div>
            </div>

            {record.checkIn.selfieUrl && (
              <div>
                <span className="text-[11px] font-semibold text-on-surface block mb-1">
                  Ảnh bằng chứng selfie:
                </span>
                <div className="w-24 h-32 rounded-lg overflow-hidden border border-outline-variant shadow-sm">
                  <img
                    src={record.checkIn.selfieUrl}
                    alt="Selfie Check-in"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant italic">Chưa ghi nhận Check-in.</p>
        )}
      </div>

      {/* Detailed Check-out Event Card */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 space-y-3 shadow-card-sm">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-secondary"></div>
            <h4 className="text-xs font-bold text-on-surface">2. Sự kiện Check-out</h4>
          </div>
          <span className="font-mono text-xs font-bold text-on-surface">
            {record.checkOut?.time || '—'}
          </span>
        </div>

        {record.checkOut ? (
          <div className="space-y-2 text-xs text-on-surface-variant">
            <div className="flex items-center gap-2 flex-wrap">
              <MethodBadge method={record.checkOut.method} />
              <ApprovalStatusBadge status={record.checkOut.approvalStatus} size="sm" />
            </div>

            <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant space-y-1">
              <p className="text-[11px] text-on-surface flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-on-surface-variant shrink-0 mt-0.5" />
                <span>{record.checkOut.address}</span>
              </p>
              <div className="flex items-center justify-between text-[10px] pt-3 border-t border-outline-variant/60">
                <span>Giờ server: {record.checkOut.serverTime}</span>
                {record.checkOut.accuracy && <span>Độ chính xác: ±{record.checkOut.accuracy}m</span>}
              </div>
            </div>

            {record.checkOut.selfieUrl && (
              <div>
                <span className="text-[11px] font-semibold text-on-surface block mb-1">
                  Ảnh bằng chứng selfie:
                </span>
                <div className="w-24 h-32 rounded-lg overflow-hidden border border-outline-variant shadow-sm">
                  <img
                    src={record.checkOut.selfieUrl}
                    alt="Selfie Check-out"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant italic">Chưa ghi nhận Check-out.</p>
        )}
      </div>

      {/* Audit Trail Timeline */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 space-y-3 shadow-card-sm">
        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
          Lịch sử xử lý & Ghi nhận
        </h4>
        <AuditTimeline logs={record.auditTrail} />
      </div>

      {/* Adjustment Request Placeholder - tagged strictly with Proposed/Phase sau */}
      <div className="mt-3">
        <button
          id="btn-open-adjustment-request"
          type="button"
          onClick={onOpenAdjustment}
          className="w-full py-3 px-4 rounded-lg border border-outline-variant bg-surface-container-low hover:bg-surface-container text-on-surface font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
        >
          <FileEdit className="w-4 h-4 text-on-surface-variant" />
          <span>Yêu cầu điều chỉnh ngày công</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed-variant">
            [Proposed / Phase sau]
          </span>
        </button>
      </div>
    </div>
  );
};