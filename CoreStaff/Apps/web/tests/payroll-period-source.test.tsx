/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PayrollRunScreen } from '../src/screens/hr/PayrollRunScreen';

let root: Root;
let container: HTMLDivElement;
let fetchMock: jest.Mock;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  fetchMock = jest.fn(async (url: string) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      success: true,
      data: url.endsWith('/api/hr/timesheet-periods')
        ? [{ _id: 'period-09', period: '2026-09', status: 'CLOSED', startDate: '2026-09-01', endDate: '2026-09-30' }]
        : [],
    }),
  }));
  globalThis.fetch = fetchMock;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

test('loads eligible payroll periods from the API base resolved by the workspace', async () => {
  await act(async () => {
    root.render(<PayrollRunScreen apiBase="http://workspace-api.test" organizationId="org1" />);
  });

  expect(fetchMock).toHaveBeenCalledWith(
    'http://workspace-api.test/api/hr/timesheet-periods',
    expect.objectContaining({ credentials: 'include' }),
  );

  const createButton = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Tạo Bảng Lương'))!;
  await act(async () => createButton.click());
  expect(container.textContent).toContain('2026-09');
  expect(container.textContent).toContain('Đã chốt');
});

test('offers recalculation only for a calculated payroll run and calls the recalculate endpoint', async () => {
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      success: true,
      data: url.endsWith('/api/payroll-runs') && (!options?.method || options.method === 'GET')
        ? [{
            _id: 'run-09',
            organizationId: 'org1',
            timesheetPeriodId: 'period-09',
            periodLabel: '2026-09',
            status: 'CALCULATED',
            runDate: '2026-10-01',
            totalGross: 120_017_500,
            totalNet: 110_696_775,
            processedEmployeeCount: 6,
            totalEmployeeCount: 6,
          }]
        : url.endsWith('/api/hr/timesheet-periods')
          ? []
          : {},
    }),
  }));
  jest.spyOn(window, 'confirm').mockReturnValue(true);

  await act(async () => {
    root.render(<PayrollRunScreen apiBase="http://workspace-api.test" organizationId="org1" />);
  });

  const recalculateButton = [...container.querySelectorAll('button')].find(
    button => button.textContent?.includes('Tính lại'),
  )!;
  expect(recalculateButton).toBeTruthy();

  await act(async () => recalculateButton.click());

  expect(fetchMock).toHaveBeenCalledWith(
    'http://workspace-api.test/api/payroll-runs/run-09/recalculate',
    expect.objectContaining({ method: 'PUT', credentials: 'include' }),
  );
});
