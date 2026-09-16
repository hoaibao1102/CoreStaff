/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EmployeeDirectoryScreen } from '../src/screens/EmployeeDirectory/EmployeeDirectoryScreen';
import { EmployeeProfileScreen } from '../src/screens/EmployeeProfile/EmployeeProfileScreen';
import { EmployeeDetailDialog } from '../src/screens/EmployeeDetail/EmployeeDetailDialog';
import { ToastViewport } from '../src/components/toast';
import { mapEmployeeValidationErrors } from '../src/screens/EmployeeDirectory/apiErrors';
import { validateBankAccount, validateCitizenId, validateEmail, validatePhone, validateSocialInsuranceCode } from '../src/screens/EmployeeDirectory/validation';
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
    if (path.pathname.endsWith('/eligible-users')) return response([{ _id: 'u2', fullName: 'New Employee', email: 'employee@corp.com' }]);
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
async function render(screen: React.ReactNode) { await act(async () => root.render(<>{screen}<ToastViewport /></>)); }
async function clickText(text: string) { const button = [...document.body.querySelectorAll('button')].find(b => b.textContent?.includes(text)); expect(button).toBeDefined(); await act(async () => button!.click()); }
async function search(value: string) { await act(async () => { const input = container.querySelector('input')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); }
const directory = () => <EmployeeDirectoryScreen user={user} apiBase="https://api.test" />;

async function setCreateField(id: string, value: string) {
  await act(async () => {
    const field = document.getElementById(`create-${id}`) as HTMLInputElement | HTMLSelectElement;
    const prototype = field.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}

async function readyCreate() {
  await render(directory());
  await clickText('Tạo hồ sơ');
  await setCreateField('userId', 'u2');
  await setCreateField('employeeCode', 'NV-123');
  await setCreateField('joinDate', '2020-01-01');
}

async function submitCreate() {
  await act(async () => (document.body.querySelector('form button[type="submit"]') as HTMLButtonElement).click());
}

test('optional blank values are omitted, including employment type and whitespace email', async () => {
  await readyCreate();
  await setCreateField('email', '   ');
  await setCreateField('employmentType', '');
  await submitCreate();
  const request = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
  expect(JSON.parse(request![1].body)).toEqual({ userId: 'u2', employeeCode: 'NV-123', joinDate: '2020-01-01' });
});

test('invalid fields block submit, retain errors until corrected, and associate accessible messages', async () => {
  await readyCreate();
  await setCreateField('phone', '123');
  await setCreateField('email', 'invalid');
  await setCreateField('citizenId', '1234');
  await submitCreate();
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  for (const name of ['phone', 'email', 'citizenId']) {
    const field = document.getElementById(`create-${name}`)!;
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(field.getAttribute('aria-describedby')!)?.textContent).toBeTruthy();
  }
  await setCreateField('phone', '1234');
  expect(document.getElementById('create-phone')?.getAttribute('aria-invalid')).toBe('true');
  await setCreateField('phone', '0968373066');
  expect(document.getElementById('create-phone')?.getAttribute('aria-invalid')).toBe('false');
});

test('API validation details mark multiple fields without exposing technical messages', async () => {
  await readyCreate();
  fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: async () => JSON.stringify({ success: false,
    error: { code: 'VALIDATION_FAILED', message: 'Bad Request', details: ['PHONE_INVALID', 'email must be shorter than or equal to 256 characters'] } }) });
  await submitCreate();
  expect(document.getElementById('create-phone')?.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById('create-email')?.getAttribute('aria-invalid')).toBe('true');
  expect(document.body.textContent).not.toContain('Bad Request');
  expect(document.body.textContent).not.toContain('PHONE_INVALID');
});

test.each(['EMAIL_TAKEN', 'PHONE_TAKEN'])('maps duplicate contact error %s to its field', code => {
  const errors = mapEmployeeValidationErrors({ code });
  expect(Object.values(errors)[0]).toContain('đã được sử dụng');
});

test('in-flight submit is locked and a server failure preserves the entered form', async () => {
  await readyCreate();
  let finish!: (value: unknown) => void;
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await submitCreate();
  const button = document.body.querySelector('form button[type="submit"]') as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  await act(async () => document.body.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  await act(async () => finish(response(null, 500, 'INTERNAL_ERROR')));
  expect(button.disabled).toBe(false);
  expect((document.getElementById('create-employeeCode') as HTMLInputElement).value).toBe('NV-123');
  expect(document.body.textContent).toContain('Máy chủ đang gặp sự cố');
});

test('account loading failure offers retry instead of claiming there are no accounts', async () => {
  const original = fetchMock.getMockImplementation()!;
  let failed = true;
  fetchMock.mockImplementation((url, init) => String(url).endsWith('/eligible-users') && failed
    ? Promise.resolve(response(null, 500, 'INTERNAL_ERROR')) : original(url, init));
  await render(directory());
  await clickText('Tạo hồ sơ');
  expect(document.body.textContent).toContain('Chưa tải được tài khoản nhân viên');
  expect((document.getElementById('create-userId') as HTMLSelectElement).disabled).toBe(true);
  failed = false;
  await clickText('Thử tải lại');
  expect(document.body.textContent).not.toContain('Chưa tải được tài khoản nhân viên');
  expect((document.getElementById('create-userId') as HTMLSelectElement).disabled).toBe(false);
  expect(document.getElementById('create-userId')?.textContent).toContain('New Employee');
});
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
  await setSelect('create-userId', 'u2');
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
  expect([...document.body.querySelectorAll('[role="status"]')].some(node => node.textContent?.includes('Tạo hồ sơ thành công'))).toBe(true);
});
test('create employee keeps field validation inline and shows a warning toast', async () => {
  await render(directory());
  await clickText('Tạo hồ sơ');
  expect(document.body.textContent).not.toContain('Vui lòng chọn tài khoản nhân viên.');
  for (const id of ['create-userId', 'create-employeeCode', 'create-joinDate']) {
    expect(document.querySelector(`label[for="${id}"]`)?.className).toContain('after:content');
  }
  for (const id of ['create-phone', 'create-email', 'create-citizenId', 'create-socialInsuranceCode', 'create-directManagerId']) {
    expect(document.querySelector(`label[for="${id}"]`)?.className).not.toContain('after:content');
  }
  await act(async () => (document.body.querySelector('form button[type="submit"]') as HTMLButtonElement).click());
  expect(document.getElementById('create-userId')?.getAttribute('aria-invalid')).toBe('true');
  expect(document.body.textContent).toContain('Vui lòng chọn tài khoản nhân viên.');
  expect([...document.body.querySelectorAll('[role="status"]')].some(node => node.textContent?.includes('Vui lòng kiểm tra thông tin'))).toBe(true);
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
});
test('employee field validators enforce the documented optional formats', () => {
  expect(validatePhone('09683')).toBe('Số điện thoại phải gồm đúng 10 chữ số.');
  expect(validatePhone('09683730666')).toBe('Số điện thoại phải gồm đúng 10 chữ số.');
  expect(validatePhone('0968abc066')).toBe('Số điện thoại chỉ được chứa chữ số.');
  expect(validatePhone('0968373066')).toBeNull();
  expect(validateEmail('sai-email')).toContain('Email chưa đúng định dạng');
  expect(validateCitizenId('')).toBeNull();
  expect(validateCitizenId('1234')).toContain('từ 9 đến 12 chữ số');
  expect(validateCitizenId('123456789')).toBeNull();
  expect(validateCitizenId('0123456789')).toBeNull();
  expect(validateCitizenId('123456789012')).toBeNull();
  expect(validateSocialInsuranceCode('')).toBeNull();
  expect(validateBankAccount('')).toBeNull();
});
test('create employee displays a specific actionable API error', async () => {
  createStatus = 404;
  createCode = 'USER_NOT_FOUND';
  await render(directory());
  await clickText('Tạo hồ sơ');
  await act(async () => {
    const select = document.getElementById('create-userId') as HTMLSelectElement;
    select.value = 'u2';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  for (const [id, value] of [['create-employeeCode', 'NV-404'], ['create-joinDate', '2026-09-16']]) {
    await act(async () => {
      const input = document.getElementById(id) as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  await act(async () => (document.body.querySelector('form button[type="submit"]') as HTMLButtonElement).click());
  const toast = document.body.querySelector('[role="alert"]') as HTMLElement;
  expect(toast).not.toBeNull();
  expect(toast.textContent).toContain('Không tìm thấy tài khoản');
  expect(toast.textContent).toContain('không còn khả dụng trong tổ chức');
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
test('detail changes employment status and refreshes the audited history', async () => {
  let historyRows: unknown[] = [];
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/departments')) return response([{ _id: 'd1', name: 'Engineering' }]);
    if (path.endsWith('/positions')) return response([{ _id: 'pos1', name: 'Developer' }]);
    if (path.endsWith('/history')) return response(historyRows);
    if (path.endsWith('/status') && init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body));
      historyRows = [{
        _id: 'h1', organizationId: 'org1', employeeProfileId: 'p1',
        previousStatus: 'ACTIVE', newStatus: body.newStatus,
        effectiveDate: body.effectiveDate, reason: body.reason,
        changedBy: 'u1', createdAt: '2026-09-16T10:00:00.000Z',
      }];
      return response({ ...profile, employmentStatus: body.newStatus, endDate: body.effectiveDate });
    }
    if (path.endsWith('/p1')) return response(profile);
    return response([]);
  });

  await render(<EmployeeDetailDialog user={user} apiBase="https://api.test" employeeId="p1" onClose={() => undefined} />);
  await act(async () => { await Promise.resolve(); });
  const statusButton = [...document.body.querySelectorAll('button')].find(button => button.textContent?.includes('Thay đổi trạng thái'));
  expect(statusButton).toBeDefined();
  expect(statusButton?.disabled).toBe(false);
  await clickText('Thay đổi trạng thái');
  await act(async () => {
    const select = document.getElementById('status-new') as HTMLSelectElement;
    select.value = 'RESIGNED';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const date = document.body.querySelector('input[type="date"]') as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(date, '2026-10-01');
    date.dispatchEvent(new Event('input', { bubbles: true }));
    const reason = document.getElementById('status-reason') as HTMLTextAreaElement;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'Hết thời gian làm việc');
    reason.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await clickText('Xác nhận');

  const request = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/api/hr/employees/p1/status') && init?.method === 'PATCH');
  expect(JSON.parse(String(request?.[1]?.body))).toEqual({
    newStatus: 'RESIGNED', effectiveDate: '2026-10-01', reason: 'Hết thời gian làm việc',
  });
  expect(document.body.textContent).toContain('Đã nghỉ việc');
  expect(document.body.textContent).toContain('Hết thời gian làm việc');
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/hr/employees/p1/history'))).toHaveLength(2);
});
test('detail update excludes immutable fields and history failure offers retry', async () => {
  status = 500;
  await render(<EmployeeDetailDialog user={user} apiBase="https://api.test" employeeId="p1" onClose={() => undefined} />);
  expect(document.body.querySelector('[role="alert"]')).not.toBeNull();
  await clickText('Chỉnh sửa');
  await act(async () => {
    const joinDate = document.body.querySelector('input[type="date"]') as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(joinDate, '2020-09-16');
    joinDate.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await clickText('Lưu');
  const request = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
  expect(request).toBeDefined();
  const body = JSON.parse(request![1].body);
  for (const field of ['employeeCode', 'userId', 'employmentStatus', 'endDate']) expect(body).not.toHaveProperty(field);
});
