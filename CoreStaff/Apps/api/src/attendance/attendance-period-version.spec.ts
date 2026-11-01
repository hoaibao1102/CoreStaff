import { AttendanceService } from './attendance.service';
import { AttendanceStatus, WorkMode } from '../database/schemas/enums';

const ORG = '64f1a2b3c4d5e6f7a8b9c0d0';
const USER = '64f1a2b3c4d5e6f7a8b9c0d1';
const PERIOD = '64f1a2b3c4d5e6f7a8b9c0d2';

function assignmentQuery(assignment: any) {
  const query: any = { populate: () => query, then: (resolve: (value: any) => void) => resolve(assignment) };
  return query;
}

function build(kind: 'check-in' | 'check-out', bump = jest.fn(async () => true)) {
  const assignment = {
    departmentId: '64f1a2b3c4d5e6f7a8b9c0d3',
    workplaceId: { allowGpsAttendance: true, latitude: 10, longitude: 106, allowedRadiusMeters: 1000, maximumAccuracyMeters: 100 },
    shiftTemplateId: { _id: 'shift-1', name: 'Day', startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 15 },
  };
  const day: any = kind === 'check-out' ? {
    _id: 'day-1', periodId: PERIOD, attendanceStatus: AttendanceStatus.CHECKED_IN,
    workMode: WorkMode.IN_OFFICE, checkInAt: new Date(), shiftSnapshot: assignment.shiftTemplateId,
    save: jest.fn(async () => undefined),
  } : null;
  const createdDay: any = day ?? { _id: 'day-1', periodId: PERIOD };
  const attendanceDays = {
    findOne: jest.fn(async () => day),
    create: jest.fn(async () => createdDay),
  };
  const attendanceEvents = {
    findOne: jest.fn(async () => null),
    create: jest.fn(async (value: any) => ({ _id: 'event-1', ...value })),
  };
  const idempotency = { findOne: jest.fn(() => ({ lean: async () => null })), create: jest.fn(async () => undefined) };
  const periods = { findOne: jest.fn(() => ({ lean: async () => ({ _id: PERIOD }) })) };
  const service = new AttendanceService(
    attendanceDays as any, attendanceEvents as any, { create: jest.fn() } as any,
    { findOne: jest.fn(() => assignmentQuery(assignment)) } as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    idempotency as any, periods as any,
    { calculateDistance: jest.fn(() => 0), isInsideGeofence: jest.fn(() => ({ isInside: true, distanceMeters: 0 })) } as any,
    { calculate: jest.fn(() => ({ lateMinutes: 0, earlyMinutes: 0, workingMinutes: 480, approvedLeaveMinutes: 0, requiredWorkingMinutes: 480 })) } as any,
    { isConfigured: jest.fn(() => false) } as any,
    { resolveForEmployeeDate: jest.fn() } as any,
    { bump } as any,
  );
  jest.spyOn(service, 'getTodayWorkDate').mockReturnValue('2026-10-30');
  return { service, bump };
}

const dto = { workMode: WorkMode.IN_OFFICE, latitude: 10, longitude: 106, accuracyMeters: 10 } as any;

describe('AttendanceService period invalidation', () => {
  it.each(['check-in', 'check-out'] as const)('bumps exactly once after successful %s', async (kind) => {
    const { service, bump } = build(kind);
    const action = kind === 'check-in' ? service.checkIn.bind(service) : service.checkOut.bind(service);
    await action(USER, ORG, dto, undefined, '127.0.0.1', 'jest', `key-${kind}`);
    expect(bump).toHaveBeenCalledTimes(1);
    expect(bump).toHaveBeenCalledWith(ORG, PERIOD);
  });

  it.each(['check-in', 'check-out'] as const)('propagates %s invalidation failure', async (kind) => {
    const bump = jest.fn(async () => { throw new Error('version unavailable'); });
    const { service } = build(kind, bump);
    const action = kind === 'check-in' ? service.checkIn.bind(service) : service.checkOut.bind(service);
    await expect(action(USER, ORG, dto, undefined, '127.0.0.1', 'jest', `key-${kind}`)).rejects.toThrow('version unavailable');
    expect(bump).toHaveBeenCalledTimes(1);
  });
});
