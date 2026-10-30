import { ShiftScope } from '../../database/schemas/enums';
import { ShiftTemplateService } from './shift-template.service';

const dto = { name: 'Office', scope: ShiftScope.ORGANIZATION, weekdays: [1, 2, 3, 4, 5], effectiveFrom: '2026-10-01', effectiveTo: '2026-10-31', startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 5 };
const policy = { effectiveFrom: new Date('2020-01-01'), active: true, normalDailyMinutes: 480, normalWeeklyMinutes: 2880, maxCombinedDailyMinutes: 720, maxMonthlyOvertimeMinutes: 2400, maxAnnualOvertimeMinutes: 12000, exceptionalAnnualOvertimeMinutes: 18000, warningThresholdPercent: 90, version: 1 };

function query(value: any) {
  const q: any = { lean: jest.fn(async () => value), select: jest.fn(() => q), session: jest.fn(() => q) };
  return q;
}

function build(old?: any) {
  const session = { withTransaction: jest.fn(async (work: () => Promise<void>) => work()), endSession: jest.fn(async () => undefined) };
  const created = { ...dto, code: 'OFFICE', organizationId: 'org', active: true, ...old };
  const shifts: any = {
    db: { startSession: jest.fn(async () => session) },
    exists: jest.fn(async () => false),
    find: jest.fn(() => query([])),
    findOne: jest.fn(() => query(old ? created : null)),
    create: jest.fn(async (docs: any[]) => [{ toObject: () => docs[0] }]),
    findOneAndUpdate: jest.fn(() => query(created)),
    deleteOne: jest.fn(async () => ({ deletedCount: 1 })),
  };
  const periodVersion = { bumpForEffectiveWindow: jest.fn(async () => 1) };
  const service = new ShiftTemplateService(
    shifts, { exists: jest.fn(async () => true) } as any,
    { exists: jest.fn(async () => false) } as any, { exists: jest.fn(async () => false) } as any,
    { laborAt: jest.fn(async () => policy), listLabor: jest.fn(async () => [policy]) } as any,
    periodVersion as any,
  );
  return { service, shifts, session, periodVersion, created };
}

const D = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('ShiftTemplateService projection invalidation', () => {
  it('creates and invalidates the inclusive effective window in one transaction/session', async () => {
    const c = build();
    await c.service.create('org', dto);
    expect(c.shifts.create).toHaveBeenCalledWith([expect.any(Object)], { session: c.session });
    expect(c.periodVersion.bumpForEffectiveWindow).toHaveBeenCalledWith('org', D('2026-10-01'), D('2026-11-01'), c.session);
    expect(c.session.endSession).toHaveBeenCalled();
  });

  it('updates and invalidates the union of old and new windows', async () => {
    const c = build({ effectiveFrom: '2026-10-10', effectiveTo: '2026-10-20' });
    await c.service.update('org', 's1', { effectiveFrom: '2026-09-01', effectiveTo: '2026-11-30' });
    expect(c.shifts.findOneAndUpdate).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), expect.objectContaining({ session: c.session }));
    expect(c.periodVersion.bumpForEffectiveWindow).toHaveBeenCalledWith('org', D('2026-09-01'), D('2026-12-01'), c.session);
  });

  it.each([true, false])('invalidates activation state changes (%s)', async (active) => {
    const c = build({ active: !active });
    await c.service.setActive('org', 's1', active);
    expect(c.periodVersion.bumpForEffectiveWindow).toHaveBeenCalledWith('org', D('2026-10-01'), D('2026-11-01'), c.session);
  });

  it('does not write or invalidate an activation no-op', async () => {
    const c = build({ active: true });
    await expect(c.service.setActive('org', 's1', true)).resolves.toMatchObject({ active: true });
    expect(c.shifts.findOneAndUpdate).not.toHaveBeenCalled();
    expect(c.periodVersion.bumpForEffectiveWindow).not.toHaveBeenCalled();
  });

  it('removes and invalidates the removed window transactionally', async () => {
    const c = build({ active: true });
    await c.service.remove('org', 's1');
    expect(c.shifts.deleteOne).toHaveBeenCalledWith({ _id: 's1', organizationId: 'org' }, { session: c.session });
    expect(c.periodVersion.bumpForEffectiveWindow).toHaveBeenCalledWith('org', D('2026-10-01'), D('2026-11-01'), c.session);
  });

  it('does not invalidate rejected removal and propagates invalidation failure', async () => {
    const rejected = build({ active: true });
    (rejected.service as any).assignments.exists.mockResolvedValueOnce(true);
    await expect(rejected.service.remove('org', 's1')).rejects.toThrow('SHIFT_TEMPLATE_IN_USE');
    expect(rejected.periodVersion.bumpForEffectiveWindow).not.toHaveBeenCalled();

    const failed = build();
    failed.periodVersion.bumpForEffectiveWindow.mockRejectedValueOnce(new Error('invalidation failed'));
    await expect(failed.service.create('org', dto)).rejects.toThrow('invalidation failed');
    expect(failed.session.withTransaction).toHaveBeenCalled();
    expect(failed.session.endSession).toHaveBeenCalled();
  });
});
