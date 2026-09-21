import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Bell,
} from 'lucide-react';
import type { DayAttendance, NetworkVerification } from '../types';
import { DayDetailModal } from './DayDetailModal';

const DEFAULT_NETWORK_CONTEXT: NetworkVerification = {
  method: 'NETWORK',
  status: 'CONNECTED_TO_ALLOWED_NETWORK',
  canAttend: true,
  networkId: 'net-office-1',
  networkName: 'CoreStaff-Office-5G',
  workplaceId: 'wp-q8',
  workplaceName: 'Văn phòng CoreStaff Quận 8',
};

const DEFAULT_DAY_OFF_CONTEXT: NetworkVerification = {
  method: 'NETWORK',
  status: 'NOT_CONNECTED_TO_ALLOWED_NETWORK',
  canAttend: false,
  networkId: null,
  networkName: null,
  workplaceId: null,
  workplaceName: null,
};

// Mock list of days with full evidence matching the 14 days work, 2 late, 2 early, 0 absence
const MOCK_HISTORY_DAYS: DayAttendance[] = [
  {
    id: 'att-1',
    workDate: '2026-09-01',
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'COMPLETED',
    availableAction: 'NONE',
    attendanceMethod: 'NETWORK',
    verificationContext: DEFAULT_NETWORK_CONTEXT,
    checkIn: {
      eventId: 'evt-in-1',
      recordedAt: '2026-09-01T08:00:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    checkOut: {
      eventId: 'evt-out-1',
      recordedAt: '2026-09-01T17:30:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    totalWorkingMinutes: 480,
  },
  {
    id: 'att-2',
    workDate: '2026-09-02',
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'COMPLETED',
    availableAction: 'NONE',
    attendanceMethod: 'GPS',
    verificationContext: { method: 'GPS', workplace: null },
    checkIn: {
      eventId: 'evt-in-2',
      recordedAt: '2026-09-02T07:55:00Z',
      method: 'GPS',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      accuracyMeters: 12,
      distanceMeters: 18,
      address: '123 Đường mẫu, Quận 8, TP.HCM',
    },
    checkOut: {
      eventId: 'evt-out-2',
      recordedAt: '2026-09-02T17:32:00Z',
      method: 'GPS',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      accuracyMeters: 10,
      distanceMeters: 15,
      address: '123 Đường mẫu, Quận 8, TP.HCM',
    },
    totalWorkingMinutes: 485,
  },
  {
    id: 'att-3',
    workDate: '2026-09-03',
    shiftName: 'Ca Hiện Trường',
    shiftHours: '08:00 – 17:30',
    workplace: 'Địa bàn Khách Hàng Quận 1',
    workplaceAddress: 'Toà nhà Bitexco, Bến Nghé, Quận 1, TP.HCM',
    status: 'COMPLETED',
    availableAction: 'NONE',
    attendanceMethod: 'SELFIE',
    verificationContext: { method: 'SELFIE' },
    checkIn: {
      eventId: 'evt-in-3',
      recordedAt: '2026-09-03T08:05:00Z',
      method: 'SELFIE',
      workplaceName: 'Địa bàn Khách Hàng Quận 1',
      status: 'AUTO_APPROVED',
      approvalStatus: 'APPROVED',
      evidence: {
        previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
      },
      location: {
        latitude: 10.7718,
        longitude: 106.7042,
        accuracyMeters: 8,
        address: 'Số 2 Hải Triều, Bến Nghé, Quận 1, TP.HCM',
      },
    },
    checkOut: {
      eventId: 'evt-out-3',
      recordedAt: '2026-09-03T17:30:00Z',
      method: 'SELFIE',
      workplaceName: 'Địa bàn Khách Hàng Quận 1',
      status: 'AUTO_APPROVED',
      approvalStatus: 'APPROVED',
      evidence: {
        previewUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
      },
      location: {
        latitude: 10.7718,
        longitude: 106.7042,
        accuracyMeters: 10,
        address: 'Số 2 Hải Triều, Bến Nghé, Quận 1, TP.HCM',
      },
    },
    totalWorkingMinutes: 480,
  },
  {
    id: 'att-4',
    workDate: '2026-09-04',
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'EARLY_LEAVE',
    availableAction: 'NONE',
    attendanceMethod: 'NETWORK',
    verificationContext: DEFAULT_NETWORK_CONTEXT,
    checkIn: {
      eventId: 'evt-in-4',
      recordedAt: '2026-09-04T08:00:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    checkOut: {
      eventId: 'evt-out-4',
      recordedAt: '2026-09-04T17:00:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    totalWorkingMinutes: 450,
  },
  {
    id: 'att-5',
    workDate: '2026-09-05',
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'COMPLETED',
    availableAction: 'NONE',
    attendanceMethod: 'NETWORK',
    verificationContext: DEFAULT_NETWORK_CONTEXT,
    checkIn: {
      eventId: 'evt-in-5',
      recordedAt: '2026-09-05T07:58:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    checkOut: {
      eventId: 'evt-out-5',
      recordedAt: '2026-09-05T17:35:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    totalWorkingMinutes: 485,
  },
  {
    id: 'att-6',
    workDate: '2026-09-06',
    shiftName: 'Chủ Nhật',
    shiftHours: 'Nghỉ',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'DAY_OFF',
    availableAction: 'NONE',
    attendanceMethod: 'NETWORK',
    verificationContext: DEFAULT_DAY_OFF_CONTEXT,
  },
  {
    id: 'att-7',
    workDate: '2026-09-07',
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'COMPLETED',
    availableAction: 'NONE',
    attendanceMethod: 'NETWORK',
    verificationContext: DEFAULT_NETWORK_CONTEXT,
    checkIn: {
      eventId: 'evt-in-7',
      recordedAt: '2026-09-07T08:01:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    checkOut: {
      eventId: 'evt-out-7',
      recordedAt: '2026-09-07T17:31:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    totalWorkingMinutes: 482,
  },
  {
    id: 'att-8',
    workDate: '2026-09-08',
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'EARLY_LEAVE',
    availableAction: 'NONE',
    attendanceMethod: 'GPS',
    verificationContext: { method: 'GPS', workplace: null },
    checkIn: {
      eventId: 'evt-in-8',
      recordedAt: '2026-09-08T07:59:00Z',
      method: 'GPS',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      accuracyMeters: 14,
      distanceMeters: 20,
      address: '123 Đường mẫu, Quận 8, TP.HCM',
    },
    checkOut: {
      eventId: 'evt-out-8',
      recordedAt: '2026-09-08T17:05:00Z',
      method: 'GPS',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      accuracyMeters: 15,
      distanceMeters: 22,
      address: '123 Đường mẫu, Quận 8, TP.HCM',
    },
    totalWorkingMinutes: 455,
  },
  {
    id: 'att-9',
    workDate: '2026-09-09',
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'COMPLETED',
    availableAction: 'NONE',
    attendanceMethod: 'NETWORK',
    verificationContext: DEFAULT_NETWORK_CONTEXT,
    checkIn: {
      eventId: 'evt-in-9',
      recordedAt: '2026-09-09T08:03:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    checkOut: {
      eventId: 'evt-out-9',
      recordedAt: '2026-09-09T17:33:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    totalWorkingMinutes: 481,
  },
  {
    id: 'att-10',
    workDate: '2026-09-10',
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'LATE',
    availableAction: 'NONE',
    attendanceMethod: 'GPS',
    verificationContext: { method: 'GPS', workplace: null },
    checkIn: {
      eventId: 'evt-in-10',
      recordedAt: '2026-09-10T08:24:00Z',
      method: 'GPS',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      accuracyMeters: 14,
      distanceMeters: 30,
      address: '123 Đường mẫu, Quận 8, TP.HCM',
    },
    checkOut: {
      eventId: 'evt-out-10',
      recordedAt: '2026-09-10T17:35:00Z',
      method: 'GPS',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      accuracyMeters: 12,
      distanceMeters: 25,
      address: '123 Đường mẫu, Quận 8, TP.HCM',
    },
    totalWorkingMinutes: 491,
  },
  {
    id: 'att-11',
    workDate: '2026-09-11',
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'COMPLETED',
    availableAction: 'NONE',
    attendanceMethod: 'NETWORK',
    verificationContext: DEFAULT_NETWORK_CONTEXT,
    checkIn: {
      eventId: 'evt-in-11',
      recordedAt: '2026-09-11T08:00:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    checkOut: {
      eventId: 'evt-out-11',
      recordedAt: '2026-09-11T17:30:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    totalWorkingMinutes: 480,
  },
  {
    id: 'att-12',
    workDate: '2026-09-12',
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'COMPLETED',
    availableAction: 'NONE',
    attendanceMethod: 'NETWORK',
    verificationContext: DEFAULT_NETWORK_CONTEXT,
    checkIn: {
      eventId: 'evt-in-12',
      recordedAt: '2026-09-12T08:02:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    checkOut: {
      eventId: 'evt-out-12',
      recordedAt: '2026-09-12T17:32:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    totalWorkingMinutes: 482,
  },
  {
    id: 'att-13',
    workDate: '2026-09-13',
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'COMPLETED',
    availableAction: 'NONE',
    attendanceMethod: 'NETWORK',
    verificationContext: DEFAULT_NETWORK_CONTEXT,
    checkIn: {
      eventId: 'evt-in-13',
      recordedAt: '2026-09-13T08:00:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    checkOut: {
      eventId: 'evt-out-13',
      recordedAt: '2026-09-13T17:30:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    totalWorkingMinutes: 480,
  },
  {
    id: 'att-14',
    workDate: '2026-09-14',
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'COMPLETED',
    availableAction: 'NONE',
    attendanceMethod: 'GPS',
    verificationContext: { method: 'GPS', workplace: null },
    checkIn: {
      eventId: 'evt-in-14',
      recordedAt: '2026-09-14T07:58:00Z',
      method: 'GPS',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      accuracyMeters: 16,
      distanceMeters: 15,
      address: '123 Đường mẫu, Quận 8, TP.HCM',
    },
    checkOut: {
      eventId: 'evt-out-14',
      recordedAt: '2026-09-14T17:32:00Z',
      method: 'GPS',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      accuracyMeters: 18,
      distanceMeters: 20,
      address: '123 Đường mẫu, Quận 8, TP.HCM',
    },
    totalWorkingMinutes: 484,
  },
  {
    id: 'att-15',
    workDate: '2026-09-15',
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'LATE',
    availableAction: 'NONE',
    attendanceMethod: 'NETWORK',
    verificationContext: DEFAULT_NETWORK_CONTEXT,
    checkIn: {
      eventId: 'evt-in-15',
      recordedAt: '2026-09-15T08:35:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    checkOut: {
      eventId: 'evt-out-15',
      recordedAt: '2026-09-15T17:30:00Z',
      method: 'NETWORK',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
      status: 'AUTO_APPROVED',
      networkName: 'CoreStaff-Office-5G',
    },
    totalWorkingMinutes: 460,
  },
  {
    id: 'att-16',
    workDate: '2026-09-16',
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'DAY_OFF',
    availableAction: 'NONE',
    attendanceMethod: 'NETWORK',
    verificationContext: DEFAULT_DAY_OFF_CONTEXT,
  },
];

const WEEKDAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function AttendanceHistoryView() {
  const [selectedMonth, setSelectedMonth] = useState('2026-09');
  const [activeDetailDay, setActiveDetailDay] = useState<DayAttendance | null>(null);

  const daysMap = useMemo(() => {
    const map = new Map<string, DayAttendance>();
    for (const d of MOCK_HISTORY_DAYS) map.set(d.workDate, d);
    return map;
  }, []);

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

  return (
    <div className="w-full max-w-md md:max-w-xl mx-auto space-y-3.5 pb-8">
      {/* ── Top App Bar (Mobile style) ────────────────────────── */}
      <header className="flex items-center justify-between pt-1 pb-2">
        {/* Avatar */}
        <div className="relative">
          <div className="size-10 rounded-full border-2 border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center shadow-xs">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              alt="Avatar"
              className="size-full object-cover"
            />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold tracking-tight text-[#102a43]">
          Chấm công
        </h1>

        {/* Bell notification */}
        <button
          type="button"
          aria-label="Thông báo"
          className="relative size-10 rounded-full flex items-center justify-center text-[#102a43] hover:bg-slate-100 transition-colors"
        >
          <Bell className="size-6" />
          <span className="absolute top-2 right-2 size-2.5 rounded-full bg-pink-400 ring-2 ring-white" />
        </button>
      </header>

      {/* ── Subheader / Month Switcher Card ────────────────── */}
      <div className="rounded-2xl bg-[#3f475b] p-3.5 sm:p-4 text-white flex items-center justify-between shadow-sm">
        <div className="min-w-0 pr-2">
          <h2 className="text-sm sm:text-base font-bold text-white truncate leading-tight">
            Lịch sử chấm...
          </h2>
          <p className="text-xs text-white/70 truncate mt-0.5 leading-tight">
            Bảng chấm công th...
          </p>
        </div>

        {/* Month Selector Pill */}
        <div className="flex items-center gap-1.5 rounded-xl bg-[#1c223a] px-2 py-1.5 shadow-xs shrink-0">
          <button
            type="button"
            aria-label="Tháng trước"
            onClick={() => setSelectedMonth('2026-08')}
            className="size-6 rounded-lg bg-[#272f4e] hover:bg-[#343e66] flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-xs font-semibold text-white px-1 whitespace-nowrap">
            tháng 9 năm 2026
          </span>
          <button
            type="button"
            aria-label="Tháng sau"
            onClick={() => setSelectedMonth('2026-09')}
            className="size-6 rounded-lg bg-[#272f4e] hover:bg-[#343e66] flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── 4 KPI Statistic Cards ──────────────────────────── */}
      <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
        {[
          { labelTop: 'Ngày', labelBottom: 'công', value: '14' },
          { labelTop: 'Ngày', labelBottom: 'đi muộn', value: '2' },
          { labelTop: 'Ngày', labelBottom: 'về sớm', value: '2' },
          { labelTop: 'Ngày', labelBottom: 'vắng', value: '0' },
        ].map((item) => (
          <div
            key={item.labelBottom}
            className="bg-[#1c223a] text-white rounded-2xl py-3 px-1 sm:py-4 sm:px-2 flex flex-col items-center justify-center text-center shadow-md transition-transform active:scale-95"
          >
            <div className="text-[11px] sm:text-xs font-medium text-white/80 leading-tight h-[28px] flex flex-col items-center justify-center">
              <span>{item.labelTop}</span>
              <span>{item.labelBottom}</span>
            </div>
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-white mt-1">
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Calendar Grid ──────────────────────────────────── */}
      <div className="pt-2">
        {/* Weekday Names */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs font-bold text-slate-400 pb-2">
          {WEEKDAY_NAMES.map((d) => (
            <div key={d} className="py-0.5">
              {d}
            </div>
          ))}
        </div>

        {/* Day Cells */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center">
          {calendarCells.map((dateStr, idx) => {
            if (!dateStr) {
              return <div key={`blank-${idx}`} className="aspect-square" />;
            }
            const day = daysMap.get(dateStr);
            const dayNum = Number(dateStr.slice(-2));

            // Dot color matching the user's design:
            // - Days 1 to 15 (except 6): mint green dot
            // - Days 6 & 16: white/slate dot for DAY_OFF
            // - Days 17+: future days, no dot
            const isDayOff = day?.status === 'DAY_OFF';
            const hasRecord = Boolean(day);

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => {
                  if (day) setActiveDetailDay(day);
                }}
                disabled={!day}
                className="aspect-square bg-[#1c223a] hover:bg-[#252c4a] text-white rounded-xl sm:rounded-2xl flex flex-col items-center justify-center gap-1 shadow-sm transition-transform active:scale-95 cursor-pointer disabled:cursor-default"
              >
                <span className="text-sm sm:text-base font-bold text-white leading-none">
                  {dayNum}
                </span>

                {hasRecord ? (
                  isDayOff ? (
                    <span className="size-1.5 rounded-full bg-slate-300" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-[#3ae39f] shadow-[0_0_6px_#3ae39f]" />
                  )
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Status Badges Legend ───────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 pt-3 pb-4">
        <span className="bg-[#1c223a] text-white text-[11px] sm:text-xs font-medium px-4 py-1.5 rounded-full shadow-xs">
          Chưa vào
        </span>
        <span className="bg-[#0c395b] text-white text-[11px] sm:text-xs font-medium px-4 py-1.5 rounded-full shadow-xs">
          Đã vào
        </span>
        <span className="bg-[#0e6f3b] text-white text-[11px] sm:text-xs font-medium px-4 py-1.5 rounded-full shadow-xs">
          Hoàn
        </span>
        <span className="bg-[#8f520a] text-white text-[11px] sm:text-xs font-medium px-4 py-1.5 rounded-full shadow-xs">
          Chờ
        </span>
        <span className="bg-[#1c223a] text-white text-[11px] sm:text-xs font-medium px-4 py-1.5 rounded-full shadow-xs">
          Nghỉ
        </span>
        <span className="text-slate-500 text-[11px] sm:text-xs font-medium px-2 py-1 leading-tight flex flex-col items-center">
          <span>Đã</span>
          <span>khóa</span>
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
