import { NotFoundException } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { validateSync } from 'class-validator';
import { CreateLaborPolicyDto } from './dto/policies.dto';
import { LaborCompliancePolicySchema } from '../../database/schemas/compensation.schema';

/* ==========================================================================
   PoliciesService — unit tests (no real MongoDB). Fake Mongoose models mirror
   assignment.service.spec.ts conventions.
   ========================================================================== */

interface LaborRow {
  _id: string;
  organizationId: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  normalDailyMinutes: number;
  normalWeeklyMinutes: number;
  maxCombinedDailyMinutes: number;
  maxMonthlyOvertimeMinutes: number;
  maxAnnualOvertimeMinutes: number;
  exceptionalAnnualOvertimeMinutes: number;
  warningThresholdPercent: number;
  probationMinimumRate: number;
  legalReference: string;
  version: number;
  active: boolean;
}

interface OvertimeRow {
  _id: string;
  organizationId: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  workingDayRate: number;
  weeklyOffRate: number;
  publicHolidayRate: number;
  legalReference: string;
  version: number;
  active: boolean;
}

interface WorkCreditRow {
  _id: string;
  organizationId: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  halfDayMinimumRatio: number;
  fullDayMinimumRatio: number;
  paidLeaveCreditEnabled: boolean;
  incompleteDayRule: 'BLOCK';
  businessReference?: string;
  version: number;
  active: boolean;
}

const D = (s: string) => new Date(s);

/** Convenience opts for seeded rows; `effectiveTo` accepts either form. */
interface SeedOpts {
  effectiveTo?: string;
  version?: number;
  active?: boolean;
}

function seedLabor(
  id: string,
  org: string,
  effectiveFrom: string,
  opts: SeedOpts = {},
): LaborRow {
  return {
    _id: id,
    organizationId: org,
    effectiveFrom: D(effectiveFrom),
    effectiveTo: opts.effectiveTo ? D(opts.effectiveTo) : undefined,
    normalDailyMinutes: 480,
    normalWeeklyMinutes: 2880,
    maxCombinedDailyMinutes: 720,
    maxMonthlyOvertimeMinutes: 2400,
    maxAnnualOvertimeMinutes: 20000,
    exceptionalAnnualOvertimeMinutes: 24000,
    warningThresholdPercent: 80,
    probationMinimumRate: 0.85,
    legalReference: 'BLLĐ 45/2019/QH14',
    version: opts.version ?? 1,
    active: opts.active ?? true,
  };
}

function seedOvertime(
  id: string,
  org: string,
  effectiveFrom: string,
  opts: SeedOpts = {},
): OvertimeRow {
  return {
    _id: id,
    organizationId: org,
    effectiveFrom: D(effectiveFrom),
    effectiveTo: opts.effectiveTo ? D(opts.effectiveTo) : undefined,
    workingDayRate: 1.5,
    weeklyOffRate: 2,
    publicHolidayRate: 3,
    legalReference: 'BLLĐ 45/2019/QH14',
    version: opts.version ?? 1,
    active: opts.active ?? true,
  };
}

/** Mirrors Mongoose/Mongo equality: `{ field: null }` matches null AND missing. */
function coerceEquals(row: Record<string, unknown>, key: string, expected: unknown): boolean {
  if (expected === null) return (row[key] as unknown) == null;
  return (row[key] as unknown) === expected;
}

/** Minimal filter evaluator supporting the shapes PoliciesService actually uses:
 *  plain equality, $ne/$lte/$gt operators, and $or (used for effective windows). */
function matchesFilter(row: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or' && Array.isArray(value)) {
      return (value as Record<string, unknown>[]).some((sub) => matchesFilter(row, sub));
    }
    if (typeof value === 'object' && value !== null) {
      const op = value as Record<string, unknown>;
      if ('$lte' in op) return (row[key] as Date).getTime() <= (op.$lte as Date).getTime();
      if ('$gt' in op) return (row[key] as Date).getTime() > (op.$gt as Date).getTime();
      if ('$ne' in op) return !coerceEquals(row, key, op.$ne);
    }
    return coerceEquals(row, key, value);
  });
}

/** Latest-matching row by effectiveFrom (service sorts { effectiveFrom: -1 }). */
function latestMatch<T>(rows: T[], filter: Record<string, unknown>): T | null {
  const match = rows.filter((r) => matchesFilter(r as unknown as Record<string, unknown>, filter));
  const sorted = [...match].sort(
    (a, b) => (a as { effectiveFrom: Date }).effectiveFrom.getTime() - (b as { effectiveFrom: Date }).effectiveFrom.getTime(),
  );
  return sorted[sorted.length - 1] ?? null;
}

function addPatch(row: { version: number }, patch: Record<string, unknown>): void {
  for (const k of Object.keys(patch)) {
    const value = patch[k];
    if (value === undefined) continue;
    (row as unknown as Record<string, unknown>)[k] = value;
  }
}

/** Fake Mongoose model over an in-memory LaborCompliancePolicy array. */
function buildLaborModel(rows: LaborRow[]) {
  let next = rows.length + 1;
  const session = { withTransaction: async (work: () => Promise<void>) => work(), endSession: async () => undefined };
  return {
    db: { startSession: async () => session },
    async create(input: Record<string, unknown> | Record<string, unknown>[]) {
      const isArray = Array.isArray(input);
      const doc = (isArray ? input[0] : input) as Record<string, unknown>;
      const row = seedLabor(`l${next++}`, String(doc.organizationId), '2026-01-01', {
        effectiveTo: doc.effectiveTo ? (doc.effectiveTo as Date).toISOString().slice(0, 10) : undefined,
        version: doc.version as number,
        active: doc.active as boolean,
      });
      Object.assign(row, doc);
      rows.push(row);
      const result = { ...row, toObject: () => row };
      return isArray ? [result] : result;
    },
    /** Fluent find(): the service calls it with or without an intermediate .sort(). */
    find(filter: Record<string, unknown>) {
      const chain = {
        sort: () => chain,
        session: () => chain,
        lean: async () => rows.filter((r) => matchesFilter(r as unknown as Record<string, unknown>, filter)),
      };
      return chain;
    },
    /** Fluent findOne(): supports both .findOne(q).lean() and .findOne(q).sort().lean(). */
    findOne(filter: Record<string, unknown>) {
      const chain = {
        sort: () => chain,
        session: () => chain,
        lean: async () => latestMatch(rows, filter),
      };
      return chain;
    },
    findOneAndUpdate(filter: Record<string, unknown>, update: Record<string, unknown>) {
      return {
        lean: async () => {
          const row = latestMatch(rows, filter);
          if (!row) return null;
          const set = update.$set as Record<string, unknown> | undefined;
          const inc = update.$inc as { version?: number } | undefined;
          if (set) addPatch(row, set);
          if (inc && typeof inc.version === 'number') row.version = row.version + inc.version;
          if (update.$unset) {
            const unset = update.$unset as Record<string, unknown>;
            for (const k of Object.keys(unset)) delete (row as unknown as Record<string, unknown>)[k];
          }
          return row;
        },
      };
    },
  };
}

/** Fake Mongoose model over an in-memory OvertimePayPolicy array. */
function buildOvertimeModel(rows: OvertimeRow[]) {
  let next = rows.length + 1;
  const session = { withTransaction: async (work: () => Promise<void>) => work(), endSession: async () => undefined };
  return {
    db: { startSession: async () => session },
    async create(input: Record<string, unknown> | Record<string, unknown>[]) {
      const isArray = Array.isArray(input);
      const doc = (isArray ? input[0] : input) as Record<string, unknown>;
      const row = seedOvertime(`o${next++}`, String(doc.organizationId), '2026-01-01', {
        effectiveTo: doc.effectiveTo ? (doc.effectiveTo as Date).toISOString().slice(0, 10) : undefined,
        version: doc.version as number,
        active: doc.active as boolean,
      });
      Object.assign(row, doc);
      rows.push(row);
      const result = { ...row, toObject: () => row };
      return isArray ? [result] : result;
    },
    /** Fluent find(): the service calls it with or without an intermediate .sort(). */
    find(filter: Record<string, unknown>) {
      const chain = {
        sort: () => chain,
        session: () => chain,
        lean: async () => rows.filter((r) => matchesFilter(r as unknown as Record<string, unknown>, filter)),
      };
      return chain;
    },
    /** Fluent findOne(): supports both .findOne(q).lean() and .findOne(q).sort().lean(). */
    findOne(filter: Record<string, unknown>) {
      const chain = {
        sort: () => chain,
        session: () => chain,
        lean: async () => latestMatch(rows, filter),
      };
      return chain;
    },
    findOneAndUpdate(filter: Record<string, unknown>, update: Record<string, unknown>) {
      return {
        lean: async () => {
          const row = latestMatch(rows, filter);
          if (!row) return null;
          const set = update.$set as Record<string, unknown> | undefined;
          const inc = update.$inc as { version?: number } | undefined;
          if (set) addPatch(row, set);
          if (inc && typeof inc.version === 'number') row.version = row.version + inc.version;
          if (update.$unset) {
            const unset = update.$unset as Record<string, unknown>;
            for (const k of Object.keys(unset)) delete (row as unknown as Record<string, unknown>)[k];
          }
          return row;
        },
      };
    },
  };
}

function seedWorkCredit(
  id: string,
  org: string,
  effectiveFrom: string,
  opts: SeedOpts = {},
): WorkCreditRow {
  return {
    _id: id,
    organizationId: org,
    effectiveFrom: D(effectiveFrom),
    effectiveTo: opts.effectiveTo ? D(opts.effectiveTo) : undefined,
    halfDayMinimumRatio: 0.5,
    fullDayMinimumRatio: 0.9,
    paidLeaveCreditEnabled: true,
    incompleteDayRule: 'BLOCK',
    version: opts.version ?? 1,
    active: opts.active ?? true,
  };
}

function buildWorkCreditModel(rows: WorkCreditRow[]) {
  let next = rows.length + 1;
  const session = {
    withTransaction: async (work: () => Promise<void>) => work(),
    endSession: async () => undefined,
  };
  return {
    db: { startSession: async () => session },
    async create(input: Record<string, unknown> | Record<string, unknown>[]) {
      const isArray = Array.isArray(input);
      const doc = (isArray ? input[0] : input) as Record<string, unknown>;
      const row = seedWorkCredit(`w${next++}`, String(doc.organizationId), (doc.effectiveFrom as Date).toISOString(), {
        effectiveTo: doc.effectiveTo ? (doc.effectiveTo as Date).toISOString() : undefined,
        version: doc.version as number,
        active: doc.active as boolean,
      });
      Object.assign(row, doc);
      rows.push(row);
      const result = { ...row, toObject: () => row };
      return isArray ? [result] : result;
    },
    find(filter: Record<string, unknown>) {
      const chain = {
        sort: () => chain,
        session: () => chain,
        lean: async () => rows.filter((r) => matchesFilter(r as unknown as Record<string, unknown>, filter)),
      };
      return chain;
    },
    findOne(filter: Record<string, unknown>) {
      const chain = { sort: () => chain, session: () => chain, lean: async () => latestMatch(rows, filter) };
      return chain;
    },
    findOneAndUpdate(filter: Record<string, unknown>, update: Record<string, unknown>) {
      return {
        lean: async () => {
          const row = latestMatch(rows, filter);
          if (!row) return null;
          const set = update.$set as Record<string, unknown> | undefined;
          const inc = update.$inc as { version?: number } | undefined;
          if (set) addPatch(row, set);
          if (inc?.version) row.version += inc.version;
          if (update.$unset) for (const key of Object.keys(update.$unset as object)) delete (row as unknown as Record<string, unknown>)[key];
          return row;
        },
      };
    },
  };
}

function buildService(
  labors: LaborRow[],
  overtimes: OvertimeRow[],
  workCredits: WorkCreditRow[] = [],
  periodVersion = { bumpForEffectiveWindow: jest.fn().mockResolvedValue(0) },
) {
  return new PoliciesService(
    buildLaborModel(labors) as never,
    buildOvertimeModel(overtimes) as never,
    buildWorkCreditModel(workCredits) as never,
    periodVersion as never,
  );
}

describe('PoliciesService — LaborCompliancePolicy (TASK-036)', () => {
  it('resolves explicit V2 OT by Vietnam workDate and quota by month start', async () => {
    const early = Object.assign(seedLabor('early', 'org1', '2026-09-30T17:00:00Z', { effectiveTo: '2026-10-14T17:00:00Z' }), {
      minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30, maxMonthlyAttendanceConfirmations: 3,
    });
    const late = Object.assign(seedLabor('late', 'org1', '2026-10-14T17:00:00Z'), {
      minimumOvertimeMinutes: 0, overtimeRoundingMinutes: 0, maxMonthlyAttendanceConfirmations: 0,
    });
    const svc = buildService([early, late], []) as any;
    expect((await svc.overtimeRulesForWorkDate('org1', '2026-10-20'))._id).toBe('late');
    expect((await svc.attendanceConfirmationRulesForWorkDate('org1', '2026-10-20'))._id).toBe('early');
    await expect(svc.overtimeRulesForWorkDate('org1', '2026-02-30')).rejects.toThrow('WORK_DATE_INVALID');
    await expect(svc.overtimeRulesForWorkDate('org2', '2026-10-20')).rejects.toThrow('POLICY_CONFIGURATION_REQUIRED');
    const legacy = buildService([seedLabor('old', 'org1', '2026-01-01')], []) as any;
    await expect(legacy.overtimeRulesForWorkDate('org1', '2026-10-20')).rejects.toThrow('POLICY_CONFIGURATION_REQUIRED');
    await expect(legacy.attendanceConfirmationRulesForWorkDate('org1', '2026-10-20')).rejects.toThrow('POLICY_CONFIGURATION_REQUIRED');
  });
  it.each([
    { minimumOvertimeMinutes: -1 }, { minimumOvertimeMinutes: 1441 },
    { minimumOvertimeMinutes: 1.5 }, { overtimeRoundingMinutes: 20 },
    { maxMonthlyAttendanceConfirmations: 32 }, { maxMonthlyAttendanceConfirmations: 1.5 },
    { minimumOvertimeMinutes: null },
    { minimumOvertimeMinutes: 15, overtimeRoundingMinutes: 30 },
    { minimumOvertimeMinutes: 61, overtimeRoundingMinutes: 30 },
  ])('rejects invalid explicit V2 rules %j without writing', async (rules) => {
    const rows: LaborRow[] = [];
    await expect(buildService(rows, []).createLabor('org1', {
      ...seedLabor('unused', 'org1', '2026-01-01'), effectiveFrom: '2026-01-01', ...rules,
    } as never)).rejects.toThrow('LABOR_POLICY_V2_RULES_INVALID');
    expect(rows).toHaveLength(0);
  });

  it('validates optional V2 integers in the DTO and declares no schema defaults', () => {
    for (const field of ['minimumOvertimeMinutes', 'overtimeRoundingMinutes', 'maxMonthlyAttendanceConfirmations']) {
      const dto = Object.assign(new CreateLaborPolicyDto(), { [field]: 1.5 });
      expect(validateSync(dto).some((error) => error.property === field)).toBe(true);
      expect(LaborCompliancePolicySchema.path(field)).toBeDefined();
      expect(LaborCompliancePolicySchema.path(field).options.default).toBeUndefined();
    }
  });

  it('preserves missing legacy fields and validates merged partial updates', async () => {
    const rows = [seedLabor('l1', 'org1', '2026-01-01')];
    const svc = buildService(rows, []);
    expect(await svc.laborAt('org1', D('2026-02-01'))).not.toHaveProperty('minimumOvertimeMinutes');
    await svc.updateLabor('org1', 'l1', { minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30, maxMonthlyAttendanceConfirmations: 0 } as never);
    await expect(svc.updateLabor('org1', 'l1', { overtimeRoundingMinutes:  60, minimumOvertimeMinutes: 30 } as never)).rejects.toThrow('LABOR_POLICY_V2_RULES_INVALID');
    expect(await svc.laborAt('org1', D('2026-02-01'))).toHaveProperty('maxMonthlyAttendanceConfirmations', 0);
  });
  it('creates a policy scoped to the tenant with auto version', async () => {
    const svc = buildService([], []);
    const result = await svc.createLabor('org1', {
      effectiveFrom: '2026-01-01',
      normalDailyMinutes: 480,
      normalWeeklyMinutes: 2880,
      maxCombinedDailyMinutes: 720,
      maxMonthlyOvertimeMinutes: 2400,
      maxAnnualOvertimeMinutes: 20000,
      exceptionalAnnualOvertimeMinutes: 24000,
      warningThresholdPercent: 80,
      probationMinimumRate: 0.85,
      legalReference: 'BLLĐ 45/2019/QH14',
    } as never);
    expect(result.organizationId).toBe('org1');
    expect(result.version).toBe(1);
  });

  it('atomically invalidates intersecting open periods on create and propagates invalidation failure', async () => {
    const periodVersion = { bumpForEffectiveWindow: jest.fn().mockRejectedValue(new Error('period invalidation unavailable')) };
    const svc = buildService([], [], [], periodVersion);
    await expect(svc.createLabor('org1', {
      effectiveFrom: '2026-01-01', effectiveTo: '2026-07-01', normalDailyMinutes: 480,
      normalWeeklyMinutes: 2880, maxCombinedDailyMinutes: 720, maxMonthlyOvertimeMinutes: 2400,
      maxAnnualOvertimeMinutes: 20000, exceptionalAnnualOvertimeMinutes: 24000,
      warningThresholdPercent: 80, probationMinimumRate: 0.85, legalReference: 'BLLĐ 45/2019/QH14',
    } as never)).rejects.toThrow('period invalidation unavailable');
    expect(periodVersion.bumpForEffectiveWindow).toHaveBeenCalledWith(
      'org1', D('2026-01-01'), D('2026-07-01'), expect.anything(),
    );
  });

  it('rejects an overlapping effective window on create', async () => {
    const svc = buildService([seedLabor('l1', 'org1', '2026-01-01', { effectiveTo: '2026-06-30' })], []);
    await expect(
      svc.createLabor('org1', {
        effectiveFrom: '2026-03-01',
        normalDailyMinutes: 480, normalWeeklyMinutes: 2880, maxCombinedDailyMinutes: 720,
        maxMonthlyOvertimeMinutes: 2400, maxAnnualOvertimeMinutes: 20000,
        exceptionalAnnualOvertimeMinutes: 24000, warningThresholdPercent: 80,
        probationMinimumRate: 0.85, legalReference: 'BLLĐ 45/2019/QH14',
      } as never),
    ).rejects.toThrow('EFFECTIVE_DATE_OVERLAP');
  });

  it('allows back-to-back windows', async () => {
    const svc = buildService([seedLabor('l1', 'org1', '2026-01-01', { effectiveTo: '2026-07-01' })], []);
    await expect(
      svc.createLabor('org1', {
        effectiveFrom: '2026-07-01',
        normalDailyMinutes: 480, normalWeeklyMinutes: 2880, maxCombinedDailyMinutes: 720,
        maxMonthlyOvertimeMinutes: 2400, maxAnnualOvertimeMinutes: 20000,
        exceptionalAnnualOvertimeMinutes: 24000, warningThresholdPercent: 80,
        probationMinimumRate: 0.85, legalReference: 'BLLĐ 45/2019/QH14',
      } as never),
    ).resolves.toBeDefined();
  });

  it('lists only the tenant policies', async () => {
    const svc = buildService(
      [seedLabor('l1', 'org1', '2026-01-01'), seedLabor('l2', 'org2', '2026-01-01')],
      [],
    );
    const rows = await svc.listLabor('org1');
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe('l1');
  });

  it('returns the effective policy at a date (window match, not latest row)', async () => {
    const svc = buildService(
      [seedLabor('old', 'org1', '2025-01-01', { effectiveTo: '2025-12-31' }), seedLabor('current', 'org1', '2026-01-01')],
      [],
    );
    const at = await svc.laborAt('org1', D('2026-06-01'));
    expect(at._id).toBe('current');
    // 2024-06-01 predates every window → no effective policy.
    await expect(svc.laborAt('org1', D('2024-06-01'))).rejects.toThrow('LABOR_POLICY_NOT_FOUND');
  });

  it('throws LABOR_POLICY_NOT_FOUND when no effective policy covers the date', async () => {
    const svc = buildService([], []);
    await expect(svc.laborAt('org1', D('2026-06-01'))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates a policy and bumps version; cross-tenant id 404s', async () => {
    const svc = buildService([seedLabor('l1', 'org1', '2026-01-01', { version: 1 })], []);
    const updated = await svc.updateLabor('org1', 'l1', { warningThresholdPercent: 90 } as never);
    expect(updated.version).toBe(2);
    expect(updated.warningThresholdPercent).toBe(90);
    await expect(svc.updateLabor('org2', 'l1', { warningThresholdPercent: 90 } as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('invalidates the union of old and new labor windows in the write transaction', async () => {
    const periodVersion = { bumpForEffectiveWindow: jest.fn().mockResolvedValue(2) };
    const svc = buildService([seedLabor('l1', 'org1', '2026-02-01', { effectiveTo: '2026-07-01' })], [], [], periodVersion);
    await svc.updateLabor('org1', 'l1', { effectiveFrom: '2026-01-01', effectiveTo: '2026-08-01' } as never);
    expect(periodVersion.bumpForEffectiveWindow).toHaveBeenCalledWith(
      'org1', D('2026-01-01'), D('2026-08-01'), expect.anything(),
    );
  });

  it('previews enforcement against the effective policy', async () => {
    const svc = buildService([seedLabor('l1', 'org1', '2026-01-01')], []);
    const result = await svc.previewLabor('org1', D('2026-06-01'), { combinedDailyMinutes: 800 });
    expect(result.approvable).toBe(false);
    expect(result.policyVersion).toBe(1);
    expect(result.violations[0].code).toBe('OVERTIME_DAILY_LIMIT_EXCEEDED');
  });
});

describe('PoliciesService — WorkCreditPolicy', () => {
  const dto = {
    effectiveFrom: '2026-01-01',
    halfDayMinimumRatio: 0.5,
    fullDayMinimumRatio: 0.9,
    paidLeaveCreditEnabled: true,
    incompleteDayRule: 'BLOCK' as const,
    businessReference: 'HR-2026-01',
  };

  it('creates and lists organization-scoped policies with an auto version', async () => {
    const svc = buildService([], []);
    const created = await svc.createWorkCredit('org1', dto);
    expect(created).toMatchObject({ organizationId: 'org1', version: 1, incompleteDayRule: 'BLOCK' });
    expect(await svc.listWorkCredit('org1')).toHaveLength(1);
    expect(await svc.listWorkCredit('org2')).toHaveLength(0);
  });

  it('resolves only the tenant effective policy and returns a stable missing error', async () => {
    const svc = buildService([], [], [seedWorkCredit('w1', 'org1', '2026-01-01')]);
    await expect(svc.workCreditAt('org1', D('2026-06-01'))).resolves.toMatchObject({ _id: 'w1' });
    await expect(svc.workCreditAt('org2', D('2026-06-01'))).rejects.toThrow('WORK_CREDIT_POLICY_NOT_FOUND');
  });

  it('rejects invalid dates, thresholds, and overlapping windows with stable errors', async () => {
    const svc = buildService([], [], [seedWorkCredit('w1', 'org1', '2026-01-01', { effectiveTo: '2026-07-01' })]);
    await expect(svc.createWorkCredit('org1', { ...dto, effectiveFrom: 'not-a-date' })).rejects.toThrow('WORK_CREDIT_POLICY_DATE_INVALID');
    await expect(svc.createWorkCredit('org1', { ...dto, effectiveFrom: '2027-01-01', halfDayMinimumRatio: 0.9, fullDayMinimumRatio: 0.5 })).rejects.toThrow('WORK_CREDIT_POLICY_THRESHOLDS_INVALID');
    await expect(svc.createWorkCredit('org1', { ...dto, effectiveFrom: '2026-03-01' })).rejects.toThrow('WORK_CREDIT_POLICY_EFFECTIVE_DATE_OVERLAP');
  });

  it('updates within the tenant and increments the version', async () => {
    const svc = buildService([], [], [seedWorkCredit('w1', 'org1', '2026-01-01')]);
    await expect(svc.updateWorkCredit('org1', 'w1', { fullDayMinimumRatio: 0.95 })).resolves.toMatchObject({ version: 2, fullDayMinimumRatio: 0.95 });
    await expect(svc.updateWorkCredit('org2', 'w1', { fullDayMinimumRatio: 0.95 })).rejects.toThrow('WORK_CREDIT_POLICY_NOT_FOUND');
  });

  it('invalidates every intersecting open period after a work-credit policy create', async () => {
    const periodVersion = { bumpForEffectiveWindow: jest.fn().mockResolvedValue(1) };
    const svc = buildService([], [], [], periodVersion);
    await svc.createWorkCredit('org1', { ...dto, effectiveTo: '2026-07-01' });
    expect(periodVersion.bumpForEffectiveWindow).toHaveBeenCalledWith(
      'org1', D('2026-01-01'), D('2026-07-01'), expect.anything(),
    );
  });

  it('invalidates the union of old and new effective windows after update and propagates failure', async () => {
    const periodVersion = { bumpForEffectiveWindow: jest.fn().mockRejectedValue(new Error('period invalidation unavailable')) };
    const svc = buildService([], [], [seedWorkCredit('w1', 'org1', '2026-01-01', { effectiveTo: '2026-07-01' })], periodVersion);
    await expect(svc.updateWorkCredit('org1', 'w1', {
      effectiveFrom: '2026-02-01', effectiveTo: '2026-08-01', fullDayMinimumRatio: 0.95,
    })).rejects.toThrow('period invalidation unavailable');
    expect(periodVersion.bumpForEffectiveWindow).toHaveBeenCalledWith(
      'org1', D('2026-01-01'), D('2026-08-01'), expect.anything(),
    );
  });
});

describe('PoliciesService — OvertimePayPolicy (TASK-037)', () => {
  it('creates an overtime policy scoped to the tenant with auto version', async () => {
    const svc = buildService([], []);
    const result = await svc.createOvertime('org1', {
      effectiveFrom: '2026-01-01',
      workingDayRate: 1.5,
      weeklyOffRate: 2,
      publicHolidayRate: 3,
      legalReference: 'BLLĐ 45/2019/QH14',
    } as never);
    expect(result.organizationId).toBe('org1');
    expect(result.workingDayRate).toBe(1.5);
  });

  it('atomically invalidates intersecting periods on overtime policy create and fails closed', async () => {
    const periodVersion = { bumpForEffectiveWindow: jest.fn().mockRejectedValue(new Error('period invalidation unavailable')) };
    const svc = buildService([], [], [], periodVersion);
    await expect(svc.createOvertime('org1', {
      effectiveFrom: '2026-01-01', effectiveTo: '2026-07-01', workingDayRate: 1.5,
      weeklyOffRate: 2, publicHolidayRate: 3, legalReference: 'BLLĐ 45/2019/QH14',
    } as never)).rejects.toThrow('period invalidation unavailable');
    expect(periodVersion.bumpForEffectiveWindow).toHaveBeenCalledWith(
      'org1', D('2026-01-01'), D('2026-07-01'), expect.anything(),
    );
  });

  it('rejects overlapping effective windows on create', async () => {
    const svc = buildService([], [seedOvertime('o1', 'org1', '2026-01-01', { effectiveTo: '2026-06-30' })]);
    await expect(
      svc.createOvertime('org1', {
        effectiveFrom: '2026-03-01',
        workingDayRate: 1.5, weeklyOffRate: 2, publicHolidayRate: 3, legalReference: 'BLLĐ 45/2019/QH14',
      } as never),
    ).rejects.toThrow('EFFECTIVE_DATE_OVERLAP');
  });

  it('returns the effective overtime policy and 404s outside any window', async () => {
    const svc = buildService([], [seedOvertime('o1', 'org1', '2026-01-01')]);
    const at = await svc.overtimeAt('org1', D('2026-06-01'));
    expect(at._id).toBe('o1');
    await expect(svc.overtimeAt('org2', D('2026-06-01'))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates and bumps version; cross-tenant id 404s', async () => {
    const svc = buildService([], [seedOvertime('o1', 'org1', '2026-01-01', { version: 1 })]);
    const updated = await svc.updateOvertime('org1', 'o1', { weeklyOffRate: 2.5 } as never);
    expect(updated.version).toBe(2);
    expect(updated.weeklyOffRate).toBe(2.5);
    await expect(svc.updateOvertime('org2', 'o1', { weeklyOffRate: 2.5 } as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('invalidates the union of old and new overtime windows and propagates failure', async () => {
    const periodVersion = { bumpForEffectiveWindow: jest.fn().mockRejectedValue(new Error('period invalidation unavailable')) };
    const svc = buildService([], [seedOvertime('o1', 'org1', '2026-02-01', { effectiveTo: '2026-07-01' })], [], periodVersion);
    await expect(svc.updateOvertime('org1', 'o1', {
      effectiveFrom: '2026-01-01', effectiveTo: '2026-08-01', weeklyOffRate: 2.5,
    } as never)).rejects.toThrow('period invalidation unavailable');
    expect(periodVersion.bumpForEffectiveWindow).toHaveBeenCalledWith(
      'org1', D('2026-01-01'), D('2026-08-01'), expect.anything(),
    );
  });

  it('previews rate resolution with the no-double-count rule', async () => {
    const svc = buildService([], [seedOvertime('o1', 'org1', '2026-01-01')]);
    const result = await svc.previewOvertime('org1', D('2026-09-06'), { weeklyOff: true, publicHoliday: true });
    expect(result.rates[0].type).toBe('OT_PUBLIC_HOLIDAY');
    expect(result.rates[0].rate).toBe(3);
  });
});