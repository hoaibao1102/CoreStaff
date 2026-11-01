import { expect, test, type Page, type Route } from '@playwright/test';

const firstDate = '2026-09-15';
const secondDate = '2026-09-16';
const employee = { id: 'employee-user', organizationId: 'org-1', role: 'EMPLOYEE', fullName: 'Browser Test', email: 'browser@example.test', status: 'ACTIVE' };
const reason = 'Tôi quên chấm công khi kết thúc ca';

function confirmation(workDate: string) {
  return {
    enabled: true, workDate, canSubmit: true, actionType: 'CHECK_OUT', blockedReasons: [],
    contextHash: `confirmation-${workDate}`,
    existingPunches: { checkInAt: `${workDate}T01:00:00.000Z`, checkInProvenance: { source: 'OBSERVED' } },
    proposedChanges: { checkOutAt: `${workDate}T10:00:00.000Z`, calculation: { workingMinutes: 480, lateMinutes: 0, earlyMinutes: 0 } },
    requiredWorkingIntervals: [{ from: '08:00', to: '17:00' }], snapshot: { shift: { breakMinutes: 60 } },
    quota: { monthKey: '2026-09', usedSlots: 1, limit: 3, remaining: 2 }, period: { status: 'OPEN', canMutate: true },
  };
}

type Handler = (route: Route, path: string) => Promise<boolean>;
async function openForm(page: Page, handler: Handler = async () => false) {
  const unexpected: string[] = [];
  const writes: Array<{ path: string; body: any; key?: string }> = [];
  await page.addInitScript(() => localStorage.setItem('corestaff:has-session', '1'));
  await page.routeWebSocket('**/*', socket => socket.close());
  // Never continue an API, socket, or external request to Vite's proxies/network.
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/local-api/, '');
    if (path.includes('/socket.io')) return route.fulfill({ status: 200, body: '0{"sid":"mock","upgrades":[],"pingInterval":25000,"pingTimeout":20000}' });
    if (path.startsWith('/api/')) {
      if (request.method() === 'POST') writes.push({ path, body: request.postDataJSON(), key: request.headers()['idempotency-key'] });
      if (await handler(route, path)) return;
      if (path === '/api/healthz') return route.fulfill({ json: { status: 'ok', service: 'corestaff-api', mongo: 'configured', timezone: 'Asia/Ho_Chi_Minh' } });
      if (path === '/api/auth/me') return route.fulfill({ json: { success: true, data: employee } });
      if (path === '/api/employees/me') return route.fulfill({ json: { success: true, data: { _id: 'profile-1', userId: employee.id, employmentStatus: 'ACTIVE' } } });
      if (path === '/api/requests/mine' || path === '/api/notifications' || path === '/api/notifications/unread-count') return route.fulfill({ json: { success: true, data: [] } });
      if (path === '/api/requests/attendance-confirmation-preview') return route.fulfill({ json: { success: true, data: confirmation(url.searchParams.get('date')!) } });
      if (path === '/api/requests' && request.method() === 'POST') return route.fulfill({ status: 201, json: { success: true, data: { _id: 'request-1', status: 'PENDING' } } });
      unexpected.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 501, json: { success: false, message: 'Unmocked API request' } });
    }
    if (url.origin !== 'http://127.0.0.1:4173') {
      unexpected.push(request.url());
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  await page.goto(`/app/ot?type=ATTENDANCE&workDate=${firstDate}&adjustmentType=CHECK_OUT`);
  await expect(page.getByRole('region', { name: 'Xem trước xác nhận công' })).toBeVisible();
  return { unexpected, writes };
}

test('confirmation date change removes the old preview until the matching date resolves', async ({ page }) => {
  let pending: Route | undefined;
  const state = await openForm(page, async (route, path) => {
    if (path.endsWith('/attendance-confirmation-preview') && new URL(route.request().url()).searchParams.get('date') === secondDate) {
      pending = route;
      return true;
    }
    return false;
  });
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Lý do', { exact: true }).fill(reason);
  await expect(dialog.getByRole('button', { name: 'Gửi xác nhận công' })).toBeEnabled();
  await dialog.getByLabel('Ngày', { exact: true }).fill(secondDate);
  await expect(dialog.getByRole('status')).toHaveText('Đang tải xem trước…');
  await expect(dialog.getByRole('region', { name: 'Xem trước xác nhận công' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Gửi xác nhận công' })).toHaveCount(0);
  await expect.poll(() => Boolean(pending)).toBe(true);
  expect(state.writes).toHaveLength(0);
  await pending!.fulfill({ json: { success: true, data: confirmation(secondDate) } });
  await expect(dialog.getByRole('heading', { name: `Xác nhận công · ${secondDate}` })).toBeVisible();
  await expect(dialog.getByText('Tháng 2026-09: đã dùng 1/3, còn 2 lượt.', { exact: false })).toBeVisible();
  await expect(dialog.locator('input[type="time"]')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Gửi xác nhận công' }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toEqual([{ path: '/api/requests', body: { requestKind: 'ATTENDANCE_CONFIRMATION', type: 'ATTENDANCE', workDate: secondDate, reason, previewHash: `confirmation-${secondDate}` }, key: expect.stringMatching(/^[0-9a-f-]{36}$/i) }]);
  expect(state.unexpected).toEqual([]);
});

test('server stale confirmation response blocks resubmission until preview reload', async ({ page }) => {
  let stale = true;
  const state = await openForm(page, async (route, path) => {
    if (path === '/api/requests' && route.request().method() === 'POST' && stale) {
      stale = false;
      await route.fulfill({ status: 409, json: { success: false, error: { code: 'ATTENDANCE_CONFIRMATION_STALE', message: 'ATTENDANCE_CONFIRMATION_STALE' } } });
      return true;
    }
    return false;
  });
  const dialog = page.getByRole('dialog');
  const submit = dialog.getByRole('button', { name: 'Gửi xác nhận công' });
  await dialog.getByLabel('Lý do', { exact: true }).fill(reason);
  await submit.click();
  await expect(dialog.getByRole('alert')).toContainText('Dữ liệu đã thay đổi');
  await expect(submit).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Tải lại xem trước' }).click();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1].key).toBe(state.writes[0].key);
  expect(state.unexpected).toEqual([]);
});

test('OT suggestion fills VN times and submits only after matching server preview', async ({ page }) => {
  let pending: Route | undefined;
  const preview = {
    workDate: firstDate, calculationContract: 'OVERTIME_V2', rawEligibleMinutes: 95,
    payableMinutes: 90, roundingDroppedMinutes: 5, contextHash: 'ot-selected-hash',
    canFile: true, blockedReasons: [],
    policy: { id: 'policy-1', version: 4, minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30 },
    provenance: { checkIn: { source: 'OBSERVED' }, checkOut: { source: 'OBSERVED' } },
  };
  const state = await openForm(page, async (route, path) => {
    if (path === '/api/overtime/schedule') {
      await route.fulfill({ json: { success: true, data: {
        workDate: firstDate, scheduled: { from: `${firstDate}T01:00:00.000Z`, to: `${firstDate}T10:00:00.000Z`, startTime: '08:00', endTime: '17:00', breakMinutes: 60 },
        overtimeType: 'WEEKDAY', calendarType: 'WORKING_DAY', overrideType: null,
        canFile: true, blockedReasons: [], calculationContract: 'OVERTIME_V2',
        suggestedOvertimeIntervals: [{ ...preview, from: `${firstDate}T10:00:00.000Z`, to: `${firstDate}T11:35:00.000Z` }],
      } } });
      return true;
    }
    if (path === '/api/overtime/preview') {
      const body = route.request().postDataJSON();
      if (body.requestedStart === `${firstDate}T17:00:00+07:00` && body.requestedEnd === `${firstDate}T18:35:00+07:00`) pending = route;
      else await route.fulfill({ json: { success: true, data: { ...preview, contextHash: 'old-window', canFile: false, blockedReasons: ['OVERTIME_BELOW_MINIMUM'] } } });
      return true;
    }
    if (path === '/api/overtime') {
      await route.fulfill({ status: 201, json: { success: true, data: { _id: 'ot-1', status: 'PENDING' } } });
      return true;
    }
    return false;
  });
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Chuyển sang OT' }).click();
  await dialog.getByRole('button', { name: '17:00–18:35 · Thực tế 95 phút / tính OT 90 phút' }).click();
  await expect(dialog.getByLabel('Bắt đầu', { exact: true })).toHaveValue('17:00');
  await expect(dialog.getByLabel('Kết thúc', { exact: true })).toHaveValue('18:35');
  await dialog.getByLabel('Lý do', { exact: true }).fill('Hoàn thành kiểm thử phát hành');
  await dialog.getByLabel('Mô tả công việc làm thêm giờ', { exact: true }).fill('Kiểm thử bản vá');
  const retro = dialog.getByLabel('Lý do bổ sung yêu cầu trễ hạn', { exact: true });
  const hasRetro = await retro.count() > 0;
  if (hasRetro) await retro.fill('Bổ sung sau khi đối chiếu giờ thực tế');
  const submit = dialog.getByRole('button', { name: 'Gửi yêu cầu', exact: true });
  await expect(submit).toBeDisabled();
  await expect.poll(() => Boolean(pending)).toBe(true);
  expect(state.writes.filter(w => w.path === '/api/overtime')).toHaveLength(0);
  await pending!.fulfill({ json: { success: true, data: preview } });
  await expect(dialog.getByRole('region', { name: 'Xem trước OT' })).toContainText('Phút đủ điều kiện: 95 · Phút tính OT: 90 · Phút làm tròn bỏ: 5');
  await expect(dialog.getByRole('region', { name: 'Xem trước OT' })).toContainText('Chính sách v4: tối thiểu 60 phút · làm tròn 30 phút.');
  await expect(dialog.getByRole('region', { name: 'Xem trước OT' })).toContainText('Nguồn vào: OBSERVED · Nguồn ra: OBSERVED');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes.filter(w => w.path === '/api/overtime')).toEqual([{ path: '/api/overtime', key: undefined, body: {
    workDate: firstDate, requestedStart: `${firstDate}T17:00:00+07:00`, requestedEnd: `${firstDate}T18:35:00+07:00`,
    reason: 'Hoàn thành kiểm thử phát hành', workDescription: 'Kiểm thử bản vá',
    previewHash: 'ot-selected-hash',
    ...(hasRetro ? { retroactiveReason: 'Bổ sung sau khi đối chiếu giờ thực tế' } : {}),
  } }]);
  expect(state.unexpected).toEqual([]);
});
