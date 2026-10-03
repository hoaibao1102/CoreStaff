/** @jest-environment jsdom */
import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { navigationEvent } from '../src/components/AppLink';
import { DayDetailModal } from '../src/screens/Attendance/components/DayDetailModal';
import type { DayAttendance } from '../src/screens/Attendance/types';
import { LeaveOvertimeScreen } from '../src/screens/Employee/EmployeeWorkScreens';

jest.mock('../src/config/api', () => ({
  resolveApiBase: async () => ({ base: 'https://api.test' }),
  apiUrl: (base: string, path: string) => base + path,
}));
jest.mock('../src/services/socket', () => ({
  getSocket: () => ({ on: jest.fn(), off: jest.fn() }),
}));
jest.mock('../src/components/toast', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

const workDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
let container: HTMLDivElement;
let root: Root;
let submitted: Record<string, unknown> | null;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, '', '/app/attendance/history');
  submitted = null;
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, options?: RequestInit) => {
    if (options?.method === 'POST') submitted = JSON.parse(String(options.body));
    const data = options?.method === 'POST' ? { _id: 'request-1' } : [];
    return {
      ok: true, status: 200,
      text: async () => JSON.stringify({ success: true, data }),
    } as Response;
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

function Flow({ day }: { day: DayAttendance }) {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const navigate = () => setPath(window.location.pathname);
    window.addEventListener(navigationEvent, navigate);
    return () => window.removeEventListener(navigationEvent, navigate);
  }, []);
  return path === '/app/ot'
    ? <LeaveOvertimeScreen />
    : <DayDetailModal isOpen onClose={() => {}} day={day} />;
}

test.each(['CHECK_IN', 'CHECK_OUT'] as const)(
  'opens the adjustment form from a forgotten %s and submits the selected date and punch',
  async (adjustmentType) => {
    const checkInAt = adjustmentType === 'CHECK_OUT' ? `${workDate}T01:08:00Z` : undefined;
    const day: DayAttendance = {
      id: 'day-1', workDate, shiftName: 'Ca hành chính', shiftHours: '08:00–17:00',
      workplace: 'Văn phòng', workplaceAddress: '', workdayType: 'WORKING_DAY',
      status: checkInAt ? 'CHECKED_IN' : 'NOT_CHECKED_IN', availableAction: 'NONE',
      attendanceMethod: 'NETWORK', verificationContext: { method: 'SELFIE' }, checkInAt,
      checkIn: checkInAt ? {
        eventId: 'event-1', method: 'NETWORK', recordedAt: checkInAt, networkName: 'Office',
      } : null,
    };
    await act(async () => root.render(<Flow day={day} />));

    const link = container.querySelector<HTMLAnchorElement>('a[href^="/app/ot?"]');
    expect(link?.textContent).toContain('Gửi yêu cầu điều chỉnh công');
    await act(async () => link!.click());

    expect(window.location.pathname).toBe('/app/ot');
    const form = document.body.querySelector<HTMLFormElement>('form')!;
    expect(form).not.toBeNull();
    expect(form.querySelector<HTMLInputElement>('input[type="date"]')?.value).toBe(workDate);
    expect(form.querySelector('select')?.value).toBe(adjustmentType);
    const time = form.querySelector<HTMLInputElement>('input[type="time"]')!;
    expect(time.value).toBe('');
    const reason = form.querySelector('textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(time, '17:00');
      time.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'Tôi quên chấm công, vui lòng kiểm tra và bổ sung.');
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    expect(submitted).toEqual({
      type: 'ATTENDANCE', workDate, adjustmentType,
      reason: 'Tôi quên chấm công, vui lòng kiểm tra và bổ sung.',
      requestedStart: `${workDate}T17:00:00+07:00`,
    });
  },
);
