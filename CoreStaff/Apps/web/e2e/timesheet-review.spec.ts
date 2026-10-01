import { test, expect, type Page } from '@playwright/test';

/**
 * FE E2E Tests — Timesheet Period Review & Close Workflow
 * 
 * Test coverage:
 * - Load periods list with status badges
 * - View period detail with stats cards
 * - Progress indicators (summaries generated, attendance complete)
 * - Blockers warning card (red) when issues exist
 * - Missing summaries warning card (yellow)
 * - Close confirmation card (green)
 * - Close action with loading state
 * - Success state animation after close
 * - Reopen period dialog with mandatory reason validation
 */

const hrUser = { id: 'u1', organizationId: 'org1', role: 'HR', fullName: 'Nguyễn Minh Anh', email: 'hr@example.test', status: 'ACTIVE' };

interface PeriodState {
  rows: any[];
  requests: { method: string; path: string; body: string | null }[];
}

async function openTimesheetReview(page: Page) {
  const state: PeriodState = {
    rows: [
      {
        _id: 'p1',
        organizationId: 'org1',
        period: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        status: 'READY_TO_CLOSE',
        version: 1,
        active: true,
        summariesGenerated: 5,
        totalEmployees: 6,
        attendanceComplete: 5,
        pendingApprovals: 0,
        hasBlockers: false,
        missingSummaries: false,
        closedBy: null,
        closedAt: null,
      },
      {
        _id: 'p2',
        organizationId: 'org1',
        period: '2026-09',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        status: 'CLOSED',
        version: 1,
        active: true,
        summariesGenerated: 6,
        totalEmployees: 6,
        attendanceComplete: 6,
        pendingApprovals: 0,
        hasBlockers: false,
        missingSummaries: false,
        closedBy: 'u1',
        closedAt: '2026-10-02T08:00:00Z',
      },
      {
        _id: 'p3',
        organizationId: 'org1',
        period: '2026-08',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        status: 'REVIEWING',
        version: 2,
        active: true,
        summariesGenerated: 4,
        totalEmployees: 6,
        attendanceComplete: 5,
        pendingApprovals: 2,
        hasBlockers: true,
        missingSummaries: true,
        reopenReason: 'Điều chỉnh công ngày 15/08',
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

    if (path.endsWith('/healthz')) {
      return route.fulfill({ json: { status: 'ok', service: 'corestaff-api' } });
    }

    if (path.endsWith('/auth/me')) {
      return route.fulfill({ json: { success: true, data: hrUser } });
    }

    state.requests.push({ method, path: path + url.search, body: request.postData() });

    let data: unknown;
    let status = 200;

    // GET /api/timesheet-periods
    if (path === '/api/timesheet-periods' && method === 'GET') {
      data = state.rows;
    }
    // GET /api/timesheet-periods/:id
    else if (path.match(/\/api\/timesheet-periods\/[^/]+$/) && method === 'GET') {
      const id = path.split('/')[4];
      const row = state.rows.find(r => r._id === id);
      status = row ? 200 : 404;
      data = row || { error: { code: 'PERIOD_NOT_FOUND' } };
    }
    // PUT /api/timesheet-periods/:id/status
    else if (path.match(/\/api\/timesheet-periods\/[^/]+\/status$/) && method === 'PUT') {
      const id = path.split('/')[4];
      const row = state.rows.find(r => r._id === id);
      if (row) {
        const body = request.postDataJSON();
        row.status = body.status;
        data = { ...row };
      } else {
        status = 404;
        data = { error: { code: 'PERIOD_NOT_FOUND' } };
      }
    }
    // PUT /api/timesheet-periods/:id/close
    else if (path.match(/\/api\/timesheet-periods\/[^/]+\/close$/) && method === 'PUT') {
      const id = state.rows.findIndex(r => r._id === path.split('/')[4]);
      if (id !== -1) {
        state.rows[id].status = 'CLOSED';
        state.rows[id].closedBy = 'u1';
        state.rows[id].closedAt = new Date().toISOString();
        data = {
          data: {
            period: state.rows[id],
            summariesCreated: 1,
            snapshotsCreated: 1,
          },
        };
      } else {
        status = 404;
        data = { error: { code: 'PERIOD_NOT_FOUND' } };
      }
    }
    // POST /api/timesheet-periods/:id/reopen
    else if (path.match(/\/api\/timesheet-periods\/[^/]+\/reopen$/) && method === 'POST') {
      const id = path.split('/')[4];
      const row = state.rows.find(r => r._id === id);
      if (row) {
        const body = request.postDataJSON();
        if (!body.reason || body.reason.length < 10) {
          status = 400;
          data = { error: { code: 'REASON_TOO_SHORT' } };
        } else {
          row.status = 'REVIEWING';
          row.version += 1;
          row.reopenReason = body.reason;
          data = { data: row };
        }
      } else {
        status = 404;
        data = { error: { code: 'PERIOD_NOT_FOUND' } };
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

  await page.goto('/timesheet/review');
  return state;
}

/* ───────── PERIODS LIST ───────── */

test('HR loads periods list with status badges', async ({ page }) => {
  const state = await openTimesheetReview(page);

  // Should see period table
  await expect(page.getByRole('table')).toBeVisible();

  // Should see status badges
  await expect(page.getByText('READY_TO_CLOSE')).toBeVisible();
  await expect(page.getByText('CLOSED')).toBeVisible();
  await expect(page.getByText('REVIEWING')).toBeVisible();

  // Should see period info
  await expect(page.getByText('2026-10')).toBeVisible();
  await expect(page.getByText('2026-09')).toBeVisible();
  await expect(page.getByText('2026-08')).toBeVisible();
});

/* ───────── PERIOD DETAIL VIEW ───────── */

test('HR views period detail with stats cards', async ({ page }) => {
  const state = await openTimesheetReview(page);

  // Click on READY_TO_CLOSE period to view detail
  await page.getByText('2026-10').click();

  // Should see stats cards
  await expect(page.getByText('Tổng số nhân viên')).toBeVisible();
  await expect(page.getByText('6')).toBeVisible();

  // Should see progress bars
  await expect(page.getByText('Tóm tắt đã tạo')).toBeVisible();
  await expect(page.getByText('5/6')).toBeVisible();

  // Should see attendance progress
  await expect(page.getByText('Công hoàn thành')).toBeVisible();
  await expect(page.getByText('5/6')).toBeVisible();
});

test('HR sees blockers warning card for REVIEWING period', async ({ page }) => {
  const state = await openTimesheetReview(page);

  // Click on REVIEWING period (p3) which has blockers
  await page.getByText('2026-08').click();

  // Should see red blockers warning
  await expect(page.getByText('CẢN ĐỪNG ĐÓ GÓI')).toBeVisible();

  // Should see missing summaries warning (yellow)
  await expect(page.getByText('Chưa đủ tóm tắt')).toBeVisible();
});

test('HR sees success-ready state for READY_TO_CLOSE period', async ({ page }) => {
  const state = await openTimesheetReview(page);

  // Click on READY_TO_CLOSE period (p1)
  await page.getByText('2026-10').click();

  // Should see green close confirmation card
  await expect(page.getByText('Sẵn sàng đóng')).toBeVisible();

  // Should see close button
  await expect(page.getByRole('button', { name: /Đóng kỳ này/i })).toBeVisible();
});

/* ───────── CLOSE PERIOD WORKFLOW ───────── */

test('HR closes period successfully', async ({ page }) => {
  const state = await openTimesheetReview(page);

  // Click on READY_TO_CLOSE period
  await page.getByText('2026-10').click();

  // Click close button
  await page.getByRole('button', { name: /Đóng kỳ này/i }).click();

  // Should see confirmation dialog
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Xác nhận đóng kỳ')).toBeVisible();

  // Confirm close
  await page.getByRole('button', { name: /Xác nhận/i }).click();

  // Should show loading state
  await expect(page.getByRole('button', { name: /Đóng kỳ này/i })).toBeDisabled();

  // Should see success state
  await expect(page.getByText('Đã đóng kỳ thành công')).toBeVisible();

  // Verify API call was made
  const closeRequest = state.requests.find(r => r.path.includes('/close') && r.method === 'PUT');
  expect(closeRequest).toBeDefined();
});

test('HR cancels close period action', async ({ page }) => {
  const state = await openTimesheetReview(page);

  await page.getByText('2026-10').click();
  await page.getByRole('button', { name: /Đóng kỳ này/i }).click();

  // Cancel
  await page.getByRole('button', { name: /Hủy/i }).click();

  // Dialog should be closed
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

/* ───────── REOPEN PERIOD DIALOG ───────── */

test('HR reopens closed period with valid reason', async ({ page }) => {
  const state = await openTimesheetReview(page);

  // Click on CLOSED period (p2)
  await page.getByText('2026-09').click();

  // Click reopen button
  await page.getByRole('button', { name: /Mở lại/i }).click();

  // Should see dialog
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Lý do mở lại')).toBeVisible();

  // Enter valid reason (>= 10 chars)
  await page.getByLabel('Lý do mở lại', { exact: false }).fill('Nhân viên ABC cần điều chỉnh công ngày 15/09');

  // Submit
  await page.getByRole('button', { name: /Xác nhận/i }).click();

  // Should see success message
  await expect(page.getByText('Đã mở lại kỳ')).toBeVisible();

  // Verify API call
  const reopenRequest = state.requests.find(r => r.path.includes('/reopen') && r.method === 'POST');
  expect(reopenRequest).toBeDefined();
  const body = JSON.parse(reopenRequest!.body!);
  expect(body.reason.length).toBeGreaterThanOrEqual(10);
});

test('Reopen dialog rejects short reason', async ({ page }) => {
  const state = await openTimesheetReview(page);

  await page.getByText('2026-09').click();
  await page.getByRole('button', { name: /Mở lại/i }).click();

  // Enter short reason (< 10 chars)
  await page.getByLabel('Lý do mở lại', { exact: false }).fill('Sai');

  // Submit should fail validation
  await page.getByRole('button', { name: /Xác nhận/i }).click();

  // Should show validation error
  await expect(page.getByText('Lý do phải có ít nhất 10 ký tự')).toBeVisible();
});

test('Reopen dialog requires reason before submit', async ({ page }) => {
  const state = await openTimesheetReview(page);

  await page.getByText('2026-09').click();
  await page.getByRole('button', { name: /Mở lại/i }).click();

  // Don't enter reason, just submit
  await page.getByRole('button', { name: /Xác nhận/i }).click();

  // Should show validation error
  await expect(page.getByText('Vui lòng nhập lý do')).toBeVisible();
});

/* ───────── TENANT ISOLATION ───────── */

test('HR cannot see other tenant periods', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('corestaff:has-session', '1'));
  
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith('/auth/me')) {
      return route.fulfill({ json: { success: true, data: { ...hrUser, organizationId: 'other-org' } } });
    }

    if (path === '/api/timesheet-periods' && method === 'GET') {
      return route.fulfill({ json: { success: true, data: [] } });
    }

    await route.fulfill({ json: { success: false, error: { code: 'NOT_FOUND' } }, status: 404 });
  });

  await page.goto('/timesheet/review');

  // Should show empty state
  await expect(page.getByText(/Không có kỳ|iền trống|chưa có kỳ/i)).toBeVisible();
});

/* ───────── ERROR HANDLING ───────── */

test('Shows error when close fails', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('corestaff:has-session', '1'));
  
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path.endsWith('/auth/me')) {
      return route.fulfill({ json: { success: true, data: hrUser } });
    }

    if (path === '/api/timesheet-periods' && method === 'GET') {
      return route.fulfill({ json: { success: true, data: [{ _id: 'p1', period: '2026-10', status: 'READY_TO_CLOSE' }] } });
    }

    if (path.match(/\/close$/) && method === 'PUT') {
      return route.fulfill({
        json: { success: false, error: { code: 'SUMMARY_GENERATION_FAILED' } },
        status: 500,
      });
    }

    await route.fulfill({ json: { success: true, data: {} } });
  });

  await page.goto('/timesheet/review');
  await page.getByText('2026-10').click();
  await page.getByRole('button', { name: /Đóng kỳ này/i }).click();
  await page.getByRole('button', { name: /Xác nhận/i }).click();

  // Should show error toast/message
  await expect(page.getByText(/Đóng kỳ không thành công|Lỗi/i)).toBeVisible();
});
