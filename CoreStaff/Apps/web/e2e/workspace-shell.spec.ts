import { test, expect, type Page } from '@playwright/test';

const user = { id: 'test-user', organizationId: 'test-org', role: 'HR', fullName: 'Nguyễn Thị Minh Anh', email: 'sidebar@example.test', status: 'ACTIVE' };
const errors = new WeakMap<Page, string[]>();

async function openApp(page: Page, role = 'HR', path = '/overview') {
  await page.addInitScript(() => localStorage.setItem('corestaff:has-session', '1'));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let data: unknown = [];
    if (url.pathname.endsWith('/auth/me')) data = { ...user, role };
    if (url.pathname.endsWith('/employees/me')) data = { _id: 'employee', userId: user.id, employmentStatus: 'ACTIVE' };
    await route.fulfill({ json: url.pathname.endsWith('/healthz')
      ? { status: 'ok', mongo: 'configured', service: 'test', timezone: 'Asia/Ho_Chi_Minh' }
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
    await expect(nav.locator('a[href="/manager/approvals"]')).toHaveCount(role === 'DEPARTMENT_MANAGER' ? 1 : 0);
    await expect(nav.locator('a[href="/platform/organizations"]')).toHaveCount(role === 'SYSTEM_ADMIN' ? 1 : 0);
    if (role !== 'SYSTEM_ADMIN') await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('href', role === 'HR' ? '/hr/employees' : '/app/attendance/history');
    await noOverflow(page);
  });
}

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
