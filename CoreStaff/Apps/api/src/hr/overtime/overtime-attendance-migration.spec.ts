export {};
const instant = '2026-10-29T01:00:00.000Z';
const day = { _id: 'day', organizationId: 'org', employeeId: 'user', workDate: '2026-10-29', checkInAt: instant };
const event = { _id: 'event', organizationId: 'org', employeeId: 'user', attendanceDayId: 'day', eventType: 'CHECK_IN', recordedAt: instant, method: 'GPS', approvalStatus: 'NOT_REQUIRED', validationStatus: 'VALID' };
const inspect = (snapshot: unknown) => require('./overtime-attendance-migration').inspectOvertimeAttendanceV2(snapshot);

describe('offline overtime/attendance migration contract', () => {
  it('only infers observed from one matching verified event, without mutating input', () => {
    const input = { attendanceDays: [day], attendanceEvents: [event] };
    const before = JSON.stringify(input);
    const report = inspect(input);
    expect(report.inspected).toBe(true);
    expect(report.endpoints).toEqual([{ dayId: 'day', endpoint: 'CHECK_IN', source: 'OBSERVED', eventId: 'event', reason: 'MATCHED_VERIFIED_EVENT' }]);
    expect(report.counts).toMatchObject({ endpoints: 1, observed: 1, unknown: 0, conflicts: 0, duplicates: 0 });
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each([
    ['organizationId', 'other'], ['attendanceDayId', 'other'], ['employeeId', 'other'],
    ['eventType', 'CHECK_OUT'], ['recordedAt', '2026-10-29T02:00:00.000Z'],
    ['approvalStatus', 'PENDING'], ['approvalStatus', 'REJECTED'],
    ['approvalStatus', undefined], ['validationStatus', 'FLAGGED'], ['method', 'IMPORTED'],
  ])('does not infer observed with mismatched or unverified %s=%s', (key, value) => {
    expect(inspect({ attendanceDays: [day], attendanceEvents: [{ ...event, [key]: value }] }).counts).toMatchObject({ observed: 0, unknown: 1 });
  });

  it('reports duplicate event keys as conflicts even if only one timestamp matches', () => {
    const report = inspect({ attendanceDays: [day], attendanceEvents: [event, { ...event, _id: 'duplicate', recordedAt: '2026-10-29T02:00:00Z' }] });
    expect(report.counts).toMatchObject({ observed: 0, unknown: 1, conflicts: 1, duplicates: 1 });
  });

  it('keeps manual events non-observed and preserves explicit confirmation evidence', () => {
    expect(inspect({ attendanceDays: [day], attendanceEvents: [{ ...event, method: 'MANUAL' }] }).endpoints[0].source).toBe('MANUAL_ADJUSTMENT');
    expect(inspect({ attendanceDays: [day], attendanceEvents: [{ ...event, method: 'MANUAL', provenance: { source: 'CONFIRMED_SCHEDULE', requestId: 'request' } }] }).endpoints[0]).toMatchObject({ source: 'CONFIRMED_SCHEDULE', requestId: 'request' });
  });

  it('reports conflicting existing endpoint provenance rather than overwriting it', () => {
    const report = inspect({ attendanceDays: [{ ...day, checkInProvenance: { source: 'OBSERVED', eventId: 'wrong' } }], attendanceEvents: [event] });
    expect(report.endpoints[0]).toMatchObject({ source: 'LEGACY_UNKNOWN', reason: 'EXISTING_PROVENANCE_CONFLICT' });
    expect(report.counts.conflicts).toBe(1);
  });

  it('counts unmatched legacy endpoints as unknown instead of guessing from timestamp', () => {
    expect(inspect({ attendanceDays: [day] }).counts).toMatchObject({ unknown: 1, observed: 0 });
    expect(inspect({ attendanceDays: [{ ...day, checkInAt: 'not-a-date' }], attendanceEvents: [event] }).counts.unknown).toBe(1);
  });

  it('detects duplicate days and never emits their inferred provenance as safe evidence', () => {
    const report = inspect({ attendanceDays: [day, { ...day, _id: 'day2' }], attendanceEvents: [event] });
    expect(report.counts).toMatchObject({ duplicates: 1, conflicts: 2, unknown: 2, observed: 0 });
  });

  it('does not leak location or evidence URL from an export into the report', () => {
    const report = inspect({ attendanceDays: [day], attendanceEvents: [{ ...event, latitude: 10, evidenceUrl: 'secret-url' }] });
    expect(JSON.stringify(report)).not.toContain('secret-url');
    expect(JSON.stringify(report)).not.toContain('latitude');
  });

  it('protects all supplied closed artifacts and reports legacy/V2 without rewriting contracts', () => {
    const input = { attendanceDays: [day], attendanceEvents: [event], periods: [{ _id: 'period', organizationId: 'org', status: 'CLOSED' }], summaries: [{ frozen: true }], payrollSnapshots: [{ frozen: true }], overtimeResults: [{ classificationStatus: 'FINAL' }, { calculationContract: 'V2' }], managerRequests: [{ type: 'ATTENDANCE', status: 'PENDING' }] };
    const before = JSON.stringify(input);
    const report = inspect(input);
    expect(report.protection).toMatchObject({ closedPeriods: 1, summaries: 1, payrollSnapshots: 1, finalOvertimeResults: 1, allArtifactsUnchanged: true });
    expect(report.contracts).toEqual({ legacyV1: 1, explicitContracts: { V2: 1 }, legacyAttendanceRequests: 1 });
    expect(report.rollback).toContain('KEEP_V2_READERS');
    expect(JSON.stringify(input)).toBe(before);
  });

  it('rejects malformed exports instead of reporting an empty successful inspection', () => {
    expect(() => inspect(null)).toThrow('INVALID_SNAPSHOT');
    expect(() => inspect({ attendanceDays: {} })).toThrow('INVALID_SNAPSHOT');
  });

  it('offers only offline inspect/dry-run modes and inventories client/seed entrypoints without running them', () => {
    const { runMigrationInspection } = require('../../../scripts/migrate-overtime-attendance-v2');
    const report = runMigrationInspection([]);
    expect(report.mode).toBe('inspect');
    expect(report.inventory.clients).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'CoreStaff/Apps/web/src/services/manager.service.ts' }), expect.objectContaining({ status: 'NOT_VERIFIED' })]));
    expect(report.inventory.seedEntrypoints).toEqual(expect.arrayContaining(['CoreStaff/Apps/api/src/database/seed/seed.ts', 'CoreStaff/Apps/api/scripts/seed-demo-org.ts']));
    expect(report.inventory.packageSeedCommands['seed:demo']).toContain('--apply');
    expect(runMigrationInspection(['--dry-run'], { attendanceDays: [] }).mode).toBe('dry-run');
  });

  it.each(['--apply', '--backfill', '--activate', '--enable-v2', '--ensure-indexes', '--drop', '--rollback', '--apply=false', '--unknown'])('refuses unsupported argument %s before any execution', (arg) => {
    const { runMigrationInspection } = require('../../../scripts/migrate-overtime-attendance-v2');
    expect(() => runMigrationInspection([arg])).toThrow(/UNSUPPORTED_MODE.*read-only/i);
  });

  it('importing script cannot load environment, database or application bootstrapping', () => {
    jest.isolateModules(() => {
      jest.doMock('dotenv', () => { throw new Error('environment must not load'); });
      jest.doMock('mongoose', () => { throw new Error('database must not load'); });
      jest.doMock('@nestjs/core', () => { throw new Error('application must not load'); });
      expect(() => require('../../../scripts/migrate-overtime-attendance-v2')).not.toThrow();
    });
    jest.dontMock('dotenv'); jest.dontMock('mongoose'); jest.dontMock('@nestjs/core');
  });

  it('handles checkout endpoints and Mongo extended JSON IDs/dates without losing evidence identity', () => {
    const report = inspect({ attendanceDays: [{ ...day, _id: { $oid: 'day' }, checkInAt: undefined, checkOutAt: { $date: instant } }], attendanceEvents: [{ ...event, eventType: 'CHECK_OUT', _id: { $oid: 'event' } }] });
    expect(report.endpoints[0]).toMatchObject({ dayId: 'day', endpoint: 'CHECK_OUT', source: 'OBSERVED', eventId: 'event' });
  });

  it('rejects contradictory event provenance references', () => {
    const report = inspect({ attendanceDays: [day], attendanceEvents: [{ ...event, provenance: { source: 'OBSERVED', eventId: 'other-event' } }] });
    expect(report.counts).toMatchObject({ observed: 0, unknown: 1, conflicts: 1 });
  });

  it('defaults to an explicitly incomplete read-only inspection', () => {
    const { inspectOvertimeAttendanceV2 } = require('./overtime-attendance-migration');
    const report = inspectOvertimeAttendanceV2({});
    expect(report).toMatchObject({ mode: 'inspect', readOnly: true, databaseConnected: false, writesPerformed: 0, inspected: false, rolloutReady: false });
    expect(report.remainingTasks).toEqual(expect.arrayContaining(['HR_PRODUCT_APPROVAL', 'REPLICA_SET_RACE_TESTS', 'APPROVED_MIGRATION_IMPLEMENTATION']));
  });
});
