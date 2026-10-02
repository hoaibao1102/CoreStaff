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
