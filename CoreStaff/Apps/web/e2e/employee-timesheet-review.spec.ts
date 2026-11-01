import { expect, test, type Page } from '@playwright/test';

const employee = {
  id: 'employee-user', organizationId: 'org-1', role: 'EMPLOYEE',
  fullName: 'Nguyễn Văn Test', email: 'employee@example.test', status: 'ACTIVE',
};

function review(state: 'PENDING' | 'ACKNOWLEDGED' | 'DISPUTED', history: any[] = []) {
  return {
    periodId: 'period-1', periodKey: '2026-09', periodVersion: 3,
    state, projectionHash: 'a'.repeat(64), standardWorkUnits: 22,
    standardWorkMinutes: 10_560, payableWorkUnits: 21.5,
    days: [{
      workDate: '2026-09-15', checkInAt: '2026-09-15T01:00:00.000Z',
      checkOutAt: '2026-09-15T05:00:00.000Z', scheduledObligationMinutes: 480,
      workedScheduledMinutes: 240, payableLeaveMinutes: 240, unpaidLeaveMinutes: 0,
      lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0, attendanceState: 'COMPLETED',
      workCredit: 1, reasonCode: 'PAID_LEAVE_AND_WORK', calendarClassification: 'WORKING_DAY',
    }],
    history,
  };
}

async function openReview(page: Page) {
  let current = review('PENDING');
  const actions: Array<{ path: string; body: any }> = [];
  await page.addInitScript(() => localStorage.setItem('corestaff:has-session', '1'));
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path.endsWith('/healthz')) return route.fulfill({ json: { status: 'ok', service: 'corestaff-api', mongo: 'configured', timezone: 'Asia/Ho_Chi_Minh' } });
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { success: true, data: employee } });
    if (path.endsWith('/employees/me')) return route.fulfill({ json: { success: true, data: { _id: 'profile-1', userId: employee.id, employmentStatus: 'ACTIVE' } } });
    if (path === '/api/hr/timesheet-reviews/my' && method === 'GET') {
      return route.fulfill({ json: { success: true, data: [{ periodId: current.periodId, periodKey: current.periodKey, periodVersion: current.periodVersion, state: current.state }] } });
    }
    if (path === '/api/hr/timesheet-periods/period-1/my-review' && method === 'GET') {
      return route.fulfill({ json: { success: true, data: current } });
    }
    if (path.endsWith('/my-review/acknowledge') && method === 'POST') {
      const body = request.postDataJSON(); actions.push({ path, body });
      current = review('ACKNOWLEDGED', [{ action: 'ACKNOWLEDGED', actedAt: '2026-10-30T00:00:00.000Z' }]);
      return route.fulfill({ status: 201, json: { success: true, data: current } });
    }
    if (path.endsWith('/my-review/dispute') && method === 'POST') {
      const body = request.postDataJSON(); actions.push({ path, body });
      current = review('DISPUTED', [{ action: 'DISPUTED', actedAt: '2026-10-30T00:01:00.000Z', disputeReason: body.reason }]);
      return route.fulfill({ status: 201, json: { success: true, data: current } });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto('/app/timesheet-review');
  await expect(page.getByRole('heading', { name: 'Rà soát bảng công' })).toBeVisible();
  return actions;
}

test('employee acknowledges the exact visible projection and can later dispute it', async ({ page }) => {
  const actions = await openReview(page);
  await expect(page.getByText('Kỳ 2026-09 · phiên bản 3')).toBeVisible();
  await expect(page.getByText('21.5')).toBeVisible();
  await expect(page.getByText('2026-09-15')).toBeVisible();

  await page.getByRole('button', { name: 'Đã kiểm tra — thông tin chính xác' }).click();
  await expect(page.getByRole('dialog', { name: 'Xác nhận thông tin chính xác' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByText('Trạng thái: Đã xác nhận')).toBeVisible();
  expect(actions[0]).toEqual({
    path: '/api/hr/timesheet-periods/period-1/my-review/acknowledge',
    body: { expectedPeriodVersion: 3, projectionHash: 'a'.repeat(64) },
  });

  await page.getByRole('button', { name: 'Báo sai lệch' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Lý do sai lệch').fill('Thiếu thời gian làm việc buổi chiều');
  await dialog.getByRole('button', { name: 'Gửi báo sai lệch' }).click();
  await expect(page.getByText('Trạng thái: Đã báo sai lệch')).toBeVisible();
  expect(actions[1]).toEqual({
    path: '/api/hr/timesheet-periods/period-1/my-review/dispute',
    body: { expectedPeriodVersion: 3, projectionHash: 'a'.repeat(64), reason: 'Thiếu thời gian làm việc buổi chiều' },
  });

  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/lương|thuế|bảo hiểm|GPS|Wi-Fi|evidence|user-agent/i);
});

test('employee dispute requires a meaningful reason', async ({ page }) => {
  await openReview(page);
  await page.getByRole('button', { name: 'Báo sai lệch' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Lý do sai lệch').fill('Sai');
  await expect(dialog.getByRole('alert')).toHaveText('Lý do cần ít nhất 10 ký tự.');
  await expect(dialog.getByRole('button', { name: 'Gửi báo sai lệch' })).toBeDisabled();
});
