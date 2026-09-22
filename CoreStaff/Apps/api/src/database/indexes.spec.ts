import { hasCompoundIndex } from './indexes';
import { OrganizationSchema } from './schemas/organization.schema';
import { UserSchema } from './schemas/user.schema';
import { UserSessionSchema } from './schemas/user-session.schema';
import { PasswordResetTokenSchema } from './schemas/password-reset-token.schema';
import { DepartmentSchema } from './schemas/department.schema';
import { PositionSchema } from './schemas/position.schema';
import { EmployeeProfileSchema } from './schemas/employee-profile.schema';
import { EmploymentHistorySchema } from './schemas/employment-history.schema';
import { InsuranceProfileSchema } from './schemas/insurance-profile.schema';
import { InsurancePolicySchema } from './schemas/insurance-policy.schema';
import { normalizeEmail, normalizeCode, normalizeEmployeeCode } from './schemas/enums';

describe('mongodb index contracts (TASK-015)', () => {
  it('Organization: unique platform code', () => {
    expect(hasCompoundIndex(OrganizationSchema, ['code'], true)).toBe(true);
  });

  it('User: tenant-scoped unique email (case-insensitive via emailN)', () => {
    expect(hasCompoundIndex(UserSchema, ['organizationId', 'emailN'], true)).toBe(true);
  });

  it('UserSession: unique token hash + user lookup + tenant scope', () => {
    expect(hasCompoundIndex(UserSessionSchema, ['tokenHash'], true)).toBe(true);
    expect(hasCompoundIndex(UserSessionSchema, ['userId', 'expiresAt'])).toBe(true);
    expect(hasCompoundIndex(UserSessionSchema, ['organizationId', 'userId'])).toBe(true);
  });

  it('PasswordResetToken: unique hash + user/expiry lookup (FR-AUTH-05)', () => {
    expect(hasCompoundIndex(PasswordResetTokenSchema, ['tokenHash'], true)).toBe(true);
    expect(hasCompoundIndex(PasswordResetTokenSchema, ['userId', 'expiresAt'])).toBe(true);
  });

  it('Department: tenant-scoped unique code (TASK-020/021, FR-HRCFG-01)', () => {
    expect(hasCompoundIndex(DepartmentSchema, ['organizationId', 'code'], true)).toBe(true);
  });

  it('Position: tenant-scoped unique code (TASK-022)', () => {
    expect(hasCompoundIndex(PositionSchema, ['organizationId', 'code'], true)).toBe(true);
  });

  it('EmployeeProfile: sole owner of tenant-scoped unique employeeCode (TASK-120)', () => {
    expect(hasCompoundIndex(EmployeeProfileSchema, ['organizationId', 'userId'], true)).toBe(true);
    expect(hasCompoundIndex(EmployeeProfileSchema, ['organizationId', 'employeeCode'], true)).toBe(true);
    expect(hasCompoundIndex(EmployeeProfileSchema, ['organizationId', 'employmentStatus'])).toBe(true);
    // The code must exist in exactly one index, or the two can drift apart.
    expect(hasCompoundIndex(UserSchema, ['organizationId', 'employeeCode'])).toBe(false);
  });

  it('EmploymentHistory: tenant/employee-scoped chronological lookup (TASK-023)', () => {
    expect(
      hasCompoundIndex(EmploymentHistorySchema, ['organizationId', 'employeeProfileId', 'createdAt']),
    ).toBe(true);
  });

  it('InsuranceProfile: tenant/employee-scoped effective-dating lookup (TASK-038)', () => {
    expect(hasCompoundIndex(InsuranceProfileSchema, ['organizationId', 'employeeId', 'effectiveFrom'])).toBe(true);
  });

  it('InsurancePolicy: tenant-scoped effective-dating lookup (TASK-039)', () => {
    expect(hasCompoundIndex(InsurancePolicySchema, ['organizationId', 'effectiveFrom'])).toBe(true);
  });
});

describe('identifier normalization (TASK-015)', () => {
  it('lowercases and trims email', () => {
    expect(normalizeEmail('  Admin@Example.COM ')).toBe('admin@example.com');
  });

  it('trims department/position codes without lowercasing', () => {
    expect(normalizeCode('  TVS-0248  ')).toBe('TVS-0248');
  });

  it('case-folds employee codes so login cannot see two tenants-identical rows', () => {
    expect(normalizeEmployeeCode('  tvs-0001  ')).toBe('TVS-0001');
    expect(normalizeEmployeeCode('TVS-0001')).toBe(normalizeEmployeeCode('tvs-0001'));
  });
});