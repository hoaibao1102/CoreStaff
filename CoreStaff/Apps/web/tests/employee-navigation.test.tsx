/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from '../src/App';
import type { AuthUser } from '../src/services/auth';
import { EmployeeDirectoryScreen } from '../src/screens/EmployeeDirectory/EmployeeDirectoryScreen';
import type { EmployeeView } from '../src/lib/employee';

jest.mock('../src/config/api', () => ({
  resolveApiBase: async () => ({
    base: 'https://api.example.test', source: 'remote',
    health: { status: 'ok', service: 'corestaff-api', mongo: 'configured', timezone: 'Asia/Ho_Chi_Minh' },
  }),
  apiUrl: (base: string, path: string) => base + path,
}));

const user: AuthUser = {
  id: 'u1',
  organizationId: 'org1',
  role: 'HR',
  fullName: 'Current User',
  email: 'current@example.test',
  employeeCode: 'E001',
  status: 'ACTIVE',
};

let container: HTMLDivElement;
let root: Root;
let session: AuthUser | null;
let loginUser: AuthUser;
let fetchMock: jest.Mock;
let changePasswordStatus: number;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  session = null;
  loginUser = user;
  changePasswordStatus = 200;
  fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    let status = 200;
    let body: unknown = { status: 'ok', mongo: 'configured' };
    if (url.endsWith('/api/auth/me')) {
      status = session ? 200 : 401;
      body = session ? { success: true, data: session } : { success: false };
    } else if (url.endsWith('/api/auth/login')) {
      session = loginUser;
      body = { success: true, data: { user: loginUser, mustChangePassword: !!loginUser.mustChangePassword } };
      expect(init?.credentials).toBe('include');
      expect(JSON.parse(String(init?.body))).toEqual({ identifier: 'user@example.test', password: 'TestPassword1' });
    } else if (url.endsWith('/api/auth/change-password')) {
      status = changePasswordStatus;
      body = status === 200 ? { success: true } : { success: false };
    } else if (url.includes('/api/hr/employees/me')) {
      body = { success: true, data: { _id: 'p1', userId: session?.id, organizationId: session?.organizationId, employeeCode: 'HR001', employmentStatus: 'ACTIVE' } };
    } else if (url.includes('/api/hr/')) {
      body = { success: true, data: [] };
    } else if (url.endsWith('/api/auth/logout')) {
      session = null;
      body = { success: true };
    }
    return { ok: status === 200, status, json: async () => body, text: async () => JSON.stringify(body) };
  });
  globalThis.fetch = fetchMock;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

async function open(path: string, currentUser: AuthUser | null = null) {
  window.history.replaceState(null, '', path);
  session = currentUser;
  await act(async () => root.render(<App />));
}

async function remount() {
  await act(async () => root.unmount());
  root = createRoot(container);
}

test('guest boot does not probe /auth/me until a prior login marker exists', async () => {
  await open('/');

  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/auth/me'))).toBe(false);

  window.localStorage.setItem('corestaff:has-session', '1');
  await remount();
  await open('/', user);

  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/auth/me'))).toBe(true);
  expect(container.textContent).toContain('current@example.test');
});

async function click(selector: string) {
  const element = container.querySelector<HTMLElement>(selector);
  expect(element).not.toBeNull();
  await act(async () => element!.click());
}

async function input(element: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function signIn() {
  await input(container.querySelector<HTMLInputElement>('input[autocomplete="username"]')!, ' user@example.test ');
  await input(container.querySelector<HTMLInputElement>('input[autocomplete="current-password"]')!, 'TestPassword1');
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

test('HR login opens directory and own profile without reloading authentication', async () => {
  await open('/');
  await signIn();

  expect(container.querySelector('#workspace a[href="/hr/employees"]')).not.toBeNull();
  expect(container.querySelector('#workspace a[href="/app/profile"]')).not.toBeNull();

  const authRequests = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/auth/')).length;
  const requests = authRequests();
  await click('#workspace a[href="/hr/employees"]');
  expect(window.location.pathname).toBe('/hr/employees');
  expect(container.querySelector('table[aria-label]')).not.toBeNull();

  await click('#desktop-sidebar nav a[href="/app/profile"]');
  expect(container.textContent).toContain('current@example.test');
  expect(authRequests()).toBe(requests);

  await act(async () => {
    const popped = new Promise<void>(resolve => window.addEventListener('popstate', () => resolve(), { once: true }));
    window.history.back();
    await popped;
  });
  expect(window.location.pathname).toBe('/hr/employees');

  await click('#desktop-sidebar nav a[href="/overview"]');
  expect(container.querySelector('#workspace')).not.toBeNull();
});

test.each(['EMPLOYEE', 'DEPARTMENT_MANAGER'] as const)('%s login has profile but cannot open HR directory', async role => {
  loginUser = { ...user, role };
  await open('/hr/employees');
  await signIn();

  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector('a[href="/hr/employees"]')).toBeNull();

  await click('#desktop-sidebar nav a[href="/app/profile"]');
  expect(container.textContent).toContain('current@example.test');
});

test.each(['/hr/employees', '/app/profile'])('guest and mandatory password change guard %s', async path => {
  await open(path);
  expect(container.textContent).toContain('Đăng nhập CoreStaff');

  loginUser = { ...user, mustChangePassword: true };
  await signIn();

  expect(container.querySelector('a[href="/app/profile"]')).toBeNull();
  expect(container.querySelector('input[autocomplete="new-password"]')).not.toBeNull();
});

test('change password uses auth layout and returns to login when the session expires', async () => {
  loginUser = { ...user, mustChangePassword: true };
  changePasswordStatus = 401;

  await open('/');
  await signIn();

  expect(container.textContent).toContain('Đổi mật khẩu tạm thời');
  expect(container.querySelector('header button')).toBeNull();
  expect(container.querySelector('header')?.textContent).toContain('CoreStaff');

  await input(container.querySelector<HTMLInputElement>('input[autocomplete="current-password"]')!, 'OldPass1');
  const newPasswordInputs = container.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]');
  await input(newPasswordInputs[0], 'NewPass1');
  await input(newPasswordInputs[1], 'NewPass1');
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

  expect(container.textContent).toContain('Đăng nhập CoreStaff');
  expect(container.textContent).toContain('Phiên đăng nhập đã hết hạn');
});

test('restored System Admin cannot fetch the HR directory', async () => {
  const path = '/hr/employees';
  window.localStorage.setItem('corestaff:has-session', '1');
  await open(path, { ...user, role: 'SYSTEM_ADMIN', organizationId: undefined });
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/hr/employees'))).toBe(false);
});

test('restores own profile on direct URL with the account menu available', async () => {
  window.localStorage.setItem('corestaff:has-session', '1');
  await open('/app/profile/', { ...user, role: 'EMPLOYEE' });
  expect(container.textContent).toContain('current@example.test');

  expect(container.querySelector('#desktop-sidebar .workspace-sidebar-account')?.getAttribute('aria-haspopup')).toBe('menu');
  // The portaled menu's logout and session cleanup are exercised in the browser
  // suite, where its focus/animation lifecycle has a real layout engine.
});
