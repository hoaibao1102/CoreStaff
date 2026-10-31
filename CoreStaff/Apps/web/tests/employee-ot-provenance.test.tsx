/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { LeaveOvertimeScreen } from '../src/screens/Employee/EmployeeWorkScreens';

jest.mock('../src/config/api', () => ({ resolveApiBase: async () => ({ base: 'base' }), apiUrl: (base: string, path: string) => base + path }));
jest.mock('../src/services/socket', () => ({ getSocket: () => ({ on: jest.fn(), off: jest.fn() }) }));
jest.mock('../src/components/toast', () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));

it.each([
  { checkIn: 'CONFIRMED_SCHEDULE', checkOut: 'OBSERVED', expectedOut: 'OBSERVED' },
  { checkIn: { source: 'CONFIRMED_SCHEDULE' }, checkOut: { source: 'OBSERVED' }, expectedOut: 'OBSERVED' },
  { checkIn: { source: 'CONFIRMED_SCHEDULE' }, checkOut: undefined, expectedOut: '—' },
])('displays OT endpoint provenance for $checkIn and $checkOut', async ({ checkIn, checkOut, expectedOut }) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, '', '/app/ot');
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (url) => ({
    ok: true, status: 200,
    text: async () => JSON.stringify({ success: true, data: String(url).includes('/overtime/preview')
      ? { workDate: new Date().toISOString().slice(0, 10), calculationContract: 'OVERTIME_V2', canFile: false, blockedReasons: [], provenance: { checkIn, checkOut } }
      : String(url).includes('/schedule') ? { scheduled: null } : String(url).includes('confirmation-preview') ? { enabled: false } : [] }),
  } as Response));
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<LeaveOvertimeScreen />));
    await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Tạo yêu cầu'))!.click());
    await act(async () => Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('Chuyển sang OT'))!.click());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    expect(document.querySelector('[role=dialog]')!.textContent).toContain(`Nguồn vào: CONFIRMED_SCHEDULE · Nguồn ra: ${expectedOut}`);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    global.fetch = originalFetch;
  }
});
