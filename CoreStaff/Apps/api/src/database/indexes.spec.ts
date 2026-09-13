import { hasCompoundIndex } from './indexes';
import { OrganizationSchema } from './schemas/organization.schema';
import { UserSchema } from './schemas/user.schema';
import { UserSessionSchema } from './schemas/user-session.schema';
import { normalizeEmail, normalizeCode } from './schemas/enums';

describe('mongodb index contracts (TASK-015)', () => {
  it('Organization: unique platform code', () => {
    expect(hasCompoundIndex(OrganizationSchema, ['code'], true)).toBe(true);
  });

  it('User: tenant-scoped unique email (case-insensitive via emailN)', () => {
    expect(hasCompoundIndex(UserSchema, ['organizationId', 'emailN'], true)).toBe(true);
  });

  it('User: tenant-scoped unique employeeCode (sparse, nullable for System Admin)', () => {
    expect(hasCompoundIndex(UserSchema, ['organizationId', 'employeeCode'], true)).toBe(true);
  });

  it('UserSession: unique token hash + user lookup + tenant scope', () => {
    expect(hasCompoundIndex(UserSessionSchema, ['tokenHash'], true)).toBe(true);
    expect(hasCompoundIndex(UserSessionSchema, ['userId', 'expiresAt'])).toBe(true);
    expect(hasCompoundIndex(UserSessionSchema, ['organizationId', 'userId'])).toBe(true);
  });
});

describe('identifier normalization (TASK-015)', () => {
  it('lowercases and trims email', () => {
    expect(normalizeEmail('  Admin@Example.COM ')).toBe('admin@example.com');
  });

  it('trims employee code without lowercasing', () => {
    expect(normalizeCode('  TVS-0248  ')).toBe('TVS-0248');
  });
});