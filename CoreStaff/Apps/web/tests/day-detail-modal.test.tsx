/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DayDetailModal, calculateDayWorkCredit } from '../src/screens/Attendance/components/DayDetailModal';
import type { DayAttendance } from '../src/screens/Attendance/types';

jest.mock('../src/config/api', () => ({
  resolveApiBase: async () => ({ base: 'https://api.test' }),
  apiUrl: (base: string, path: string) => base + path,
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

describe('DayDetailModal & Work Credit Calculation', () => {
  test('calculates 1.0 công for regular work day above 90% obligation', () => {
    const day: DayAttendance = {
      id: 'day-1',
      workDate: '2026-10-06',
      shiftName: 'Ca Hành Chính',
      shiftHours: '08:00 – 17:30',
      workplace: 'Văn phòng CoreStaff',
      workplaceAddress: '',
      status: 'LATE',
      availableAction: 'NONE',
      attendanceMethod: 'GPS',
      lateMinutes: 19,
      workingMinutes: 461,
      totalWorkingMinutes: 461,
      checkIn: { eventId: 'e1', method: 'GPS', recordedAt: '2026-10-06T08:19:00Z' },
      checkOut: { eventId: 'e2', method: 'GPS', recordedAt: '2026-10-06T17:19:00Z' },
    };

    const credit = calculateDayWorkCredit(day, 'LATE');
    expect(credit.credit).toBe(1);
    expect(credit.label).toBe('1.0 công');
    expect(credit.ratioPercent).toBe(96);
    expect(credit.isProvisional).toBe(false);
  });

  test('calculates 0.5 công for half day work between 50% and 90%', () => {
    const day: DayAttendance = {
      id: 'day-2',
      workDate: '2026-10-07',
      shiftName: 'Ca Hành Chính',
      shiftHours: '08:00 – 17:30',
      workplace: 'Văn phòng CoreStaff',
      workplaceAddress: '',
      status: 'EARLY_LEAVE',
      availableAction: 'NONE',
      attendanceMethod: 'GPS',
      workingMinutes: 260,
      totalWorkingMinutes: 260,
      earlyMinutes: 220,
    };

    const credit = calculateDayWorkCredit(day, 'EARLY_LEAVE');
    expect(credit.credit).toBe(0.5);
    expect(credit.label).toBe('0.5 công');
  });

  test('renders 3 summary cards and status badge without detailed minutes', async () => {
    const day: DayAttendance = {
      id: 'day-1',
      workDate: '2026-10-06',
      shiftName: 'Ca Hành Chính',
      shiftHours: '08:00 – 17:30',
      workplace: 'Văn phòng CoreStaff',
      workplaceAddress: '',
      status: 'LATE',
      availableAction: 'NONE',
      attendanceMethod: 'GPS',
      lateMinutes: 19,
      workingMinutes: 461,
      totalWorkingMinutes: 461,
      checkIn: { eventId: 'e1', method: 'GPS', recordedAt: '2026-10-06T08:19:00Z' },
      checkOut: { eventId: 'e2', method: 'GPS', recordedAt: '2026-10-06T17:19:00Z' },
    };

    await act(async () => {
      root.render(<DayDetailModal isOpen={true} onClose={() => {}} day={day} />);
    });

    // Verify 3 cards
    expect(container.textContent).toContain('Trạng thái');
    expect(container.textContent).toContain('Tổng thời gian');
    expect(container.textContent).toContain('Ngày công');

    // Verify status badge has "Đi trễ" but NOT "· 19 phút"
    expect(container.textContent).toContain('Đi trễ');
    expect(container.textContent).not.toContain('Đi trễ · 19 phút');

    // Verify work credit
    expect(container.textContent).toContain('1.0 công');

    // Toggle Accordion to view calculation details
    const accordionBtn = container.querySelector<HTMLButtonElement>('button:has(svg.lucide-calculator)')
      || Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Chi tiết quy đổi công'));
    expect(accordionBtn).not.toBeNull();

    await act(async () => {
      accordionBtn!.click();
    });

    expect(container.textContent).toContain('Tỷ lệ hoàn thành ca');
    expect(container.textContent).toContain('96%');
    expect(container.textContent).toContain('Tiêu chuẩn 1.0 công');
  });

  test('renders 0 công (Tạm tính) when punches are missing (FORGOTTEN)', async () => {
    const day: DayAttendance = {
      id: 'day-forgotten',
      workDate: '2026-10-05',
      shiftName: 'Ca Hành Chính',
      shiftHours: '08:00 – 17:30',
      workplace: 'Văn phòng CoreStaff',
      workplaceAddress: '',
      status: 'NOT_CHECKED_IN',
      availableAction: 'NONE',
      attendanceMethod: 'GPS',
      checkIn: { eventId: 'e1', method: 'GPS', recordedAt: '2026-10-05T08:00:00Z' },
      checkOut: null,
    };

    await act(async () => {
      root.render(<DayDetailModal isOpen={true} onClose={() => {}} day={day} />);
    });

    expect(container.textContent).toContain('Quên chấm công');
    expect(container.textContent).toContain('0 công');
    expect(container.textContent).toContain('Tạm tính');
  });
});

