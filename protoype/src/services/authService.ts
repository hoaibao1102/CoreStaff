export type MockRole = 'EMPLOYEE' | 'APPROVER' | 'HR' | 'ADMIN';

export interface MockAccount {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
  password: string;
  role: MockRole;
  department: string;
}

export interface MockSession {
  token: string;
  user: Omit<MockAccount, 'password'>;
  signedInAt: string;
}

export class AuthError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export const MOCK_ACCOUNTS: MockAccount[] = [
  { id: 'usr-employee-a', fullName: 'Nguyễn Văn An', employeeCode: 'TVS-0248', email: 'an.nguyen@timelock.demo', password: 'Employee@123', role: 'EMPLOYEE', department: 'Phòng Kinh doanh' },
  { id: 'usr-approver-b', fullName: 'Lê Hoàng Hải', employeeCode: 'TVS-0102', email: 'hai.le@timelock.demo', password: 'Approver@123', role: 'APPROVER', department: 'Phòng Kinh doanh' },
  { id: 'usr-admin', fullName: 'Trần Minh Anh', employeeCode: 'TVS-0001', email: 'admin@timelock.demo', password: 'Admin@123', role: 'ADMIN', department: 'Quản trị hệ thống' },
  { id: 'usr-hr', fullName: 'Phạm Thị Thu Hà', employeeCode: 'TVS-0008', email: 'ha.phan@timelock.demo', password: 'Hr@123', role: 'HR', department: 'Phòng Nhân sự' },
  { id: 'usr-employee-c', fullName: 'Trần Thị Bích Ngọc', employeeCode: 'TVS-0312', email: 'ngoc.tran@timelock.demo', password: 'Employee@123', role: 'EMPLOYEE', department: 'Phòng Dự án ERP' },
];

const SESSION_KEY = 'timelock-mock-session-v1';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function authenticateMockUser(identifier: string, password: string): Promise<MockSession> {
  await wait(450);
  const normalized = identifier.trim().toLowerCase();
  const account = MOCK_ACCOUNTS.find((item) => item.email.toLowerCase() === normalized || item.employeeCode.toLowerCase() === normalized);
  if (!account || account.password !== password) {
    throw new AuthError('AUTH_INVALID_CREDENTIALS', 'Thông tin đăng nhập không hợp lệ.');
  }
  const { password: _password, ...user } = account;
  const session: MockSession = { token: `mock-${account.id}-${Date.now()}`, user, signedInAt: new Date().toISOString() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function loadMockSession(): MockSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as MockSession : null;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearMockSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
