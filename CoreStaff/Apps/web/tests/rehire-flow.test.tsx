/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EmployeeDetailDialog } from '../src/screens/EmployeeDetail/EmployeeDetailDialog';
import { EmployeeCreateDialog } from '../src/screens/EmployeeDirectory/components/EmployeeCreateDialog';
import type { EmployeeProfile } from '../src/services/hrService';

jest.mock('../src/config/api', () => ({
  resolveApiBase: async () => ({ base: 'https://api.test' }),
  apiUrl: (base: string, path: string) => base + path,
}));

const resigned: EmployeeProfile = {
  _id: 'p1', userId: 'u1', organizationId: 'org1', employeeCode: 'E001',
  fullName: 'Nguyễn Văn A', employmentType: 'FULL_TIME', employmentStatus: 'RESIGNED',
  departmentId: 'd1', departmentName: 'Kỹ thuật', positionId: 'pos1',
  dateOfBirth: '1995-03-02', gender: 'MALE', phone: '0901234567',
  address: '1 Lê Lợi', citizenId: '012345678901', taxCode: '0123456789',
  socialInsuranceCode: '0123456789', joinDate: '2020-01-05', endDate: '2026-10-31',
  email: 'a@corp.com',
} as EmployeeProfile;

const user = { _id: 'u-hr', id: 'u-hr', fullName: 'HR', email: 'hr@corp.com', role: 'HR', organizationId: 'org1', employeeCode: 'HR-1' } as any;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  globalThis.fetch = jest.fn(async (url: unknown) => {
    const path = String(url);
    const body = path.endsWith('/history') ? [] : path.endsWith('/salary-profiles') ? [] : resigned;
    return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, data: body }) } as Response;
  }) as unknown as typeof fetch;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

async function settle() {
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}

describe('re-hire a resigned employee (new profile, new id)', () => {
  test('the status tab offers "Tuyển lại nhân sự" and hands the old profile back', async () => {
    const onRehire = jest.fn();
    await act(async () => {
      root.render(<EmployeeDetailDialog user={user} apiBase="https://api.test" employeeId="p1" onClose={() => {}} onRehire={onRehire} />);
    });
    await settle();

    const tab = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Trạng thái & Lịch sử'));
    expect(tab).toBeDefined();
    await act(async () => (tab as HTMLButtonElement).click());

    const rehire = document.getElementById('employee-rehire-trigger') as HTMLButtonElement | null;
    expect(rehire).not.toBeNull();
    await act(async () => rehire!.click());

    expect(onRehire).toHaveBeenCalledWith(expect.objectContaining({ _id: 'p1', employmentStatus: 'RESIGNED' }));
  });

  test('the create dialog prefills personal data but leaves the new identifiers empty', async () => {
    await act(async () => {
      root.render(
        <EmployeeCreateDialog
          apiBase="https://api.test"
          open
          rehireFrom={resigned}
          departments={[{ _id: 'd1', code: 'KT', name: 'Kỹ thuật', active: true, organizationId: 'org1' } as any]}
          positions={[{ _id: 'pos1', code: 'DEV', name: 'Developer', departmentId: 'd1', active: true, organizationId: 'org1' } as any]}
          accounts={[]}
          onOpenChange={() => {}}
          onCreated={() => {}}
        />,
      );
    });
    await settle();

    const value = (id: string) => (document.getElementById(`create-${id}`) as HTMLInputElement | null)?.value;
    expect(document.body.textContent).toContain('Tuyển lại nhân sự');
    expect(value('fullName')).toBe('Nguyễn Văn A');
    expect(value('dateOfBirth')).toBe('02/03/1995');
    expect(value('departmentId')).toBe('d1');
    expect(value('positionId')).toBe('pos1');
    // Hồ sơ cũ vẫn giữ chỗ của email + mã nhân viên trong unique index.
    expect(value('email')).toBe('');
    expect(value('employeeCode')).toBe('');
  });
});
