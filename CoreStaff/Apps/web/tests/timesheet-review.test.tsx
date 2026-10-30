/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EmployeeTimesheetReviewScreen } from '../src/screens/Employee/EmployeeTimesheetReviewScreen';
import * as hr from '../src/services/hrService';

jest.mock('../src/services/hrService');
const review = { periodId: 'p1', periodKey: '2026-10', periodVersion: 2, projectionHash: 'a'.repeat(64), state: 'PENDING' as const, standardWorkUnits: 1, standardWorkMinutes: 480, payableWorkUnits: 1, days: [{ workDate: '2026-10-01', scheduledObligationMinutes: 480, workedScheduledMinutes: 480, payableLeaveMinutes: 0, unpaidLeaveMinutes: 0, overtimeMinutes: 0, workCredit: 1, reasonCode: 'FULL_CREDIT' }], history: [] };
let root: Root; let container: HTMLDivElement;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); (hr.listMyTimesheetReviews as jest.Mock).mockResolvedValue([{ periodId: 'p1', periodKey: '2026-10', periodVersion: 2, state: 'PENDING' }]); (hr.getMyTimesheetReview as jest.Mock).mockResolvedValue(review); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.clearAllMocks(); });
it('renders current review and requires an explicit acknowledgement confirmation', async () => { await act(async () => root.render(<EmployeeTimesheetReviewScreen apiBase="api" />)); await act(async () => { await Promise.resolve(); await Promise.resolve(); }); expect(container.textContent).toContain('Rà soát bảng công'); expect(container.textContent).toContain('Đã kiểm tra — thông tin chính xác'); const button = [...container.querySelectorAll('button')].find(x => x.textContent?.includes('Đã kiểm tra'))!; await act(async () => button.click()); expect(container.textContent).toContain('Xác nhận thông tin chính xác'); });
it('requires a meaningful dispute reason', async () => { await act(async () => root.render(<EmployeeTimesheetReviewScreen apiBase="api" />)); await act(async () => { await Promise.resolve(); await Promise.resolve(); }); const button = [...container.querySelectorAll('button')].find(x => x.textContent?.includes('Báo sai lệch'))!; await act(async () => button.click()); expect(container.textContent).toContain('Lý do sai lệch'); });
