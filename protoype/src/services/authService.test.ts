import { describe, expect, it, beforeEach } from 'vitest';
import { authenticateMockUser, clearMockSession, loadMockSession, MOCK_ACCOUNTS } from './authService';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  },
});

describe('mock authentication', () => {
  beforeEach(() => localStorage.clear());

  it('logs in with employee code regardless of letter case', async () => {
    const session = await authenticateMockUser('tvs-0248', 'Employee@123');
    expect(session.user.role).toBe('EMPLOYEE');
    expect(session.user.employeeCode).toBe('TVS-0248');
    expect(loadMockSession()?.user.employeeCode).toBe('TVS-0248');
  });

  it('logs in with email and returns approver role', async () => {
    const session = await authenticateMockUser('hai.le@timelock.demo', 'Approver@123');
    expect(session.user.role).toBe('APPROVER');
  });

  it('rejects invalid credentials without revealing which field is wrong', async () => {
    await expect(authenticateMockUser('unknown', 'bad')).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });

  it('removes the persisted session on logout', async () => {
    await authenticateMockUser(MOCK_ACCOUNTS[0].employeeCode, MOCK_ACCOUNTS[0].password);
    clearMockSession();
    expect(loadMockSession()).toBeNull();
  });
});
