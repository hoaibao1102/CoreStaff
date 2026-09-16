/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EmployeeDirectoryScreen } from '../src/screens/EmployeeDirectory/EmployeeDirectoryScreen';
import { EmployeeProfileScreen } from '../src/screens/EmployeeProfile/EmployeeProfileScreen';
import { EmployeeDetailDialog } from '../src/screens/EmployeeDirectory/EmployeeDetailDialog';
import type { AuthUser } from '../src/services/auth';
import type { EmployeeProfile } from '../src/services/hrService';
jest.mock('../src/config/api', () => ({ apiUrl: (base: string, path: string) => base + path }));
const user: AuthUser = { id: 'u1', organizationId: 'org1', role: 'HR', fullName: 'Session Name', email: 'session@example.test', employeeCode: 'AUTH-CODE', status: 'ACTIVE' };
const profile: EmployeeProfile = { _id: 'p1', userId: 'u1', organizationId: 'org1', employeeCode: 'E001', fullName: 'Test Employee', employmentType: 'FULL_TIME', employmentStatus: 'ACTIVE', departmentId: 'd1', departmentName: 'Engineering', positionName: 'Developer', managerName: 'Manager', joinDate: '2026-09-16' };
let root: Root;
let container: HTMLDivElement;
let fetchMock: jest.Mock;
let rows: EmployeeProfile[];
let own: EmployeeProfile;
let status: number;
let code: string;
let createStatus: number;
let createCode: string;
const response = (data: unknown, http = 200, errorCode = '') => ({ ok: http === 200, status: http, text: async () => JSON.stringify(http === 200 ? { success: true, data } : { success: false, error: { code: errorCode } }) });
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  rows = [profile]; own = profile; status = 200; code = ''; createStatus = 200; createCode = '';
  fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url);
    if (path.pathname.endsWith('/departments')) return response([{ _id: 'd1', name: 'Engineering' }, { _id: 'd2', name: 'Sales' }]);
    if (path.pathname.endsWith('/positions')) return response([{ _id: 'pos1', name: 'Developer' }]);
    if (path.pathname.endsWith('/me')) return response(own, status, code);
    if (path.pathname.endsWith('/history')) return response([], status, code);
    if (init?.method === 'POST') return response({ ...profile, ...JSON.parse(String(init.body)), _id: 'p-new', employmentStatus: 'PROBATION' }, createStatus, createCode);
    if (init?.method === 'PATCH') return response({ ...profile, ...JSON.parse(String(init.body)) });
    if (path.pathname.endsWith('/p1')) return response(profile);
    const filtered = rows.filter(row => (!path.searchParams.get('status') || row.employmentStatus === path.searchParams.get('status')) && (!path.searchParams.get('departmentId') || row.departmentId === path.searchParams.get('departmentId')));
    return response(filtered, status, code);
  });
  globalThis.fetch = fetchMock;
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.restoreAllMocks(); });
async function render(screen: React.ReactNode) { await act(async () => root.render(screen)); }
async function clickText(text: string) { const button = [...document.body.querySelectorAll('button')].find(b => b.textContent?.includes(text)); expect(button).toBeDefined(); await act(async () => button!.click()); }
async function search(value: string) { await act(async () => { const input = container.querySelector('input')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); }
const directory = () => <EmployeeDirectoryScreen user={user} apiBase="https://api.test" />;
const self = (current = user) => <EmployeeProfileScreen user={current} apiBase="https://api.test" />;

test.each(['EMPLOYEE', 'DEPARTMENT_MANAGER', 'SYSTEM_ADMIN'] as const)('directory denies %s without requests', async role => {
  await render(<EmployeeDirectoryScreen user={{ ...user, role }} apiBase="https://api.test" />);
  expect(container.textContent).toContain('Bạn không có quyền'); expect(fetchMock).not.toHaveBeenCalled();
});
test('directory requires organization and handles unavailable API', async () => {
  await render(<EmployeeDirectoryScreen user={{ ...user, organizationId: undefined }} apiBase="https://api.test" />);
  expect(fetchMock).not.toHaveBeenCalled();
  await render(<EmployeeDirectoryScreen user={user} apiBase={null} />);
  expect(container.textContent).toContain('chưa khả dụng');
});
test('directory searches names/codes locally, paginates, filters by IDs and isolates tenants', async () => {
  rows = Array.from({ length: 23 }, (_, i) => ({ ...profile, _id: `p${i}`, employeeCode: `E${i}`, fullName: `Person ${i}`, departmentId: i === 22 ? 'd2' : 'd1' }));
  rows.push({ ...profile, organizationId: 'other', fullName: 'Foreign Secret' });
  await render(directory());
  expect(container.querySelectorAll('tbody tr')).toHaveLength(10);
  expect(container.textContent).not.toContain('Foreign Secret');
  const calls = fetchMock.mock.calls.length;
  const next = container.querySelectorAll('button');
  const nextButton = [...next].find(button => button.querySelector('.lucide-chevron-right'))!;
  await act(async () => nextButton.click());
  expect(container.textContent).toContain('Person 10');
  await search(' person 22 ');
  expect(container.querySelectorAll('tbody tr')).toHaveLength(1); expect(container.textContent).toContain('Person 22');
  expect(fetchMock).toHaveBeenCalledTimes(calls);
  await search('E21'); expect(container.textContent).toContain('Person 21');
  await search('');
  await act(async () => { const select = container.querySelectorAll('select')[0]; select.value = 'd2'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes('departmentId=d2'))).toBe(true);
  expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  expect(fetchMock.mock.calls.every(([url]) => !new URL(String(url)).searchParams.has('q') && !new URL(String(url)).searchParams.has('page'))).toBe(true);
});
test('directory empty and loading states', async () => {
  rows = []; await render(directory()); expect(container.textContent).toContain('Không tìm thấy nhân viên');
  fetchMock.mockImplementation(() => new Promise(() => {}));
  await render(<EmployeeDirectoryScreen user={user} apiBase="https://other.test" />);
  expect(container.querySelector('[role="status"]')).not.toBeNull();
});
test('directory creates employee profile with the HR business payload', async () => {
  await render(directory());
  await clickText('Tạo hồ sơ');
  const setInput = async (id: string, value: string) => {
    await act(async () => {
      const input = document.getElementById(id) as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const setSelect = async (id: string, value: string) => {
    await act(async () => {
      const select = document.getElementById(id) as HTMLSelectElement;
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };
  await setInput('create-userId', ' u2 ');
  await setInput('create-employeeCode', ' TVS-0248 ');
  await setInput('create-joinDate', '2026-09-16');
  await setInput('create-email', 'employee@corp.com');
  await setSelect('create-departmentId', 'd1');
  await setSelect('create-positionId', 'pos1');
  const submit = document.body.querySelector('form button[type="submit"]') as HTMLButtonElement;
  await act(async () => submit.click());
  const request = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/api/hr/employees') && init?.method === 'POST');
  expect(request).toBeDefined();
  const body = JSON.parse(String(request![1].body));
  expect(body).toMatchObject({ userId: 'u2', employeeCode: 'TVS-0248', employmentType: 'FULL_TIME', joinDate: '2026-09-16', email: 'employee@corp.com', departmentId: 'd1', positionId: 'pos1' });
  expect(body).not.toHaveProperty('employmentStatus');
  expect(body).not.toHaveProperty('endDate');
});
test('create employee displays a specific actionable API error', async () => {
  createStatus = 404;
  createCode = 'USER_NOT_FOUND';
  await render(directory());
  await clickText('Tạo hồ sơ');
  for (const [id, value] of [['create-userId', 'missing-user'], ['create-employeeCode', 'NV-404']]) {
    await act(async () => {
      const input = document.getElementById(id) as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  await act(async () => (document.body.querySelector('form button[type="submit"]') as HTMLButtonElement).click());
  const alert = document.body.querySelector('[role="alert"]') as HTMLElement;
  expect(alert.textContent).toContain('Không tìm thấy tài khoản');
  expect(alert.textContent).toContain('không tồn tại trong tổ chức hiện tại');
  expect(document.getElementById('create-userId')?.getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(document.getElementById('create-userId'));
});
test.each([401, 403, 500])('directory handles HTTP %s and retries', async http => {
  status = http; await render(directory()); expect(container.querySelector('[role="alert"]')).not.toBeNull();
  status = 200; await clickText('Thử lại'); expect(container.textContent).toContain('Test Employee');
});
test.each(['EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR', 'SYSTEM_ADMIN'] as const)('self uses me for authenticated %s and is read-only', async role => {
  await render(self({ ...user, role }));
  expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/hr/employees/me', expect.objectContaining({ method: 'GET', credentials: 'include' }));
  expect(container.textContent).toContain('Session Name'); expect(container.textContent).toContain('E001');
  expect(container.textContent).toContain('Engineering'); expect(container.textContent).toContain('Developer');
  expect(container.textContent).toContain('Manager'); expect(container.textContent).toContain('Ca làm việc');
  expect(container.querySelector('input')).toBeNull();
});
test.each([{ userId: 'other' }, { organizationId: 'other' }])('self rejects foreign response %j', async change => {
  own = { ...profile, ...change }; await render(self());
  expect(container.textContent).toContain('Bạn không có quyền'); expect(container.textContent).not.toContain('Engineering');
});
test('self 404 keeps account data and displays dedicated empty state', async () => {
  status = 404; code = 'EMPLOYEE_PROFILE_NOT_FOUND'; await render(self());
  expect(container.textContent).toContain('chưa có hồ sơ nhân sự'); expect(container.textContent).toContain('session@example.test');
});
test.each([401, 403, 500])('self handles HTTP %s with retry', async http => {
  status = http; await render(self()); expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.textContent).toContain('session@example.test'); status = 200; await clickText('Thử lại');
  expect(container.textContent).toContain('Engineering');
});
test('late responses from an old account cannot replace current profile', async () => {
  let resolveOld!: (value: unknown) => void;
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  await render(self());
  own = { ...profile, userId: 'u2', departmentName: 'New Department' };
  await render(self({ ...user, id: 'u2' }));
  await act(async () => resolveOld(response(profile)));
  expect(container.textContent).toContain('New Department'); expect(container.textContent).not.toContain('Engineering');
});
test('detail update excludes immutable fields and history failure offers retry', async () => {
  status = 500;
  await render(<EmployeeDetailDialog user={user} apiBase="https://api.test" employeeId="p1" onClose={() => undefined} />);
  expect(document.body.querySelector('[role="alert"]')).not.toBeNull();
  await clickText('Chỉnh sửa'); await clickText('Lưu');
  const request = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
  expect(request).toBeDefined();
  const body = JSON.parse(request![1].body);
  for (const field of ['employeeCode', 'userId', 'employmentStatus', 'endDate']) expect(body).not.toHaveProperty(field);
});
