/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ContractsScreen } from '../src/screens/Contracts/ContractsScreen';
import { EmployeeProfileScreen } from '../src/screens/EmployeeProfile/EmployeeProfileScreen';
import { ToastViewport } from '../src/components/toast';
import type { AuthUser } from '../src/services/auth';
import type { EmploymentContract } from '../src/services/hrService';
jest.mock('../src/config/api', () => ({ apiUrl: (base: string, path: string) => base + path }));
const user: AuthUser = { id: 'u1', organizationId: 'org1', role: 'HR', fullName: 'Session Name', email: 'session@example.test', employeeCode: 'AUTH-CODE', status: 'ACTIVE' };
const now = '2026-09-18T00:00:00.000Z';
const contract: EmploymentContract = {
  _id: 'c1', organizationId: 'org1', employeeProfileId: 'p1', contractType: 'FIXED_TERM',
  status: 'ACTIVE', effectiveDate: '2026-01-01', expiryDate: '2026-10-01',
  isExpiringSoon: true, expiryWarningDays: 13, employeeCode: 'E001', employeeFullName: 'Test Employee',
};
let root: Root;
let container: HTMLDivElement;
let fetchMock: jest.Mock;
let rows: EmploymentContract[] = [];
const response = (data: unknown, http = 200, errorCode = '') => ({ ok: http === 200, status: http, text: async () => JSON.stringify(http === 200 ? { success: true, data } : { success: false, error: { code: errorCode } }) });
const jsonResponse = (data: unknown, http = 200, errorCode = '') => ({ ok: http === 200, status: http, headers: new Headers({ 'Content-Type': 'application/json' }), json: async () => data, text: async () => JSON.stringify(http === 200 ? { success: true, data } : { success: false, error: { code: errorCode } }) });

/* ───────── URL.createObjectURL polyfill (jsdom has none) ───────── */
let objectURL: string | null = null;
beforeAll(() => {
  Object.assign(URL, {
    createObjectURL: jest.fn(() => { objectURL = 'blob:mock'; return objectURL as string; }),
    revokeObjectURL: jest.fn(),
  });
});

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  rows = [contract];
  const employees = [{ _id: 'p1', userId: 'u1', organizationId: 'org1', employeeCode: 'E001', fullName: 'Test Employee', employmentType: 'FULL_TIME', employmentStatus: 'ACTIVE', joinDate: '2026-09-16' }];
  fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url);
    const method = init?.method ?? 'GET';
    if (path.pathname.endsWith('/api/hr/contracts') && method === 'POST') {
      // Records whatever the app actually sent — body type matters for upload.
      return jsonResponse({ ...contract, _id: 'c-new' } as unknown as Record<string, never>, 200);
    }
    if (path.pathname.endsWith('/api/hr/documents/upload')) {
      const ct = init?.headers ? ((init.headers as Record<string, string>)['Content-Type'] ?? (init.headers as Record<string, string>).contentType ?? '') : '';
      if (ct) throw new Error('upload must not set Content-Type');
      return jsonResponse({ _id: 'd1', originalName: 'HDLD.pdf', mimeType: 'application/pdf', sizeBytes: 100, employeeProfileId: 'p1' });
    }
    if (path.pathname.endsWith('/api/hr/documents')) return jsonResponse([{ _id: 'd1', organizationId: 'org1', employeeProfileId: 'p1', originalName: 'HDLD.pdf', mimeType: 'application/pdf', sizeBytes: 100, uploadedBy: 'u1', createdAt: now }]);
    if (path.pathname.match(/\/api\/hr\/documents\/[^/]+$/) && method === 'DELETE') {
      return jsonResponse(null, 200);
    }
    if (path.pathname.endsWith('/api/app/documents')) return jsonResponse([{ _id: 'd2', organizationId: 'org1', employeeProfileId: 'p1', originalName: 'CCCD.jpg', mimeType: 'image/jpeg', sizeBytes: 2048, uploadedBy: 'u1', createdAt: now }]);
    if (path.pathname.endsWith('/api/hr/employees/me')) return jsonResponse(employees[0]);
    if (path.pathname.match(/\/api\/hr\/contracts\/[^/]+$/)) {
      const id = path.pathname.split('/').pop();
      return jsonResponse({ ...contract, _id: id });
    }
    if (path.pathname.endsWith('/download')) return { ok: true, status: 200, blob: async () => new Blob(['pdf']), text: async () => '' };
    if (path.pathname.endsWith('/api/hr/employees')) return jsonResponse(employees);
    if (path.pathname.endsWith('/api/hr/contracts')) return jsonResponse(rows.filter(r => !path.searchParams.get('status') || r.status === path.searchParams.get('status')));
    return jsonResponse({ success: false }, 404, 'NOT_FOUND');
  });
  globalThis.fetch = fetchMock;
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.restoreAllMocks(); });

async function render(screen: React.ReactNode) { await act(async () => root.render(<>{screen}<ToastViewport /></>)); }
async function clickText(text: string) { const button = [...document.body.querySelectorAll('button')].find(b => b.textContent?.includes(text)); expect(button).toBeDefined(); await act(async () => button!.click()); }
const screenEl = () => <ContractsScreen user={user} apiBase="https://api.test" />;

test('lists contracts with the expiring-soon badge (TASK-030 derived on-read)', async () => {
  await render(screenEl());
  expect(container.textContent).toContain('Test Employee');
  expect(container.textContent).toContain('Sắp hết hạn (13 ngày)');
  expect(container.textContent).toContain('Đang hiệu lực');
  expect(fetchMock).toHaveBeenCalledTimes(2); // contracts + employees
});

test('create posts the HR payload and never sets status', async () => {
  await render(screenEl());
  await clickText('Tạo hợp đồng');
  const setSelect = async (id: string, value: string) => {
    await act(async () => {
      const select = document.getElementById(id) as HTMLSelectElement;
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };
  const setInput = async (id: string, value: string) => {
    await act(async () => {
      const input = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
      const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  await setSelect('contract-employee', 'p1');
  await setSelect('contract-type', 'FIXED_TERM');
  await setInput('contract-effective', '2026-09-01');
  await setInput('contract-expiry', '2027-08-31');
  await setInput('contract-note', 'Hợp đồng chính năm 2026');
  await act(async () => (document.body.querySelector('form button[type="submit"]') as HTMLButtonElement).click());
  const request = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/api/hr/contracts') && init?.method === 'POST');
  const body = JSON.parse(String(request![1].body));
  expect(body).toEqual({ employeeId: 'p1', contractType: 'FIXED_TERM', effectiveDate: '2026-09-01', expiryDate: '2027-08-31', note: 'Hợp đồng chính năm 2026' });
  expect(body).not.toHaveProperty('status');
});

test('INDEFINITE_TERM hides the expiry field and omits it from the payload', async () => {
  await render(screenEl());
  await clickText('Tạo hợp đồng');
  await act(async () => {
    const select = document.getElementById('contract-type') as HTMLSelectElement;
    select.value = 'INDEFINITE_TERM';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(document.getElementById('contract-expiry')).toBeNull();
  await act(async () => {
    const select = document.getElementById('contract-employee') as HTMLSelectElement;
    select.value = 'p1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const input = document.getElementById('contract-effective') as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2026-09-01');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => (document.body.querySelector('form button[type="submit"]') as HTMLButtonElement).click());
  const request = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/api/hr/contracts') && init?.method === 'POST');
  const body = JSON.parse(String(request![1].body));
  expect(body).toEqual({ employeeId: 'p1', contractType: 'INDEFINITE_TERM', effectiveDate: '2026-09-01' });
  expect(body).not.toHaveProperty('expiryDate');
});

test('detail shows documents and deletion calls DELETE on the document row', async () => {
  window.history.pushState(null, '', '/hr/contracts/c1');
  window.dispatchEvent(new Event('corestaff:navigate'));
  await render(<ContractsScreen user={user} apiBase="https://api.test" contractId="c1" />);
  await act(async () => { await Promise.resolve(); });
  expect(document.body.textContent).toContain('HDLD.pdf');
  const del = [...document.body.querySelectorAll('button')].find(b => b.getAttribute('aria-label')?.startsWith('Xóa'));
  await act(async () => del!.click());
  const deleteCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/api/hr/documents/d1') && init?.method === 'DELETE');
  expect(deleteCall).toBeDefined();
});

test('upload sends FormData without a manual Content-Type', async () => {
  await render(<ContractsScreen user={user} apiBase="https://api.test" contractId="c1" />);
  const file = new File(['pdf'], 'HDLD.pdf', { type: 'application/pdf' });
  const input = document.body.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file] });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  const uploadCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/hr/documents/upload'));
  expect(uploadCall).toBeDefined();
  expect(uploadCall![1].method).toBe('POST');
  expect(uploadCall![1].body).toBeInstanceOf(FormData);
  expect(uploadCall![1].headers).toBeUndefined();
  expect((uploadCall![1].body as FormData).get('file')).toBe(file);
});

test('download streams a blob then clicks an anchor with a download attribute', async () => {
  await render(<ContractsScreen user={user} apiBase="https://api.test" contractId="c1" />);
  const link = [...document.body.querySelectorAll('button')].find(b => b.textContent?.includes('HDLD.pdf'));
  await act(async () => link!.click());
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
});

test('self profile lists own documents and denies nothing on download route', async () => {
  await render(<EmployeeProfileScreen user={{ ...user, role: 'EMPLOYEE' }} apiBase="https://api.test" />);
  const documents = fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/app/documents'));
  expect(documents).toBe(true);
  expect(container.textContent).toContain('CCCD.jpg');
});