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

describe('EventsGateway scoped domain events', () => {
  function withServer() {
    const service = gateway();
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    (service as any).server = { to };
    return { service, to, emit };
  }

  it('sends attendance changes to the employee and responsible management rooms', () => {
    const { service, to, emit } = withServer();
    service.notifyAttendanceChanged('u1', 'o1', 'd1', { attendanceStatus: 'CHECKED_IN' });
    expect(to).toHaveBeenCalledWith(['user:u1', 'dept:d1', 'org:o1:managers']);
    expect(emit).toHaveBeenCalledWith('attendance:changed', { attendanceStatus: 'CHECKED_IN' });
  });

  it('sends leave decisions to the employee and tenant-scoped management rooms', () => {
    const { service, to, emit } = withServer();
    service.notifyLeaveChanged('u1', 'o1', 'd1', { status: 'APPROVED' });
    expect(to).toHaveBeenCalledWith(['user:u1', 'dept:d1', 'org:o1:managers']);
    expect(emit).toHaveBeenCalledWith('leave:changed', { status: 'APPROVED' });
  });

  it('sends a payroll release only to the affected employees', () => {
    const { service, to, emit } = withServer();
    service.notifyPayslipReleased(['u1', 'u2'], { periodLabel: '2026-10' });
    expect(to).toHaveBeenCalledWith(['user:u1', 'user:u2']);
    expect(emit).toHaveBeenCalledWith('payslip:released', { periodLabel: '2026-10' });
  });
});

describe('EventsGateway revocation (AUD-H07 / AUD-H08)', () => {
  it.each(['DISABLED', 'LOCKED'])('refuses a socket for a %s account even with a live session row', async (status) => {
    const client = socket('sid=valid');
    await gateway({ user: { _id: 'u1', organizationId: 'o1', role: 'HR', status } }).handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('fails closed: an error while authorizing disconnects the socket instead of leaving it open', async () => {
    const client = socket('sid=valid');
    const g = gateway();
    (g as any).managerAssignmentModel = { find: () => { throw new Error('db down'); } };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await g.handleConnection(client);
    spy.mockRestore();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('puts an ACTIVE socket in session, user and tenant rooms so it can be revoked', async () => {
    const client = socket('sid=valid');
    await gateway().handleConnection(client);
    const rooms = client.join.mock.calls.map((c: any[]) => c[0]);
    expect(rooms).toEqual(expect.arrayContaining(['user:u1', `sess:${hashToken('valid')}`, 'org:o1']));
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('disconnectSession / disconnectUser / disconnectOrganization terminate the matching room', () => {
    const disconnectSockets = jest.fn();
    const inRoom = jest.fn(() => ({ disconnectSockets }));
    const g = gateway();
    (g as any).server = { in: inRoom };
    g.disconnectSession('hash1');
    g.disconnectUser('u1');
    g.disconnectOrganization('o1');
    expect(inRoom.mock.calls.map((c: any[]) => c[0])).toEqual(['sess:hash1', 'user:u1', 'org:o1']);
    expect(disconnectSockets).toHaveBeenCalledTimes(3);
    expect(disconnectSockets).toHaveBeenCalledWith(true);
  });

  it('is a no-op when the server is not initialised', () => {
    expect(() => gateway().disconnectUser('u1')).not.toThrow();
  });
});
