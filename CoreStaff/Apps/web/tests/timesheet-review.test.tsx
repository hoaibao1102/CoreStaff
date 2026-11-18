/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EmployeeTimesheetReviewScreen } from '../src/screens/Employee/EmployeeTimesheetReviewScreen';
import * as hr from '../src/services/hrService';
import * as manager from '../src/services/manager.service';

jest.mock('../src/services/hrService');
jest.mock('../src/services/manager.service');
const review = {
  periodId: 'p1',
  periodKey: '2026-10',
  periodVersion: 2,
  projectionHash: 'a'.repeat(64),
  state: 'PENDING' as const,
  standardWorkUnits: 1,
  standardWorkMinutes: 480,
  payableWorkUnits: 1,
  hasUnresolvedDays: false,
  canAcknowledge: true,
  days: [
    {
      workDate: '2026-10-01',
      scheduledObligationMinutes: 480,
      workedScheduledMinutes: 480,
      payableLeaveMinutes: 0,
      unpaidLeaveMinutes: 0,
      overtimeMinutes: 0,
      workCredit: 1,
      reasonCode: 'FULL_CREDIT',
    },
  ],
  history: [],
};
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  (hr.listMyTimesheetReviews as jest.Mock).mockResolvedValue([
    { periodId: 'p1', periodKey: '2026-10', periodVersion: 2, state: 'PENDING' },
  ]);
  (hr.getMyTimesheetReview as jest.Mock).mockResolvedValue(review);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

it('renders current review and requires an explicit acknowledgement confirmation', async () => {
  await act(async () => root.render(<EmployeeTimesheetReviewScreen apiBase="api" />));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(container.textContent).toContain('Rà soát bảng công');
  expect(container.textContent).toContain('Đã kiểm tra — thông tin chính xác');
  const button = [...container.querySelectorAll('button')].find((x) => x.textContent?.includes('Đã kiểm tra'))!;
  await act(async () => button.click());
  expect(container.textContent).toContain('Xác nhận thông tin chính xác');
});

it('submits the reviewed version when the employee confirms', async () => {
  (hr.acknowledgeMyTimesheetReview as jest.Mock).mockResolvedValue({ ...review, state: 'ACKNOWLEDGED' });
  await act(async () => root.render(<EmployeeTimesheetReviewScreen apiBase="api" />));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  const openButton = [...document.body.querySelectorAll('button')].find((button) => button.textContent?.includes('Đã kiểm tra'))!;
  await act(async () => openButton.click());
  const confirmButton = [...document.body.querySelectorAll('button')].find((button) => button.textContent === 'Xác nhận')!;
  await act(async () => {
    confirmButton.click();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(hr.acknowledgeMyTimesheetReview).toHaveBeenCalledWith('api', 'p1', 2, 'a'.repeat(64));
  expect(container.textContent).toContain('Bạn đã xác nhận thông tin bảng công chính xác.');
});

it('opens the three-column dispute panel with a scrollable container and reason field per draft', async () => {
  await act(async () => root.render(<EmployeeTimesheetReviewScreen apiBase="api" />));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  const button = [...container.querySelectorAll('button')].find((x) => x.textContent?.includes('Báo sai lệch'))!;
  await act(async () => button.click());
  expect(container.textContent).toContain('Báo sai lệch bảng công');
  expect(container.textContent).toContain('Lý do đơn này');
  expect([...container.querySelectorAll('button')].some((x) => x.textContent?.includes('Thêm đơn thiếu công'))).toBe(true);
  const form = container.querySelector('form[aria-label="Báo sai lệch bảng công"]');
  expect(form).not.toBeNull();
  expect(form?.querySelector('.overflow-y-auto')).not.toBeNull();
});

it('sends attendance confirmation request with previewHash and custom times, and marks the period with corrected dates', async () => {
  (manager.getAttendanceConfirmationPreview as jest.Mock).mockResolvedValue({
    enabled: true,
    workDate: '2026-10-01',
    canSubmit: true,
    blockedReasons: [],
    actionType: 'FULL_DAY',
    previewHash: 'hash-2026-10-01',
    proposedChanges: { checkInAt: '2026-10-01T01:00:00.000Z', checkOutAt: '2026-10-01T10:00:00.000Z' },
    quota: { monthKey: '2026-10', usedSlots: 0, limit: 3, remaining: 3 },
  });
  (manager.createAttendanceConfirmation as jest.Mock).mockResolvedValue({ _id: 'req-1' });
  (hr.disputeMyTimesheetReview as jest.Mock).mockResolvedValue({ ...review, state: 'DISPUTED' });

  await act(async () => root.render(<EmployeeTimesheetReviewScreen apiBase="api" />));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => [...container.querySelectorAll('button')].find((x) => x.textContent?.includes('Báo sai lệch'))!.click());
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  const reason = [...container.querySelectorAll('textarea')][0] as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'Tôi quên chấm công buổi sáng');
    reason.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const submit = [...container.querySelectorAll('button')].find((x) => x.textContent?.includes('Gửi 1 yêu cầu'))!;
  await act(async () => {
    submit.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(manager.createAttendanceConfirmation).toHaveBeenCalledWith(
    'api',
    expect.objectContaining({
      workDate: '2026-10-01',
      reason: 'Tôi quên chấm công buổi sáng',
      previewHash: 'hash-2026-10-01',
      customCheckInTime: '2026-10-01T08:00:00+07:00',
      customCheckOutTime: '2026-10-01T17:00:00+07:00',
    }),
    expect.any(String),
  );
  expect(hr.disputeMyTimesheetReview).toHaveBeenCalledWith('api', 'p1', 2, 'a'.repeat(64), expect.stringContaining('01/10/2026'), ['2026-10-01']);
});

it('adds multiple attendance confirmation drafts and overtime drafts in one batch and sends each via shared APIs', async () => {
  (manager.getAttendanceConfirmationPreview as jest.Mock).mockImplementation(async (_base: string, date: string) => ({
    enabled: true,
    workDate: date,
    canSubmit: true,
    blockedReasons: [],
    actionType: 'FULL_DAY',
    previewHash: `hash-${date}`,
    proposedChanges: { checkInAt: `${date}T01:00:00.000Z`, checkOutAt: `${date}T10:00:00.000Z` },
    quota: { monthKey: '2026-10', usedSlots: 0, limit: 3, remaining: 3 },
  }));
  (manager.createAttendanceConfirmation as jest.Mock).mockResolvedValue({ _id: 'req-att' });
  (manager.getOvertimePreview as jest.Mock).mockResolvedValue({
    workDate: '2026-10-01',
    calculationContract: 'OVERTIME_V2',
    canFile: true,
    blockedReasons: [],
    contextHash: 'ot-hash-1',
    rawEligibleMinutes: 120,
    payableMinutes: 120,
  });
  (manager.createOvertimeRequest as jest.Mock).mockResolvedValue({ _id: 'req-ot' });
  // Simulate version bump from createAttendanceConfirmation causing PERIOD_VERSION_CONFLICT on first dispute attempt
  (hr.disputeMyTimesheetReview as jest.Mock)
    .mockRejectedValueOnce({ code: 'PERIOD_VERSION_CONFLICT' })
    .mockResolvedValueOnce({ ...review, periodVersion: 4, state: 'DISPUTED' });
  (hr.getMyTimesheetReview as jest.Mock)
    .mockResolvedValueOnce(review)
    .mockResolvedValueOnce({ ...review, periodVersion: 4, projectionHash: 'b'.repeat(64) });

  await act(async () => root.render(<EmployeeTimesheetReviewScreen apiBase="api" />));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => [...container.querySelectorAll('button')].find((x) => x.textContent?.includes('Báo sai lệch'))!.click());
  await act(async () => [...container.querySelectorAll('button')].find((x) => x.textContent?.includes('Thêm đơn thiếu công'))!.click());
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  const setText = async (field: HTMLTextAreaElement, value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
  const reasons = [...container.querySelectorAll('textarea')] as HTMLTextAreaElement[];
  expect(reasons).toHaveLength(2);
  await setText(reasons[0], 'Quên chấm công buổi sáng');
  await setText(reasons[1], 'Máy chấm công lỗi buổi chiều');

  // Switch to Báo OT tab and add an OT draft
  const otTab = [...container.querySelectorAll('[role="tab"]')].find((x) => x.textContent?.includes('Báo OT')) as HTMLElement;
  await act(async () => otTab.click());
  await act(async () => [...container.querySelectorAll('button')].find((x) => x.textContent?.includes('Thêm đơn OT'))!.click());
  const otReason = container.querySelector('textarea[aria-label="Lý do đơn OT"]') as HTMLTextAreaElement;
  expect(otReason).not.toBeNull();
  await setText(otReason, 'Làm thêm giờ hoàn thành báo cáo tháng');

  await act(async () => {
    [...container.querySelectorAll('button')].find((x) => x.textContent?.includes('Gửi 3 yêu cầu'))!.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(manager.createAttendanceConfirmation).toHaveBeenCalledTimes(2);
  expect(manager.createAttendanceConfirmation).toHaveBeenNthCalledWith(
    1,
    'api',
    expect.objectContaining({ reason: 'Quên chấm công buổi sáng' }),
    expect.any(String),
  );
  expect(manager.createAttendanceConfirmation).toHaveBeenNthCalledWith(
    2,
    'api',
    expect.objectContaining({ reason: 'Máy chấm công lỗi buổi chiều' }),
    expect.any(String),
  );
  expect(manager.createOvertimeRequest).toHaveBeenCalledWith(
    'api',
    expect.objectContaining({
      workDate: '2026-10-01',
      reason: 'Làm thêm giờ hoàn thành báo cáo tháng',
      previewHash: 'ot-hash-1',
      retroactiveReason: 'Làm thêm giờ hoàn thành báo cáo tháng',
    }),
  );
  // Retried disputeMyTimesheetReview with refreshed version 4 and hash 'b'*64
  expect(hr.disputeMyTimesheetReview).toHaveBeenCalledTimes(2);
  expect(hr.disputeMyTimesheetReview).toHaveBeenLastCalledWith(
    'api',
    'p1',
    4,
    'b'.repeat(64),
    expect.stringContaining('01/10/2026'),
    ['2026-10-01'],
  );
});

it('shows an incomplete timesheet for review but blocks acknowledgement', async () => {
  (hr.getMyTimesheetReview as jest.Mock).mockResolvedValue({
    ...review,
    payableWorkUnits: 0,
    hasUnresolvedDays: true,
    canAcknowledge: false,
    days: [{ ...review.days[0], workCredit: 0, reasonCode: 'INCOMPLETE_DAY_BLOCKED' }],
  });
  await act(async () => root.render(<EmployeeTimesheetReviewScreen apiBase="api" />));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(container.textContent).toContain('Bảng công còn ngày chấm công chưa hoàn tất.');
  expect([...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Báo sai lệch'))).toBeTruthy();
  expect([...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Đã kiểm tra'))?.hasAttribute('disabled')).toBe(true);
});

it('filters reviews by month', async () => {
  (hr.listMyTimesheetReviews as jest.Mock).mockResolvedValue([
    { periodId: 'p1', periodKey: '2026-10', periodVersion: 2, state: 'PENDING' },
    { periodId: 'p2', periodKey: '2026-09', periodVersion: 1, state: 'ACKNOWLEDGED' },
  ]);
  (hr.getMyTimesheetReview as jest.Mock).mockImplementation(async (_base: string, periodId: string) =>
    periodId === 'p2' ? { ...review, periodId: 'p2', periodKey: '2026-09', state: 'ACKNOWLEDGED' } : review,
  );
  await act(async () => root.render(<EmployeeTimesheetReviewScreen apiBase="api" />));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
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
