import React from 'react';
import { ArrowLeft, MapPin, FileEdit, XCircle, ChevronRight } from 'lucide-react';
import { DayAttendance } from '../../types';
import { AttendanceStatusBadge, ApprovalStatusBadge, MethodBadge } from '../common/Badges';
import { AuditTimeline } from '../common/CommonStates';

// ─── Summary KPI Cards ────────────────────────────────────────────────────────

interface HistorySummaryProps { records: DayAttendance[] }

export const HistorySummary: React.FC<HistorySummaryProps> = ({ records }) => {
  const totalDays = records.filter(
    (r) => r.status === 'COMPLETED' || r.status === 'CHECKED_IN' || r.status === 'LATE' || r.status === 'EARLY_LEAVE'
  ).length;
  const lateCount  = records.filter((r) => r.status === 'LATE'        || (r.lateMinutes  && r.lateMinutes  > 0)).length;
  const earlyCount = records.filter((r) => r.status === 'EARLY_LEAVE' || (r.earlyMinutes && r.earlyMinutes > 0)).length;
  const absenceCount = records.filter((r) => r.status === 'HOLIDAY').length;

  const statCards = [
    { label: 'Ngày công', value: totalDays,    unit: '/ 22',  dot: 'bg-emerald-400', valueColor: 'text-slate-700'  },
    { label: 'Đi trễ',   value: lateCount,    unit: 'lần',   dot: 'bg-red-400',     valueColor: lateCount  > 0 ? 'text-red-500'    : 'text-slate-500' },
    { label: 'Về sớm',   value: earlyCount,   unit: 'lần',   dot: 'bg-amber-400',   valueColor: earlyCount > 0 ? 'text-amber-600' : 'text-slate-500' },
    { label: 'Nghỉ',     value: absenceCount, unit: 'ngày',  dot: 'bg-slate-300',   valueColor: 'text-slate-500' },
  ];

  return (
    <div id="history-summary-cards" className="grid grid-cols-4 gap-2">
      {statCards.map((card) => (
        <div key={card.label} className="bg-[#fefcfa] p-2.5 rounded-xl border border-stone-200/80 shadow-sm flex flex-col gap-1 min-h-[64px]">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${card.dot}`} />
            <span className="text-[10px] text-slate-400">{card.label}</span>
          </div>
          <span className={`font-mono text-lg font-semibold leading-none ${card.valueColor}`}>{card.value}</span>
          <span className="text-[9px] text-slate-400">{card.unit}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Calendar / Schedule View ─────────────────────────────────────────────────

const DOW_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

type StatusKey = string;

// Readable, warm palette — clear status colors
const STATUS_CELL: Record<string, { bg: string; leftBar: string; dot: string; numText: string; timeText: string; label: string }> = {
  COMPLETED:   { bg: 'bg-emerald-50',   leftBar: 'border-l-[3px] border-l-emerald-500', dot: 'bg-emerald-500', numText: 'text-slate-800', timeText: 'text-emerald-800', label: 'Hoàn thành' },
  LATE:        { bg: 'bg-red-50',       leftBar: 'border-l-[3px] border-l-red-500',     dot: 'bg-red-500',     numText: 'text-slate-800', timeText: 'text-red-700',    label: 'Đi trễ'     },
  EARLY_LEAVE: { bg: 'bg-amber-50',     leftBar: 'border-l-[3px] border-l-amber-500',   dot: 'bg-amber-500',   numText: 'text-slate-800', timeText: 'text-amber-800',  label: 'Về sớm'    },
  CHECKED_IN:  { bg: 'bg-blue-50',     leftBar: 'border-l-[3px] border-l-blue-500',    dot: 'bg-blue-500',    numText: 'text-slate-800', timeText: 'text-blue-700',   label: 'Đang làm'   },
  HOLIDAY:     { bg: 'bg-stone-100',    leftBar: 'border-l-[3px] border-l-stone-300',   dot: 'bg-stone-400',   numText: 'text-stone-500', timeText: 'text-stone-400',  label: 'Nghỉ'       },
  LOCKED:      { bg: 'bg-stone-100',    leftBar: 'border-l-[3px] border-l-stone-300',   dot: 'bg-stone-400',   numText: 'text-stone-500', timeText: 'text-stone-400',  label: 'Khóa'       },
};
const EMPTY_STYLE = { bg: 'bg-transparent', leftBar: '', dot: '', numText: 'text-stone-300', timeText: '', label: '' };

function cellStyle(s: StatusKey) { return STATUS_CELL[s] ?? EMPTY_STYLE; }

interface HistoryCalendarViewProps {
  records: DayAttendance[];
  onSelect: (record: DayAttendance) => void;
}

export const HistoryCalendarView: React.FC<HistoryCalendarViewProps> = ({ records, onSelect }) => {
  // Map date→record for O(1) lookup
  const byDate = React.useMemo(() => {
    const m: Record<string, DayAttendance> = {};
    records.forEach((r) => { m[r.date] = r; });
    return m;
  }, [records]);

  // Determine month from first record
  const [year, month] = React.useMemo(() => {
    if (!records.length) return [2026, 8];
    return records[0].date.split('-').map(Number);
  }, [records]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow    = new Date(year, month - 1, 1).getDay(); // 0=Sun

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  return (
    <div id="history-calendar-view" className="bg-[#fefcfa] rounded-2xl border border-stone-200/70 shadow-sm p-4 space-y-3">

      {/* ── Month header + legend ── */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700 capitalize">{monthLabel}</h3>
        <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
          {[
            { dot: 'bg-emerald-400', label: 'Hoàn thành' },
            { dot: 'bg-red-400',     label: 'Trễ/Sớm' },
            { dot: 'bg-blue-400',    label: 'Đang làm' },
          ].map(({ dot, label }) => (
            <span key={label} className="flex items-center gap-1 text-[9px] text-slate-400 whitespace-nowrap">
              <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />{label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Day-of-week header row ── */}
      <div className="grid grid-cols-7 gap-1">
        {DOW_LABELS.map((d, i) => (
          <div key={d} className={`text-center text-[11px] font-semibold py-1 ${
            i === 0 || i === 6 ? 'text-red-500' : 'text-stone-500'
          }`}>
            {d}
          </div>
        ))}
      </div>

      {/* ── Day cells ── */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`blank-${i}`} />)}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateStr   = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const record    = byDate[dateStr];
          const dow       = (firstDow + (day - 1)) % 7;
          const isWknd    = dow === 0 || dow === 6;
          const st        = record ? cellStyle(record.status) : EMPTY_STYLE;
          const isHoliday = record?.status === 'HOLIDAY';
          const hasAlert  = record?.overallApprovalStatus === 'REJECTED' || record?.overallApprovalStatus === 'PENDING';
          const hasWarn   = !!record?.warningNote;

          return (
            <button
              key={dateStr}
              id={`cal-cell-${dateStr}`}
              type="button"
              disabled={!record}
              onClick={() => record && onSelect(record)}
              className={[
                'relative flex flex-col items-center rounded-lg border border-stone-200 pt-1.5 pb-2 min-h-[60px] transition-all duration-100',
                st.bg,
                st.leftBar,
                record ? 'cursor-pointer hover:shadow-md active:scale-95' : 'cursor-default',
              ].join(' ')}
            >
              {/* Day number */}
              <span className={[
                'text-[12px] font-semibold leading-none',
                !record             ? (isWknd ? 'text-red-300' : 'text-stone-300') :
                isHoliday           ? 'text-stone-400' :
                isWknd              ? 'text-red-500' :
                                      st.numText,
              ].join(' ')}>
                {day}
              </span>

              {/* Working day content */}
              {record && !isHoliday && (
                <div className="flex flex-col items-center gap-[3px] mt-1 w-full">
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  {record.checkIn && (
                    <span className={`text-[9px] font-mono font-medium leading-none ${st.timeText}`}>
                      {record.checkIn.time}
                    </span>
                  )}
                  {record.checkOut ? (
                    <span className={`text-[9px] font-mono leading-none ${st.timeText} opacity-75`}>
                      {record.checkOut.time}
                    </span>
                  ) : record.checkIn ? (
                    <span className="text-[8px] leading-none text-stone-400">–</span>
                  ) : null}
                </div>
              )}

              {/* Holiday */}
              {isHoliday && (
                <span className="text-[9px] text-stone-500 font-medium mt-0.5 leading-none">Nghỉ</span>
              )}

              {/* Alert dot */}
              {(hasAlert || hasWarn) && !isHoliday && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer note */}
      <p className="text-[9px] text-slate-400 text-center pt-1 border-t border-slate-100">
        <span className="inline-flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-amber-400 inline-block" />
          Chấm vàng = chờ duyệt · Bấm vào ngày để xem chi tiết
        </span>
      </p>
    </div>
  );
};

// Keep HistoryListItem exported for backward compatibility (not rendered by default now)
interface HistoryListItemProps { record: DayAttendance; onSelect: (r: DayAttendance) => void }
export const HistoryListItem: React.FC<HistoryListItemProps> = ({ record, onSelect }) => (
  <div
    id={`history-item-${record.id}`}
    onClick={() => onSelect(record)}
    className="bg-surface-container-lowest rounded-xl border border-outline-variant p-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
  >
    <span className="text-xs font-bold text-on-surface group-hover:text-primary">{record.formattedDate}</span>
    <ChevronRight className="w-4 h-4 text-outline group-hover:text-primary" />
  </div>
);

// ─── DayDetailView ────────────────────────────────────────────────────────────

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
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 space-y-2 shadow-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
        <h3 className="text-sm font-bold text-on-surface pl-1.5">{record.formattedDate}</h3>
        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-surface-variant text-on-surface-variant pl-1.5">
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
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-secondary"></div>
            <h4 className="text-xs font-bold text-on-surface">1. Sự kiện Check-in</h4>
          </div>
          <span className="font-mono text-xs font-bold text-on-surface">{record.checkIn?.time || '—'}</span>
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
              <div className="flex items-center justify-between text-[10px] pt-1 border-t border-outline-variant/60">
                <span>Giờ server: {record.checkIn.serverTime}</span>
                {record.checkIn.accuracy && <span>Độ chính xác: ±{record.checkIn.accuracy}m</span>}
              </div>
            </div>

            {record.checkIn.selfieUrl && (
              <div>
                <span className="text-[11px] font-semibold text-on-surface block mb-1">Ảnh bằng chứng selfie:</span>
                <div className="w-24 h-32 rounded-lg overflow-hidden border border-outline-variant shadow-sm">
                  <img src={record.checkIn.selfieUrl} alt="Selfie Check-in" className="w-full h-full object-cover" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant italic">Chưa ghi nhận Check-in.</p>
        )}
      </div>

      {/* Detailed Check-out Event Card */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-secondary"></div>
            <h4 className="text-xs font-bold text-on-surface">2. Sự kiện Check-out</h4>
          </div>
          <span className="font-mono text-xs font-bold text-on-surface">{record.checkOut?.time || '—'}</span>
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
              <div className="flex items-center justify-between text-[10px] pt-1 border-t border-outline-variant/60">
                <span>Giờ server: {record.checkOut.serverTime}</span>
                {record.checkOut.accuracy && <span>Độ chính xác: ±{record.checkOut.accuracy}m</span>}
              </div>
            </div>

            {record.checkOut.selfieUrl && (
              <div>
                <span className="text-[11px] font-semibold text-on-surface block mb-1">Ảnh bằng chứng selfie:</span>
                <div className="w-24 h-32 rounded-lg overflow-hidden border border-outline-variant shadow-sm">
                  <img src={record.checkOut.selfieUrl} alt="Selfie Check-out" className="w-full h-full object-cover" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant italic">Chưa ghi nhận Check-out.</p>
        )}
      </div>

      {/* Audit Trail Timeline */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 space-y-3 shadow-sm">
        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
          Lịch sử xử lý &amp; Ghi nhận
        </h4>
        <AuditTimeline logs={record.auditTrail} />
      </div>

      {/* Adjustment Request Placeholder */}
      <div className="pt-2">
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