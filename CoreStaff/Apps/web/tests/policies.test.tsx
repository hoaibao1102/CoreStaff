/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LaborCompliancePolicyScreen } from '../src/screens/LaborCompliancePolicy/LaborCompliancePolicyScreen';
import { OvertimePayPolicyScreen } from '../src/screens/OvertimePayPolicy/OvertimePayPolicyScreen';
import { ToastViewport } from '../src/components/toast';
import type { LaborCompliancePolicy, OvertimePayPolicy } from '../src/services/policies.service';

jest.mock('../src/config/api', () => ({ apiUrl: (base: string, path: string) => base + path }));

const NOW = '2026-09-18T00:00:00.000Z';
const labor: LaborCompliancePolicy = {
  _id: 'l1', organizationId: 'org1', effectiveFrom: NOW, effectiveTo: null,
  normalDailyMinutes: 480, normalWeeklyMinutes: 2880, maxCombinedDailyMinutes: 720,
  maxMonthlyOvertimeMinutes: 2400, maxAnnualOvertimeMinutes: 20000,
  exceptionalAnnualOvertimeMinutes: 24000, warningThresholdPercent: 80,
  probationMinimumRate: 0.85, legalReference: 'BLLĐ 45/2019/QH14', version: 1, active: true,
};
const labor2: LaborCompliancePolicy = {
  ...labor, _id: 'l2', effectiveFrom: '2026-06-01', effectiveTo: NOW,
  legalReference: 'Nghị định 145', version: 2,
};
const overtime: OvertimePayPolicy = {
  _id: 'o1', organizationId: 'org1', effectiveFrom: NOW, effectiveTo: null,
  workingDayRate: 1.5, weeklyOffRate: 2, publicHolidayRate: 3,
  legalReference: 'BLLĐ 45/2019/QH14', version: 1, active: true,
};
const overtime2: OvertimePayPolicy = {
  ...overtime, _id: 'o2', effectiveFrom: '2026-06-01', effectiveTo: NOW,
  workingDayRate: 2, weeklyOffRate: 2.5, publicHolidayRate: 3.5,
  legalReference: 'Nghị định 145', version: 2,
};

let root: Root;
let container: HTMLDivElement;
let fetchMock: jest.Mock;
let laborRows: LaborCompliancePolicy[] = [];
let overtimeRows: OvertimePayPolicy[] = [];

const jsonResponse = (data: unknown, http = 200, errorCode = '') => ({
  ok: http === 200, status: http,
  text: async () => JSON.stringify(http === 200 ? { success: true, data } : { success: false, error: { code: errorCode } }),
});

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  laborRows = [labor, labor2];
  overtimeRows = [overtime, overtime2];

  fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(String(url));
    const method = init?.method ?? 'GET';
    const p = path.pathname;

    if (p.endsWith('/api/hr/policies/labor') && method === 'POST') {
      const posted = JSON.parse(String(init?.body));
      return jsonResponse({ ...labor, _id: 'l-new', ...posted });
    }
    if (p.endsWith('/api/hr/policies/overtime') && method === 'POST') {
      const posted = JSON.parse(String(init?.body));
      return jsonResponse({ ...overtime, _id: 'o-new', ...posted });
    }
    if (/\/api\/hr\/policies\/labor\/[^/]+$/.test(p)) {
      const id = p.split('/').pop();
      const row = laborRows.find(r => r._id === id);
      if (!row) return jsonResponse({}, 404, 'LABOR_POLICY_NOT_FOUND');
      if (method === 'PATCH') {
        const body = JSON.parse(String(init?.body));
        return jsonResponse({ ...row, ...body, version: (row.version ?? 1) + 1 });
      }
      return jsonResponse(row);
    }
    if (/\/api\/hr\/policies\/overtime\/[^/]+$/.test(p)) {
      const id = p.split('/').pop();
      const row = overtimeRows.find(r => r._id === id);
      if (!row) return jsonResponse({}, 404, 'OVERTIME_POLICY_NOT_FOUND');
      if (method === 'PATCH') {
        const body = JSON.parse(String(init?.body));
        return jsonResponse({ ...row, ...body, version: (row.version ?? 1) + 1 });
      }
      return jsonResponse(row);
    }
    if (p.endsWith('/api/hr/policies/labor')) return jsonResponse(laborRows);
    if (p.endsWith('/api/hr/policies/overtime')) return jsonResponse(overtimeRows);
    return jsonResponse({}, 404, 'NOT_FOUND');
  });
  globalThis.fetch = fetchMock;
});

afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.restoreAllMocks(); });

const settle = async () => { await act(async () => { await Promise.resolve(); }); };
async function render(screen: React.ReactNode) { await act(async () => root.render(<>{screen}<ToastViewport /></>)); }
async function clickText(text: string) {
  const button = [...document.body.querySelectorAll('button')].find(b => b.textContent?.includes(text));
  expect(button).toBeDefined();
  await act(async () => button!.click());
  await settle();
}
async function setInput(id: string, value: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  expect(input).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function setSelect(id: string, value: string) {
  const select = document.getElementById(id) as HTMLSelectElement;
  expect(select).not.toBeNull();
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
async function openRowMenu(ariaLabelPrefix: string, itemText: string) {
  // base-ui Menu opens on `mousedown` (not click) and defers the state update
  // to a requestAnimationFrame; settle() must run a REAL timer so jsdom's
  // polyfilled rAF fires — a microtask flush would leave the frame pending.
  const menu = [...document.body.querySelectorAll('button')].find(b => b.getAttribute('aria-label')?.startsWith(ariaLabelPrefix));
  expect(menu).toBeDefined();
  await act(async () => {
    menu!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    await new Promise(r => setTimeout(r, 100));
  });
  const item = [...document.body.querySelectorAll('[role="menuitem"]')].find(el => el.textContent?.includes(itemText));
  expect(item).toBeDefined();
  await act(async () => {
    item!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await new Promise(r => setTimeout(r, 100));
  });
}

/* ───────── Labor Compliance Policy screen ───────── */

test('labor lists effective-dated policies with version and status badge', async () => {
  await render(<LaborCompliancePolicyScreen apiBase="https://api.test" />);
  expect(container.textContent).toContain('BLLĐ 45/2019/QH14');
  expect(container.textContent).toContain('Nghị định 145');
  expect(container.textContent).toContain('v1');
  expect(container.textContent).toContain('v2');
  expect(container.textContent).toContain('Đang hiệu lực');
  expect(container.textContent).toContain('8 giờ');  // 480 phút
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('labor empty state when the list endpoint returns nothing', async () => {
  laborRows = [];
  await render(<LaborCompliancePolicyScreen apiBase="https://api.test" />);
  expect(container.textContent).toContain('Chưa có chính sách tuân thủ lao động nào.');
});

test('labor client-side search filters rows by legal reference', async () => {
  await render(<LaborCompliancePolicyScreen apiBase="https://api.test" />);
  await setInput('labor-policy-search', 'Nghị định');
  expect(container.textContent).toContain('Nghị định 145');
  expect(container.textContent).not.toContain('BLLĐ 45/2019/QH14');
});

test('labor create posts the full §30B.1 DTO and refetches', async () => {
  await render(<LaborCompliancePolicyScreen apiBase="https://api.test" />);
  await clickText('Thêm chính sách');
  await setInput('labor-policy-effectiveFrom', '2027-01-01');
  await setInput('labor-policy-normalDailyMinutes', '9');
  await setInput('labor-policy-normalWeeklyMinutes', '50');
  await setInput('labor-policy-maxCombinedDailyMinutes', '13');
  await setInput('labor-policy-maxMonthlyOvertimeMinutes', '50');
  await setInput('labor-policy-maxAnnualOvertimeMinutes', '366.6667');
  await setInput('labor-policy-exceptionalAnnualOvertimeMinutes', '433.3333');
  await setInput('labor-policy-warningThresholdPercent', '85');
  await setInput('labor-policy-probationMinimumRate', '0.9');
  await setInput('labor-policy-legalReference', 'BLLĐ 2019');
  await setSelect('labor-policy-active', 'true');
  await clickText('Tạo chính sách');

  const request = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/api/hr/policies/labor') && i?.method === 'POST');
  expect(request).toBeDefined();
  const body = JSON.parse(String(request![1].body));
  expect(body).toEqual({
    effectiveFrom: '2027-01-01',
    normalDailyMinutes: 540, normalWeeklyMinutes: 3000,
    maxCombinedDailyMinutes: 780, maxMonthlyOvertimeMinutes: 3000,
    maxAnnualOvertimeMinutes: 22000, exceptionalAnnualOvertimeMinutes: 26000,
    warningThresholdPercent: 85, probationMinimumRate: 0.9,
    legalReference: 'BLLĐ 2019', active: true,
  });
  // After a successful create the screen refetches the list.
  const refetch = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/api/hr/policies/labor')).length;
  expect(refetch).toBeGreaterThanOrEqual(2);
});

test('labor edit PATCHes only changed fields', async () => {
  await render(<LaborCompliancePolicyScreen apiBase="https://api.test" />);
  await openRowMenu('Mở thao tác chính sách', 'Chỉnh sửa');
  await setInput('labor-policy-warningThresholdPercent', '90');
  await clickText('Lưu thay đổi');

  const request = fetchMock.mock.calls.find(([u, i]) => /\/api\/hr\/policies\/labor\/l1$/.test(new URL(String(u)).pathname) && i?.method === 'PATCH');
  expect(request).toBeDefined();
  const body = JSON.parse(String(request![1].body));
  expect(body).toEqual({ warningThresholdPercent: 90 });
});

test('labor create surfaces EFFECTIVE_DATE_OVERLAP as a toast', async () => {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (new URL(String(url)).pathname.endsWith('/api/hr/policies/labor') && init?.method === 'POST') {
      return jsonResponse({}, 409, 'EFFECTIVE_DATE_OVERLAP');
    }
    return jsonResponse(laborRows);
  });
  await render(<LaborCompliancePolicyScreen apiBase="https://api.test" />);
  await clickText('Thêm chính sách');
  await setInput('labor-policy-effectiveFrom', '2027-01-01');
  await setInput('labor-policy-normalDailyMinutes', '9');
  await setInput('labor-policy-normalWeeklyMinutes', '50');
  await setInput('labor-policy-maxCombinedDailyMinutes', '13');
  await setInput('labor-policy-maxMonthlyOvertimeMinutes', '50');
  await setInput('labor-policy-maxAnnualOvertimeMinutes', '366.6667');
  await setInput('labor-policy-exceptionalAnnualOvertimeMinutes', '433.3333');
  await setInput('labor-policy-warningThresholdPercent', '85');
  await setInput('labor-policy-probationMinimumRate', '0.9');
  await setInput('labor-policy-legalReference', 'BLLĐ 2019');
  await clickText('Tạo chính sách');
  await settle();
  expect(document.body.textContent).toContain('trùng khoảng thời gian hiệu lực');
});

/* ───────── Overtime Pay Policy screen ───────── */

test('overtime lists rates as multipliers with formatRate', async () => {
  await render(<OvertimePayPolicyScreen apiBase="https://api.test" />);
  expect(container.textContent).toContain('BLLĐ 45/2019/QH14');
  expect(container.textContent).toContain('x1.5');
  expect(container.textContent).toContain('x2.0');
  expect(container.textContent).toContain('x3.0');
  expect(container.textContent).toContain('x2.5');
  expect(container.textContent).toContain('x3.5');
});

test('overtime create posts the rates DTO (multipliers, not percentages)', async () => {
  await render(<OvertimePayPolicyScreen apiBase="https://api.test" />);
  await clickText('Thêm chính sách');
  await setInput('overtime-policy-effectiveFrom', '2027-01-01');
  await setInput('overtime-policy-workingDayRate', '1.5');
  await setInput('overtime-policy-weeklyOffRate', '2');
  await setInput('overtime-policy-publicHolidayRate', '3');
  await setInput('overtime-policy-legalReference', 'BLLĐ 45/2019/QH14');
  await clickText('Tạo chính sách');

  const request = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/api/hr/policies/overtime') && i?.method === 'POST');
  expect(request).toBeDefined();
  const body = JSON.parse(String(request![1].body));
  expect(body).toEqual({
    effectiveFrom: '2027-01-01',
    workingDayRate: 1.5, weeklyOffRate: 2, publicHolidayRate: 3,
    legalReference: 'BLLĐ 45/2019/QH14', active: true,
  });
});

test('overtime status filter shows only active rows', async () => {
  overtimeRows = [
    { ...overtime, active: true },
    { ...overtime2, active: false },
  ];
  await render(<OvertimePayPolicyScreen apiBase="https://api.test" />);
  await setSelect('overtime-policy-status', 'active');
  expect(container.textContent).toContain('BLLĐ 45/2019/QH14');
  expect(container.textContent).not.toContain('Nghị định 145');
});