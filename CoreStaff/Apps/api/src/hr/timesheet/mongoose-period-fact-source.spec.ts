import { Types } from 'mongoose';
import { MongoosePeriodFactSource } from './mongoose-period-fact-source';

const queryModel = (rows: any[]) => {
  const query = { session: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(rows) };
  return { find: jest.fn().mockReturnValue(query), query };
};

describe('MongoosePeriodFactSource evidence adapter', () => {
  it('loads exact V2 snapshots and string endpoint references in the same session', async () => {
    const eventId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const attendance = queryModel([{ _id: 'a', employeeId: 'u', workDate: '2026-09-01',
      checkInProvenance: { source: 'OBSERVED', eventId },
      checkOutProvenance: { source: 'CONFIRMED_SCHEDULE', requestId }, overallApprovalStatus: 'APPROVED' }]);
    const evidence = { calculationContract: 'OVERTIME_V2', rawEligibleMinutes: 89, payableMinutes: 60,
      roundingDroppedMinutes: 29, minimumThresholdApplied: false, reasons: [],
      policySnapshot: { id: 'policy', version: 2, minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30 },
      provenanceSnapshot: { checkIn: { source: 'OBSERVED', eventId }, approvalStatus: 'APPROVED' }, inputHash: 'hash' };
    const overtime = queryModel([{ _id: 'ot', employeeId: 'u', eligibleMinutes: 60, ...evidence }]);
    const models = [queryModel([]), queryModel([]), queryModel([]), queryModel([]), queryModel([]), attendance, overtime];
    const source = new MongoosePeriodFactSource(...models as [any, any, any, any, any, any, any]);
    const session = {} as any;
    const facts = await source.load({ organizationId: String(new Types.ObjectId()), periodKey: '2026-09', startDate: '2026-09-01', endDate: '2026-09-30' }, session);
    expect(facts.attendanceDays[0]).toMatchObject({ checkInProvenance: { source: 'OBSERVED', eventId: String(eventId) },
      checkOutProvenance: { source: 'CONFIRMED_SCHEDULE', requestId: String(requestId) }, overallApprovalStatus: 'APPROVED' });
    expect(facts.overtimeResults[0]).toMatchObject({ ...evidence, provenanceSnapshot: {
      checkIn: { source: 'OBSERVED', eventId: String(eventId) }, approvalStatus: 'APPROVED' } });
    for (const model of models) expect(model.query.session).toHaveBeenCalledWith(session);
  });
});
