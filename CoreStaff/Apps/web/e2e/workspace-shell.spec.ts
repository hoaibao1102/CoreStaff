import { test, expect, type Page } from '@playwright/test';

const user = { id: 'test-user', organizationId: 'test-org', role: 'HR', fullName: 'Nguyễn Thị Minh Anh', email: 'sidebar@example.test', status: 'ACTIVE' };
const errors = new WeakMap<Page, string[]>();

for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  test(`nested employee modal ${viewport.width}: overlay, scroll and focus`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openApp(page, 'HR', '/hr/employees/employee');
    const body = page.locator('[data-slot="employee-detail-body"]');
    const trigger = page.locator('#employee-status-trigger');
    for (const close of ['escape', 'backdrop']) {
      await body.evaluate(element => { element.scrollTop = 180; });
      const before = await body.evaluate(element => element.scrollTop);
      // Programmatic activation keeps the scrolled position while exercising the same handler.
      await trigger.evaluate((element: HTMLButtonElement) => element.click());
      const popup = page.getByRole('dialog', { name: 'Thay đổi trạng thái', exact: true });
      await expect(popup).toBeVisible();
      await expect(page.locator('#status-new')).toBeFocused();
      await expect(body).toHaveCSS('overflow-y', 'hidden');
      expect(await popup.evaluate(element => element.closest('[data-slot="employee-detail-body"]'))).toBeNull();
      await expect(popup).toHaveCSS('z-index', '1110');
      const backdrop = page.locator('[data-slot="dialog-backdrop"]').last();
      await expect(backdrop).toHaveCSS('z-index', '1100');
      const box = (await popup.boundingBox())!;
      expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2);
      expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(2);
      expect(box.height).toBeLessThanOrEqual(viewport.height - 32);
      for (let i = 0; i < 9; i++) {
        await page.keyboard.press('Tab');
        expect(await popup.evaluate(element => element.contains(document.activeElement))).toBe(true);
      }
      await page.mouse.move(30, 300);
      await page.mouse.wheel(0, 500);
      expect(await body.evaluate(element => element.scrollTop)).toBe(before);
      if (close === 'escape') await page.keyboard.press('Escape');
      else await backdrop.click({ position: { x: 5, y: 5 } });
      await expect(popup).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(body).toHaveCSS('overflow-y', 'auto');
      expect(await body.evaluate(element => element.scrollTop)).toBe(before);
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="dialog-content"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  });
}

async function openApp(page: Page, role = 'HR', path = '/overview') {
  await page.addInitScript(() => localStorage.setItem('corestaff:has-session', '1'));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let data: unknown = [];
    if (url.pathname.endsWith('/auth/me')) data = { ...user, role };
    if (url.pathname.endsWith('/employees/me')) data = { _id: 'employee', userId: user.id, employmentStatus: 'ACTIVE' };
    if (url.pathname.endsWith('/employees/employee')) data = {
      _id: 'employee', userId: user.id, organizationId: user.organizationId,
      employeeCode: 'NV-001', fullName: user.fullName, employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE', joinDate: '2026-01-01',
    };
    if (url.pathname.endsWith('/manager/context')) data = {
      managerUserId: user.id,
      managedDepartments: [{ id: 'dept-1', code: 'ENG', name: 'Kỹ thuật' }],
      defaultDepartmentId: 'dept-1',
      capabilities: ['manager:employees:read', 'manager:approvals:write', 'manager:kpi:draft'],
    };
    if (url.pathname.endsWith('/manager/employees')) data = [{ id: 'employee', userId: 'employee-user', employeeCode: 'NV-001', fullName: 'Nhân viên A', departmentId: 'dept-1', employmentStatus: 'ACTIVE' }];
    if (url.pathname.endsWith('/manager/approvals')) data = [];
    await route.fulfill({ json: url.pathname.endsWith('/healthz')
      ? { status: 'ok', mongo: 'configured', service: 'corestaff-api', timezone: 'Asia/Ho_Chi_Minh' }
      : { success: true, data } });
  });
  await page.goto(path);
  await expect(page.locator('.workspace-shell')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const rail = document.querySelector('#desktop-sidebar')!.getBoundingClientRect();
    const main = document.querySelector('.workspace-main')!.getBoundingClientRect();
    const items = [...document.querySelectorAll('#desktop-sidebar nav a')].map(item => {
      const rect = item.getBoundingClientRect();
      const icon = item.querySelector('svg')!.getBoundingClientRect();
      return { x: icon.x, y: icon.y, width: icon.width, height: icon.height, itemHeight: rect.height };
    });
    return { width: rail.width, right: rail.right, mainX: main.x, items };
  });
}

test.beforeEach(({ page }) => {
  errors.set(page, []);
  page.on('pageerror', error => errors.get(page)!.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.get(page)!.push(message.text()); });
});
test.afterEach(({ page }) => { expect(errors.get(page)).toEqual([]); });

for (const width of [1440, 1024]) {
  test(`desktop ${width}: geometry, rapid toggle, persistence, tooltips and account`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page);
    const rail = page.locator('#desktop-sidebar');
    await expect(rail.locator('[aria-current="page"]')).toHaveAttribute('href', '/overview');
    await expect(rail.getByText('Workforce Management')).toBeVisible();
    const expanded = await geometry(page);
    expect(expanded.width).toBe(280);
    expect(expanded.mainX).toBe(expanded.right);
    expect(expanded.items.every(item => item.width === 20 && item.height === 20 && item.itemHeight === 44)).toBe(true);
    const brand = await rail.locator('.workspace-sidebar-brand').boundingBox();
    const mark = await rail.locator('.workspace-sidebar-brand > div > span').first().boundingBox();
    const toggle = await rail.locator('.workspace-sidebar-toggle').boundingBox();
    expect(brand!.x + brand!.width).toBeLessThanOrEqual(toggle!.x);
    await noOverflow(page);
    await page.screenshot({ path: `test-results/sidebar-${width}-expanded.png` });
    await rail.getByRole('button', { name: 'Thu gọn sidebar' }).click();
    await expect.poll(async () => (await geometry(page)).width).toBe(72);
    const collapsed = await geometry(page);
    expect(collapsed.mainX).toBe(collapsed.right);
    expect(collapsed.items).toEqual(expanded.items);
    expect(await rail.locator('.workspace-sidebar-brand > div > span').first().boundingBox()).toEqual(mark);
    await expect(rail.locator('.workspace-sidebar-item-text').first()).toBeHidden();
    await expect(rail.locator('.workspace-sidebar-account-text')).toBeHidden();
    await rail.getByRole('link', { name: 'Danh sách nhân viên' }).hover();
    await expect(page.getByRole('tooltip')).toHaveText('Danh sách nhân viên');
    expect((await page.getByRole('tooltip').boundingBox())!.x).toBeGreaterThanOrEqual(collapsed.right);
    await page.keyboard.press('Escape');
    await page.mouse.move(600, 10);
    await rail.getByRole('link', { name: 'Hồ sơ của tôi' }).focus();
    await expect(page.getByRole('tooltip')).toHaveText('Hồ sơ của tôi');
    expect(await rail.getByRole('link', { name: 'Hồ sơ của tôi' }).evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await page.keyboard.press('Escape');
    await rail.getByRole('button', { name: /^Tài khoản:/ }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Đăng xuất' })).toBeVisible();
    await expect.poll(async () => (await menu.boundingBox())!.x).toBeGreaterThanOrEqual(collapsed.right);
    await menu.getByRole('menuitem', { name: 'Hồ sơ của tôi' }).click();
    await expect(page).toHaveURL(/\/app\/profile$/);
    await expect(rail).toHaveAttribute('data-collapsed', 'true');
    await page.reload();
    await expect(rail).toHaveAttribute('data-collapsed', 'true');
    await page.screenshot({ path: `test-results/sidebar-${width}-collapsed.png` });
    await rail.getByRole('button', { name: 'Mở rộng sidebar' }).click();
    await expect.poll(async () => (await geometry(page)).width).toBe(280);
    expect((await geometry(page)).items).toEqual(expanded.items);
    await expect(rail.locator('.workspace-sidebar-item-text').first()).toBeVisible();
    const samples = await page.evaluate(async () => {
      const results: { gap: number; overflow: boolean; x: number; height: number }[] = [];
      for (let i = 0; i < 20; i++) {
        (document.querySelector('#desktop-sidebar .workspace-sidebar-toggle') as HTMLElement).click();
        await new Promise(requestAnimationFrame);
        const sidebar = document.querySelector('#desktop-sidebar')!.getBoundingClientRect();
        const main = document.querySelector('.workspace-main')!.getBoundingClientRect();
        const icon = document.querySelector('#desktop-sidebar nav svg')!.getBoundingClientRect();
        results.push({ gap: main.x - sidebar.right, overflow: document.documentElement.scrollWidth > innerWidth, x: icon.x, height: icon.height });
      }
      return results;
    });
    expect(samples.every(s => Math.abs(s.gap) < 1 && !s.overflow && s.x === expanded.items[0].x && s.height === 20)).toBe(true);
    await expect.poll(async () => (await geometry(page)).width).toBe(280);
    await rail.locator('.workspace-sidebar-item-text span').first().evaluate(el => { el.textContent = 'Tên menu rất dài để kiểm tra bố cục không bị xuống dòng và tràn chữ'; });
    expect((await geometry(page)).items.every(item => item.itemHeight === 44)).toBe(true);
    await noOverflow(page);
    await rail.getByRole('button', { name: /^Tài khoản:/ }).click();
    await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
    await expect(page.getByRole('heading', { name: 'Đăng nhập CoreStaff' })).toBeVisible();
    await expect(page.locator('.workspace-shell')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('corestaff:has-session'))).toBeNull();
  });
}

for (const width of [768, 375]) {
  test(`mobile ${width}: drawer, focus, nested menu and navigation`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await openApp(page);
    await page.evaluate(() => localStorage.setItem('corestaff:sidebar-collapsed', 'true'));
    await page.reload();
    const opener = page.getByRole('button', { name: 'Mở menu', exact: true });
    await expect(opener).toBeVisible();
    await expect(page.locator('#desktop-sidebar')).toBeHidden();
    expect((await page.locator('.workspace-main').boundingBox())!.x).toBe(0);
    await noOverflow(page);
    await page.screenshot({ path: `test-results/sidebar-${width}-closed.png` });
    await opener.click();
    const drawer = page.getByRole('dialog', { name: 'Menu điều hướng' });
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveCSS('opacity', '1');
    await expect(drawer.locator('.workspace-sidebar')).toHaveAttribute('data-collapsed', 'false');
    await expect(page.locator('[data-slot="sheet-overlay"]')).toBeVisible();
    await page.screenshot({ path: `test-results/sidebar-${width}-drawer.png` });
    await noOverflow(page);
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      expect(await drawer.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    await drawer.getByRole('button', { name: /^Tài khoản:/ }).click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const rect = await menu.boundingBox();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await drawer.getByRole('button', { name: 'Đóng menu' }).click();
    await expect(drawer).toBeHidden();
    await opener.click();
    await page.locator('[data-slot="sheet-overlay"]').click({ position: { x: width - 8, y: 120 } });
    await expect(drawer).toBeHidden();
    await opener.click();
    await drawer.getByRole('link', { name: 'Hồ sơ của tôi', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/profile$/);
    await expect(drawer).toBeHidden();
    await noOverflow(page);
    await opener.click();
    await drawer.getByRole('link', { name: 'Hồ sơ của tôi', exact: true }).click();
    await expect(drawer).toBeHidden();
    await opener.click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(drawer).toBeHidden();
    await expect(page.locator('#desktop-sidebar')).toHaveAttribute('data-collapsed', 'true');
    await page.setViewportSize({ width, height: 812 });
    await expect(opener).toBeVisible();
    await expect(drawer).toBeHidden();
    await noOverflow(page);
  });
}

for (const role of ['HR', 'EMPLOYEE', 'DEPARTMENT_MANAGER', 'SYSTEM_ADMIN']) {
  test(`role ${role}: navigation and nested active route`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page, role, role === 'HR' ? '/hr/employees/employee' : '/app/attendance/history');
    const nav = page.locator('#desktop-sidebar nav');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(role === 'SYSTEM_ADMIN' ? 0 : 1);
    await expect(nav.locator('a[href="/hr/employees"]')).toHaveCount(role === 'HR' ? 1 : 0);
    await expect(nav.locator('a[href="/manager/department"]')).toHaveCount(role === 'DEPARTMENT_MANAGER' ? 1 : 0);
    await expect(nav.locator('a[href="/manager/approvals"]')).toHaveCount(0);
    await expect(nav.locator('a[href="/hr/kpi-inputs"]')).toHaveCount(role === 'HR' ? 1 : 0);
    await expect(nav.locator('a[href="/platform/organizations"]')).toHaveCount(role === 'SYSTEM_ADMIN' ? 1 : 0);
    if (role !== 'SYSTEM_ADMIN') await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('href', role === 'HR' ? '/hr/employees' : '/app/attendance/history');
    if (role === 'HR') {
      const detail = page.getByRole('dialog', { name: 'Chi tiết nhân viên' });
      await expect(detail).toBeVisible();
      await expect(detail.getByRole('heading', { name: 'NV-001' })).toBeVisible();
      await detail.getByRole('button', { name: 'Đóng hộp thoại' }).click();
      await expect(page).toHaveURL(/\/hr\/employees$/);
      await expect(detail).toHaveCount(0);
    }
    await noOverflow(page);
  });
}

test('department manager responsive workspace uses desktop tabs and four mobile destinations', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, 'DEPARTMENT_MANAGER', '/manager/department');
  await expect(page.getByRole('heading', { name: 'Phòng ban', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Phê duyệt' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Đánh giá nhân sự' })).toBeVisible();
  await expect(page.locator('#desktop-sidebar').getByRole('link', { name: 'Phòng ban' })).toBeVisible();
  await noOverflow(page);

  await page.setViewportSize({ width: 375, height: 812 });
  const mobileNav = page.getByRole('navigation', { name: 'Thanh điều hướng nhân viên' });
  for (const label of ['Chấm công', 'Lịch sử', 'Đơn từ', 'Phòng ban']) {
    await expect(mobileNav.getByRole('link', { name: label })).toBeVisible();
  }
  await expect(page.locator('#desktop-sidebar')).toBeHidden();
  await noOverflow(page);
});

test('short viewport scrolls navigation only and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 440 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);
  const header = page.locator('#desktop-sidebar .workspace-sidebar-header');
  const footer = page.locator('#desktop-sidebar .workspace-sidebar-footer');
  const before = { header: await header.boundingBox(), footer: await footer.boundingBox() };
  const nav = page.locator('#desktop-sidebar nav');
  expect(await nav.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await nav.evaluate(el => { el.scrollTop = el.scrollHeight; });
  expect(await header.boundingBox()).toEqual(before.header);
  expect(await footer.boundingBox()).toEqual(before.footer);
  await page.locator('#desktop-sidebar').getByRole('button', { name: 'Thu gọn sidebar' }).click();
  expect(await page.locator('.workspace-sidebar-desktop').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  await noOverflow(page);
});
