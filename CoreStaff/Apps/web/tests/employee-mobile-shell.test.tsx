/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkspaceShell } from '../src/components/WorkspaceShell';
import type { AuthUser } from '../src/services/auth';
jest.mock('../src/config/api', () => ({ apiUrl: (base: string, path: string) => base + path, getApiBaseSync: () => 'https://api.example.test' }));

const user: AuthUser = { id: 'employee', role: 'EMPLOYEE', fullName: 'Employee', email: 'employee@example.test', status: 'ACTIVE', organizationId: 'org' };
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(path: string, role: AuthUser['role'] = 'EMPLOYEE') {
  await act(async () => root.render(<WorkspaceShell user={{ ...user, role }} currentPath={path} onLogout={() => {}}>Content</WorkspaceShell>));
  return container.querySelector('nav[aria-label="Thanh điều hướng nhân viên"]')!;
}
test('employee has five ordered destinations with attendance in the centre', async () => {
  const nav = await render('/app/attendance');
  expect([...nav.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual(['/app/attendance/history', '/app/leave', '/app/attendance', '/app/compensation', '/app/profile']);
  expect(nav.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe('/app/attendance');
  expect(container.querySelector('.workspace-shell')?.getAttribute('data-experience')).toBe('self-service');
});
test.each(['/app/ot', '/app/payslips/payslip', '/app/timesheet-review'])('related route %s marks its parent tab', async path => {
  const nav = await render(path);
  expect(nav.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe(path === '/app/ot' ? '/app/leave' : '/app/compensation');
});
test('manager retains the department tab instead of employee compensation', async () => {
  const nav = await render('/manager/department', 'DEPARTMENT_MANAGER');
  expect(nav.querySelector('a[href="/manager/department"]')).not.toBeNull();
  expect(nav.querySelector('a[href="/app/compensation"]')).toBeNull();
});
test('HR does not receive the self-service theme or mobile tabs', async () => {
  await render('/overview', 'HR');
  expect(container.querySelector('.workspace-shell')?.getAttribute('data-experience')).not.toBe('self-service');
  expect(container.querySelector('nav[aria-label="Thanh điều hướng nhân viên"]')).toBeNull();
});
