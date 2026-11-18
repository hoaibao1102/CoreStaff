/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BlockerDayDetailDialog } from '../src/screens/timesheet/components/BlockerDayDetailDialog';
import { hrRequest } from '../src/services/hrService';

jest.mock('../src/services/hrService', () => {
  const actual = jest.requireActual('../src/services/hrService');
  return { ...actual, hrRequest: jest.fn(), getPeriodDayDetail: jest.fn() };
});

const getPeriodDayDetail = jest.requireMock('../src/services/hrService').getPeriodDayDetail as jest.Mock;

const blocker = (overrides: Record<string, unknown> = {}) => ({
  id: 'day1:MISSING_CHECK_OUT',
  type: 'MISSING_CHECK_OUT',
  attendanceDayId: 'day1',
  employeeId: 'emp1',
  employee: { name: 'Nguyễn Văn A', code: 'NV-01', department: 'Kỹ thuật' },
  date: '2026-10-21',
  note: 'Thiếu check-out',
  checkInAt: '2026-10-21T01:00:00Z',
  checkOutAt: null,
  ...overrides,
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  getPeriodDayDetail.mockResolvedValue({
    day: { workDate: '2026-10-21', dayResult: 'INCOMPLETE', workdayType: 'WORKING_DAY', overallApprovalStatus: 'CLARIFICATION_REQUESTED', checkInAt: '2026-10-21T01:00:00Z', checkOutAt: null },
    events: [],
    request: null,
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

async function render(b: any) {
  await act(async () => {
    root.render(
      <BlockerDayDetailDialog
        open
        onOpenChange={() => {}}
        apiBase="https://api.test"
        periodId="period1"
        blocker={b as any}
      />,
    );
  });
  await act(async () => { await Promise.resolve(); });
}

describe('BlockerDayDetailDialog explanation guard (QC 2.1)', () => {
  test('offers the explanation request when none is open yet', async () => {
    await render(blocker());
    expect(document.body.textContent).toContain('Yêu cầu NV giải trình');
    expect(document.body.textContent).not.toContain('Đã yêu cầu giải trình');
  });

  test('replaces the button with a status badge once an explanation is open', async () => {
    await render(blocker({ hasOpenExplanation: true, openRequestStatus: 'CLARIFICATION_REQUESTED' }));
    expect(document.body.textContent).not.toContain('Yêu cầu NV giải trình');
    expect(document.body.textContent).toContain('Đã yêu cầu giải trình');
    expect(document.body.textContent).toContain('Chờ giải trình');
    // Forfeiting the day must still be possible.
    expect(document.body.textContent).toContain('Xác nhận mất ngày công');
  });

  test('still lets HR forfeit the day when the request was already answered', async () => {
    await render(blocker({ hasOpenExplanation: true, openRequestStatus: 'PENDING' }));
    expect(document.body.textContent).toContain('Đã yêu cầu giải trình');
    expect(document.body.textContent).toContain('Xác nhận mất ngày công');
    expect(hrRequest).toBeDefined();
  });
});
