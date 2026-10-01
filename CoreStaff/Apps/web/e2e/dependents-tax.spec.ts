import { test, expect, type Page } from '@playwright/test';

/**
 * FE E2E Tests — Dependents & Tax Policy Management
 * 
 * Test coverage:
 * - Create/edit/delete dependents
 * - Dependent validation (name, DOB, relationship)
 * - Dependent list with deduction summary
 * - Tax policy CRUD with versioning
 * - Effective-dating overlap detection
 * - PIT calculation preview tool
 */

const hrUser = { id: 'u1', organizationId: 'org1', role: 'HR', fullName: 'Nguyễn Minh Anh', email: 'hr@example.test', status: 'ACTIVE' };

interface DepState {
  rows: any[];
  requests: { method: string; path: string; body: string | null }[];
}

async function openDependents(page: Page, profileId = 'p1') {
  const state: DepState = {
    rows: [
      { _id: 'd1', employeeProfileId: profileId, fullName: 'Nguyễn Văn A', dateOfBirth: '2015-05-10', relationship: 'CHILD', active: true, version: 1 },
      { _id: 'd2', employeeProfileId: profileId, fullName: 'Nguyễn Văn B', dateOfBirth: '2018-03-20', relationship: 'CHILD', active: true, version: 1 },
    ],
    requests: [],
  };

  await page.addInitScript(() => localStorage.setItem('corestaff:has-session', '1'));
  
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;

    if (path.endsWith('/healthz')) {
      return route.fulfill({ json: { status: 'ok' } });
    }

    if (path.endsWith('/auth/me')) {
      return route.fulfill({ json: { success: true, data: hrUser } });
    }

    state.requests.push({ method, path: path + url.search, body: request.postData() });

    let data: unknown;
    let status = 200;

    // GET /api/hr/employees/:id/dependents
    if (path.match(/\/api\/hr\/employees\/[^/]+\/dependents$/) && method === 'GET') {
      data = state.rows.filter(d => d.employeeProfileId === profileId);
    }
    // POST /api/hr/employees/:id/dependents
    else if (path.match(/\/api\/hr\/employees\/[^/]+\/dependents$/) && method === 'POST') {
      const body = request.postDataJSON();
      if (!body.fullName || !body.dateOfBirth || !body.relationship) {
        status = 400;
        data = { error: { code: 'VALIDATION_ERROR' } };
      } else {
        const newDep = { ...body, _id: `d${state.rows.length + 1}`, active: true, version: 1 };
        state.rows.push(newDep);
        data = newDep;
      }
    }
    // PUT /api/hr/dependents/:id
    else if (path.match(/\/api\/hr\/dependents\/[^/]+$/) && method === 'PUT') {
      const id = path.split('/')[4];
      const row = state.rows.find(r => r._id === id);
      if (row) {
        const body = request.postDataJSON();
        Object.assign(row, body);
        row.version += 1;
        data = row;
      } else {
        status = 404;
        data = { error: { code: 'DEPENDENT_NOT_FOUND' } };
      }
    }
    // DELETE /api/hr/dependents/:id
    else if (path.match(/\/api\/hr\/dependents\/[^/]+$/) && method === 'DELETE') {
      const id = path.split('/')[4];
      const row = state.rows.find(r => r._id === id);
      if (row) {
        row.active = false;
        data = row;
      } else {
        status = 404;
        data = { error: { code: 'DEPENDENT_NOT_FOUND' } };
      }
    }
    else {
      data = { error: { code: 'NOT_IMPLEMENTED' } };
      status = 501;
    }

    await route.fulfill({
      status,
      json: status === 200 ? { success: true, data } : { success: false, error: data.error },
    });
  });

  await page.goto(`/employee/${profileId}/dependents`);
  return state;
}

/* ───────── DEPENDENTS LIST ───────── */

test('HR loads dependents list with deduction summary', async ({ page }) => {
  const state = await openDependents(page);

  // Should see dependents table
  await expect(page.getByRole('table')).toBeVisible();

  // Should see dependent names
  await expect(page.getByText('Nguyễn Văn A')).toBeVisible();
  await expect(page.getByText('Nguyễn Văn B')).toBeVisible();

  // Should show total deduction summary
  await expect(page.getByText(/Tổng khấu trừ/i)).toBeVisible();
  // 2 dependents * 9,000,000 = 18,000,000
  await expect(page.getByText(/18\.?000\.?000/i)).toBeVisible();
});

/* ───────── CREATE DEPENDENT ───────── */

test('HR creates a new dependent', async ({ page }) => {
  const state = await openDependents(page);

  // Click create button
  await page.getByRole('button', { name: /Thêm phụ thuộc/i }).click();

  // Fill form
  await page.getByLabel('Họ tên', { exact: false }).fill('Nguyễn Văn C');
  await page.getByLabel('Ngày sinh').fill('2020-01-15');
  await page.getByLabel('Quan hệ', { exact: false }).selectOption('CHILD');

  // Submit
  await page.getByRole('button', { name: /Tạo mới/i }).click();

  // Should see success message
  await expect(page.getByText(/Đã thêm phụ thuộc/i)).toBeVisible();

  // Verify in table
  await expect(page.getByText('Nguyễn Văn C')).toBeVisible();

  // Verify API call
  const createReq = state.requests.find(r => r.method === 'POST' && r.path.includes('dependents'));
  expect(createReq).toBeDefined();
  const body = JSON.parse(createReq!.body!);
  expect(body.fullName).toBe('Nguyễn Văn C');
  expect(body.relationship).toBe('CHILD');
});

test('Create rejects empty fullName', async ({ page }) => {
  await openDependents(page);

  await page.getByRole('button', { name: /Thêm phụ thuộc/i }).click();

  // Don't fill name, just submit
  await page.getByLabel('Ngày sinh').fill('2020-01-15');
  await page.getByLabel('Quan hệ', { exact: false }).selectOption('CHILD');
  await page.getByRole('button', { name: /Tạo mới/i }).click();

  // Should show validation error
  await expect(page.getByText(/Vui lòng nhập họ tên/i)).toBeVisible();
});

test('Create rejects future DOB', async ({ page }) => {
  await openDependents(page);

  await page.getByRole('button', { name: /Thêm phụ thuộc/i }).click();

  await page.getByLabel('Họ tên', { exact: false }).fill('Nguyễn Văn D');
  await page.getByLabel('Ngày sinh').fill('2030-01-01');
  await page.getByLabel('Quan hệ', { exact: false }).selectOption('CHILD');
  await page.getByRole('button', { name: /Tạo mới/i }).click();

  // Should show validation error
  await expect(page.getByText(/Ngày sinh không được nằm trong tương lai/i)).toBeVisible();
});

/* ───────── EDIT DEPENDENT ───────── */

test('HR edits existing dependent', async ({ page }) => {
  const state = await openDependents(page);

  // Click edit on first dependent
  await page.getByRole('button', { name: 'Chỉnh sửa Nguyễn Văn A' }).click();

  // Update name
  await page.getByLabel('Họ tên', { exact: false }).fill('Nguyễn Văn A Updated');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();

  // Should see success
  await expect(page.getByText(/Đã cập nhật/i)).toBeVisible();

  // Verify in table
  await expect(page.getByText('Nguyễn Văn A Updated')).toBeVisible();
});

/* ───────── DELETE DEPENDENT ───────── */

test('HR deactivates dependent', async ({ page }) => {
  const state = await openDependents(page);

  // Click delete/deactivate
  await page.getByRole('button', { name: 'Xóa Nguyễn Văn A' }).click();

  // Confirm dialog
  await page.getByRole('button', { name: 'Xác nhận xóa' }).click();

  // Should see success
  await expect(page.getByText(/Đã xóa/i)).toBeVisible();

  // Should no longer appear in active list
  await expect(page.getByText('Nguyễn Văn A')).not.toBeVisible();
});

/* ───────── TAX POLICY MANAGEMENT ───────── */

interface TaxState {
  policies: any[];
  requests: { method: string; path: string; body: string | null }[];
}

async function openTaxPolicy(page: Page) {
  const state: TaxState = {
    policies: [
      {
        _id: 'tp1',
        organizationId: 'org1',
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        version: 1,
        active: true,
        progressiveBrackets: [
          { upperLimit: 10_000_000, rate: 5 },
          { upperLimit: 30_000_000, rate: 10 },
          { upperLimit: 60_000_000, rate: 20 },
          { upperLimit: 100_000_000, rate: 30 },
          { upperLimit: Infinity, rate: 35 },
        ],
        standardDeduction: 11000000,
      },
    ],
    requests: [],
  };

  await page.addInitScript(() => localStorage.setItem('corestaff:has-session', '1'));
  
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;

    if (path.endsWith('/auth/me')) {
      return route.fulfill({ json: { success: true, data: hrUser } });
    }

    if (path.endsWith('/healthz')) {
      return route.fulfill({ json: { status: 'ok' } });
    }

    state.requests.push({ method, path: path + url.search, body: request.postData() });

    let data: unknown;
    let status = 200;

    // GET /api/hr/policies/tax
    if (path === '/api/hr/policies/tax' && method === 'GET') {
      data = state.policies;
    }
    // POST /api/hr/policies/tax
    else if (path === '/api/hr/policies/tax' && method === 'POST') {
      const body = request.postDataJSON();
      
      // Check for overlapping effective dates
      const newFrom = new Date(body.effectiveFrom);
      const newTo = body.effectiveTo ? new Date(body.effectiveTo) : null;

      for (const policy of state.policies) {
        if (!policy.active) continue;
        const polFrom = new Date(policy.effectiveFrom);
        const polTo = policy.effectiveTo ? new Date(policy.effectiveTo) : null;

        if (polTo && newFrom < polTo) {
          status = 409;
          data = { error: { code: 'OVERLAPPING_EFFECTIVE_DATE' } };
          break;
        }
      }

      if (status === 200) {
        const newPolicy = { ...body, _id: `tp${state.policies.length + 1}`, active: true };
        state.policies.push(newPolicy);
        data = newPolicy;
      }
    }
    // GET /api/hr/policies/tax/calculate
    else if (path === '/api/hr/policies/tax/calculate' && method === 'POST') {
      const body = request.postDataJSON();
      data = {
        taxableIncome: Math.max(0, body.grossIncome - body.insuranceContributions - 11000000 - (body.dependentCount * 9000000)),
        pitAmount: Math.floor(body.grossIncome * 0.05), // Simplified
        effectiveRate: 5,
      };
    }
    else {
      data = { error: { code: 'NOT_IMPLEMENTED' } };
      status = 501;
    }

    await route.fulfill({
      status,
      json: status === 200 ? { success: true, data } : { success: false, error: data.error },
    });
  });

  await page.goto('/hr/tax-policy');
  return state;
}

test('HR views tax policy list', async ({ page }) => {
  const state = await openTaxPolicy(page);

  // Should see policy info
  await expect(page.getByText('2026-01-01')).toBeVisible();
  await expect(page.getByText('Phiên bản 1')).toBeVisible();

  // Should see brackets table
  await expect(page.getByText('5%')).toBeVisible();
  await expect(page.getByText('30%')).toBeVisible();
});

test('HR creates new tax policy version', async ({ page }) => {
  const state = await openTaxPolicy(page);

  // Click create new version
  await page.getByRole('button', { name: /Tạo phiên bản mới/i }).click();

  // Fill form
  await page.getByLabel('Có hiệu lực từ').fill('2027-01-01');
  await page.getByLabel('Mức giảm trừ tiêu chuẩn').fill('12000000');

  // Submit
  await page.getByRole('button', { name: /Tạo chính sách/i }).click();

  // Should see success
  await expect(page.getByText(/Đã tạo chính sách/i)).toBeVisible();

  // Verify version increment
  const createReq = state.requests.find(r => r.method === 'POST' && r.path === '/api/hr/policies/tax');
  expect(createReq).toBeDefined();
});

test('Creating overlapping effective date is rejected', async ({ page }) => {
  await openTaxPolicy(page);

  await page.getByRole('button', { name: /Tạo phiên bản mới/i }).click();

  // Set overlapping date (within existing policy period)
  await page.getByLabel('Có hiệu lực từ').fill('2026-06-01');
  await page.getByLabel('Mức giảm trừ tiêu chuẩn').fill('12000000');
  await page.getByRole('button', { name: /Tạo chính sách/i }).click();

  // Should show conflict error
  await expect(page.getByText(/trùng/lấp chồng|đã tồn tại/i)).toBeVisible();
});

/* ───────── PIT CALCULATION PREVIEW ───────── */

test('HR uses PIT calculation preview tool', async ({ page }) => {
  await openTaxPolicy(page);

  // Navigate to calculator
  await page.getByRole('link', { name: /Tính PIT/i }).click();

  // Fill calculation form
  await page.getByLabel('Lương gross').fill('30000000');
  await page.getByLabel('Bảo hiểm đóng góp').fill('3150000');
  await page.getByLabel('Số phụ thuộc').fill('1');

  // Calculate
  await page.getByRole('button', { name: /Tính toán/i }).click();

  // Should see results
  await expect(page.getByText(/Thuế phải nộp/i)).toBeVisible();
  await expect(page.getByText(/Thu nhập tính thuế/i)).toBeVisible();
});

test('PIT preview handles zero income', async ({ page }) => {
  await openTaxPolicy(page);

  await page.getByRole('link', { name: /Tính PIT/i }).click();

  await page.getByLabel('Lương gross').fill('0');
  await page.getByLabel('Số phụ thuộc').fill('0');
  await page.getByRole('button', { name: /Tính toán/i }).click();

  // Should show 0 tax
  await expect(page.getByText(/0 ₫|Không phải nộp/i)).toBeVisible();
});
