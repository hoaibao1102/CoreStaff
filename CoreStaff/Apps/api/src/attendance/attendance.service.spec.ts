import { NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { AttendanceService } from './attendance.service';
import { model, Types } from 'mongoose';
import { AttendanceDaySchema } from '../database/schemas/attendance-day.schema';
import { AttendanceEventSchema } from '../database/schemas/attendance-event.schema';
import { AttendanceApprovalStatus, AttendanceStatus, WorkMode } from '../database/schemas/enums';
import { AttendanceCalculatorService } from './services/attendance-calculator.service';
import { HaversineService } from './services/haversine.service';

type Row = Record<string, any>;

function queryOne(row: Row | null) {
  return { lean: async () => row };
}

function build(options: {
  evidence?: Row | null;
  request?: Row | null;
  managerAssignments?: Row[];
} = {}) {
  const evidence = options.evidence === undefined
    ? { _id: '507f1f77bcf86cd799439011', organizationId: '507f1f77bcf86cd799439012', ownerUserId: '507f1f77bcf86cd799439013', storageKey: 'org/evidence/file.jpg', mimeType: 'image/jpeg', originalFileName: 'selfie.jpg' }
    : options.evidence;
  const evidenceModel = { findOne: jest.fn(() => queryOne(evidence ?? null)) };
  const managerRequestModel = { findOne: jest.fn(() => queryOne(options.request ?? null)) };
  const managerAssignmentModel = {
    findOne: jest.fn((filter: Row) => queryOne((options.managerAssignments ?? []).find((row) =>
      String(row.organizationId) === String(filter.organizationId)
      && String(row.managerUserId) === String(filter.managerUserId)
      && String(row.departmentId) === String(filter.departmentId)
      && row.active === true,
    ) ?? null)),
  };
  const storage = { download: jest.fn(async () => Readable.from('bytes')), isConfigured: jest.fn(() => true) };
  const inertModel = {} as any;
  const service = new AttendanceService(
    inertModel,
    inertModel,
    evidenceModel as any,
    inertModel,
    inertModel,
    inertModel,
    managerAssignmentModel as any,
    managerRequestModel as any,
    inertModel,
    { findOne: jest.fn(() => queryOne(null)), create: jest.fn() } as any,
    {} as any,
    {} as any,
    {} as any,
    storage as any,
    { resolveForEmployeeDate: jest.fn(async () => null) } as any,
    { bump: jest.fn(async () => true) } as any, // periodVersion
    undefined, // eventsGateway
    undefined, // overtime
  );
  return { service, storage };
}

const evidenceId = '507f1f77bcf86cd799439011';
const organizationId = '507f1f77bcf86cd799439012';
const ownerId = '507f1f77bcf86cd799439013';
const managerId = '507f1f77bcf86cd799439014';

describe('additive attendance endpoint provenance schema', () => {
  const Day = model('ProvenanceSpecDay', AttendanceDaySchema);
  const Event = model('ProvenanceSpecEvent', AttendanceEventSchema);

  it('does not backfill missing legacy provenance from timestamps or approval defaults', () => {
    const legacy = Day.hydrate({ checkInAt: new Date(), checkOutAt: new Date() });
    expect(legacy.checkInProvenance).toBeUndefined();
    expect(legacy.checkOutProvenance).toBeUndefined();
    expect(new Event({ recordedAt: new Date() }).provenance).toBeUndefined();
  });

  it('rejects an unsupported source rather than silently accepting invented evidence', () => {
    const day = new Day({ checkInProvenance: { source: 'TIMESTAMP' } });
    expect(day.validateSync()?.errors['checkInProvenance.source']).toBeDefined();
  });

  it('preserves per-endpoint sources and typed event/request references without changing unique event identity', () => {
    const eventId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const day = new Day({ checkInProvenance: { source: 'OBSERVED', eventId }, checkOutProvenance: { source: 'CONFIRMED_SCHEDULE', requestId } });
    expect(day.toObject()).toMatchObject({ checkInProvenance: { source: 'OBSERVED', eventId }, checkOutProvenance: { source: 'CONFIRMED_SCHEDULE', requestId } });
    const event = new Event({ provenance: { source: 'MANUAL_ADJUSTMENT', requestId } });
    expect(event.toObject()).toMatchObject({ provenance: { source: 'MANUAL_ADJUSTMENT', requestId } });
    expect(AttendanceEventSchema.indexes()).toContainEqual([{ organizationId: 1, attendanceDayId: 1, eventType: 1 }, expect.objectContaining({ unique: true })]);
  });
});

function punchFixture(checkOut = false, existingIn = false) {
  const workplace = { latitude: 10, longitude: 106, allowedRadiusMeters: 100 };
  const assignment = { workplaceId: workplace, shiftTemplateId: { startTime: '08:00', endTime: '17:00', breakMinutes: 60 }, departmentId: new Types.ObjectId() };
  const chain = (value: any) => { const q: any = { session: () => q, populate: () => q, select: () => q, sort: () => q, lean: async () => value, then: (resolve: any) => resolve(value) }; return q; };
  const day: any = { _id: new Types.ObjectId(), employeeId: new Types.ObjectId(ownerId), organizationId: new Types.ObjectId(organizationId), workDate: '2026-10-30', workMode: WorkMode.IN_OFFICE, attendanceStatus: checkOut ? AttendanceStatus.CHECKED_IN : AttendanceStatus.NOT_CHECKED_IN, overallApprovalStatus: AttendanceApprovalStatus.NOT_REQUIRED, ...(checkOut ? { checkInAt: new Date('2026-10-30T01:00:00Z') } : {}), save: jest.fn(async () => undefined) };
  const days = { find: jest.fn(() => chain([day])), findOne: jest.fn(() => chain(checkOut || existingIn ? day : null)), create: jest.fn(async (value: any) => Object.assign(day, value)) };
  const events = { findOne: jest.fn(() => chain(null)), create: jest.fn(async (value: any) => ({ _id: new Types.ObjectId(), ...value })), find: jest.fn(() => chain([])) };
  const requests = { find: jest.fn(() => chain([])), findOne: jest.fn(() => chain(null)), create: jest.fn(async (value: any) => ({ _id: new Types.ObjectId(), ...value })) };
  const service = new AttendanceService(days as any, events as any, { create: async (value: any) => value } as any, { findOne: () => chain(assignment) } as any, {} as any, {} as any, {} as any, requests as any, { findOne: () => chain({ _id: new Types.ObjectId(), departmentId: assignment.departmentId }) } as any, { findOne: () => chain(null), create: jest.fn() } as any, { findOne: () => chain(null) } as any, new HaversineService(), new AttendanceCalculatorService(), { isConfigured: () => false } as any, { resolveForEmployeeDate: async () => null } as any, { bump: jest.fn(async () => false) } as any);
  jest.spyOn(service, 'getTodayWorkDate').mockReturnValue('2026-10-30');
  return { service, day, days, events, requests, assignment };
}

describe('ordinary shift break snapshot', () => {
  it('snapshots exact working intervals at checkin without a leave override', async () => {
    const { service, day, assignment } = punchFixture();
    Object.assign(assignment.shiftTemplateId, { breakStartTime: '12:00', breakEndTime: '13:00' });
    await service.checkIn(ownerId, organizationId, { workMode: WorkMode.IN_OFFICE, latitude: 10, longitude: 106, address: 'Office' } as any, undefined, undefined, undefined, 'break-snapshot');
    expect(day.shiftSnapshot.requiredWorkingIntervals).toEqual([{ from: '08:00', to: '12:00' }, { from: '13:00', to: '17:00' }]);
    expect(day.shiftSnapshot).toMatchObject({ breakStartTime: '12:00', breakEndTime: '13:00' });
  });
});

function notificationFixture(checkout = false) {
  const fixture = punchFixture(checkout);
  const { service, day, days, events, requests } = fixture;
  const gateway = { notifyAttendanceChanged: jest.fn(), notifyNewRequest: jest.fn() };
  (service as any).eventsGateway = gateway;
  day.getChanges = () => ({ $set: {} });
  (days as any).updateOne = jest.fn(async () => ({ modifiedCount: 1 }));
  for (const model of [days, events, requests, (service as any).evidenceModel, (service as any).idempotencyModel]) {
    model.create = jest.fn(async (value: any) => {
      const record = { _id: new Types.ObjectId(), ...(Array.isArray(value) ? value[0] : value) };
      return Array.isArray(value) ? [record] : record;
    });
  }
  (service as any).periodVersion.claimForWorkDate = jest.fn(async () => ({ periodId: new Types.ObjectId().toString() }));
  const session = { withTransaction: jest.fn(async (fn: any) => fn()), endSession: jest.fn() };
  (days as any).db = { model: () => ({ findById: () => queryOne({ attendanceOvertimeV2Enabled: true }) }), startSession: async () => session };
  const punch = () => (checkout ? service.checkOut.bind(service) : service.checkIn.bind(service))(
    ownerId, organizationId, verifiedPunch,
    { fieldname: 'selfie', originalname: 'selfie.jpg', encoding: '7bit', mimetype: 'image/jpeg', size: 3, buffer: Buffer.from('jpg') },
    undefined, undefined, 'notify',
  );
  return { ...fixture, gateway, session, punch };
}

describe('AttendanceService post-commit notifications', () => {
  it.each(['throw', 'reject'])('preserves committed response when attendance notification fails via %s', async failure => {
    const { gateway, punch } = notificationFixture();
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    gateway.notifyAttendanceChanged.mockImplementation(() => {
      if (failure === 'throw') throw new Error('socket unavailable');
      return Promise.reject(new Error('socket unavailable'));
    });
    try {
      await expect(punch()).resolves.toMatchObject({ attendanceStatus: 'CHECKED_IN' });
      expect(warning).toHaveBeenCalled();
    } finally { warning.mockRestore(); }
  });

  it('discards queued notifications when commit fails', async () => {
    const { session, gateway, punch } = notificationFixture();
    session.withTransaction.mockImplementation(async fn => { await fn(); throw new Error('commit failed'); });
    await expect(punch()).rejects.toThrow('commit failed');
    expect(gateway.notifyAttendanceChanged).not.toHaveBeenCalled();
    expect(gateway.notifyNewRequest).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('discards an aborted attempt and emits only the retried attempt payloads', async () => {
    const { session, gateway, punch, requests } = notificationFixture();
    session.withTransaction.mockImplementation(async fn => { await fn(); return fn(); });
    const response = await punch();
    const committedRequest = (await requests.create.mock.results[1].value)[0];
    expect(gateway.notifyAttendanceChanged).toHaveBeenCalledTimes(1);
    expect(gateway.notifyAttendanceChanged.mock.calls[0][3]).toBe(response);
    expect(gateway.notifyNewRequest).toHaveBeenCalledTimes(1);
    expect(gateway.notifyNewRequest.mock.calls[0][1].requestId).toBe(String(committedRequest._id));
  });

  it('continues flushing after a rejected pending approval notification', async () => {
    const { gateway, punch } = notificationFixture();
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    gateway.notifyNewRequest.mockImplementation(() => Promise.reject(new Error('socket unavailable')));
    try {
      await expect(punch()).resolves.toMatchObject({ attendanceStatus: 'CHECKED_IN' });
      expect(gateway.notifyAttendanceChanged).toHaveBeenCalledTimes(1);
    } finally { warning.mockRestore(); }
  });

  it('preserves immediate notifications for legacy no-session punches', async () => {
    const { gateway, punch, days } = notificationFixture();
    delete (days as any).db;
    await punch();
    expect(gateway.notifyAttendanceChanged).toHaveBeenCalledTimes(1);
    expect(gateway.notifyNewRequest).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])('emits attendance and pending approval only after commit checkout=%s', async checkout => {
    const { session, gateway, punch } = notificationFixture(checkout);
    session.withTransaction.mockImplementation(async fn => {
      const result = await fn();
      expect(gateway.notifyAttendanceChanged).not.toHaveBeenCalled();
      expect(gateway.notifyNewRequest).not.toHaveBeenCalled();
      return result;
    });
    await punch();
    expect(gateway.notifyAttendanceChanged).toHaveBeenCalledTimes(1);
    expect(gateway.notifyNewRequest).toHaveBeenCalledTimes(1);
  });
});

describe('V2 period guard', () => {
  it.each([false, true])('blocks punch without active period before endpoint mutation checkout=%s', async checkout => {
    const { service, day } = punchFixture(checkout);
    const session = { inTransaction: () => true, withTransaction: async (fn: any) => fn(), endSession: jest.fn() };
    (service as any).attendanceDayModel.db = { model: () => ({ findById: () => ({ lean: async () => ({ attendanceOvertimeV2Enabled: true }) }) }), startSession: async () => session };
    (service as any).periodVersion.claimForWorkDate = jest.fn(async () => { throw new Error('ACTIVE_TIMESHEET_PERIOD_REQUIRED'); });
    const action = checkout ? service.checkOut.bind(service) : service.checkIn.bind(service);
    await expect(action(ownerId, organizationId, verifiedPunch, undefined, undefined, undefined, 'v2')).rejects.toThrow('ACTIVE_TIMESHEET_PERIOD_REQUIRED');
    expect(day.save).not.toHaveBeenCalled();
  });
});

const verifiedPunch = { workMode: WorkMode.IN_OFFICE, latitude: 10, longitude: 106, address: 'Office' } as any;

describe('AttendanceService endpoint writers', () => {
  it('returns explicit unknown provenance for legacy history without persisting guessed sources', async () => {
    const { service, day } = punchFixture(true);
    const history = await service.getHistory(ownerId, organizationId, '2026-10');
    expect(history.items[0]).toMatchObject({ checkInProvenance: { source: 'LEGACY_UNKNOWN' }, checkOutProvenance: { source: 'LEGACY_UNKNOWN' } });
    expect(day.checkInProvenance).toBeUndefined();
    expect(day.save).not.toHaveBeenCalled();
  });

  it.each([false, true])('keeps pending SELFIE unverified for checkout=%s', async checkout => {
    const { service, day, events, requests } = punchFixture(checkout);
    const action = checkout ? service.checkOut.bind(service) : service.checkIn.bind(service);
    await action(ownerId, organizationId, verifiedPunch, { fieldname: 'selfie', originalname: 'selfie.jpg', encoding: '7bit', mimetype: 'image/jpeg', size: 3, buffer: Buffer.from('jpg') }, undefined, undefined, 'selfie');
    const event = await events.create.mock.results[0].value;
    expect(event.approvalStatus).toBe('PENDING');
    expect(day.overallApprovalStatus).toBe('PENDING');
    expect(event.provenance).toEqual({ source: 'LEGACY_UNKNOWN', eventId: event._id });
    expect(checkout ? day.checkOutProvenance : day.checkInProvenance).toEqual(event.provenance);
    expect(requests.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'ATTENDANCE', status: 'PENDING', attendanceDayId: day._id }));
  });

  it('reads legacy endpoints as unknown without inferring observed from GPS-like timestamps', async () => {
    const { service } = punchFixture(true);
    const state = await service.getTodayState(ownerId, organizationId);
    expect(state).toMatchObject({ checkInProvenance: { source: 'LEGACY_UNKNOWN' }, checkOutProvenance: { source: 'LEGACY_UNKNOWN' } });
  });

  it('links verified checkout to its observed event without inventing provenance for a legacy check-in', async () => {
    const { service, day, events } = punchFixture(true);
    const originalIn = day.checkInAt;
    await service.checkOut(ownerId, organizationId, verifiedPunch, undefined, undefined, undefined, 'out');
    const savedEvent = await events.create.mock.results[0].value;
    expect(day.checkOutProvenance).toEqual({ source: 'OBSERVED', eventId: savedEvent._id });
    expect(savedEvent.provenance).toEqual(day.checkOutProvenance);
    expect(day.checkInAt).toEqual(originalIn);
    expect(day.checkInProvenance).toBeUndefined();
  });

  it.each([false, true])('links a verified GPS check-in to its observed event (existing day: %s)', async existing => {
    const { service, day, events } = punchFixture(false, existing);
    await service.checkIn(ownerId, organizationId, verifiedPunch, undefined, undefined, undefined, 'in');
    const savedEvent = await events.create.mock.results[0].value;
    expect(day.checkInProvenance).toEqual({ source: 'OBSERVED', eventId: savedEvent._id });
    expect(savedEvent.provenance).toEqual(day.checkInProvenance);
    expect(savedEvent.approvalStatus).toBe('NOT_REQUIRED');
  });
});

describe('AttendanceService evidence authorization', () => {
  it('allows the evidence owner in the same tenant', async () => {
    const { service, storage } = build();
    await expect(service.getEvidenceStream(evidenceId, { userId: ownerId, organizationId, role: 'EMPLOYEE' }))
      .resolves.toMatchObject({ mimeType: 'image/jpeg', originalFileName: 'selfie.jpg' });
    expect(storage.download).toHaveBeenCalledWith('org/evidence/file.jpg');
  });

  it('returns resource not found to another employee in the same tenant', async () => {
    const { service, storage } = build();
    await expect(service.getEvidenceStream(evidenceId, {
      userId: '507f1f77bcf86cd799439099', organizationId, role: 'EMPLOYEE',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.download).not.toHaveBeenCalled();
  });

  it('returns resource not found across tenants', async () => {
    const { service } = build({ evidence: null });
    await expect(service.getEvidenceStream(evidenceId, {
      userId: ownerId, organizationId: '507f1f77bcf86cd799439099', role: 'EMPLOYEE',
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows a manager with an effective assignment for the request department', async () => {
    const departmentId = '507f1f77bcf86cd799439015';
    const { service } = build({
      request: { evidenceId, organizationId, departmentId },
      managerAssignments: [{ organizationId, managerUserId: managerId, departmentId, active: true, effectiveFrom: new Date('2020-01-01') }],
    });
    await expect(service.getEvidenceStream(evidenceId, {
      userId: managerId, organizationId, role: 'DEPARTMENT_MANAGER',
    })).resolves.toMatchObject({ mimeType: 'image/jpeg' });
  });

  it('blocks a manager outside the effective department scope', async () => {
    const departmentId = '507f1f77bcf86cd799439015';
    const { service } = build({
      request: { evidenceId, organizationId, departmentId },
      managerAssignments: [{ organizationId, managerUserId: managerId, departmentId, active: true, effectiveFrom: new Date('2020-01-01'), effectiveTo: new Date('2021-01-01') }],
    });
    await expect(service.getEvidenceStream(evidenceId, {
      userId: managerId, organizationId, role: 'DEPARTMENT_MANAGER',
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows HR in the same tenant but not SYSTEM_ADMIN by default', async () => {
    const { service } = build();
    await expect(service.getEvidenceStream(evidenceId, {
      userId: managerId, organizationId, role: 'HR',
    })).resolves.toMatchObject({ mimeType: 'image/jpeg' });
    await expect(service.getEvidenceStream(evidenceId, {
      userId: managerId, organizationId, role: 'SYSTEM_ADMIN',
    })).rejects.toBeInstanceOf(NotFoundException);
  });
});
