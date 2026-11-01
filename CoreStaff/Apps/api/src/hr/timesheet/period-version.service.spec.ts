import { describe, expect, it } from '@jest/globals';
import { PeriodVersionService } from './period-version.service';

/** Records the calls the service makes against the period model. */
function fakePeriods(resolve: (filter: any) => any) {
  const calls: Array<{ filter: any; update: any; options: any }> = [];
  const finds: any[] = [];
  return {
    calls,
    finds,
    model: {
      updateOne: async (filter: any, update: any, options: any) => {
        calls.push({ filter, update, options });
        return { modifiedCount: resolve(filter) ? 1 : 0 };
      },
      findOne: (filter: any) => {
        finds.push(filter);
        const result = resolve(filter);
        return {
          select: () => ({ session: () => ({ lean: async () => result }) }),
        };
      },
    },
  };
}

const ORG = '64f1a2b3c4d5e6f7a8b9c0d0';
const PERIOD = '64f1a2b3c4d5e6f7a8b9c0d1';

describe('PeriodVersionService.claimForWorkDate', () => {
  const session = { inTransaction: () => true } as any;
  function setup(rows: any[], modifiedCount = 1) {
    const writes: any[] = [];
    const model = {
      find: () => ({ session: () => ({ lean: async () => rows }) }),
      updateOne: async (filter: any, update: any, options: any) => {
        writes.push({ filter, update, options });
        return { modifiedCount };
      },
    };
    return { service: new PeriodVersionService(model as any), writes };
  }

  it('claims and invalidates the exact open period version in the caller transaction', async () => {
    const { service, writes } = setup([{ _id: PERIOD, version: 4, status: 'READY_TO_CLOSE' }]);
    await expect(service.claimForWorkDate(ORG, '2026-10-05', session))
      .resolves.toEqual({ periodId: PERIOD, version: 5 });
    expect(writes[0].filter).toMatchObject({ version: 4, status: 'READY_TO_CLOSE', payrollRunId: { $exists: false } });
    expect(writes[0].update).toMatchObject({ $inc: { version: 1 }, $set: { status: 'REVIEWING', managerSnapshotClosed: false, departmentSnapshots: [] } });
    expect(writes[0].options.session).toBe(session);
  });

  it('requires an active transaction before resolving any period', async () => {
    const { service, writes } = setup([]);
    await expect(service.claimForWorkDate(ORG, '2026-10-05', { inTransaction: () => false } as any))
      .rejects.toThrow('TRANSACTION_REQUIRED');
    expect(writes).toHaveLength(0);
  });

  it('requires a covering period', async () => {
    await expect(setup([]).service.claimForWorkDate(ORG, '2026-10-05', session)).rejects.toThrow('PERIOD_REQUIRED');
  });

  it.each([
    [{ _id: PERIOD, version: 4, status: 'CLOSED' }],
    [{ _id: PERIOD, version: 4, status: 'OPEN', payrollRunId: PERIOD }],
  ])('rejects closed or payroll-claimed periods without writing', async (period) => {
    const { service, writes } = setup([period]);
    await expect(service.claimForWorkDate(ORG, '2026-10-05', session)).rejects.toThrow('PERIOD_CLOSED_OR_PAYROLL_CLAIMED');
    expect(writes).toHaveLength(0);
  });

  it('rejects a lost period CAS rather than allowing the source write', async () => {
    const { service } = setup([{ _id: PERIOD, version: 4, status: 'OPEN' }], 0);
    await expect(service.claimForWorkDate(ORG, '2026-10-05', session)).rejects.toThrow('PERIOD_VERSION_CONFLICT');
  });

  it('does not select arbitrarily between overlapping periods', async () => {
    const { service } = setup([{ _id: PERIOD }, { _id: ORG }]);
    await expect(service.claimForWorkDate(ORG, '2026-10-05', session)).rejects.toThrow('CONTEXT_REQUIRES_REVIEW');
  });

  it.each(['2026-02-30', '2026-1-05', '2026-10-05T00:00:00Z'])('rejects invalid date-only token %s', async (date) => {
    await expect(setup([]).service.claimForWorkDate(ORG, date, session)).rejects.toThrow('INVALID_WORK_DATE');
  });
});

describe('TASK-073 — PeriodVersionService.bump', () => {
  it('increments the version of an open period', async () => {
    const { model, calls } = fakePeriods(() => ({ _id: PERIOD }));
    const service = new PeriodVersionService(model as any);

    await expect(service.bump(ORG, PERIOD)).resolves.toBe(true);

    expect(calls).toHaveLength(1);
    expect(calls[0].update).toEqual({
      $inc: { version: 1 },
      $set: { status: 'REVIEWING', managerSnapshotClosed: false, departmentSnapshots: [] },
      $unset: { managerSnapshotClosedBy: 1, managerSnapshotClosedAt: 1 },
    });
    expect(calls[0].filter).toMatchObject({
      _id: expect.anything(),
      organizationId: expect.anything(),
      active: true,
      status: { $ne: 'CLOSED' },
    });
  });

  it('is a no-op when no period id is resolved', async () => {
    const { model, calls } = fakePeriods(() => null);
    const service = new PeriodVersionService(model as any);

    await expect(service.bump(ORG, null)).resolves.toBe(false);
    await expect(service.bump(ORG, undefined)).resolves.toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('does not bump a CLOSED period (filter excludes it, so nothing is modified)', async () => {
    const { model } = fakePeriods(() => null); // updateOne matches nothing
    const service = new PeriodVersionService(model as any);

    await expect(service.bump(ORG, PERIOD)).resolves.toBe(false);
  });
});

describe('TASK-073 — PeriodVersionService.bumpForWorkDates', () => {
  it('bumps each distinct period covering the dates', async () => {
    const { model, finds, calls } = fakePeriods(() => ({ _id: PERIOD }));
    const service = new PeriodVersionService(model as any);

    const bumped = await service.bumpForWorkDates(ORG, ['2026-10-06', '2026-10-07']);

    // Both dates resolve to the same period → one lookup each, one bump total.
    expect(finds).toHaveLength(2);
    expect(calls).toHaveLength(1);
    expect(bumped).toBe(1);
  });

  it('dedupes identical dates before resolving', async () => {
    const { model, finds } = fakePeriods(() => ({ _id: PERIOD }));
    const service = new PeriodVersionService(model as any);

    await service.bumpForWorkDates(ORG, ['2026-10-06', '2026-10-06', '2026-10-06']);

    expect(finds).toHaveLength(1);
  });

  it('bumps nothing when no period covers the dates', async () => {
    const { model, calls } = fakePeriods(() => null);
    const service = new PeriodVersionService(model as any);

    await expect(service.bumpForWorkDates(ORG, ['2026-10-06'])).resolves.toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('returns zero for an empty date list without querying', async () => {
    const { model, finds } = fakePeriods(() => ({ _id: PERIOD }));
    const service = new PeriodVersionService(model as any);

    await expect(service.bumpForWorkDates(ORG, [])).resolves.toBe(0);
    expect(finds).toHaveLength(0);
  });
});

describe('PeriodVersionService.bumpForEffectiveWindow', () => {
  it('bumps every distinct open period intersecting the half-open policy window', async () => {
    const second = '64f1a2b3c4d5e6f7a8b9c0d2';
    const calls: any[] = [];
    const findFilters: any[] = [];
    const model = {
      find: (filter: any) => {
        findFilters.push(filter);
        return { select: () => ({ session: () => ({ lean: async () => [{ _id: PERIOD }, { _id: second }, { _id: PERIOD }] }) }) };
      },
      updateOne: async (filter: any, update: any, options: any) => {
        calls.push({ filter, update, options });
        return { modifiedCount: 1 };
      },
    };
    const service = new PeriodVersionService(model as any);
    const session = { id: 'session' } as any;

    await expect(service.bumpForEffectiveWindow(
      ORG,
      new Date('2026-10-01T00:00:00.000Z'),
      new Date('2026-11-01T00:00:00.000Z'),
      session,
    )).resolves.toBe(2);
    expect(findFilters[0]).toMatchObject({
      active: true,
      status: { $ne: 'CLOSED' },
      startDate: { $lt: new Date('2026-11-01T00:00:00.000Z') },
      endDate: { $gte: new Date('2026-10-01T00:00:00.000Z') },
    });
    expect(calls).toHaveLength(2);
    expect(calls.every(call => call.options.session === session)).toBe(true);
  });

  it('uses only a lower bound for an open-ended policy window', async () => {
    const filters: any[] = [];
    const model = {
      find: (filter: any) => {
        filters.push(filter);
        return { select: () => ({ session: () => ({ lean: async () => [] }) }) };
      },
    };
    const service = new PeriodVersionService(model as any);
    await expect(service.bumpForEffectiveWindow(ORG, new Date('2026-10-01T00:00:00.000Z'))).resolves.toBe(0);
    expect(filters[0].startDate).toBeUndefined();
    expect(filters[0].endDate).toEqual({ $gte: new Date('2026-10-01T00:00:00.000Z') });
  });
});
