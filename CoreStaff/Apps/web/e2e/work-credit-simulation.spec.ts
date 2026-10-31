import { expect, test, type Page } from '@playwright/test';

// Browser acceptance of the real UI with an isolated HTTP boundary; not live-backend E2E.
const endpoint = '/api/hr/policies/work-credit';
const reference = 'Browser acceptance policy';
const initialPolicy = {
  _id: 'work-credit-browser', organizationId: 'org-browser', effectiveFrom: '2026-01-01',
  effectiveTo: '2027-01-01', halfDayMinimumRatio: 0.425, fullDayMinimumRatio: 0.975,
  paidLeaveCreditEnabled: false, incompleteDayRule: 'BLOCK', businessReference: reference,
  active: true, version: 1,
};

async function openLab(page: Page) {
  let policy = { ...initialPolicy };
  const writes: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
  const unexpected: string[] = [];
  let reads = 0;
  await page.addInitScript(() => localStorage.setItem('corestaff:has-session', '1'));
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/local-api/, '');
    if (path.includes('/socket.io')) return route.fulfill({ status: 200, body: '0{"sid":"mock","upgrades":[],"pingInterval":25000,"pingTimeout":20000}' });
    if (path.startsWith('/api/')) {
      const method = request.method();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) writes.push({ method, path, body: request.postDataJSON() });
      if (path === '/api/healthz') return route.fulfill({ json: { status: 'ok', service: 'corestaff-api', mongo: 'configured', timezone: 'Asia/Ho_Chi_Minh' } });
      if (path === '/api/auth/me') return route.fulfill({ json: { success: true, data: { id: 'hr-browser', organizationId: 'org-browser', role: 'HR', fullName: 'Browser HR', email: 'hr@example.test', status: 'ACTIVE' } } });
      if (path === endpoint && method === 'GET') {
        reads += 1;
        return route.fulfill({ json: { success: true, data: [policy] } });
      }
      if (path === `${endpoint}/${policy._id}` && method === 'PATCH') {
        policy = { ...policy, ...request.postDataJSON(), version: policy.version + 1 };
        return route.fulfill({ json: { success: true, data: policy } });
      }
      if (path === '/api/notifications/unread-count') return route.fulfill({ json: { success: true, data: { count: 0 } } });
      if (path === '/api/notifications') return route.fulfill({ json: { success: true, data: [] } });
      unexpected.push(`${method} ${path}`);
      return route.fulfill({ status: 501, json: { success: false, message: 'Unmocked API request' } });
    }
    if (url.origin !== 'http://127.0.0.1:4173') {
      unexpected.push(request.url());
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  await page.goto('/hr/policies/work-credit');
  await expect(page.getByRole('heading', { name: 'Chính sách quy đổi ngày công', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: reference, exact: true })).toBeVisible();
  return { writes, unexpected, reads: () => reads };
}

async function editPolicy(page: Page) {
  await page.getByRole('button', { name: `Mở thao tác chính sách quy đổi ngày công ${reference}` }).click();
  await page.getByRole('menuitem', { name: 'Chỉnh sửa' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('region', { name: 'Policy Simulation Lab' })).toBeVisible();
  return dialog;
}

const halfLabel = 'Ngưỡng nửa ngày (%)';
const fullLabel = 'Ngưỡng đủ ngày (%)';

test('add is blank and edit preserves decimal thresholds until an explicit preset; undo preserves unrelated fields', async ({ page }) => {
  const state = await openLab(page);
  await page.getByRole('button', { name: 'Thêm chính sách', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel(halfLabel, { exact: true })).toHaveValue('');
  await expect(dialog.getByLabel(fullLabel, { exact: true })).toHaveValue('');
  await expect(dialog.getByRole('button', { name: 'Tạo chính sách', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  dialog = await editPolicy(page);
  await expect(dialog.getByLabel(halfLabel, { exact: true })).toHaveValue('42.5');
  await expect(dialog.getByLabel(fullLabel, { exact: true })).toHaveValue('97.5');
  await dialog.getByLabel('Tham chiếu nghiệp vụ', { exact: true }).fill('Unsaved HR reference');
  for (const full of ['100', '85']) {
    await dialog.getByRole('button', { name: `Ví dụ 50–${full}`, exact: true }).click();
    await expect(dialog.getByLabel(halfLabel, { exact: true })).toHaveValue('50');
    await expect(dialog.getByLabel(fullLabel, { exact: true })).toHaveValue(full);
    await expect(dialog.getByLabel('Hiệu lực từ', { exact: true })).toHaveValue('2026-01-01');
    await expect(dialog.getByLabel('Hiệu lực đến', { exact: true })).toHaveValue('2027-01-01');
    await expect(dialog.getByLabel('Tính phép hưởng lương', { exact: true })).toHaveValue('false');
    await expect(dialog.getByLabel('Tham chiếu nghiệp vụ', { exact: true })).toHaveValue('Unsaved HR reference');
    await dialog.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
    await expect(dialog.getByLabel(halfLabel, { exact: true })).toHaveValue('42.5');
    await expect(dialog.getByLabel(fullLabel, { exact: true })).toHaveValue('97.5');
  }
  expect(state.writes).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test('scenario shows the 407/408 cliff without any POST or PATCH', async ({ page }) => {
  const state = await openLab(page);
  const dialog = await editPolicy(page);
  await dialog.getByRole('button', { name: 'Ví dụ 50–85', exact: true }).click();
  const lab = dialog.getByRole('region', { name: 'Policy Simulation Lab' });
  const worked = lab.getByLabel('W — Làm việc trong ca (phút)', { exact: true });
  const summary = lab.locator('[aria-live="polite"]');
  await worked.fill('407');
  await expect(summary).toHaveText('Kết quả: 0.5 đơn vị công — HALF_CREDIT. Chặn: Không');
  await expect(lab).toContainText('Mốc tối thiểu nguyên: nửa ngày 240; đủ ngày 408 phút.');
  await worked.fill('408');
  await expect(summary).toHaveText('Kết quả: 1 đơn vị công — FULL_CREDIT. Chặn: Không');
  await dialog.getByRole('button', { name: 'Ví dụ 50–100', exact: true }).click();
  await expect(summary).toHaveText('Kết quả: 0.5 đơn vị công — HALF_CREDIT. Chặn: Không');
  await lab.getByLabel('S — Nghĩa vụ mẫu (phút)', { exact: true }).selectOption('240');
  await worked.fill('240');
  await expect(summary).toHaveText('Kết quả: 1 đơn vị công — FULL_CREDIT. Chặn: Không');
  expect(state.writes).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test('blank threshold and scenario expose associated errors without a fabricated result', async ({ page }) => {
  const state = await openLab(page);
  const dialog = await editPolicy(page);
  const full = dialog.getByLabel(fullLabel, { exact: true });
  await full.fill('');
  await expect(full).toHaveAttribute('aria-invalid', 'true');
  await expect(full).toHaveAccessibleDescription('Các ngưỡng phải nằm trong khoảng 0–100%.');
  await expect(dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true })).toBeDisabled();
  const lab = dialog.getByRole('region', { name: 'Policy Simulation Lab' });
  await expect(lab.locator('[aria-live="polite"]')).toHaveText('Chưa có kết quả: kiểm tra ngưỡng và số phút.');
  await expect(lab.getByText(/^C:/)).toHaveCount(0);
  await full.fill('97.5');
  const worked = lab.getByLabel('W — Làm việc trong ca (phút)', { exact: true });
  await worked.fill('');
  await expect(worked).toHaveAttribute('aria-invalid', 'true');
  await expect(worked).toHaveAccessibleDescription('Nhập số phút nguyên 0–1440; không để trống.');
  await expect(lab.locator('[aria-live="polite"]')).toHaveText('Chưa có kết quả: kiểm tra ngưỡng và số phút.');
  await expect(lab.getByText(/^C:/)).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test('narrow viewport supports keyboard preset/undo and explicit save persists ratio through a mocked refresh', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await openLab(page);
  const dialog = await editPolicy(page);
  const preset = dialog.getByRole('button', { name: 'Ví dụ 50–85', exact: true });
  await preset.focus();
  await page.keyboard.press('Enter');
  await expect(dialog.getByLabel(fullLabel, { exact: true })).toHaveValue('85');
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Hoàn tác', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog.getByLabel(fullLabel, { exact: true })).toHaveValue('97.5');
  await preset.focus();
  await page.keyboard.press('Enter');
  const worked = dialog.getByLabel('W — Làm việc trong ca (phút)', { exact: true });
  await worked.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('408');
  await expect(dialog.locator('[aria-live="polite"]')).toContainText('Kết quả: 1 đơn vị công');
  const bounds = await dialog.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, viewport: innerWidth }));
  expect(bounds.width).toBeLessThanOrEqual(bounds.viewport);
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1);
  expect(state.writes).toEqual([]);
  const save = dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true });
  await save.focus();
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('alert')).toContainText('Kiểm tra thay đổi ngưỡng: 42.5–97.5% → 50–85%');
  expect(state.writes).toEqual([]);
  await dialog.getByRole('button', { name: 'Xác nhận lưu', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toEqual([{ method: 'PATCH', path: `${endpoint}/${initialPolicy._id}`, body: { halfDayMinimumRatio: 0.5, fullDayMinimumRatio: 0.85 } }]);
  const readsBeforeRefresh = state.reads();
  await page.reload();
  const reopened = await editPolicy(page);
  expect(state.reads()).toBeGreaterThan(readsBeforeRefresh);
  await expect(reopened.getByLabel(halfLabel, { exact: true })).toHaveValue('50');
  await expect(reopened.getByLabel(fullLabel, { exact: true })).toHaveValue('85');
  await expect(reopened.getByLabel('Tham chiếu nghiệp vụ', { exact: true })).toHaveValue(reference);
  await expect(reopened.getByLabel('Tính phép hưởng lương', { exact: true })).toHaveValue('false');
  expect(state.writes).toHaveLength(1);
  expect(state.unexpected).toEqual([]);
});
