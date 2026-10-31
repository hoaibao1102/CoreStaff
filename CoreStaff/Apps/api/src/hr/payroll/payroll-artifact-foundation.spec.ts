import { Types } from 'mongoose';
import { listIndexes } from '../../database/indexes';
import { PayrollInputSnapshotSchema } from '../../database/schemas/payroll-input-snapshot.schema';
import {
  PayrollRunSchema,
  PayrollRunStatus,
} from '../../database/schemas/payroll-run.schema';
import { PayslipSchema } from '../../database/schemas/payslip.schema';
import { TimesheetSummarySchema } from '../../database/schemas/timesheet-summary.schema';
import { TimesheetPeriodSchema } from '../../database/schemas/timesheet-period.schema';
import {
  buildPeriodPayrollClaimCas,
  buildPayrollRunTransitionCas,
  canonicalPayloadHash,
  PayrollLifecycleConflict,
} from './payroll-artifact-foundation';

describe('append-only payroll artifact schemas', () => {
  it('versions summaries by tenant, period, source period version and employee', () => {
    expect(Object.keys(TimesheetSummarySchema.paths)).toEqual(
      expect.arrayContaining([
        'schemaVersion',
        'sourcePeriodVersion',
        'canonicalPayloadHash',
        'supersededBySummaryId',
        'supersededAt',
        'supersessionReason',
        'calculationContract',
      ]),
    );
    const unique = listIndexes(TimesheetSummarySchema).filter((index) => index.unique);
    expect(unique.map((index) => Object.keys(index.key).join(','))).toEqual([
      'organizationId,periodId,sourcePeriodVersion,employeeProfileId',
    ]);
  });

  it('versions snapshots and binds each one to its exact source summary', () => {
    expect(Object.keys(PayrollInputSnapshotSchema.paths)).toEqual(
      expect.arrayContaining([
        'schemaVersion',
        'sourcePeriodVersion',
        'sourceSummaryId',
        'sourceSummaryVersion',
        'sourceSummaryHash',
        'canonicalPayloadHash',
        'supersededBySnapshotId',
        'supersededAt',
        'supersessionReason',
        'calculationContract',
      ]),
    );
    const unique = listIndexes(PayrollInputSnapshotSchema).filter((index) => index.unique);
    expect(unique.map((index) => Object.keys(index.key).join(','))).toEqual([
      'organizationId,periodId,sourcePeriodVersion,employeeProfileId',
    ]);
  });

  it('retains run history while allowing only one active run for a period', () => {
    expect(Object.keys(PayrollRunSchema.paths)).toEqual(
      expect.arrayContaining([
        'schemaVersion',
        'sourcePeriodVersion',
        'sourceSnapshotIds',
        'sourceSnapshotSetHash',
        'runSequence',
        'cancelledBy',
        'cancelledAt',
        'cancellationReason',
        'discardedBy',
        'discardedAt',
        'discardReason',
      ]),
    );
    expect(PayrollRunSchema.path('status').options.enum).toEqual(
      expect.arrayContaining([PayrollRunStatus.CANCELLED, PayrollRunStatus.DISCARDED]),
    );
    const indexes = PayrollRunSchema.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        [
          { organizationId: 1, timesheetPeriodId: 1, runSequence: 1 },
          expect.objectContaining({ unique: true }),
        ],
        [
          { organizationId: 1, timesheetPeriodId: 1 },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: {
              status: {
                $in: [
                  PayrollRunStatus.DRAFT,
                  PayrollRunStatus.CALCULATED,
                  PayrollRunStatus.LOCKED,
                  PayrollRunStatus.RELEASED,
                ],
              },
            },
          }),
        ],
      ]),
    );
  });

  it('binds payslips to the exact immutable snapshot and snapshot set', () => {
    expect(Object.keys(PayslipSchema.paths)).toEqual(
      expect.arrayContaining([
        'schemaVersion',
        'sourcePeriodVersion',
        'sourceSnapshotId',
        'sourceSnapshotHash',
        'sourceSnapshotSetHash',
      ]),
    );
  });
});

describe('canonical payload hashing', () => {
  it('is stable across object key order and ObjectId representations', () => {
    const id = new Types.ObjectId('64b000000000000000000001');
    const left = { z: [2, 1], id, nested: { b: true, a: new Date('2026-10-01T00:00:00.000Z') } };
    const right = {
      nested: { a: new Date('2026-10-01T00:00:00.000Z'), b: true },
      id: '64b000000000000000000001',
      z: [2, 1],
    };
    expect(canonicalPayloadHash(left)).toBe(canonicalPayloadHash(right));
    expect(canonicalPayloadHash(left)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('distinguishes array order and rejects non-finite numbers', () => {
    expect(canonicalPayloadHash({ values: [1, 2] })).not.toBe(
      canonicalPayloadHash({ values: [2, 1] }),
    );
    expect(() => canonicalPayloadHash({ value: Number.NaN })).toThrow('NON_FINITE_NUMBER');
  });
});

describe('payroll run lifecycle CAS foundation', () => {
  it('adds a shared payroll claim to periods and builds a version-checked claim', () => {
    expect(Object.keys(TimesheetPeriodSchema.paths)).toEqual(
      expect.arrayContaining(['payrollRunId', 'payrollState', 'payrollSourceVersion']),
    );
    expect(buildPeriodPayrollClaimCas({
      periodId: 'period-1', organizationId: 'org-1', expectedPeriodVersion: 7,
      runId: 'run-1',
    })).toEqual({
      filter: {
        _id: 'period-1', organizationId: 'org-1', status: 'CLOSED', version: 7,
        payrollRunId: { $exists: false },
      },
      update: {
        $set: {
          payrollRunId: 'run-1', payrollState: PayrollRunStatus.DRAFT,
          payrollSourceVersion: 7,
        },
      },
    });
  });

  it('builds a version-checked DRAFT to CALCULATED transition', () => {
    expect(
      buildPayrollRunTransitionCas({
        runId: 'run-1',
        organizationId: 'org-1',
        expectedStatus: PayrollRunStatus.DRAFT,
        expectedVersion: 3,
        nextStatus: PayrollRunStatus.CALCULATED,
        at: new Date('2026-10-30T00:00:00.000Z'),
      }),
    ).toEqual({
      filter: {
        _id: 'run-1',
        organizationId: 'org-1',
        status: PayrollRunStatus.DRAFT,
        version: 3,
      },
      update: {
        $set: { status: PayrollRunStatus.CALCULATED },
        $inc: { version: 1 },
      },
    });
  });

  it('requires audited reasons for cancel and discard transitions', () => {
    expect(() =>
      buildPayrollRunTransitionCas({
        runId: 'run-1', organizationId: 'org-1', expectedStatus: PayrollRunStatus.DRAFT,
        expectedVersion: 1, nextStatus: PayrollRunStatus.CANCELLED,
        actorId: 'user-1', reason: 'short', at: new Date(),
      }),
    ).toThrow(PayrollLifecycleConflict);

    const at = new Date('2026-10-30T01:00:00.000Z');
    expect(
      buildPayrollRunTransitionCas({
        runId: 'run-2', organizationId: 'org-1', expectedStatus: PayrollRunStatus.CALCULATED,
        expectedVersion: 4, nextStatus: PayrollRunStatus.DISCARDED,
        actorId: 'user-1', reason: 'Inputs require a corrected re-close', at,
      }).update.$set,
    ).toEqual({
      status: PayrollRunStatus.DISCARDED,
      discardedBy: 'user-1',
      discardedAt: at,
      discardReason: 'Inputs require a corrected re-close',
      active: false,
    });
  });

  it('rejects skipped and terminal transitions before any database operation', () => {
    expect(() =>
      buildPayrollRunTransitionCas({
        runId: 'run-1', organizationId: 'org-1', expectedStatus: PayrollRunStatus.DRAFT,
        expectedVersion: 1, nextStatus: PayrollRunStatus.LOCKED, at: new Date(),
      }),
    ).toThrow('INVALID_PAYROLL_RUN_TRANSITION');
    expect(() =>
      buildPayrollRunTransitionCas({
        runId: 'run-1', organizationId: 'org-1', expectedStatus: PayrollRunStatus.RELEASED,
        expectedVersion: 5, nextStatus: PayrollRunStatus.DISCARDED,
        actorId: 'user-1', reason: 'Released rows are immutable', at: new Date(),
      }),
    ).toThrow('INVALID_PAYROLL_RUN_TRANSITION');
  });
});
