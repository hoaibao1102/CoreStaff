import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import type { DayAttendance, AttendanceMethod, NetworkVerification } from '../types';
import { DayDetailModal } from './DayDetailModal';
import { resolveApiBase, apiUrl } from '../../../config/api';
import { getAttendanceHistory } from '../../../services/attendance.service';

const DEFAULT_NETWORK_CONTEXT: NetworkVerification = {
  method: 'NETWORK',
  status: 'CONNECTED_TO_ALLOWED_NETWORK',
  canAttend: true,
  networkId: 'net-office-1',
  networkName: 'CoreStaff-Office-5G',
  workplaceId: 'wp-default',
  workplaceName: 'Văn phòng CoreStaff',
};

const WEEKDAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function getInitialMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export interface AttendanceHistoryViewProps {
  apiBase?: string | null;
}

export function AttendanceHistoryView({ apiBase: propApiBase }: AttendanceHistoryViewProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(getInitialMonth);
  const [activeDetailDay, setActiveDetailDay] = useState<DayAttendance | null>(null);
  const [days, setDays] = useState<DayAttendance[]>([]);
  const [summary, setSummary] = useState({
    workingDays: 0,
    lateDays: 0,
    earlyDays: 0,
    otDays: 0,
    otMinutes: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ nhớ đệm phía Client theo từng tháng để chuyển tháng tức thì (0ms)
  const monthCache = useRef<Map<string, { days: DayAttendance[]; summary: typeof summary }>>(new Map());

  const fetchHistory = useCallback(async (month: string) => {
    // 1. Kiểm tra cache trước: Nếu đã tải tháng này rồi thì nạp ngay không để user phải chờ
    const cached = monthCache.current.get(month);
    if (cached) {
      setDays(cached.days);
      setSummary(cached.summary);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const base = propApiBase || (await resolveApiBase()).base;
      const res = await getAttendanceHistory(base, month);
      
      const rawItems: any[] = res?.items || [];
      const mappedDays: DayAttendance[] = rawItems.map((item: any) => ({
        id: item._id || item.id || `att-${item.workDate}`,
        workDate: item.workDate,
        shiftName: item.shiftName || 'Ca Hành Chính',
        shiftHours: item.shiftHours || '08:00 – 17:30',
        workplace: item.workplaceName || item.workplace || 'Văn phòng CoreStaff',
        workplaceAddress: item.workplaceAddress || '',
        status: item.attendanceStatus || (item.workingMinutes ? 'COMPLETED' : 'DAY_OFF'),
        availableAction: 'NONE',
        attendanceMethod: (item.checkIn?.method || 'NETWORK') as AttendanceMethod,
        verificationContext: DEFAULT_NETWORK_CONTEXT,
        checkIn: item.checkIn
          ? {
              ...item.checkIn,
              evidenceUrl: item.checkIn.evidenceUrl ? apiUrl(base, item.checkIn.evidenceUrl) : null,
              status: item.checkIn.approvalStatus || 'AUTO_APPROVED',
            }
          : null,
        checkOut: item.checkOut
          ? {
              ...item.checkOut,
              evidenceUrl: item.checkOut.evidenceUrl ? apiUrl(base, item.checkOut.evidenceUrl) : null,
              status: item.checkOut.approvalStatus || 'AUTO_APPROVED',
            }
          : null,
        totalWorkingMinutes: item.workingMinutes ?? item.totalWorkingMinutes ?? 0,
        workingMinutes: item.workingMinutes,
        lateMinutes: item.lateMinutes ?? 0,
        earlyMinutes: item.earlyMinutes ?? 0,
        overtime: item.overtime ?? null,
      }));

      let calculatedSummary = {
        workingDays: 0,
        lateDays: 0,
        earlyDays: 0,
        otDays: 0,
        otMinutes: 0,
      };

      if (res?.summary) {
        calculatedSummary = {
          workingDays: res.summary.workingDays ?? 0,
          lateDays: res.summary.lateDays ?? 0,
          earlyDays: res.summary.earlyDays ?? 0,
          otDays: res.summary.otDays ?? 0,
          otMinutes: res.summary.otMinutes ?? 0,
        };
      } else {
        const completed = mappedDays.filter((d) => d.status === 'COMPLETED' || d.status === 'CHECKED_IN').length;
        const late = mappedDays.filter((d) => (d.lateMinutes || 0) > 0).length;
        const early = mappedDays.filter((d) => (d.earlyMinutes || 0) > 0).length;
        const otWithInfo = mappedDays.filter((d) => Boolean(d.overtime));
        const otMins = otWithInfo.reduce((acc, d) => acc + (d.overtime?.otMinutes || 0), 0);
        calculatedSummary = {
          workingDays: completed,
          lateDays: late,
          earlyDays: early,
          otDays: otWithInfo.length,
          otMinutes: otMins,
        };
      }

      setDays(mappedDays);
      setSummary(calculatedSummary);

      // Lưu vào cache
      monthCache.current.set(month, { days: mappedDays, summary: calculatedSummary });
    } catch (err: any) {
      console.error('Failed to fetch attendance history:', err);
      setError(err?.message || 'Không thể tải lịch sử chấm công');
    } finally {
      setIsLoading(false);
    }
  }, [propApiBase]);

  useEffect(() => {
    fetchHistory(selectedMonth);
  }, [selectedMonth, fetchHistory]);

  const daysMap = useMemo(() => {
    const map = new Map<string, DayAttendance>();
    for (const d of days) map.set(d.workDate, d);
    return map;
  }, [days]);

  // Month navigation
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const newY = prevDate.getFullYear();
    const newM = String(prevDate.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const newY = nextDate.getFullYear();
    const newM = String(nextDate.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  const formattedMonthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return `tháng ${m} năm ${y}`;
  }, [selectedMonth]);

  // Generate 7-column calendar cells for current month
  const calendarCells = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const totalDays = new Date(y, m, 0).getDate();
    // Monday is 1, Sunday is 0 -> offset
    const dayOfWeek = firstDay.getDay();
    const offset = (dayOfWeek - 1 + 7) % 7;

    const cells: (string | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      cells.push(`${selectedMonth}-${String(d).padStart(2, '0')}`);
    }
    return cells;
  }, [selectedMonth]);

  // Số hàng của lịch trong tháng (5 hoặc 6 hàng)
  const rowCount = Math.ceil(calendarCells.length / 7) || 5;

  return (
    <div className="w-full h-full flex flex-col justify-between space-y-2.5 sm:space-y-3 flex-1 min-h-0">
      {/* ── Subheader / Month Switcher Card ────────────────── */}
      <div className="rounded-xl sm:rounded-2xl bg-[#3f475b] p-3 sm:p-3.5 lg:px-6 lg:py-3 text-white flex items-center justify-between shadow-sm shrink-0">
        <div className="min-w-0 pr-2">
          <h2 className="text-sm sm:text-base lg:text-lg font-bold text-white truncate leading-tight">
            <span>Bảng công nhân viên</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-white/70 truncate mt-0.5 leading-tight">
            <span>{isLoading ? 'Đang cập nhật dữ liệu...' : `Tổng ${days.length} ngày ghi nhận`}</span>
          </p>
        </div>

        {/* Month Selector Pill */}
        <div className="flex items-center gap-1.5 lg:gap-2 rounded-lg bg-[#1c223a] px-2 py-1 lg:px-3 lg:py-1.5 shadow-xs shrink-0">
          <button
            type="button"
            aria-label="Tháng trước"
            onClick={handlePrevMonth}
            className="size-6 lg:size-7 rounded bg-[#272f4e] hover:bg-[#343e66] flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-xs lg:text-sm font-semibold text-white px-1 whitespace-nowrap">
            {formattedMonthLabel}
          </span>
          <button
            type="button"
            aria-label="Tháng sau"
            onClick={handleNextMonth}
            className="size-6 lg:size-7 rounded bg-[#272f4e] hover:bg-[#343e66] flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── 4 KPI Statistic Cards ──────────────────────────── */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:gap-4 shrink-0">
        {[
          { labelTop: 'Ngày', labelBottom: 'công', value: summary.workingDays },
          { labelTop: 'Ngày', labelBottom: 'đi muộn', value: summary.lateDays },
          { labelTop: 'Ngày', labelBottom: 'về sớm', value: summary.earlyDays },
          {
            labelTop: 'Tăng ca',
            labelBottom: 'OT (giờ)',
            value: summary.otMinutes > 0 ? (summary.otMinutes / 60).toFixed(1) : summary.otDays,
          },
        ].map((item) => (
          <div
            key={item.labelBottom}
            className="bg-[#1c223a] text-white rounded-xl sm:rounded-2xl py-2 sm:py-2.5 lg:py-3 px-2 flex flex-col items-center justify-center text-center shadow-md transition-transform active:scale-95"
          >
            <div className="text-[10px] sm:text-xs font-medium text-white/80 leading-tight flex flex-col sm:flex-row sm:gap-1 items-center justify-center">
              <span>{item.labelTop}</span>
              <span>{item.labelBottom}</span>
            </div>
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-white mt-0.5">
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Calendar Grid ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 justify-between py-1 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-slate-900/10 backdrop-blur-2xs rounded-xl flex items-center justify-center">
            <Loader2 className="size-7 text-primary animate-spin" />
          </div>
        )}

        {error && (
          <div className="mb-2 p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-center">
            {error}
          </div>
        )}

        {/* Weekday Names */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 lg:gap-3 text-center text-xs sm:text-sm font-bold text-slate-400 pb-1 shrink-0">
          {WEEKDAY_NAMES.map((d) => (
            <div key={d} className="py-0.5">
              {d}
            </div>
          ))}
        </div>

        {/* Day Cells - gridTemplateRows linh hoạt chia đều 1fr không bị tràn đè lên legend */}
        <div
          className="grid grid-cols-7 gap-1.5 sm:gap-2 lg:gap-2.5 flex-1 min-h-0 text-center"
          style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
        >
          {calendarCells.map((dateStr, idx) => {
            if (!dateStr) {
              return <div key={`blank-${idx}`} className="w-full h-full min-h-0" />;
            }
            const day = daysMap.get(dateStr);
            const dayNum = Number(dateStr.slice(-2));

            const isDayOff = day?.status === 'DAY_OFF';
            const hasRecord = Boolean(day);
            const hasOvertime = Boolean(day?.overtime);

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => {
                  if (day) setActiveDetailDay(day);
                }}
                disabled={!day}
                className="relative w-full h-full min-h-0 bg-[#1c223a] hover:bg-[#252c4a] text-white rounded-xl sm:rounded-2xl flex flex-col items-center justify-center gap-1 shadow-sm transition-transform active:scale-95 cursor-pointer disabled:cursor-default disabled:opacity-30"
              >
                <span className="text-xs sm:text-sm md:text-base font-bold text-white leading-none">
                  {dayNum}
                </span>

                {/* Status indicator dots */}
                <div className="flex items-center gap-1">
                  {hasRecord ? (
                    isDayOff ? (
                      <span className="size-1.5 sm:size-2 rounded-full bg-slate-400" title="Nghỉ" />
                    ) : (
                      <span
                        className="size-1.5 sm:size-2 rounded-full bg-[#3ae39f] shadow-[0_0_6px_#3ae39f]"
                        title="Đã chấm công"
                      />
                    )
                  ) : null}

                  {/* Overtime indicator dot */}
                  {hasOvertime && (
                    <span
                      className="size-1.5 sm:size-2 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]"
                      title="Có tăng ca (OT)"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Status Badges Legend ───────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2.5 pb-1 mt-auto shrink-0 border-t border-slate-700/30">
        <span className="flex items-center gap-1.5 bg-[#1c223a] text-white text-[10px] sm:text-xs font-medium px-3.5 py-1.5 rounded-full shadow-xs">
          <span className="size-1.5 sm:size-2 rounded-full bg-[#3ae39f]" />
          Đã chấm công
        </span>
        <span className="flex items-center gap-1.5 bg-[#1c223a] text-white text-[10px] sm:text-xs font-medium px-3.5 py-1.5 rounded-full shadow-xs">
          <span className="size-1.5 sm:size-2 rounded-full bg-indigo-400" />
          Có OT được duyệt
        </span>
        <span className="flex items-center gap-1.5 bg-[#1c223a] text-white text-[10px] sm:text-xs font-medium px-3.5 py-1.5 rounded-full shadow-xs">
          <span className="size-1.5 sm:size-2 rounded-full bg-slate-400" />
          Nghỉ phép / Lễ
        </span>
      </div>

      {/* ── Evidence & Detail Modal ────────────────────────── */}
      <DayDetailModal
        isOpen={Boolean(activeDetailDay)}
        onClose={() => setActiveDetailDay(null)}
        day={activeDetailDay}
      />
    </div>
  );
}
