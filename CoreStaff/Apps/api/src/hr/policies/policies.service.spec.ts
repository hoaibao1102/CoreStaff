import { NotFoundException } from '@nestjs/common';
import { PoliciesService } from './policies.service';

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
  return {
    async create(doc: Record<string, unknown>) {
      const row = seedLabor(`l${next++}`, String(doc.organizationId), '2026-01-01', {
        effectiveTo: doc.effectiveTo ? (doc.effectiveTo as Date).toISOString().slice(0, 10) : undefined,
        version: doc.version as number,
        active: doc.active as boolean,
      });
      Object.assign(row, doc);
      rows.push(row);
      return { toObject: () => row };
    },
    /** Fluent find(): the service calls it with or without an intermediate .sort(). */
    find(filter: Record<string, unknown>) {
      const chain = {
        sort: () => chain,
        lean: async () => rows.filter((r) => matchesFilter(r as unknown as Record<string, unknown>, filter)),
      };
      return chain;
    },
    /** Fluent findOne(): supports both .findOne(q).lean() and .findOne(q).sort().lean(). */
    findOne(filter: Record<string, unknown>) {
      const chain = {
        sort: () => chain,
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
  return {
    async create(doc: Record<string, unknown>) {
      const row = seedOvertime(`o${next++}`, String(doc.organizationId), '2026-01-01', {
        effectiveTo: doc.effectiveTo ? (doc.effectiveTo as Date).toISOString().slice(0, 10) : undefined,
        version: doc.version as number,
        active: doc.active as boolean,
      });
      Object.assign(row, doc);
      rows.push(row);
      return { toObject: () => row };
    },
    /** Fluent find(): the service calls it with or without an intermediate .sort(). */
    find(filter: Record<string, unknown>) {
      const chain = {
        sort: () => chain,
        lean: async () => rows.filter((r) => matchesFilter(r as unknown as Record<string, unknown>, filter)),
      };
      return chain;
    },
    /** Fluent findOne(): supports both .findOne(q).lean() and .findOne(q).sort().lean(). */
    findOne(filter: Record<string, unknown>) {
      const chain = {
        sort: () => chain,
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

function buildService(labors: LaborRow[], overtimes: OvertimeRow[]) {
  return new PoliciesService(buildLaborModel(labors) as never, buildOvertimeModel(overtimes) as never);
}

describe('PoliciesService — LaborCompliancePolicy (TASK-036)', () => {
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

  it('previews enforcement against the effective policy', async () => {
    const svc = buildService([seedLabor('l1', 'org1', '2026-01-01')], []);
    const result = await svc.previewLabor('org1', D('2026-06-01'), { combinedDailyMinutes: 800 });
    expect(result.approvable).toBe(false);
    expect(result.policyVersion).toBe(1);
    expect(result.violations[0].code).toBe('OVERTIME_DAILY_LIMIT_EXCEEDED');
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

  it('previews rate resolution with the no-double-count rule', async () => {
    const svc = buildService([], [seedOvertime('o1', 'org1', '2026-01-01')]);
    const result = await svc.previewOvertime('org1', D('2026-09-06'), { weeklyOff: true, publicHoliday: true });
    expect(result.rates[0].type).toBe('OT_PUBLIC_HOLIDAY');
    expect(result.rates[0].rate).toBe(3);
  });
});