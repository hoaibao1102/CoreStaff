import { test, expect } from '@playwright/test';

// Isolated browser fixtures: never send mutations to the real HR backend.
const workplace = { _id: 'workplace', organizationId: 'org', code: 'VP-01', name: 'Văn phòng chính', address: '123 Nguyễn Huệ, TP.HCM', latitude: 10.77, longitude: 106.7, allowedRadiusMeters: 200, maximumAccuracyMeters: 100, active: true };
const shift = { _id: 'shift', organizationId: 'org', workplaceId: 'workplace', startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 5, active: true };

for (const width of [1440, 768, 390]) {
  for (const module of ['workplaces', 'shift-templates']) {
    test(`${module} ${width}: table, colors, dialogs and viewport`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => localStorage.setItem('corestaff:has-session', '1'));
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        let data: unknown = [];
        if (path.endsWith('/auth/me')) data = { id: 'user', organizationId: 'org', role: 'HR', fullName: 'HR', email: 'hr@example.test', status: 'ACTIVE' };
        if (path.endsWith('/workplaces')) data = [workplace];
        if (path.endsWith('/workplaces/workplace')) data = workplace;
        if (path.endsWith('/shift-templates')) data = [shift];
        if (path.endsWith('/shift-templates/shift')) data = shift;
        await route.fulfill({ json: path.endsWith('/healthz') ? { status: 'ok', mongo: 'configured', service: 'corestaff-api', timezone: 'Asia/Ho_Chi_Minh' } : { success: true, data } });
      });
      await page.goto('/hr/' + module);
      const table = page.getByRole('table');
      await expect(table).toBeVisible();
      await expect(table.getByText('Đang hoạt động')).toHaveClass(/bg-emerald-50/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const create = page.getByRole('button', { name: module === 'workplaces' ? 'Thêm nơi làm việc' : 'Tạo ca làm việc', exact: true });
      await expect(create).toHaveCSS('background-color', 'rgb(23, 78, 166)');
      await create.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeLessThanOrEqual(868);
      await expect(dialog.getByLabel(module === 'workplaces' ? 'Tên nơi làm việc' : 'Giờ bắt đầu', { exact: false })).toBeVisible();
      await page.screenshot({ path: `test-results/${module}-${width}-create.png` });
      await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
      for (const action of ['Xem chi tiết', 'Chỉnh sửa', 'Ngưng hoạt động']) {
        await table.getByRole('button', { name: /Mở thao tác/ }).click();
        await page.getByRole('menuitem', { name: action, exact: true }).click();
        await expect(dialog).toBeVisible();
        if (action === 'Chỉnh sửa') await expect(dialog.locator('input').first()).toBeVisible();
        await dialog.getByRole('button', { name: 'Đóng hộp thoại' }).click();
        await expect(dialog).toHaveCount(0);
      }
      expect(errors).toEqual([]);
    });
  }
}
