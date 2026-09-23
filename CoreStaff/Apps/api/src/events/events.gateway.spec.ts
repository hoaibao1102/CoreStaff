import { EventsGateway } from './events.gateway';
import { hashToken } from '../auth/strategies/token-strategy';

type Row = Record<string, any>;

function queryOne(row: Row | null) {
  return { lean: async () => row };
}

function queryMany(rows: Row[]) {
  return { lean: async () => rows };
}

function socket(cookie?: string) {
  return {
    handshake: { headers: { cookie } },
    data: {},
    join: jest.fn(),
    disconnect: jest.fn(),
  } as any;
}

function gateway(options: { session?: Row | null; user?: Row | null; assignments?: Row[] } = {}) {
  const session = options.session === undefined
    ? { userId: 'u1', organizationId: 'o1', tokenHash: hashToken('valid'), revokedAt: null, expiresAt: new Date('2099-01-01') }
    : options.session;
  const user = options.user === undefined
    ? { _id: 'u1', organizationId: 'o1', role: 'DEPARTMENT_MANAGER', status: 'ACTIVE' }
    : options.user;
  const sessions = { findOne: jest.fn(() => queryOne(session ?? null)) };
  const users = { findById: jest.fn(() => queryOne(user ?? null)) };
  const assignments = { find: jest.fn(() => queryMany(options.assignments ?? [
    { organizationId: 'o1', managerUserId: 'u1', departmentId: 'd1', active: true, effectiveFrom: new Date('2020-01-01') },
    { organizationId: 'o1', managerUserId: 'u1', departmentId: 'expired', active: true, effectiveFrom: new Date('2020-01-01'), effectiveTo: new Date('2021-01-01') },
  ])) };
  return new EventsGateway(users as any, sessions as any, assignments as any);
}

describe('EventsGateway socket authorization', () => {
  it('disconnects a socket without a session cookie', async () => {
    const client = socket();
    await gateway().handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('disconnects a socket with an invalid session', async () => {
    const client = socket('sid=invalid');
    await gateway({ session: null }).handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnects a socket whose user no longer exists', async () => {
    const client = socket('sid=valid');
    await gateway({ user: null }).handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('joins only the authenticated user and effective tenant-scoped manager departments', async () => {
    const client = socket('sid=valid');
    await gateway().handleConnection(client);
    expect(client.data).toMatchObject({ userId: 'u1', organizationId: 'o1', role: 'DEPARTMENT_MANAGER' });
    expect(client.join).toHaveBeenCalledWith('user:u1');
    expect(client.join).toHaveBeenCalledWith('dept:d1');
    expect(client.join).not.toHaveBeenCalledWith('dept:expired');
  });

  it('does not expose client-controlled room registration handlers', () => {
    const service = gateway() as any;
    expect(service.handleRegisterUser).toBeUndefined();
    expect(service.handleJoinDepartment).toBeUndefined();
  });
});
