/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorkspaceRoutes } from '../src/routes/WorkspaceRoutes';
import { Sidebar } from '../src/components/Sidebar';
import type { AuthUser } from '../src/services/auth';

jest.mock('../src/components/WorkspaceShell', () => ({ WorkspaceShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
jest.mock('../src/components/EmployeeDataState', () => ({ EmployeeDataState: ({ status }: { status: string }) => <div>STATE:{status}</div> }));
jest.mock('../src/services/manager.service', () => ({
  getManagerRequests: jest.fn(async () => []),
  getManagerContext: jest.fn(async () => ({ managedDepartments: [{ id: 'd1', code: 'D1', name: 'Dept' }] })),
}));
jest.mock('../src/services/socket', () => ({ getSocket: () => ({ on: jest.fn(), off: jest.fn() }) }));

const hr: AuthUser = { id: 'u1', _id: 'u1', fullName: 'HR', email: 'hr@example.com', role: 'HR', organizationId: 'org1' };
const manager: AuthUser = { ...hr, role: 'DEPARTMENT_MANAGER' };
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it('removes KPI navigation from the HR sidebar', async () => {
  await act(async () => root.render(<Sidebar user={hr} currentPath="/overview" onLogout={() => {}} apiBase="https://api.test" />));
  expect(container.textContent).not.toContain('KPI kỳ lương');
});

it.each([hr, manager])('does not render the retired KPI screen for $role deep links', async (user) => {
  await act(async () => root.render(<WorkspaceRoutes path="/hr/kpi-inputs" user={user} apiBase="https://api.test" apiSource={null} health={null} onLogout={() => {}} />));
  expect(container.textContent).toContain('STATE:unavailable');
  expect(container.textContent).not.toContain('KPI đầu vào kỳ lương');
  expect(container.textContent).not.toContain('Đánh giá KPI');
});
