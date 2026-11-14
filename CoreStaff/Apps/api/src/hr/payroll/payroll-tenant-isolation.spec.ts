import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PayrollRunStatus } from '../../database/schemas/payroll-run.schema';
import { PayrollRunService } from './payroll-run.service';
import { PayslipService } from './payslip.service';
import { PayrollExportService } from './payroll-export.service';

/**
 * AUD-C02 / AUD-C03: a payroll run id belonging to tenant A must behave like an
 * unknown id for HR of tenant B, and must never be written.
 */
const ORG_A = new Types.ObjectId();
const ORG_B = new Types.ObjectId();
const RUN = new Types.ObjectId();

const sameId = (a: unknown, b: unknown) => String(a) === String(b);

function run(status: PayrollRunStatus) {
  return {
    _id: RUN,
    organizationId: ORG_A,
    status,
    version: 1,
    timesheetPeriodId: new Types.ObjectId(),
    sourceSnapshotIds: [],
    toObject() { return this; },
  };
}

/** Evaluates only _id / organizationId / status the way Mongo would. */
function runModel(status: PayrollRunStatus) {
  const doc = run(status);
  const matches = (f: any) =>
    (f._id === undefined || sameId(f._id, doc._id)) &&
    (f.organizationId === undefined || sameId(f.organizationId, doc.organizationId)) &&
    (f.status === undefined || f.status === doc.status);
  const query = (f: any) => {
    const hit = matches(f) ? doc : null;
    const q: any = {
      lean: jest.fn().mockResolvedValue(hit),
      session: jest.fn().mockImplementation(() => q),
      then: (resolve: any) => resolve(hit),
    };
    return q;
  };
  return {
    db: {
      startSession: jest.fn().mockImplementation(async () => ({
        withTransaction: async (fn: () => Promise<unknown>) => fn(),
        endSession: jest.fn().mockResolvedValue(undefined),
      })),
      model: jest.fn(),
    },
    findOne: jest.fn().mockImplementation(query),
    findById: jest.fn().mockImplementation((id: any) => query({ _id: id })),
    exists: jest.fn().mockImplementation(async (f: any) => (matches(f) ? { _id: doc._id } : null)),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };
}

function payslipModel() {
  return {
    find: jest.fn(),
    aggregate: jest.fn(),
    updateMany: jest.fn(),
  };
}

describe('payroll run lifecycle is tenant scoped (AUD-C02)', () => {
  const cases: Array<[string, PayrollRunStatus, (s: PayrollRunService, org: string) => Promise<unknown>]> = [
    ['calculate', PayrollRunStatus.DRAFT, (s, org) => s.calculate(org, String(RUN), String(new Types.ObjectId()))],
    ['recalculate', PayrollRunStatus.CALCULATED, (s, org) => s.recalculate(org, String(RUN), String(new Types.ObjectId()))],
    ['lock', PayrollRunStatus.CALCULATED, (s, org) => s.lock(org, String(RUN), String(new Types.ObjectId()))],
    ['release', PayrollRunStatus.LOCKED, (s, org) => s.release(org, String(RUN), String(new Types.ObjectId()))],
  ];

  it.each(cases)('%s: foreign tenant gets 404 and nothing is written', async (_name, status, call) => {
    const payrollRunModel = runModel(status);
    const periodModel: any = { findOneAndUpdate: jest.fn() };
    const payslipService: any = { deleteGeneratedForRecalculation: jest.fn(), generateForPayrollRun: jest.fn() };
    const service = new PayrollRunService(
      payrollRunModel as any, {} as any, periodModel, {} as any, {} as any, {} as any, payslipService,
    );

    await expect(call(service, String(ORG_B))).rejects.toThrow(NotFoundException);
    await expect(call(service, String(ORG_B))).rejects.toThrow('PAYROLL_RUN_NOT_FOUND');
    expect(payrollRunModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(periodModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(payslipService.deleteGeneratedForRecalculation).not.toHaveBeenCalled();
    expect(payslipService.generateForPayrollRun).not.toHaveBeenCalled();
  });

  it('an unknown id and a malformed id are also 404', async () => {
    const service = new PayrollRunService(
      runModel(PayrollRunStatus.DRAFT) as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    await expect(service.lock(String(ORG_A), String(new Types.ObjectId()), 'u')).rejects.toThrow(NotFoundException);
    await expect(service.lock(String(ORG_A), 'not-an-id', 'u')).rejects.toThrow(NotFoundException);
  });

  it('the owning tenant still reaches the state check (not blocked by scoping)', async () => {
    const service = new PayrollRunService(
      runModel(PayrollRunStatus.DRAFT) as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    // DRAFT cannot be locked: proves the run was found for ORG_A.
    await expect(service.lock(String(ORG_A), String(RUN), String(new Types.ObjectId())))
      .rejects.toThrow('CANNOT_LOCK_NON_CALCULATED');
  });
});

describe('payslip run endpoints are tenant scoped (AUD-C03)', () => {
  function payslipService(status = PayrollRunStatus.LOCKED) {
    const runs = runModel(status);
    const slips = payslipModel();
    const service = new PayslipService(
      slips as any, runs as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    return { service, runs, slips };
  }

  it('release: foreign tenant is rejected before any payslip or run write', async () => {
    const { service, runs, slips } = payslipService();
    await expect(service.releaseForPayrollRun(String(ORG_B), String(RUN), 'u'))
      .rejects.toThrow(BadRequestException);
    expect(slips.updateMany).not.toHaveBeenCalled();
    expect(runs.updateOne).not.toHaveBeenCalled();
    expect(runs.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('list and summary: foreign tenant gets 404 and payslips are never queried', async () => {
    const { service, slips } = payslipService();
    await expect(service.findByPayrollRun(String(ORG_B), String(RUN))).rejects.toThrow(NotFoundException);
    await expect(service.getSummary(String(ORG_B), String(RUN))).rejects.toThrow(NotFoundException);
    expect(slips.find).not.toHaveBeenCalled();
    expect(slips.aggregate).not.toHaveBeenCalled();
  });

  it('list and summary: payslip queries carry the tenant filter for the owner', async () => {
    const { service, slips } = payslipService();
    slips.find.mockReturnValue({ sort: () => ({ lean: async () => [] }) });
    slips.aggregate.mockResolvedValue([]);
    await service.findByPayrollRun(String(ORG_A), String(RUN));
    await service.getSummary(String(ORG_A), String(RUN));
    expect(String(slips.find.mock.calls[0][0].organizationId)).toBe(String(ORG_A));
    expect(String(slips.aggregate.mock.calls[0][0][0].$match.organizationId)).toBe(String(ORG_A));
  });
});

describe('payroll export is tenant scoped (AUD-C03)', () => {
  function exportService() {
    const runs = runModel(PayrollRunStatus.RELEASED);
    const slips = payslipModel();
    const service = new PayrollExportService(slips as any, runs as any, {} as any, {} as any, {} as any);
    return { service, slips };
  }

  it.each([
    ['csv', (s: PayrollExportService) => s.exportCSV(String(ORG_B), String(RUN))],
    ['summary csv', (s: PayrollExportService) => s.exportSummaryCSV(String(ORG_B), String(RUN))],
    ['excel', (s: PayrollExportService) => s.exportExcel(String(ORG_B), String(RUN))],
  ])('%s: foreign tenant gets 404 and no payslip data is read', async (_n, call) => {
    const { service, slips } = exportService();
    await expect(call(service)).rejects.toThrow(NotFoundException);
    expect(slips.find).not.toHaveBeenCalled();
    expect(slips.aggregate).not.toHaveBeenCalled();
  });
});
