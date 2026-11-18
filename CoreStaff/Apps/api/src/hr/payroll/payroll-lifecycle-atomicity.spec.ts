import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PayrollRunStatus } from '../../database/schemas/payroll-run.schema';
import { PayrollRunService } from './payroll-run.service';
import { PayslipService } from './payslip.service';

/**
 * AUD-C08: lock and release move several collections. They must commit as one
 * unit, use a single orchestration, and notify only after the commit.
 */
const ORG = new Types.ObjectId();
const RUN = new Types.ObjectId();
const PERIOD = new Types.ObjectId();
const USER = String(new Types.ObjectId());

function session() {
  return {
    withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
}

function runDoc(status: PayrollRunStatus) {
  return {
    _id: RUN,
    organizationId: ORG,
    timesheetPeriodId: PERIOD,
    periodLabel: '2026-10',
    status,
    version: 7,
    toObject() { return this; },
  };
}

function modelWithRun(status: PayrollRunStatus, opts: { casResult?: unknown; periodResult?: unknown } = {}) {
  const sess = session();
  const doc = runDoc(status);
  const chain = (value: unknown) => {
    const q: any = { session: jest.fn(() => q), lean: jest.fn().mockResolvedValue(value), select: jest.fn(() => q), then: (r: any) => r(value) };
    return q;
  };
  const periodFindOneAndUpdate = jest.fn().mockResolvedValue('periodResult' in opts ? opts.periodResult : { _id: PERIOD });
  const model: any = {
    db: { startSession: jest.fn().mockResolvedValue(sess), model: jest.fn(() => ({ findOneAndUpdate: periodFindOneAndUpdate, findById: () => ({ select: () => ({ lean: async () => ({ payrollSeparationOfDuties: (opts as any).sod === true }) }) }) })) },
    findOne: jest.fn(() => chain(doc)),
    findOneAndUpdate: jest.fn().mockResolvedValue('casResult' in opts ? opts.casResult : { ...doc, status: 'NEXT', toObject() { return this; } }),
  };
  return { model, sess, doc, periodFindOneAndUpdate, chain };
}

describe('PayrollRunService.lock is atomic (AUD-C08)', () => {
  function build(opts: { casResult?: unknown; periodResult?: unknown } = {}) {
    const m = modelWithRun(PayrollRunStatus.CALCULATED, opts);
    const periodModel: any = { findOneAndUpdate: jest.fn().mockResolvedValue('periodResult' in opts ? opts.periodResult : { _id: PERIOD }) };
    const service = new PayrollRunService(m.model, {} as any, periodModel, {} as any, {} as any, {} as any, {} as any);
    // findOneRaw() reads through findOne().lean()
    return { service, m, periodModel };
  }

  it('writes the run and the period inside one transaction session', async () => {
    const { service, m, periodModel } = build();
    await service.lock(String(ORG), String(RUN), USER);
    expect(m.sess.withTransaction).toHaveBeenCalledTimes(1);
    expect(m.model.findOneAndUpdate.mock.calls[0][2].session).toBe(m.sess);
    expect(periodModel.findOneAndUpdate.mock.calls[0][2].session).toBe(m.sess);
    expect(m.sess.endSession).toHaveBeenCalled();
  });

  it('fails the whole lock when the period compare-and-set loses, so the run write is not committed', async () => {
    const { service, m } = build({ periodResult: null });
    await expect(service.lock(String(ORG), String(RUN), USER)).rejects.toThrow(ConflictException);
    // The run update ran inside withTransaction; throwing aborts it in Mongo.
    expect(m.sess.withTransaction).toHaveBeenCalledTimes(1);
    expect(m.sess.endSession).toHaveBeenCalled();
  });
});

describe('payslip release is one transactional orchestration (AUD-C08)', () => {
  function build(opts: { casResult?: unknown; periodResult?: unknown } = {}) {
    const m = modelWithRun(PayrollRunStatus.LOCKED, opts);
    const payslipChain = { select: jest.fn().mockReturnThis(), session: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{ employeeProfileId: 'p1' }]) };
    const payslipModel: any = { find: jest.fn(() => payslipChain), updateMany: jest.fn().mockResolvedValue({}) };
    const profileChain = { select: jest.fn().mockReturnThis(), session: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{ userId: 'u1' }]) };
    const profileModel: any = { find: jest.fn(() => profileChain) };
    const gateway: any = { notifyPayslipReleased: jest.fn() };
    const service = new PayslipService(payslipModel, m.model, {} as any, profileModel, {} as any, {} as any, {} as any, gateway);
    return { service, m, payslipModel, gateway };
  }

  it('flips payslips, run and period in one session, then notifies once after commit', async () => {
    const { service, m, payslipModel, gateway } = build();
    await service.releaseForPayrollRun(String(ORG), String(RUN), USER);
    expect(m.sess.withTransaction).toHaveBeenCalledTimes(1);
    expect(payslipModel.updateMany.mock.calls[0][2].session).toBe(m.sess);
    const [filter, update, options] = m.model.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ status: PayrollRunStatus.LOCKED, version: 7 });
    expect(update.$set.status).toBe(PayrollRunStatus.RELEASED);
    expect(options.session).toBe(m.sess);
    expect(m.periodFindOneAndUpdate.mock.calls[0][2].session).toBe(m.sess);
    expect(gateway.notifyPayslipReleased).toHaveBeenCalledTimes(1);
    expect(gateway.notifyPayslipReleased).toHaveBeenCalledWith(['u1'], expect.objectContaining({ payrollRunId: String(RUN) }));
  });

  it('a lost run compare-and-set aborts the release and sends no notification', async () => {
    const { service, gateway } = build({ casResult: null });
    await expect(service.releaseForPayrollRun(String(ORG), String(RUN), USER)).rejects.toThrow('PAYROLL_RUN_CAS_CONFLICT');
    expect(gateway.notifyPayslipReleased).not.toHaveBeenCalled();
  });

  it('a lost period compare-and-set aborts the release and sends no notification', async () => {
    const { service, gateway } = build({ periodResult: null });
    await expect(service.releaseForPayrollRun(String(ORG), String(RUN), USER)).rejects.toThrow('PAYROLL_PERIOD_CAS_CONFLICT');
    expect(gateway.notifyPayslipReleased).not.toHaveBeenCalled();
  });

  it('PayrollRunService.release delegates to that single orchestration instead of its own writes', async () => {
    const m = modelWithRun(PayrollRunStatus.LOCKED);
    const payslipService: any = { releaseForPayrollRun: jest.fn().mockResolvedValue(undefined) };
    const service = new PayrollRunService(m.model, {} as any, {} as any, {} as any, {} as any, {} as any, payslipService);
    await service.release(String(ORG), String(RUN), USER);
    expect(payslipService.releaseForPayrollRun).toHaveBeenCalledWith(String(ORG), String(RUN), USER);
    expect(m.model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('payroll separation of duties (AUD-H04)', () => {
  const PREPARER = String(new Types.ObjectId());
  const APPROVER = String(new Types.ObjectId());
  function build(sod: boolean, status: PayrollRunStatus) {
    const m: any = modelWithRun(status, { sod } as any);
    m.doc.createdBy = new Types.ObjectId(PREPARER);
    m.doc.calculatedBy = new Types.ObjectId(PREPARER);
    const periodModel: any = { findOneAndUpdate: jest.fn().mockResolvedValue({ _id: PERIOD }) };
    const payslipService: any = { releaseForPayrollRun: jest.fn().mockResolvedValue(undefined) };
    const service = new PayrollRunService(m.model, {} as any, periodModel, {} as any, {} as any, {} as any, payslipService);
    return { service, m, payslipService };
  }

  it('forbids the preparer from locking when the tenant enables the policy', async () => {
    const { service, m } = build(true, PayrollRunStatus.CALCULATED);
    await expect(service.lock(String(ORG), String(RUN), PREPARER)).rejects.toThrow('PAYROLL_SEPARATION_OF_DUTIES');
    expect(m.model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('forbids the preparer from releasing when the tenant enables the policy', async () => {
    const { service, payslipService } = build(true, PayrollRunStatus.LOCKED);
    await expect(service.release(String(ORG), String(RUN), PREPARER)).rejects.toThrow('PAYROLL_SEPARATION_OF_DUTIES');
    expect(payslipService.releaseForPayrollRun).not.toHaveBeenCalled();
  });

  it('lets a different actor lock and release', async () => {
    await expect(build(true, PayrollRunStatus.CALCULATED).service.lock(String(ORG), String(RUN), APPROVER)).resolves.toBeDefined();
    await expect(build(true, PayrollRunStatus.LOCKED).service.release(String(ORG), String(RUN), APPROVER)).resolves.toBeDefined();
  });

  it('does not restrict the preparer when the policy is off (default)', async () => {
    await expect(build(false, PayrollRunStatus.CALCULATED).service.lock(String(ORG), String(RUN), PREPARER)).resolves.toBeDefined();
  });
});
