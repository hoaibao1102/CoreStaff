import { ManagerRequestService } from '../manager/manager-request.service';

function fixture() {
  const session = { withTransaction: jest.fn(async (fn: any) => fn()), endSession: jest.fn(async () => {}), inTransaction: () => true };
  const row = { _id: 'r', organizationId: 'o', type: 'OVERTIME', employeeUserId: 'u', departmentId: 'd', workDate: new Date('2026-09-22'), requestedStart: new Date('2026-09-22T11:00:00Z'), requestedEnd: new Date('2026-09-22T13:00:00Z'), status: 'PENDING', version: 1, metadata: { calculationContract: 'OVERTIME_V2' } };
  const query = (value: any) => { const q: any = { lean: async () => value, populate: () => q, session: () => q }; return q; };
  const requests = { db: { startSession: async () => session }, create: jest.fn(async (data: any) => Array.isArray(data) ? data.map(d => ({ ...d, toObject: () => d })) : ({ toObject: () => data })), findOne: jest.fn(() => query(row)), findOneAndUpdate: jest.fn(() => query({ ...row, status: 'APPROVED' })) };
  const ot = { assertNoClientType: jest.fn(), assertFilingAllowed: jest.fn(async () => ({ isRetroactive: false, calculationContract: 'OVERTIME_V2' })), claimApproval: jest.fn(async () => {}), precheckApproval: jest.fn(async () => ({ labor: { violations: [] } })), onApproved: jest.fn(async () => ({})) };
  const period = { claimForWorkDate: jest.fn(async () => 1), bumpForWorkDates: jest.fn() };
  const service = new ManagerRequestService(requests as any, { findOne: () => query({ _id: 'p', departmentId: 'd' }) } as any, {} as any, {} as any, { requireDepartment: async () => {} } as any, period as any, undefined, ot as any);
  return { service, requests, ot, period, session };
}

describe('OT transactional request paths', () => {
  it('guards filing inside the transaction and stores its server-owned contract', async () => {
    const { service, ot, session, requests } = fixture();
    await service.createMine('o', 'u', { type: 'OVERTIME', workDate: '2026-09-22', reason: 'completed release', requestedStart: '2026-09-22T11:00:00Z', requestedEnd: '2026-09-22T13:00:00Z', previewHash: 'hash' });
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(ot.assertFilingAllowed).toHaveBeenCalledWith('o', 'u', expect.any(Object), '2026-09-22', expect.any(Date), undefined, { session, previewHash: 'hash' });
    expect(requests.create).toHaveBeenCalledWith([expect.objectContaining({ metadata: { calculationContract: 'OVERTIME_V2' } })], { session });
  });
  it('claims, prechecks and persists approval in one session without another version bump', async () => {
    const { service, ot, period, session, requests } = fixture();
    await service.decide('o', 'manager', 'r', 'APPROVED', 1);
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(ot.claimApproval).toHaveBeenCalledWith('o', expect.objectContaining({ _id: 'r' }), session);
    expect(ot.precheckApproval).toHaveBeenCalledWith('o', expect.any(Object), session);
    expect(requests.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING', version: 1 }), expect.any(Object), { new: true, session });
    expect(ot.onApproved).toHaveBeenCalledWith('o', expect.any(Object), session);
    expect(period.bumpForWorkDates).not.toHaveBeenCalled();
  });
});
