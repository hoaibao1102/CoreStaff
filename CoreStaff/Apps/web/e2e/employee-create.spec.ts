import { test, expect } from '@playwright/test';

for (const width of [390, 1366]) {
  test(`create employee ${width}: validation, focus, toast and layout`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => localStorage.setItem('corestaff:has-session', '1'));
    let posts = 0;
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data: unknown = [];
      if (path.endsWith('/auth/me')) data = { id: 'hr', organizationId: 'org', role: 'HR', fullName: 'HR', email: 'hr@example.com', status: 'ACTIVE' };
      if (path.endsWith('/eligible-users')) data = [{ _id: 'new-user', fullName: 'Nhân viên mới', email: 'new@example.com' }];
      if (route.request().method() === 'POST') { posts++; data = { ...route.request().postDataJSON(), _id: 'new-profile', organizationId: 'org', employmentStatus: 'PROBATION' }; }
      await route.fulfill({ json: path.endsWith('/healthz')
        ? { status: 'ok', mongo: 'configured', service: 'corestaff-api', timezone: 'Asia/Ho_Chi_Minh' }
        : { success: true, data } });
    });
    await page.goto('/hr/employees');
    await page.getByRole('button', { name: 'Tạo hồ sơ', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Tạo hồ sơ nhân sự' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[aria-invalid="true"]')).toHaveCount(0);
    await dialog.locator('#create-joinDate').fill('');
    await dialog.getByRole('button', { name: 'Tạo hồ sơ', exact: true }).click();
    await expect(dialog.locator('[aria-invalid="true"]')).toHaveCount(3);
    await expect(dialog.locator('#create-userId')).toBeFocused();
    await expect(dialog.locator('#create-userId')).toBeInViewport();
    expect(posts).toBe(0);
    const toast = page.getByRole('status').filter({ hasText: 'Vui lòng kiểm tra thông tin' });
    await expect(toast).toBeVisible();
    const toastBox = (await toast.boundingBox())!;
    expect(toastBox.y).toBeLessThan(30);
    expect(width - toastBox.x - toastBox.width).toBeLessThanOrEqual(25);
    await expect(toast).toHaveCount(0, { timeout: 6000 });
    await dialog.locator('#create-userId').selectOption('new-user');
    await dialog.locator('#create-employeeCode').fill('NV-001');
    await dialog.locator('#create-joinDate').fill('2020-01-01');
    await dialog.locator('#create-phone').fill('0968abc066');
    await expect(dialog.locator('#create-phone')).toHaveValue('0968066');
    await dialog.locator('#create-phone').fill('0968373066');
    await expect(dialog.locator('#create-phone')).toHaveAttribute('maxlength', '10');
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
    await page.getByRole('button', { name: 'Tạo hồ sơ', exact: true }).click();
    await expect(dialog.locator('[aria-invalid="true"]')).toHaveCount(0);
    await expect(dialog.locator('#create-employeeCode')).toHaveValue('');
    await dialog.locator('#create-userId').selectOption('new-user');
    await dialog.locator('#create-employeeCode').fill('NV-002');
    await dialog.locator('#create-joinDate').fill('2020-01-01');
    await dialog.getByRole('button', { name: 'Tạo hồ sơ', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(posts).toBe(1);
    await expect(page.getByRole('status').filter({ hasText: 'Tạo hồ sơ thành công' })).toBeVisible();
  });
}
