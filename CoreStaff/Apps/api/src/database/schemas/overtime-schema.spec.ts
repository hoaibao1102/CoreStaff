import { OvertimeResultSchema } from './overtime-result.schema';
import { ManagerRequestSchema } from './manager-request.schema';
import { hasCompoundIndex, listIndexes } from '../indexes';

/**
 * TASK-068/069 — the overtime result document is the input to the timesheet and
 * to §30B.2's month/year caps, so its uniqueness and period buckets are
 * contracts, not implementation details. Asserted the same way as the Sprint 4
 * scheduling schemas (`hasCompoundIndex`).
 */
describe('overtime schema invariants (SRS §15.11, §30B.2)', () => {
  it('allows exactly one current result per approved request', () => {
    expect(hasCompoundIndex(OvertimeResultSchema, ['organizationId', 'overtimeRequestId'], true)).toBe(true);
  });

  it('indexes the per-employee day lookup used to guard against double-counting', () => {
    expect(hasCompoundIndex(OvertimeResultSchema, ['organizationId', 'employeeId', 'workDate'])).toBe(true);
  });

  it('indexes (period, type) so monthly caps and Sprint 6 totals are index-only', () => {
    expect(hasCompoundIndex(OvertimeResultSchema, ['organizationId', 'periodKey', 'overtimeType'])).toBe(true);
  });

  it('indexes (department, date) for the HR scoped review list', () => {
    expect(hasCompoundIndex(OvertimeResultSchema, ['organizationId', 'departmentId', 'workDate'])).toBe(true);
  });

  it('never declares a unique index over workDate alone — one day may hold several requests', () => {
    const uniqueOnDate = listIndexes(OvertimeResultSchema).filter((index) => index.unique)
      .map((index) => Object.keys(index.key).join(','));
    expect(uniqueOnDate).toEqual(['organizationId,overtimeRequestId']);
  });

  it('declares every §15.11 minute/snapshot field plus the two §30B.2 policy fields', () => {
    const paths = Object.keys(OvertimeResultSchema.paths);
    expect(paths).toEqual(expect.arrayContaining([
      'overtimeType', 'classificationStatus', 'requestedMinutes', 'approvedMinutes',
      'actualMinutes', 'eligibleMinutes', 'eligibleIntervals', 'calendarSnapshot',
      'scheduleSnapshot', 'policyVersion', 'legalReference', 'inputHash', 'calculatedAt',
    ]));
  });

  it('gives manager_requests the OT fields without touching its existing indexes', () => {
    const paths = Object.keys(ManagerRequestSchema.paths);
    expect(paths).toEqual(expect.arrayContaining(['workDescription', 'isRetroactive', 'retroactiveReason']));
    // TASK-066/067 queue indexes must survive: the web approval list sorts on them.
    expect(hasCompoundIndex(ManagerRequestSchema, ['organizationId', 'departmentId', 'status', 'createdAt'])).toBe(true);
    expect(hasCompoundIndex(ManagerRequestSchema, ['organizationId', 'employeeUserId', 'createdAt'])).toBe(true);
  });
});
