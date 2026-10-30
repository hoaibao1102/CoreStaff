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
  expect(container.textContent).toContain('chỉ ảnh hưởng các kỳ được tạo hoặc tạo lại');
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
  const request = fetchMock.mock.calls.find(([u, i]) => /\/api\/hr\/policies\/work-credit\/w1$/.test(new URL(String(u)).pathname) && i?.method === 'PATCH');
  expect(JSON.parse(String(request![1].body))).toEqual({ fullDayMinimumRatio: 0.92 });
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
