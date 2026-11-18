import { PlatformAuditService, stripSecrets } from './platform-audit.service';
import { PlatformService } from './platform.service';
import { AuthService } from '../auth/auth.service';
import { PlatformAuditAction, PLATFORM_AUDIT_ACTIONS } from './platform-audit.constants';
import { OrganizationStatus } from '../database/schemas/enums';
import { hashPassword } from '../auth/strategies/bcrypt.strategy';

function auditFixture() {
  const created: any[] = [];
  const logs: any = {
    created,
    create: jest.fn(async (doc: any) => { created.push(doc); return doc; }),
    find: jest.fn(() => logs.chain),
    countDocuments: jest.fn(async () => 42),
    chain: { sort: jest.fn(() => logs.chain), skip: jest.fn(() => logs.chain), limit: jest.fn(() => logs.chain), lean: jest.fn(async () => [{ _id: 'e1' }]) },
  };
  const users: any = { findById: jest.fn(() => ({ select: () => ({ lean: async () => ({ fullName: 'Platform Admin', email: 'admin@corestaff.local', role: 'SYSTEM_ADMIN' }) }) })) };
  return { logs, users, audit: new PlatformAuditService(logs as never, users as never) };
}

describe('platform audit scope', () => {
  it('records only privileged and security events, never reads or tenant business actions', () => {
    expect(PLATFORM_AUDIT_ACTIONS.sort()).toEqual([
      'ADMIN_ACCOUNT_LOCKED', 'ADMIN_LOGIN_FAILED', 'ADMIN_LOGIN_SUCCEEDED', 'ADMIN_PASSWORD_CHANGED', 'ADMIN_PASSWORD_RESET',
      'INITIAL_HR_CREATED', 'ORGANIZATION_ACTIVATED', 'ORGANIZATION_CREATED', 'ORGANIZATION_SUSPENDED',
    ]);
  });
});

describe('PlatformAuditService', () => {
  it('strips passwords, tokens and hashes at any depth', () => {
    expect(stripSecrets({ role: 'HR', tempPassword: 'x', nested: { refreshToken: 'y', passwordHash: 'z', ok: 1 }, list: [{ secretKey: 1, keep: 2 }] }))
      .toEqual({ role: 'HR', nested: { ok: 1 }, list: [{ keep: 2 }] });
  });

  it('never writes a secret even if a caller passes one', async () => {
    const { audit, logs } = auditFixture();
    await audit.record({ action: 'X', targetType: 'USER', details: { tempPassword: 'Abc12345', ok: true } });
    expect(JSON.stringify(logs.created[0])).not.toContain('Abc12345');
    expect(logs.created[0].details).toEqual({ ok: true });
  });

  it('snapshots the actor name, email and role', async () => {
    const { audit, logs } = auditFixture();
    await audit.recordForActor('64b7f0f4f0f4f0f4f0f4f0f4', { action: 'X', targetType: 'ORGANIZATION' });
    expect(logs.created[0]).toMatchObject({ actorNameSnapshot: 'Platform Admin', actorEmailSnapshot: 'admin@corestaff.local', actorRoleSnapshot: 'SYSTEM_ADMIN' });
    expect(logs.created[0].eventId).toBeTruthy();
    expect(logs.created[0].occurredAt).toBeInstanceOf(Date);
  });

  it('a failed log write does not fail the admin action', async () => {
    const { audit, logs } = auditFixture();
    logs.create.mockRejectedValueOnce(new Error('db down'));
    await expect(audit.record({ action: 'X', targetType: 'USER' })).resolves.toBeUndefined();
  });

  it('lists with Vietnam-day bounds, escaped text search and a clamped page size', async () => {
    const { audit, logs } = auditFixture();
    const result = await audit.list({ action: 'ORGANIZATION_SUSPENDED', outcome: 'SUCCEEDED', from: '2026-11-01', to: '2026-11-30', q: 'a.b(c', limit: 5000, page: 0 });
    expect(result).toEqual({ items: [{ _id: 'e1' }], total: 42 });
    const filter = logs.find.mock.calls[0][0];
    expect(filter.action).toBe('ORGANIZATION_SUSPENDED');
    expect(filter.occurredAt.$gte.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(filter.occurredAt.$lte.toISOString()).toBe('2026-11-30T16:59:59.999Z');
    expect(filter.$or[0].targetSummary.source).toBe('a\\.b\\(c');
    expect(logs.chain.limit).toHaveBeenCalledWith(100);
    expect(logs.chain.skip).toHaveBeenCalledWith(0);
  });

  it('ignores a malformed organization id instead of throwing', async () => {
    const { audit, logs } = auditFixture();
    await audit.list({ targetOrganizationId: 'not-an-id', actorId: 'nope' });
    expect(logs.find.mock.calls[0][0]).toEqual({});
  });
});

describe('PlatformService writes the audit', () => {
  function platform() {
    const { audit, logs } = auditFixture();
    const org: any = { _id: 'org1', code: 'TVS', name: 'TVS Corporation', status: 'ACTIVE' };
    const orgModel: any = {
      create: jest.fn(async () => ({ toObject: () => org })),
      exists: jest.fn(async () => ({ _id: 'org1' })),
      findById: jest.fn(() => ({ select: () => ({ lean: async () => ({ status: org.status }) }) })),
      findOneAndUpdate: jest.fn((_f: any, update: any) => ({ lean: async () => Object.assign(org, update) })),
    };
    const userModel: any = {
      exists: jest.fn(async () => null),
      create: jest.fn(async (doc: any) => ({ toObject: () => ({ _id: 'u9', ...doc }) })),
    };
    const sessionModel: any = { updateMany: jest.fn(() => ({ exec: async () => ({ modifiedCount: 3 }) })) };
    const service = new PlatformService(orgModel, userModel, sessionModel, undefined, undefined, audit);
    return { service, logs };
  }

  it('records ORGANIZATION_CREATED with the org code and name', async () => {
    const { service, logs } = platform();
    await service.createOrganization({ code: 'tvs', name: 'TVS Corporation' } as never, '64b7f0f4f0f4f0f4f0f4f0f4');
    expect(logs.created[0]).toMatchObject({ action: PlatformAuditAction.ORGANIZATION_CREATED, targetType: 'ORGANIZATION', targetSummary: 'TVS — TVS Corporation', actorEmailSnapshot: 'admin@corestaff.local' });
  });

  it('records INITIAL_HR_CREATED without the temporary password', async () => {
    const { service, logs } = platform();
    const result: any = await service.createInitialHr('org1', { email: 'hr@tvs.local', fullName: 'HR One' } as never, '64b7f0f4f0f4f0f4f0f4f0f4');
    expect(result.tempPassword).toBeTruthy();
    expect(logs.created[0]).toMatchObject({ action: PlatformAuditAction.INITIAL_HR_CREATED, targetSummary: 'hr@tvs.local (HR)', targetOrganizationId: 'org1' });
    expect(JSON.stringify(logs.created[0])).not.toContain(result.tempPassword);
  });

  it('records a suspension with how many sessions were revoked', async () => {
    const { service, logs } = platform();
    await service.setOrganizationStatus('org1', OrganizationStatus.SUSPENDED, '64b7f0f4f0f4f0f4f0f4f0f4');
    expect(logs.created[0]).toMatchObject({ action: PlatformAuditAction.ORGANIZATION_SUSPENDED, details: { previousStatus: 'ACTIVE', newStatus: 'SUSPENDED', revokedSessions: 3 } });
  });

  it('records re-activation without a revoked-session count', async () => {
    const { service, logs } = platform();
    await service.setOrganizationStatus('org1', OrganizationStatus.ACTIVE, '64b7f0f4f0f4f0f4f0f4f0f4');
    expect(logs.created[0].action).toBe(PlatformAuditAction.ORGANIZATION_ACTIVATED);
    expect(logs.created[0].details.revokedSessions).toBeUndefined();
  });

  it('writes nothing when the organization does not exist', async () => {
    const { service, logs } = platform();
    (service as any).orgModel.findOneAndUpdate = jest.fn(() => ({ lean: async () => null }));
    await expect(service.setOrganizationStatus('missing', OrganizationStatus.SUSPENDED, 'x')).rejects.toThrow('ORGANIZATION_NOT_FOUND');
    expect(logs.created).toHaveLength(0);
  });
});

describe('AuthService audits platform admin accounts only', () => {
  async function auth(role: string) {
    const { audit, logs } = auditFixture();
    const user: any = { _id: 'u1', email: 'admin@corestaff.local', fullName: 'Platform Admin', role, status: 'ACTIVE', failedLoginCount: 0, passwordHash: await hashPassword('Correct#Horse9'), mustChangePassword: false, save: jest.fn(), toObject() { return { ...this }; } };
    const userModel: any = {
      findById: jest.fn(() => ({ select: () => ({ lean: async () => ({ failedLoginCount: 5, lockedUntil: new Date(Date.now() + 60000) }) }) })),
      updateOne: jest.fn(() => ({ exec: async () => ({}) })),
      find: jest.fn(() => ({ exec: async () => [user] })),
    };
    const sessionModel: any = { create: jest.fn(async () => ({})) };
    const service: any = new AuthService(userModel, sessionModel, {} as never, {} as never, {} as never, {} as never, undefined, audit);
    service.resolveLoginUser = jest.fn(async () => ({ user, employeeCode: undefined }));
    service.assertNotTenantLocked = jest.fn(async () => undefined);
    return { service, logs };
  }

  it('records a successful admin sign-in with the client address', async () => {
    const { service, logs } = await auth('SYSTEM_ADMIN');
    await service.login({ identifier: 'admin@corestaff.local', password: 'Correct#Horse9' }, { ip: '10.0.0.7', userAgent: 'jest' });
    expect(logs.created[0]).toMatchObject({ action: PlatformAuditAction.ADMIN_LOGIN_SUCCEEDED, ip: '10.0.0.7', actorRoleSnapshot: 'SYSTEM_ADMIN', outcome: 'SUCCEEDED' });
  });

  it('records a failed admin sign-in and the lockout it triggers, never the password tried', async () => {
    const { service, logs } = await auth('SYSTEM_ADMIN');
    await expect(service.login({ identifier: 'admin@corestaff.local', password: 'Wrong#Guess1' })).rejects.toThrow('AUTH_INVALID_CREDENTIALS');
    expect(logs.created.map((row: any) => row.action)).toEqual([PlatformAuditAction.ADMIN_LOGIN_FAILED, PlatformAuditAction.ADMIN_ACCOUNT_LOCKED]);
    expect(logs.created[0]).toMatchObject({ outcome: 'FAILED', details: { failedLoginCount: 5, reason: 'WRONG_PASSWORD' } });
    expect(JSON.stringify(logs.created)).not.toContain('Wrong#Guess1');
  });

  it('does not write the platform audit for an ordinary HR login', async () => {
    const { service, logs } = await auth('HR');
    await service.login({ identifier: 'admin@corestaff.local', password: 'Correct#Horse9' });
    await expect(service.login({ identifier: 'admin@corestaff.local', password: 'Wrong#Guess1' })).rejects.toThrow();
    expect(logs.created).toHaveLength(0);
  });
});
