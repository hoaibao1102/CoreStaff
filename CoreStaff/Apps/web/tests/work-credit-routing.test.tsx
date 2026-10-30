/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorkspaceRoutes } from '../src/routes/WorkspaceRoutes';
import type { AuthUser } from '../src/services/auth';

jest.mock('../src/components/WorkspaceShell', () => ({ WorkspaceShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
jest.mock('../src/screens/WorkCreditPolicy/WorkCreditPolicyScreen', () => ({ WorkCreditPolicyScreen: () => <div>WORK_CREDIT_SCREEN</div> }));
jest.mock('../src/components/EmployeeDataState', () => ({ EmployeeDataState: ({ status }: { status: string }) => <div>STATE:{status}</div> }));

const baseUser: AuthUser = { id: 'u1', _id: 'u1', fullName: 'Test', email: 'test@example.com', role: 'HR', organizationId: 'org1' };
let root: Root; let container: HTMLDivElement;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(user: AuthUser) { await act(async () => root.render(<WorkspaceRoutes path="/hr/policies/work-credit" user={user} apiBase="https://api.test" apiSource={null} health={null} onLogout={() => {}} />)); }

it('renders the direct work-credit route for tenant HR', async () => { await render(baseUser); expect(container.textContent).toContain('WORK_CREDIT_SCREEN'); });
it.each(['EMPLOYEE', 'DEPARTMENT_MANAGER', 'SYSTEM_ADMIN'] as const)('forbids the direct work-credit route for %s', async role => { await render({ ...baseUser, role }); expect(container.textContent).toContain('STATE:forbidden'); expect(container.textContent).not.toContain('WORK_CREDIT_SCREEN'); });
it('forbids HR without a tenant', async () => { await render({ ...baseUser, organizationId: undefined }); expect(container.textContent).toContain('STATE:forbidden'); });
