import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PayrollRunStatus } from '../../database/schemas/payroll-run.schema';
import { TimesheetPeriodStatus } from '../../database/schemas/timesheet-period.schema';
import { PayrollRunService } from './payroll-run.service';
import { canonicalPayloadHash } from './payroll-artifact-foundation';

const oid = () => new Types.ObjectId().toString();

function query<T>(value: T) {
  return { lean: jest.fn().mockResolvedValue(value), session: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis() };
}

function createRunService(overrides: Record<string, any> = {}) {
  const organizationId = oid();
  const periodId = oid();
  const runId = oid();
  const snapshotIds = [oid(), oid()];
  const period = { _id: periodId, organizationId, status: TimesheetPeriodStatus.CLOSED, version: 4, period: '2026-10' };
  const snapshots = snapshotIds.map((id, index) => ({
    _id: id,
    organizationId,
    periodId,
    employeeProfileId: oid(),
    sourcePeriodVersion: 4,
    canonicalPayloadHash: `hash-${index}`,
    status: 'GENERATED',
    proratedBaseSalary: 10,
    totalAllowances: 0,
    attendanceBonus: 0,
    kpiBonus: 0,
    otPay: 0,
    socialInsurance: 0,
    healthInsurance: 0,
    unemploymentInsurance: 0,
  }));
  const createdRun: any = {
    _id: runId, organizationId, timesheetPeriodId: periodId, status: PayrollRunStatus.DRAFT,
    version: 1, sourcePeriodVersion: 4, sourceSnapshotIds: snapshotIds,
    sourceSnapshotSetHash: canonicalPayloadHash(
      [...snapshots]
        .sort((a, b) => String(a._id).localeCompare(String(b._id)))
        .map((row) => ({ id: String(row._id), hash: row.canonicalPayloadHash })),
    ),
    totalEmployeeCount: 2,
    toObject() { return this; },
  };
  const payrollRunModel: any = {
    findOne: jest.fn().mockImplementation((filter) => query(filter._id ? createdRun : null)),
    findById: jest.fn().mockImplementation(() => query(createdRun)),
    create: jest.fn().mockResolvedValue(createdRun),
    findOneAndUpdate: jest.fn().mockResolvedValue({ ...createdRun, status: PayrollRunStatus.CALCULATED, toObject() { return this; } }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    countDocuments: jest.fn().mockResolvedValue(0),
  };
  const snapshotModel: any = {
    find: jest.fn().mockImplementation(() => query(snapshots)),
    countDocuments: jest.fn().mockResolvedValue(2),
  };
  const periodModel: any = {
    findOne: jest.fn().mockImplementation(() => query(period)),
    findOneAndUpdate: jest.fn().mockResolvedValue(period),
  };
  const payslipService: any = {
    generateForPayrollRun: jest.fn().mockResolvedValue(2),
    deleteGeneratedForRecalculation: jest.fn().mockResolvedValue(2),
  };
  const pitService: any = { calculateFullPIT: jest.fn().mockResolvedValue({ pitAmount: 0, taxableIncome: 0, taxableEarnings: 0, personalDeduction: 0, dependentDeduction: 0 }) };
  const service = new PayrollRunService(
    payrollRunModel, snapshotModel, periodModel, { db: { model: jest.fn() } } as any,
    { getEffectivePolicy: jest.fn().mockResolvedValue({}) } as any, pitService, payslipService,
  );
  Object.assign({ payrollRunModel, snapshotModel, periodModel, payslipService }, overrides);
  return { service, payrollRunModel, snapshotModel, periodModel, payslipService, organizationId, periodId, runId, snapshots, createdRun };
}

describe('PayrollRunService append-only lineage integration', () => {
  it('creates only from CLOSED and binds the exact current-version snapshot IDs/hash', async () => {
    const f = createRunService();
    const result = await f.service.create({ organizationId: f.organizationId, timesheetPeriodId: f.periodId, userId: oid() });
    expect(f.payrollRunModel.create).toHaveBeenCalledWith(expect.objectContaining({
      sourcePeriodVersion: 4,
      sourceSnapshotIds: f.snapshots.map((row: any) => row._id),
      sourceSnapshotSetHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      totalEmployeeCount: 2,
    }));
    expect(f.periodModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: TimesheetPeriodStatus.CLOSED, version: 4, payrollRunId: { $exists: false } }),
      expect.any(Object),
      expect.objectContaining({ new: true }),
    );
    expect(result.sourcePeriodVersion).toBe(4);
  });

  it('rejects READY_TO_CLOSE without mutating the period', async () => {
    const f = createRunService();
    f.periodModel.findOne.mockImplementation(() => query({ _id: f.periodId, status: TimesheetPeriodStatus.READY_TO_CLOSE, version: 4 }));
    await expect(f.service.create({ organizationId: f.organizationId, timesheetPeriodId: f.periodId, userId: oid() }))
      .rejects.toEqual(new BadRequestException('PAYROLL_REQUIRES_CLOSED_PERIOD'));
    expect(f.periodModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('fails calculation on one employee error and never publishes CALCULATED or payslips', async () => {
    const f = createRunService();
    (f.service as any).calculateEmployee = jest.fn().mockResolvedValueOnce({ grossEarnings: 10, netSalary: 10 }).mockRejectedValueOnce(new Error('EMPLOYEE_FAILED'));
    await expect(f.service.calculate(f.runId, oid())).rejects.toThrow('EMPLOYEE_FAILED');
    expect(f.payslipService.generateForPayrollRun).not.toHaveBeenCalled();
    expect(f.payrollRunModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not publish CALCULATED when payslip count does not reconcile', async () => {
    const f = createRunService();
    f.payslipService.generateForPayrollRun.mockResolvedValue(1);
    await expect(f.service.calculate(f.runId, oid())).rejects.toThrow('PAYROLL_OUTPUT_RECONCILIATION_FAILED');
    expect(f.payrollRunModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(f.payslipService.deleteGeneratedForRecalculation).toHaveBeenCalledWith(f.runId);
  });

  it('publishes CALCULATED through a version/status CAS only after all outputs reconcile', async () => {
    const f = createRunService();
    const result = await f.service.calculate(f.runId, oid());
    expect(f.payrollRunModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: f.runId, status: PayrollRunStatus.DRAFT, version: 1 }),
      expect.objectContaining({ $set: expect.objectContaining({ status: PayrollRunStatus.CALCULATED, processedEmployeeCount: 2 }) }),
      expect.objectContaining({ new: true }),
    );
    expect(result.employeesProcessed).toBe(2);
  });
});
