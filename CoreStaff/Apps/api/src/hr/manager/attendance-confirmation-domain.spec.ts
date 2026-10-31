import { proposeAttendanceConfirmation } from './attendance-confirmation-domain';

describe('attendance confirmation proposal', () => {
  const context = { workDate: '2026-09-14', requiredWorkingIntervals: [{ from: '08:00', to: '12:00' }, { from: '13:00', to: '17:00' }], gracePeriodMinutes: 5 };
  it.each([
    [{ checkInAt: '2026-09-14T08:00:00.000Z', checkOutAt: '2026-09-14T10:00:00.000Z' }, 'ALREADY_COMPLETE'],
    [{ checkInAt: '2026-09-14T10:30:00.000Z' }, 'NEEDS_MANUAL_REVIEW'],
    [{ requiredWorkingIntervals: [] }, 'NO_WORK_OBLIGATION'],
    [{ blockedReasons: ['CONTEXT_REQUIRES_REVIEW'] }, 'CONTEXT_REQUIRES_REVIEW'],
    [{ requiredWorkingIntervals: [{ from: '22:00', to: '06:00' }] }, 'UNSUPPORTED_OVERNIGHT_SHIFT'],
  ])('blocks unsafe context %j', (override, reason) => {
    expect(proposeAttendanceConfirmation({ ...context, ...override })).toMatchObject({ actionType: null, blockedReasons: [reason] });
  });
  it('fills missing checkin without changing checkout', () => {
    expect(proposeAttendanceConfirmation({ ...context, checkOutAt: '2026-09-14T09:45:00.000Z' })).toMatchObject({ actionType: 'CHECK_IN', checkInAt: '2026-09-14T01:00:00.000Z', checkOutAt: '2026-09-14T09:45:00.000Z', calculation: { workingMinutes: 465, earlyMinutes: 15 } });
  });
  it('full day excludes leave and break intervals', () => {
    expect(proposeAttendanceConfirmation({ ...context, requiredWorkingIntervals: [{ from: '13:00', to: '17:00' }] })).toMatchObject({ actionType: 'FULL_DAY', calculation: { workingMinutes: 240 } });
  });
  it('fills only missing checkout and preserves observed checkin', () => {
    expect(proposeAttendanceConfirmation({ ...context, checkInAt: '2026-09-14T01:15:00.000Z' })).toMatchObject({
      actionType: 'CHECK_OUT', blockedReasons: [], checkInAt: '2026-09-14T01:15:00.000Z', checkOutAt: '2026-09-14T10:00:00.000Z',
      calculation: { workingMinutes: 465, lateMinutes: 10, earlyMinutes: 0 },
    });
  });
});
