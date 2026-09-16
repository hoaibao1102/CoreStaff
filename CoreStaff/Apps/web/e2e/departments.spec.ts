import { test, expect, type Page } from '@playwright/test';

const initialDepartment = { _id: 'd1', organizationId: 'org1', code: 'HR', name: 'Phòng Nhân sự', active: true, createdAt: '2026-09-16T01:00:00Z', updatedAt: '2026-09-16T01:00:00Z' };

async function openDepartments(page: Page, role = 'HR', organizationId: string | null = 'org1') {
  const state = {
    rows: [initialDepartment, { ...initialDepartment, _id: 'd2', code: 'OLD', name: 'Phòng cũ', active: false }],
    requests: [] as { method: string; path: string; body: string | null }[],
    listStatus: 200, detailStatus: 200, mutationStatus: 200,
  };
  await page.addInitScript(() => localStorage.setItem('corestaff:has-session', '1'));
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    if (path.endsWith('/healthz')) return route.fulfill({ json: { status: 'ok', service: 'corestaff-api', mongo: 'configured', timezone: 'Asia/Ho_Chi_Minh' } });
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { success: true, data: { id: 'u1', organizationId, role, fullName: 'Nguyễn Minh Anh', email: 'hr@example.test', status: 'ACTIVE' } } });
    state.requests.push({ method, path: path + url.search, body: request.postData() });
    let data: unknown;
    let status = 200;
    if (path === '/api/hr/departments' && method === 'GET') {
      status = state.listStatus;
      const active = url.searchParams.get('active');
      data = state.rows.filter(row => active === null || row.active === (active === 'true')).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    } else if (method === 'POST') {
      status = state.mutationStatus;
      data = { ...initialDepartment, ...request.postDataJSON(), _id: 'new' };
      if (status === 200) state.rows.push(data as typeof initialDepartment);
    } else {
      const id = path.split('/')[4];
      const row = state.rows.find(item => item._id === id);
      status = row ? (method === 'GET' ? state.detailStatus : state.mutationStatus) : 404;
      if (row && status === 200 && method === 'PATCH') {
        if (path.endsWith('/deactivate')) row.active = false;
        else if (path.endsWith('/activate')) row.active = true;
        else Object.assign(row, request.postDataJSON());
      }
      data = row;
    }
    await route.fulfill({ status, json: status === 200 ? { success: true, data } : { success: false, error: { code: status === 409 ? 'DEPARTMENT_CODE_TAKEN' : status === 404 ? 'DEPARTMENT_NOT_FOUND' : 'ERROR' } } });
  });
  await page.goto('/hr/departments');
  await expect(page.getByRole('heading', { name: 'Phòng ban', exact: true }).or(page.getByText('Bạn cần thuộc một tổ chức để xem phòng ban.'))).toBeVisible();
  return state;
}

test('HR creates, edits only changed fields, and confirms soft deactivation/reactivation', async ({ page }) => {
  const state = await openDepartments(page);
  await page.getByRole('button', { name: 'Tạo phòng ban', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Tạo phòng ban', exact: true }).click();
  await expect(dialog.getByText('Vui lòng nhập mã phòng ban.')).toBeVisible();
  await dialog.getByLabel('Mã phòng ban', { exact: false }).fill('  ENG  ');
  await dialog.getByLabel('Tên phòng ban', { exact: false }).fill('  Phòng Kỹ thuật  ');
  state.mutationStatus = 409;
  await dialog.getByRole('button', { name: 'Tạo phòng ban', exact: true }).click();
  await expect(dialog.getByText(/Mã phòng ban đã tồn tại/)).toBeVisible();
  await expect(dialog.getByLabel('Tên phòng ban', { exact: false })).toHaveValue('  Phòng Kỹ thuật  ');
  state.mutationStatus = 200;
  await dialog.getByRole('button', { name: 'Tạo phòng ban', exact: true }).click();
  await expect(page.getByText('Đã tạo phòng ban mới.')).toBeVisible();
  expect(JSON.parse(state.requests.find(request => request.method === 'POST')!.body!)).toEqual({ code: 'ENG', name: 'Phòng Kỹ thuật' });
  await page.getByRole('button', { name: 'Xem phòng ban Phòng Kỹ thuật', exact: true }).click();
  await dialog.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await dialog.getByLabel('Tên phòng ban', { exact: false }).fill('Kỹ thuật mới');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã cập nhật phòng ban.')).toBeVisible();
  expect(JSON.parse(state.requests.find(request => request.method === 'PATCH')!.body!)).toEqual({ name: 'Kỹ thuật mới' });
  await page.getByRole('button', { name: 'Xem phòng ban Kỹ thuật mới', exact: true }).click();
  await dialog.getByRole('button', { name: 'Vô hiệu hóa', exact: true }).click();
  expect(state.requests.some(request => request.path.endsWith('/deactivate'))).toBe(false);
  await dialog.getByRole('button', { name: 'Xác nhận vô hiệu hóa' }).click();
  await expect(page.getByText('Đã vô hiệu hóa phòng ban.')).toBeVisible();
  expect(state.requests.find(request => request.path.endsWith('/deactivate'))?.body).toBeNull();
  await page.getByRole('button', { name: 'Xem phòng ban Kỹ thuật mới', exact: true }).click();
  await dialog.getByRole('button', { name: 'Kích hoạt lại', exact: true }).click();
  await dialog.getByRole('button', { name: 'Xác nhận kích hoạt' }).click();
  await expect(page.getByText('Đã kích hoạt lại phòng ban.')).toBeVisible();
  expect(state.requests.find(request => request.path.endsWith('/activate'))?.body).toBeNull();
});

for (const role of ['EMPLOYEE', 'DEPARTMENT_MANAGER']) {
  test(`${role} can browse department details but cannot mutate`, async ({ page }) => {
    const state = await openDepartments(page, role);
    await expect(page.getByRole('button', { name: 'Tạo phòng ban', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Xem phòng ban Phòng Nhân sự', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Phòng Nhân sự' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Chỉnh sửa|Vô hiệu hóa|Kích hoạt/ })).toHaveCount(0);
    expect(state.requests.every(request => request.method === 'GET')).toBe(true);
  });
}

test('SYSTEM_ADMIN assigned to a tenant can manage departments', async ({ page }) => {
  const state = await openDepartments(page, 'SYSTEM_ADMIN');
  await expect(page.getByRole('button', { name: 'Tạo phòng ban', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xem phòng ban Phòng Nhân sự', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Chỉnh sửa', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Vô hiệu hóa', exact: true })).toBeVisible();
  expect(state.requests.every(request => request.method === 'GET')).toBe(true);
});

test('status filter sends true/false, search stays local and empty state can be reset', async ({ page }) => {
  const state = await openDepartments(page);
  await page.getByLabel('Trạng thái', { exact: true }).selectOption('inactive');
  await expect(page.getByRole('button', { name: 'Xem phòng ban Phòng cũ', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem phòng ban Phòng Nhân sự', exact: true })).toHaveCount(0);
  expect(state.requests.some(request => request.path.endsWith('?active=false'))).toBe(true);
  await page.getByLabel('Trạng thái', { exact: true }).selectOption('active');
  await expect(page.getByRole('button', { name: 'Xem phòng ban Phòng Nhân sự', exact: true })).toBeVisible();
  expect(state.requests.some(request => request.path.endsWith('?active=true'))).toBe(true);
  const requests = state.requests.length;
  await page.getByLabel('Tìm phòng ban').fill('không có');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy phòng ban' })).toBeVisible();
  expect(state.requests).toHaveLength(requests);
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect(page.getByRole('button', { name: 'Xem phòng ban Phòng cũ', exact: true })).toBeVisible();
});

for (const status of [401, 403, 500]) {
  test(`HTTP ${status} displays an error and retries`, async ({ page }) => {
    const state = await openDepartments(page);
    await expect(page.getByRole('button', { name: 'Làm mới' })).toBeEnabled();
    state.listStatus = status;
    await page.getByRole('button', { name: 'Làm mới' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    state.listStatus = 200;
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await expect(page.getByRole('table')).toBeVisible();
  });
}

test('missing tenant makes no department requests; direct route remains protected', async ({ page }) => {
  const state = await openDepartments(page, 'SYSTEM_ADMIN', null);
  await expect(page.getByText('Bạn cần thuộc một tổ chức để xem phòng ban.')).toBeVisible();
  expect(state.requests).toHaveLength(0);
  await expect(page.locator('nav a[href="/hr/departments"]')).toHaveCount(0);
});

test('detail 404 does not expose an edit form and can be retried', async ({ page }) => {
  const state = await openDepartments(page);
  state.detailStatus = 404;
  await page.getByRole('button', { name: 'Xem phòng ban Phòng Nhân sự', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Không tìm thấy phòng ban.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Chỉnh sửa', exact: true })).toHaveCount(0);
  state.detailStatus = 200;
  await dialog.getByRole('button', { name: 'Thử lại' }).click();
  await expect(dialog.getByRole('heading', { name: 'Phòng Nhân sự' })).toBeVisible();
});

for (const width of [375, 768, 1024, 1440]) {
  test(`list and form fit ${width}px with keyboard focus restoration`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await openDepartments(page);
    await expect(page.getByRole('table')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const create = page.getByRole('button', { name: 'Tạo phòng ban', exact: true });
    await create.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    // Create opens a centered modal, with the first required field focused.
    expect(Math.abs(box!.x + box!.width / 2 - width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(box!.y + box!.height / 2 - 450)).toBeLessThanOrEqual(1);
    await expect(dialog.locator('#department-code')).toBeFocused();
    await dialog.getByLabel('Mã phòng ban', { exact: false }).focus();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(create).toBeFocused();
    expect(errors).toEqual([]);
  });
}
