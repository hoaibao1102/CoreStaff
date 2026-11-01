import { AssignmentService } from './assignment.service';

function query(value: any) {
  const q: any = { lean: jest.fn(async () => value), sort: jest.fn(() => q), session: jest.fn(() => q) };
  return q;
}

function build(row?: any) {
  const current = row ?? { _id: 'a1', organizationId: 'org', userId: 'u1', departmentId: 'd1', effectiveFrom: '2027-10-01', effectiveTo: '2027-10-31', active: true };
  const session = { withTransaction: jest.fn(async (work: () => Promise<void>) => work()), endSession: jest.fn(async () => undefined) };
  const assignment: any = {
    db: { startSession: jest.fn(async () => session) },
    collection: { dropIndex: jest.fn(async () => undefined) },
    find: jest.fn(() => query([])), findOne: jest.fn(() => query(current)), findById: jest.fn(() => query(current)),
    findOneAndUpdate: jest.fn(() => query(current)), findByIdAndUpdate: jest.fn(() => query({ ...current })),
    insertMany: jest.fn(async (docs: any[], options: any) => docs.map(doc => ({ toObject: () => ({ ...doc, active: true }), options }))),
  };
  const refs = { findOne: jest.fn(() => query({ _id: 'ok' })) };
  const periodVersion = { bumpForEffectiveWindow: jest.fn(async () => 1) };
  const service = new AssignmentService(assignment, refs as any, refs as any, refs as any, {} as any, periodVersion as any);
  return { service, assignment, session, periodVersion, current };
}
const D = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('AssignmentService projection invalidation', () => {
  it('creates a batch and invalidates its window once in the same session', async () => {
    const c = build();
    await c.service.create('org', {}, { userIds: ['u1', 'u2'], departmentId: 'd1', effectiveFrom: '2027-10-01', effectiveTo: '2027-10-31' });
    expect(c.assignment.insertMany).toHaveBeenCalledWith(expect.any(Array), { ordered: false, session: c.session });
    expect(c.periodVersion.bumpForEffectiveWindow).toHaveBeenCalledTimes(1);
    expect(c.periodVersion.bumpForEffectiveWindow).toHaveBeenCalledWith('org', D('2027-10-01'), D('2027-11-01'), c.session);
  });

  it('enriches an existing assignment and invalidates in the same transaction/session', async () => {
    const c = build();
    await c.service.create('org', {}, { userIds: ['u1'], departmentId: 'd1', workplaceId: 'w1', effectiveFrom: '2027-10-01' });
    expect(c.assignment.findByIdAndUpdate).toHaveBeenCalledWith('a1', { workplaceId: 'w1' }, { new: true, session: c.session });
    expect(c.periodVersion.bumpForEffectiveWindow).toHaveBeenCalledWith('org', D('2027-10-01'), D('2027-11-01'), c.session);
  });

  it('updates and invalidates the union of old and new windows with the transaction session', async () => {
    const c = build();
    await c.service.update('org', 'a1', { effectiveFrom: '2027-09-01', effectiveTo: '2027-11-30' });
    expect(c.assignment.findOneAndUpdate).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), expect.objectContaining({ session: c.session }));
    expect(c.periodVersion.bumpForEffectiveWindow).toHaveBeenCalledWith('org', D('2027-09-01'), D('2027-12-01'), c.session);
  });

  it.each([true, false])('invalidates activation state changes (%s)', async active => {
    const c = build({ _id: 'a1', organizationId: 'org', effectiveFrom: '2027-10-01', effectiveTo: undefined, active: !active });
    await c.service.setActive('org', 'a1', active);
    expect(c.assignment.findByIdAndUpdate).toHaveBeenCalledWith('a1', { active }, { new: true, session: c.session });
    expect(c.periodVersion.bumpForEffectiveWindow).toHaveBeenCalledWith('org', D('2027-10-01'), undefined, c.session);
  });

  it('does not write or invalidate an activation no-op', async () => {
    const c = build();
    await c.service.setActive('org', 'a1', true);
    expect(c.assignment.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(c.periodVersion.bumpForEffectiveWindow).not.toHaveBeenCalled();
  });

  it('does not invalidate a rejected update and propagates invalidation failures', async () => {
    const rejected = build();
    rejected.assignment.findById.mockReturnValueOnce(query(null));
    await expect(rejected.service.update('org', 'missing', { effectiveFrom: '2027-11-01' })).rejects.toThrow('ASSIGNMENT_NOT_FOUND');
    expect(rejected.periodVersion.bumpForEffectiveWindow).not.toHaveBeenCalled();

    const failed = build();
    failed.periodVersion.bumpForEffectiveWindow.mockRejectedValueOnce(new Error('invalidation failed'));
    await expect(failed.service.setActive('org', 'a1', false)).rejects.toThrow('invalidation failed');
    expect(failed.session.endSession).toHaveBeenCalled();
  });
});
