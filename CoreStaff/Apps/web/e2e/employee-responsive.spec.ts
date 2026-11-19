import { test, expect, type Page } from '@playwright/test';
const user = { id: 'responsive-user', organizationId: 'org', role: 'EMPLOYEE', fullName: 'Nhân viên kiểm thử responsive', email: 'verylongemployeename.withoutspaces@example.test', employeeCode: 'NV001', status: 'ACTIVE' };
async function open(page: Page, path = '/app/profile', role = 'EMPLOYEE') {
  await page.addInitScript(() => localStorage.setItem('corestaff:has-session', '1'));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith('/auth/me')) data = { ...user, role };
    if (path.endsWith('/employees/me')) data = { _id: 'profile', ...user, userId: user.id, organizationId: user.organizationId, employmentStatus: 'ACTIVE', employmentType: 'FULL_TIME', departmentId: 'department', departmentName: 'Phòng kiểm thử', positionName: 'Chuyên viên kiểm thử', joinDate: '2026-01-02' };
    if (path.endsWith('/leave-requests/mine')) data = [{ _id: 'leave', organizationId: user.organizationId, employeeId: 'profile', departmentId: 'department', startDate: '2026-11-20', endDate: '2026-11-20', leaveType: 'PAID_LEAVE', durationType: 'FULL_DAY', calculatedMinutes: 480, leaveEquivalent: 1, reason: 'Nghỉ phép kiểm thử bố cục responsive', status: 'PENDING_MANAGER' }];
    if (path.endsWith('/payslips/me')) data = [{ _id: 'payslip', organizationId: user.organizationId, employeeId: 'profile', employeeName: user.fullName, employeeCode: user.employeeCode, periodLabel: 'Tháng 10/2026', grossEarnings: 20000000, socialInsurance: 1600000, healthInsurance: 300000, unemploymentInsurance: 200000, pitAmount: 145000, netSalary: 17755000, status: 'RELEASED' }];
    if (path.endsWith('/attendance/history')) {
      const month = new URL(route.request().url()).searchParams.get('month');
      data = { items: [{ _id: 'day', workDate: `${month}-02`, shiftName: 'Ca kiểm thử', attendanceStatus: 'COMPLETED', workingMinutes: 480 }] };
    }
    if (path.endsWith('/attendance/today')) return route.fulfill({ status: 503, json: { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Unavailable' } } });
    await route.fulfill({ json: path.endsWith('/healthz') ? { status: 'ok', mongo: 'configured', service: 'corestaff-api', timezone: 'Asia/Ho_Chi_Minh' } : { success: true, data } });
  });
  await page.goto(path);
  await expect(page.locator('.workspace-shell')).toBeVisible();
}
const today = {
  workDate: '2026-11-19', serverTime: '2026-11-19T03:00:00Z', attendanceStatus: 'NOT_CHECKED_IN', availableAction: 'CHECK_IN', workMode: 'IN_OFFICE', checkIn: null, checkOut: null, workingMinutes: null, lateMinutes: 0, earlyMinutes: 0, attendanceRequirements: null, pendingLeave: null, overallApprovalStatus: 'NONE',
  assignment: { shiftName: 'Ca hành chính', shiftHours: '08:00 – 17:00', startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 5, workplaceId: 'office', workplaceName: 'Văn phòng kiểm thử', workplaceType: 'IN_OFFICE', address: 'Địa chỉ kiểm thử', latitude: 21, longitude: 105, allowedRadiusMeters: 100, maximumAccuracyMeters: 50, allowWifiAttendance: false, allowGpsAttendance: true, allowSelfieFallback: false },
};
for (const width of [320, 390, 820, 1023, 1440]) {
  test(`attendance action clears bottom navigation ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/app/attendance');
    await page.route('**/api/attendance/today', route => route.fulfill({ json: { success: true, data: today } }));
    await page.reload();
    const action = page.locator('.employee-sticky-action');
    await expect(action).toBeVisible();
    if (width < 1024) {
      const nav = (await page.locator('.employee-bottom-nav').boundingBox())!;
      const box = (await action.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(nav.y - 20);
      const content = page.locator('.employee-attendance-content');
      expect(await content.evaluate(el => parseFloat(getComputedStyle(el).paddingBottom))).toBeGreaterThanOrEqual(160);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/employee-attendance-${width}.png`, fullPage: true });
  });
}
for (const width of [320, 390, 767, 768, 820, 1023, 1024, 1440]) {
  test(`employee navigation and profile ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const nav = page.getByRole('navigation', { name: 'Thanh điều hướng nhân viên' });
    await expect(width < 1024 ? nav : page.locator('#desktop-sidebar')).toBeVisible();
    await expect(width < 1024 ? page.locator('#desktop-sidebar') : nav).toBeHidden();
    if (width < 1024) {
      await expect(nav.getByRole('link')).toHaveCount(5);
      expect(await nav.getByRole('link', { name: 'Lịch sử', exact: true }).locator('div').evaluate(el => getComputedStyle(el).color)).toBe('rgb(71, 85, 105)');
      for (const link of await nav.getByRole('link').all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('href', '/app/profile');
      expect(await page.locator('main').evaluate(el => parseFloat(getComputedStyle(el).paddingBottom))).toBeGreaterThanOrEqual(88);
    }
    await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
    await expect(page.locator('main').getByRole('link', { name: /Bảo mật/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/employee-profile-${width}.png`, fullPage: true });
  });
}
test('request categories preserve deep links and browser Back', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/app/leave');
  const categories = page.getByRole('navigation', { name: 'Loại đơn từ' });
  await categories.getByRole('link', { name: 'Tăng ca & Xác nhận công' }).click();
  await expect(page).toHaveURL(/\/app\/ot$/);
  await expect(page.getByRole('navigation', { name: 'Thanh điều hướng nhân viên' }).locator('[aria-current="page"]')).toHaveAttribute('href', '/app/leave');
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/leave$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/app\/ot$/);
});
test('attendance temporary error provides retry without signing out', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/app/attendance');
  await expect(page.getByRole('alert')).toContainText('tạm thời');
  await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toBeVisible();
  await expect(page.locator('.workspace-shell')).toBeVisible();
  await page.route('**/api/attendance/today', route => route.fulfill({ json: { success: true, data: today } }));
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.employee-sticky-action')).toBeVisible();
});
test('short viewport with text zoom and simulated safe area keeps actions above nav', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await open(page, '/app/attendance');
  await page.route('**/api/attendance/today', route => route.fulfill({ json: { success: true, data: today } }));
  await page.reload();
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  await page.addStyleTag({ content: 'html { font-size: 20px; } .workspace-shell[data-experience="self-service"] { --employee-safe-area: 34px; }' });
  await expect(page.locator('.employee-sticky-action')).toBeVisible();
  const nav = (await page.locator('.employee-bottom-nav').boundingBox())!;
  const action = (await page.locator('.employee-sticky-action').boundingBox())!;
  await test.info().attach('short-viewport-geometry', { body: JSON.stringify({ viewport: page.viewportSize(), nav, action, gap: nav.y - action.y - action.height }), contentType: 'application/json' });
  expect(nav.height).toBe(98);
  expect(action.y + action.height).toBeLessThanOrEqual(nav.y - 20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('profile logout calls existing session cleanup', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.getByRole('heading', { name: user.fullName, exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page.locator('.workspace-shell')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('corestaff:has-session'))).toBeNull();
});
for (const width of [320, 820, 1440]) {
  for (const path of ['/app/attendance/history', '/app/leave', '/app/ot', '/app/compensation', '/app/payslips']) {
    test(`self-service layout ${width} ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, path);
      if (path === '/app/leave') await expect(page.locator('main').getByText('Nghỉ phép kiểm thử bố cục responsive', { exact: true }).filter({ visible: true })).toBeVisible();
      if (path === '/app/payslips') await expect(page.getByRole('cell', { name: 'Tháng 10/2026', exact: true })).toBeVisible();
      if (path === '/app/attendance/history') {
        for (const name of ['Tháng trước', 'Tháng sau']) {
          const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
          expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
        }
        const day = page.getByRole('button', { name: /: Đã chấm công/ }).first();
        const box = (await day.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (path === '/app/compensation' || path === '/app/payslips') {
        const tabs = page.getByRole('tablist', { name: 'Công và lương của tôi' });
        await tabs.getByRole('tab', { name: 'Bảng công', exact: true }).focus();
        await page.keyboard.press('ArrowRight');
        await expect(tabs.getByRole('tab', { name: 'Bảng lương', exact: true })).toBeFocused();
        await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'compensation-payslip-tab');
        await expect(page.getByRole('cell', { name: 'Tháng 10/2026', exact: true })).toBeVisible();
        for (const tab of await page.getByRole('tablist', { name: 'Công và lương của tôi' }).getByRole('tab').all()) expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/employee-${path.split('/').pop()}-${width}.png`, fullPage: true });
    });
  }
}
