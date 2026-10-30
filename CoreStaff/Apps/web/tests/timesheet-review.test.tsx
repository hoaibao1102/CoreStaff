/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EmployeeTimesheetReviewScreen } from '../src/screens/Employee/EmployeeTimesheetReviewScreen';
import * as hr from '../src/services/hrService';

jest.mock('../src/services/hrService');
const review = { periodId: 'p1', periodKey: '2026-10', periodVersion: 2, projectionHash: 'a'.repeat(64), state: 'PENDING' as const, standardWorkUnits: 1, standardWorkMinutes: 480, payableWorkUnits: 1, hasUnresolvedDays: false, canAcknowledge: true, days: [{ workDate: '2026-10-01', scheduledObligationMinutes: 480, workedScheduledMinutes: 480, payableLeaveMinutes: 0, unpaidLeaveMinutes: 0, overtimeMinutes: 0, workCredit: 1, reasonCode: 'FULL_CREDIT' }], history: [] };
let root: Root; let container: HTMLDivElement;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); (hr.listMyTimesheetReviews as jest.Mock).mockResolvedValue([{ periodId: 'p1', periodKey: '2026-10', periodVersion: 2, state: 'PENDING' }]); (hr.getMyTimesheetReview as jest.Mock).mockResolvedValue(review); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.clearAllMocks(); });
it('renders current review and requires an explicit acknowledgement confirmation', async () => { await act(async () => root.render(<EmployeeTimesheetReviewScreen apiBase="api" />)); await act(async () => { await Promise.resolve(); await Promise.resolve(); }); expect(container.textContent).toContain('Rà soát bảng công'); expect(container.textContent).toContain('Đã kiểm tra — thông tin chính xác'); const button = [...container.querySelectorAll('button')].find(x => x.textContent?.includes('Đã kiểm tra'))!; await act(async () => button.click()); expect(container.textContent).toContain('Xác nhận thông tin chính xác'); });
it('submits the reviewed version when the employee confirms', async () => {
  (hr.acknowledgeMyTimesheetReview as jest.Mock).mockResolvedValue({ ...review, state: 'ACKNOWLEDGED' });
  await act(async () => root.render(<EmployeeTimesheetReviewScreen apiBase="api" />));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  const openButton = [...document.body.querySelectorAll('button')].find((button) => button.textContent?.includes('Đã kiểm tra'))!;
  await act(async () => openButton.click());
  const confirmButton = [...document.body.querySelectorAll('button')].find((button) => button.textContent === 'Xác nhận')!;
  await act(async () => { confirmButton.click(); await Promise.resolve(); await Promise.resolve(); });
  expect(hr.acknowledgeMyTimesheetReview).toHaveBeenCalledWith('api', 'p1', 2, 'a'.repeat(64));
  expect(container.textContent).toContain('Bạn đã xác nhận thông tin bảng công chính xác.');
});
it('requires a meaningful dispute reason', async () => { await act(async () => root.render(<EmployeeTimesheetReviewScreen apiBase="api" />)); await act(async () => { await Promise.resolve(); await Promise.resolve(); }); const button = [...container.querySelectorAll('button')].find(x => x.textContent?.includes('Báo sai lệch'))!; await act(async () => button.click()); expect(container.textContent).toContain('Lý do sai lệch'); });
it('shows an incomplete timesheet for review but blocks acknowledgement', async () => {
  (hr.getMyTimesheetReview as jest.Mock).mockResolvedValue({
    ...review,
    payableWorkUnits: 0,
    hasUnresolvedDays: true,
    canAcknowledge: false,
    days: [{ ...review.days[0], workCredit: 0, reasonCode: 'INCOMPLETE_DAY_BLOCKED' }],
  });
  await act(async () => root.render(<EmployeeTimesheetReviewScreen apiBase="api" />));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(container.textContent).toContain('Bảng công còn ngày chấm công chưa hoàn tất.');
  expect([...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Báo sai lệch'))).toBeTruthy();
  expect([...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Đã kiểm tra'))?.hasAttribute('disabled')).toBe(true);
});
it('filters reviews by month', async () => {
  (hr.listMyTimesheetReviews as jest.Mock).mockResolvedValue([
    { periodId: 'p1', periodKey: '2026-10', periodVersion: 2, state: 'PENDING' },
    { periodId: 'p2', periodKey: '2026-09', periodVersion: 1, state: 'ACKNOWLEDGED' },
  ]);
  (hr.getMyTimesheetReview as jest.Mock).mockImplementation(async (_base: string, periodId: string) => (
    periodId === 'p2' ? { ...review, periodId: 'p2', periodKey: '2026-09', state: 'ACKNOWLEDGED' } : review
  ));
  await act(async () => root.render(<EmployeeTimesheetReviewScreen apiBase="api" />));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  const select = container.querySelector('select[aria-label="Lọc kỳ công theo tháng"]') as HTMLSelectElement;
  expect(select).not.toBeNull();
  expect(select.options).toHaveLength(2);
  await act(async () => {
    select.value = 'p2';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
  });
  expect(hr.getMyTimesheetReview).toHaveBeenLastCalledWith('api', 'p2');
  expect(container.textContent).toContain('Tháng 9/2026');
  expect(container.textContent).toContain('Bạn đã xác nhận thông tin bảng công chính xác.');
  expect([...container.querySelectorAll('button')].some((button) => button.textContent?.includes('Báo sai lệch'))).toBe(false);
});
