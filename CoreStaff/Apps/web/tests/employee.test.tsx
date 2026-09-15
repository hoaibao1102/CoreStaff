import { renderToStaticMarkup } from 'react-dom/server';
import { EmployeeDirectoryScreen } from '../src/screens/EmployeeDirectory/EmployeeDirectoryScreen';
import { EmployeeProfileScreen } from '../src/screens/EmployeeProfile/EmployeeProfileScreen';
import { canViewEmployees, directoryPage, type EmployeeView } from '../src/lib/employee';
import type { AuthUser } from '../src/services/auth';

const user: AuthUser = { id: 'u1', organizationId: 'org1', role: 'HR', fullName: 'Session Name', email: 'session@example.test', employeeCode: 'E001', status: 'ACTIVE' };
const employee: EmployeeView = { id: 'p1', userId: 'u1', organizationId: 'org1', employeeCode: 'E001', fullName: 'Test Employee', employmentStatus: 'ACTIVE', department: 'Engineering', workplace: 'Office', shift: 'Morning', manager: 'Manager' };

describe('TASK-025 directory', () => {
  test.each(['EMPLOYEE', 'DEPARTMENT_MANAGER', 'SYSTEM_ADMIN'] as const)('denies %s', role => {
    const html = renderToStaticMarkup(<EmployeeDirectoryScreen user={{ ...user, role }} state={{ status: 'ready', data: [employee] }} />);
    expect(html).toContain('Bạn không có quyền');
    expect(html).not.toContain('Test Employee');
  });
  test('requires tenant and displays HR rows with nullable fields', () => {
    expect(canViewEmployees({ ...user, organizationId: undefined })).toBe(false);
    const html = renderToStaticMarkup(<EmployeeDirectoryScreen user={user} state={{ status: 'ready', data: [employee] }} />);
    expect(html).toContain('Test Employee'); expect(html).toContain('Đang làm việc');
    expect(html).toContain('Engineering'); expect(html).toContain('—');
  });
  test('search, combined filters, tenant isolation, pagination and shrinking results', () => {
    const rows = Array.from({ length: 23 }, (_, i) => ({ ...employee, id: String(i), employeeCode: `E${i}` }));
    rows.push({ ...employee, organizationId: 'other' });
    expect(directoryPage(rows, 'org1', '', '', '', 2).rows).toHaveLength(10);
    expect(directoryPage(rows, 'org1', '', '', '', 3).rows).toHaveLength(3);
    expect(directoryPage(rows, 'org1', ' e22 ', 'Engineering', 'ACTIVE', 9)).toMatchObject({ total: 1, current: 1 });
    expect(directoryPage(rows, 'org1', 'test employee', '', '', 1).total).toBe(23);
    expect(directoryPage(rows, 'org1', '', '', 'PROBATION', 1).total).toBe(0);
    expect(directoryPage(rows, 'org1', '', 'Other', '', 1).total).toBe(0);
  });
  test('empty and unavailable are distinct', () => {
    expect(renderToStaticMarkup(<EmployeeDirectoryScreen user={user} />)).toContain('Dữ liệu nhân sự chưa khả dụng');
    expect(renderToStaticMarkup(<EmployeeDirectoryScreen user={user} state={{ status: 'ready', data: [] }} />)).toContain('Chưa có nhân viên trong tổ chức');
  });
});
describe('TASK-026 self profile', () => {
  test.each(['EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR'] as const)('uses authenticated %s identity and own assignment', role => {
    const html = renderToStaticMarkup(<EmployeeProfileScreen user={{ ...user, role }} state={{ status: 'ready', data: employee }} />);
    expect(html).toContain('Session Name'); expect(html).toContain('session@example.test');
    expect(html).toContain('Office'); expect(html).toContain('Morning'); expect(html).toContain('Manager');
    expect(html).not.toContain('<input'); expect(html).not.toContain('Test Employee');
  });
  test.each([{ userId: 'other' }, { organizationId: 'other' }])('rejects foreign profile %j', change => {
    const html = renderToStaticMarkup(<EmployeeProfileScreen user={user} state={{ status: 'ready', data: { ...employee, ...change } }} />);
    expect(html).toContain('Bạn không có quyền'); expect(html).not.toContain('Office');
  });
  test('handles absent profile, missing identity and null assignments', () => {
    expect(renderToStaticMarkup(<EmployeeProfileScreen user={user} state={{ status: 'ready', data: null }} />)).toContain('Bạn chưa có hồ sơ nhân viên');
    expect(renderToStaticMarkup(<EmployeeProfileScreen user={user} state={{ status: 'ready', data: { ...employee, shift: null } }} />)).toContain('Chưa có thông tin');
    expect(renderToStaticMarkup(<EmployeeProfileScreen user={{ ...user, id: undefined }} state={{ status: 'ready', data: employee }} />)).toContain('Bạn không có quyền');
    expect(renderToStaticMarkup(<EmployeeProfileScreen user={{ ...user, role: 'SYSTEM_ADMIN' }} />)).toContain('Bạn không có quyền');
  });
});
test.each(['loading', 'error', 'forbidden', 'unavailable'] as const)('both screens render %s without employee data', status => {
  for (const Screen of [EmployeeDirectoryScreen, EmployeeProfileScreen]) {
    const html = renderToStaticMarkup(<Screen user={user} state={{ status }} />);
    expect(html).toContain(status === 'error' || status === 'forbidden' ? 'role="alert"' : 'role="status"');
    expect(html).not.toContain('Test Employee');
  }
});
