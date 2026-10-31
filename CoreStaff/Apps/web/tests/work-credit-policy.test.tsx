/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorkCreditPolicyScreen } from '../src/screens/WorkCreditPolicy/WorkCreditPolicyScreen';
import { ToastViewport } from '../src/components/toast';
import type { WorkCreditPolicy } from '../src/services/policies.service';

jest.mock('../src/config/api', () => ({ apiUrl: (base: string, path: string) => base + path }));
jest.mock('../src/components/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, render: _render, ...props }: { children: React.ReactNode; render?: React.ReactElement } & React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button role="menuitem" {...props}>{children}</button>,
}));

const policy: WorkCreditPolicy = {
  _id: 'w1', organizationId: 'org1', effectiveFrom: '2026-09-18T00:00:00.000Z', effectiveTo: null,
  halfDayMinimumRatio: 0.5, fullDayMinimumRatio: 0.9, paidLeaveCreditEnabled: true,
  incompleteDayRule: 'BLOCK', businessReference: 'Quy chế công 2026', version: 3, active: true,
};
let root: Root;
let container: HTMLDivElement;
let fetchMock: jest.Mock;
let rows: WorkCreditPolicy[];
const response = (data: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify({ success: true, data }) });

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  rows = [policy];
  fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const method = init?.method ?? 'GET';
    if (path.endsWith('/api/hr/policies/work-credit') && method === 'POST') return response({ ...policy, ...JSON.parse(String(init?.body)) });
    if (/\/api\/hr\/policies\/work-credit\/w1$/.test(path) && method === 'PATCH') return response({ ...policy, ...JSON.parse(String(init?.body)), version: 4 });
    if (path.endsWith('/api/hr/policies/work-credit')) return response(rows);
    return { ok: false, status: 404, text: async () => JSON.stringify({ success: false, error: { code: 'NOT_FOUND' } }) };
  });
  globalThis.fetch = fetchMock;
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const settle = async () => { await act(async () => { await Promise.resolve(); }); };
async function render() { await act(async () => root.render(<><WorkCreditPolicyScreen apiBase="https://api.test" /><ToastViewport /></>)); }
async function clickText(text: string) { const button = [...document.body.querySelectorAll('button')].find(b => b.textContent?.includes(text)); expect(button).toBeDefined(); await act(async () => button!.click()); await settle(); }
async function setInput(id: string, value: string) { const input = document.getElementById(id) as HTMLInputElement; expect(input).not.toBeNull(); await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); }
async function setSelect(id: string, value: string) { const select = document.getElementById(id) as HTMLSelectElement; expect(select).not.toBeNull(); await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); }); }

it('lists effective policy values and the regeneration impact warning', async () => {
  await render();
  expect(container.textContent).toContain('Quy chế công 2026');
  expect(container.textContent).toContain('50%');
  expect(container.textContent).toContain('90%');
  expect(container.textContent).toContain('Có tính phép hưởng lương');
  expect(container.textContent).toContain('Chặn khi chưa hoàn tất');
  expect(container.textContent).toContain('v3');
  expect(container.textContent).toContain('Đang hiệu lực');
  expect(container.textContent).toContain('Thay đổi có thể làm mất hiệu lực xác nhận ở các kỳ mở giao với khoảng hiệu lực; cần kiểm tra lại trước chốt. Dữ liệu đã chốt dùng snapshot đã lưu và không tự đổi. Chỉ lưu chính sách đã được doanh nghiệp phê duyệt.');
});

it('shows an empty state', async () => {
  rows = [];
  await render();
  expect(container.textContent).toContain('Chưa có chính sách quy đổi ngày công nào.');
});

it('creates a policy with typed ratios and behavior', async () => {
  await render(); await clickText('Thêm chính sách');
  await setInput('work-credit-policy-effectiveFrom', '2027-01-01');
  await setInput('work-credit-policy-halfDayMinimumRatio', '55');
  await setInput('work-credit-policy-fullDayMinimumRatio', '95');
  await setInput('work-credit-policy-businessReference', 'Quy chế 2027');
  await setSelect('work-credit-policy-paidLeaveCreditEnabled', 'true');
  await clickText('Tạo chính sách');
  const request = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/api/hr/policies/work-credit') && i?.method === 'POST');
  expect(JSON.parse(String(request![1].body))).toEqual({ effectiveFrom: '2027-01-01', halfDayMinimumRatio: 0.55, fullDayMinimumRatio: 0.95, paidLeaveCreditEnabled: true, incompleteDayRule: 'BLOCK', businessReference: 'Quy chế 2027', active: true });
});

it('edits only changed fields', async () => {
  await render();
  const edit = [...document.body.querySelectorAll('[role="menuitem"]')].find(el => el.textContent?.includes('Chỉnh sửa')) as HTMLButtonElement;
  expect(edit).toBeDefined(); await act(async () => edit.click());
  await setInput('work-credit-policy-fullDayMinimumRatio', '92'); await clickText('Lưu thay đổi');
  expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(false);
  await clickText('Xác nhận lưu');
  const request = fetchMock.mock.calls.find(([u, i]) => /\/api\/hr\/policies\/work-credit\/w1$/.test(new URL(String(u)).pathname) && i?.method === 'PATCH');
  expect(JSON.parse(String(request![1].body))).toEqual({ fullDayMinimumRatio: 0.92 });
});

it('requires explicit presets, supports threshold-only undo and rejects blank half', async () => {
  await render(); await clickText('Thêm chính sách');
  const half = () => document.getElementById('work-credit-policy-halfDayMinimumRatio') as HTMLInputElement;
  expect(half().value).toBe('');
  await setInput('work-credit-policy-effectiveFrom', '2027-01-01');
  await setInput('work-credit-policy-businessReference', 'Giữ tham chiếu');
  await setInput('work-credit-policy-halfDayMinimumRatio', '51.23456789');
  await setInput('work-credit-policy-fullDayMinimumRatio', '99.123456789');
  await clickText('Ví dụ 50–85');
  expect(half().value).toBe('50');
  expect(document.body.textContent).toContain('51.23456789–99.123456789% → 50–85%');
  await setInput('work-credit-policy-businessReference', 'Giữ cả thay đổi sau preset');
  await clickText('Hoàn tác');
  expect(half().value).toBe('51.23456789');
  expect((document.getElementById('work-credit-policy-businessReference') as HTMLInputElement).value).toBe('Giữ cả thay đổi sau preset');
  await setInput('work-credit-policy-halfDayMinimumRatio', '');
  expect([...document.body.querySelectorAll('button')].find(b => b.textContent === 'Tạo chính sách')!.disabled).toBe(true);
  expect(half().getAttribute('aria-invalid')).toBe('true');
  expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(false);
});

it('integrates live simulation without writes and warns on half zero', async () => {
  await render(); await clickText('Thêm chính sách'); await clickText('Ví dụ 50–100');
  expect(document.body.textContent).toContain('Policy Simulation Lab');
  await setInput('simulation-worked', '420'); expect(document.body.textContent).toContain('HALF_CREDIT');
  await clickText('Ví dụ 50–85'); expect(document.body.textContent).toContain('FULL_CREDIT');
  await setInput('work-credit-policy-halfDayMinimumRatio', '0');
  expect(document.body.textContent).toContain('không có phút được ghi nhận vẫn có thể đạt 0.5');
  expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(false);
});
it('simulates the exact stored full threshold through edits, preset undo and restored strings without changing PATCH fields', async () => {
  rows = [{ ...policy, fullDayMinimumRatio: 5 / 6 }];
  await render(); await clickText('Chỉnh sửa');
  const originalFull = String(rows[0].fullDayMinimumRatio * 100);
  expect((document.getElementById('work-credit-policy-fullDayMinimumRatio') as HTMLInputElement).value).toBe(originalFull);
  await setInput('simulation-worked', '400');
  const expectFull = () => {
    expect(document.body.textContent).toContain('Kết quả: 1 đơn vị công — FULL_CREDIT');
    expect(document.body.textContent).toContain('đủ ngày 400 phút');
  };
  expectFull();
  await setInput('work-credit-policy-halfDayMinimumRatio', '49'); expectFull();
  await setInput('work-credit-policy-halfDayMinimumRatio', '50');
  await setInput('work-credit-policy-fullDayMinimumRatio', '84');
  expect(document.body.textContent).toContain('Kết quả: 0.5 đơn vị công — HALF_CREDIT');
  await setInput('work-credit-policy-fullDayMinimumRatio', originalFull); expectFull();
  await clickText('Ví dụ 50–85');
  expect(document.body.textContent).toContain('Kết quả: 0.5 đơn vị công — HALF_CREDIT');
  await clickText('Hoàn tác'); expectFull();
  await setSelect('work-credit-policy-paidLeaveCreditEnabled', 'false'); expectFull();
  await setInput('work-credit-policy-businessReference', 'Chỉ đổi tham chiếu');
  await clickText('Lưu thay đổi');
  const request = fetchMock.mock.calls.find(([, i]) => i?.method === 'PATCH');
  expect(JSON.parse(request![1].body)).toEqual({ paidLeaveCreditEnabled: false, businessReference: 'Chỉ đổi tham chiếu' });
});

it('preserves decimal ratios and sends only unrelated edited fields', async () => {
  rows = [{ ...policy, halfDayMinimumRatio: 0.50123456789123, fullDayMinimumRatio: 0.85123456789123 }];
  await render(); await clickText('Chỉnh sửa');
  expect((document.getElementById('work-credit-policy-halfDayMinimumRatio') as HTMLInputElement).value).toBe(String(rows[0].halfDayMinimumRatio * 100));
  await setInput('work-credit-policy-businessReference', 'Chỉ đổi tham chiếu'); await clickText('Lưu thay đổi');
  const request = fetchMock.mock.calls.find(([, i]) => i?.method === 'PATCH');
  expect(JSON.parse(request![1].body)).toEqual({ businessReference: 'Chỉ đổi tham chiếu' });
});
it('guards synchronous duplicate submits and freezes all controls while saving, then permits retry', async () => {
  await render(); await clickText('Thêm chính sách'); await clickText('Ví dụ 50–85');
  await setInput('work-credit-policy-effectiveFrom', '2027-01-01');
  let resolve!: (value: unknown) => void;
  fetchMock.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const save = [...document.body.querySelectorAll('button')].find(b => b.textContent === 'Tạo chính sách')!;
  await act(async () => { save.click(); save.click(); });
  expect(fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(1);
  const dialog = document.querySelector('[role="dialog"]')!;
  expect([...dialog.querySelectorAll('input,select')].every(el => (el as HTMLInputElement).disabled)).toBe(true);
  for (const text of ['Hủy', 'Ví dụ 50–100', 'Ví dụ 50–85', 'Hoàn tác']) expect([...dialog.querySelectorAll('button')].find(b => b.textContent === text)!.disabled).toBe(true);
  await act(async () => resolve({ ok: false, status: 500, text: async () => '{}' })); await settle();
  expect(save.disabled).toBe(false);
  await clickText('Hủy'); expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it('keeps valid half zero submit-enabled and rejects full blank or out-of-range thresholds', async () => {
  await render(); await clickText('Thêm chính sách');
  await setInput('work-credit-policy-effectiveFrom', '2027-01-01');
  await setInput('work-credit-policy-halfDayMinimumRatio', '0'); await setInput('work-credit-policy-fullDayMinimumRatio', '85');
  const save = () => [...document.body.querySelectorAll('button')].find(b => b.textContent === 'Tạo chính sách')!;
  expect(save().disabled).toBe(false);
  for (const full of ['', '101', '-1', '0']) { await setInput('work-credit-policy-fullDayMinimumRatio', full); expect(save().disabled).toBe(true); }
});
it('does not carry a confirmation or preset undo into a reopened form', async () => {
  await render(); await clickText('Chỉnh sửa'); await clickText('Ví dụ 50–85'); await clickText('Lưu thay đổi');
  await clickText('Quay lại kiểm tra'); expect([...document.body.querySelectorAll('button')].some(b => b.textContent === 'Xác nhận lưu')).toBe(false);
  await clickText('Hủy'); await clickText('Chỉnh sửa');
  expect((document.getElementById('work-credit-policy-fullDayMinimumRatio') as HTMLInputElement).value).toBe('90');
  expect([...document.body.querySelectorAll('button')].some(b => b.textContent === 'Hoàn tác')).toBe(false);
  expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(false);
});
it('disables review confirmation if thresholds become invalid during review', async () => {
  await render(); await clickText('Chỉnh sửa'); await clickText('Ví dụ 50–85'); await clickText('Lưu thay đổi');
  await setInput('work-credit-policy-fullDayMinimumRatio', '');
  expect([...document.body.querySelectorAll('button')].find(b => b.textContent === 'Xác nhận lưu')!.disabled).toBe(true);
});
it('rejects non-monotonic thresholds before submit', async () => {
  await render(); await clickText('Thêm chính sách');
  await setInput('work-credit-policy-effectiveFrom', '2027-01-01');
  await setInput('work-credit-policy-halfDayMinimumRatio', '90');
  await setInput('work-credit-policy-fullDayMinimumRatio', '50');
  await clickText('Tạo chính sách');
  expect(document.body.textContent).toContain('Ngưỡng nửa ngày phải nhỏ hơn ngưỡng đủ ngày');
  expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/api/hr/policies/work-credit') && i?.method === 'POST')).toBe(false);
});
