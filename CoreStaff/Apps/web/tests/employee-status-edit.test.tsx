/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EmployeeDetailDialog } from '../src/screens/EmployeeDetail/EmployeeDetailDialog';
import type { EmployeeProfile } from '../src/services/hrService';

jest.mock('../src/config/api', () => ({
  resolveApiBase: async () => ({ base: 'https://api.test' }),
  apiUrl: (base: string, path: string) => base + path,
}));

const employee: EmployeeProfile = {
  _id: 'p1', userId: 'u1', organizationId: 'org1', employeeCode: 'E001',
  fullName: 'Nguyễn Văn A', employmentType: 'FULL_TIME', employmentStatus: 'ACTIVE',
  departmentId: 'd1', departmentName: 'Kỹ thuật', positionName: 'Developer', joinDate: '2026-01-05',
} as EmployeeProfile;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  globalThis.fetch = jest.fn(async (url: unknown) => {
    const path = String(url);
    const body = path.endsWith('/history') ? [] : path.endsWith('/salary-profiles') ? [] : employee;
    return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, data: body }) } as Response;
  }) as unknown as typeof fetch;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

const user = { _id: 'u-hr', id: 'u-hr', fullName: 'HR', email: 'hr@corp.com', role: 'HR', organizationId: 'org1', employeeCode: 'HR-1' } as any;

describe('employee status editing (QC 4.7)', () => {
  test('exposes a status tab that offers Đã nghỉ việc and Đã chấm dứt', async () => {
    await act(async () => {
      root.render(<EmployeeDetailDialog user={user} apiBase="https://api.test" employeeId="p1" onClose={() => {}} />);
    });
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });

    // The tab must be reachable from the detail screen.
    const statusTab = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Trạng thái & Lịch sử'));
    expect(statusTab).toBeDefined();

    await act(async () => (statusTab as HTMLButtonElement).click());
    const trigger = document.getElementById('employee-status-trigger') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    expect(trigger.disabled).toBe(false);

    await act(async () => trigger.click());
    const options = [...document.querySelectorAll<HTMLOptionElement>('#status-new option')].map(o => o.textContent);
    expect(options).toContain('Đã nghỉ việc');
    expect(options).toContain('Đã chấm dứt');
  });
});
