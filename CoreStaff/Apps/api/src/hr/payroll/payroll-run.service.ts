import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PayrollRun, PayrollRunDocument, PayrollRunStatus } from '../../database/schemas/payroll-run.schema';
import { PayrollInputSnapshot, PayrollInputSnapshotDocument } from '../../database/schemas/payroll-input-snapshot.schema';
import { TimesheetPeriod, TimesheetPeriodDocument, TimesheetPeriodStatus } from '../../database/schemas/timesheet-period.schema';
import { EmployeeProfile, EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { InsuranceService } from './insurance.service';
import { PitService } from './pit.service';
import { PayslipService } from './payslip.service';
import {
  buildPayrollRunTransitionCas,
  buildPeriodPayrollClaimCas,
  canonicalPayloadHash,
} from './payroll-artifact-foundation';

/**
 * TASK-085/086/087/088/089 — PayrollRun service.
 * 
 * Manages payroll runs: create, calculate earnings, insurance, OT pay,
 * and generate payslips for all employees in a period.
 */
@Injectable()
export class PayrollRunService {
  constructor(
    @InjectModel('PayrollRun') private readonly payrollRunModel: Model<PayrollRunDocument>,
    @InjectModel('PayrollInputSnapshot') private readonly snapshotModel: Model<PayrollInputSnapshotDocument>,
    @InjectModel('TimesheetPeriod') private readonly periodModel: Model<TimesheetPeriodDocument>,
    @InjectModel('EmployeeProfile') private readonly employeeProfileModel: Model<EmployeeProfileDocument>,
    private readonly insuranceService: InsuranceService,
    private readonly pitService: PitService,
    private readonly payslipService: PayslipService,
  ) {}

  /**
   * Create a new payroll run DRAFT for a closed timesheet period.
   */
  async create(params: {
    organizationId: string;
    timesheetPeriodId: string;
    notes?: string;
    userId: string;
  }): Promise<any> {
    const { organizationId, timesheetPeriodId, notes, userId } = params;

    // Verify period exists and belongs to the organization
    const period = await this.periodModel.findOne({
      _id: new Types.ObjectId(timesheetPeriodId),
      organizationId: new Types.ObjectId(organizationId),
    }).lean();

    if (!period) {
      throw new NotFoundException('PERIOD_NOT_FOUND');
    }

    if (period.status !== TimesheetPeriodStatus.CLOSED) {
      throw new BadRequestException('PAYROLL_REQUIRES_CLOSED_PERIOD');
    }

    const snapshots: any[] = await this.snapshotModel.find({
      organizationId: new Types.ObjectId(organizationId),
      periodId: new Types.ObjectId(timesheetPeriodId),
      sourcePeriodVersion: period.version,
      status: 'GENERATED',
    }).lean();
    if (!snapshots.length || snapshots.some((row) => !row.canonicalPayloadHash)) {
      throw new BadRequestException('NO_PAYROLL_SNAPSHOTS_FOR_PERIOD');
    }

    // Check if payroll run already exists for this period
    const existing = await this.payrollRunModel.findOne({
      organizationId: new Types.ObjectId(organizationId),
      timesheetPeriodId: new Types.ObjectId(timesheetPeriodId),
      active: true,
    }).lean();

    if (existing) {
      throw new BadRequestException('PAYROLL_RUN_ALREADY_EXISTS');
    }

    const orderedSnapshots = [...snapshots].sort((a, b) => String(a._id).localeCompare(String(b._id)));
    const sourceSnapshotIds = orderedSnapshots.map((row) => row._id);
    const sourceSnapshotSetHash = canonicalPayloadHash(
      orderedSnapshots.map((row) => ({ id: String(row._id), hash: row.canonicalPayloadHash })),
    );
    const totalEmployeeCount = orderedSnapshots.length;

    const periodLabel = period.period || `${(period.startDate as Date)?.toISOString().slice(0, 7)}`;

    const runId = new Types.ObjectId();
    const claim = buildPeriodPayrollClaimCas({
      periodId: timesheetPeriodId,
      organizationId,
      expectedPeriodVersion: period.version,
      runId: String(runId),
    });
    const claimed = await this.periodModel.findOneAndUpdate(
      claim.filter,
      claim.update,
      { new: true, runValidators: true },
    );
    if (!claimed) throw new ConflictException('PAYROLL_PERIOD_CLAIM_CONFLICT');

    const runSequence = await this.payrollRunModel.countDocuments({
      organizationId: new Types.ObjectId(organizationId),
      timesheetPeriodId: new Types.ObjectId(timesheetPeriodId),
    }) + 1;
    const payrollRun = await this.payrollRunModel.create({
      _id: runId,
      organizationId: new Types.ObjectId(organizationId),
      timesheetPeriodId: new Types.ObjectId(timesheetPeriodId),
      periodLabel,
      status: PayrollRunStatus.DRAFT,
      runDate: new Date(),
      totalGross: 0,
      totalNet: 0,
      totalEmployerCost: 0,
      processedEmployeeCount: 0,
      totalEmployeeCount,
      schemaVersion: 1,
      sourcePeriodVersion: period.version,
      sourceSnapshotIds,
      sourceSnapshotSetHash,
      runSequence,
      notes,
      version: 1,
      active: true,
    });

    return this.toResponse(payrollRun.toObject());
  }

  /**
   * List payroll runs for an organization.
   */
  async findAll(organizationId: string): Promise<any[]> {
    const runs = await this.payrollRunModel
      .find({ organizationId: new Types.ObjectId(organizationId), active: true })
      .sort({ runDate: -1 })
      .lean();
    return Promise.all(runs.map((run) => this.withEligibleEmployeeCount(run)));
  }

  /**
   * Get a single payroll run by id.
   */
  async findOne(organizationId: string, id: string): Promise<any> {
    const doc = await this.payrollRunModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      active: true,
    }).lean();

    if (!doc) throw new NotFoundException('PAYROLL_RUN_NOT_FOUND');
    return this.toResponse(await this.withEligibleEmployeeCount(doc));
  }

  /** Keep legacy payroll runs from displaying HR-only accounts in their headcount. */
  private async withEligibleEmployeeCount(run: any): Promise<any> {
    const userModel = this.employeeProfileModel.db.model('User');
    const hrUsers = await userModel.find({
      organizationId: run.organizationId,
      role: 'HR',
    }).select('_id').lean();
    const hrProfiles = hrUsers.length
      ? await this.employeeProfileModel.find({
          organizationId: run.organizationId,
          userId: { $in: hrUsers.map((user: any) => user._id) },
        }).select('_id').lean()
      : [];
    const totalEmployeeCount = await this.snapshotModel.countDocuments({
      organizationId: run.organizationId,
      periodId: run.timesheetPeriodId,
      employeeProfileId: { $nin: hrProfiles.map((profile: any) => profile._id) },
    });
    return { ...run, totalEmployeeCount };
  }

  /**
   * Calculate payroll for all employees in a payroll run.
   * This is the core calculation step that reads from PayrollInputSnapshots.
   */
  async calculate(payrollRunId: string, userId: string): Promise<{
    payrollRun: any;
    employeesProcessed: number;
    totalGross: number;
    totalNet: number;
  }> {
    const payrollRun = await this.findOneRaw(payrollRunId);

    if (!payrollRun) {
      throw new NotFoundException('PAYROLL_RUN_NOT_FOUND');
    }

    if (payrollRun.status !== PayrollRunStatus.DRAFT) {
      throw new BadRequestException('CANNOT_CALCULATE_NON_DRAFT');
    }

    const snapshots = await this.snapshotModel
      .find({
        _id: { $in: payrollRun.sourceSnapshotIds },
        organizationId: payrollRun.organizationId,
        periodId: payrollRun.timesheetPeriodId,
        sourcePeriodVersion: payrollRun.sourcePeriodVersion,
      })
      .lean();

    if (!snapshots.length || snapshots.length !== payrollRun.sourceSnapshotIds.length) {
      throw new BadRequestException('BOUND_SNAPSHOT_SET_INCOMPLETE');
    }
    const orderedSnapshots = [...snapshots].sort((a, b) => String(a._id).localeCompare(String(b._id)));
    const actualSetHash = canonicalPayloadHash(
      orderedSnapshots.map((row: any) => ({ id: String(row._id), hash: row.canonicalPayloadHash })),
    );
    if (actualSetHash !== payrollRun.sourceSnapshotSetHash) {
      throw new BadRequestException('BOUND_SNAPSHOT_SET_HASH_MISMATCH');
    }

    // Get insurance policy for calculations
    const insurancePolicy = await this.insuranceService.getEffectivePolicy(
      String(payrollRun.organizationId)
    );

    let totalGross = 0;
    let totalNet = 0;
    let processedCount = 0;

    // Process each employee
    for (const snapshot of orderedSnapshots) {
      const result = await this.calculateEmployee(snapshot, insurancePolicy, String(payrollRun.organizationId));
      totalGross += result.grossEarnings;
      totalNet += result.netSalary;
      processedCount++;
    }
    let payslipCount: number;
    try {
      payslipCount = await this.payslipService.generateForPayrollRun(payrollRunId);
    } catch (error) {
      await this.payslipService.deleteGeneratedForRecalculation(payrollRunId);
      throw error;
    }
    if (processedCount !== orderedSnapshots.length || payslipCount !== orderedSnapshots.length) {
      await this.payslipService.deleteGeneratedForRecalculation(payrollRunId);
      throw new Error('PAYROLL_OUTPUT_RECONCILIATION_FAILED');
    }
    const transition = buildPayrollRunTransitionCas({
      runId: payrollRunId,
      organizationId: String(payrollRun.organizationId),
      expectedStatus: PayrollRunStatus.DRAFT,
      expectedVersion: payrollRun.version,
      nextStatus: PayrollRunStatus.CALCULATED,
      at: new Date(),
    });
    transition.update.$set.totalGross = totalGross;
    transition.update.$set.totalNet = totalNet;
    transition.update.$set.processedEmployeeCount = processedCount;
    const published = await this.payrollRunModel.findOneAndUpdate(
      transition.filter,
      transition.update,
      { new: true },
    );
    if (!published) {
      await this.payslipService.deleteGeneratedForRecalculation(payrollRunId);
      throw new ConflictException('PAYROLL_RUN_CAS_CONFLICT');
    }
    const periodUpdated = await this.periodModel.findOneAndUpdate(
      {
        _id: payrollRun.timesheetPeriodId,
        payrollRunId: payrollRun._id,
        payrollState: PayrollRunStatus.DRAFT,
        payrollSourceVersion: payrollRun.sourcePeriodVersion,
      },
      { $set: { payrollState: PayrollRunStatus.CALCULATED } },
      { new: true },
    );
    if (!periodUpdated) throw new ConflictException('PAYROLL_PERIOD_CAS_CONFLICT');

    return {
      payrollRun: await this.findOneRaw(payrollRunId),
      employeesProcessed: processedCount,
      totalGross,
      totalNet,
    };
  }

  /**
   * Recalculate an unpublished run from its frozen payroll input snapshots.
   * Locked and released runs remain immutable.
   */
  async recalculate(payrollRunId: string, userId: string): Promise<{
    payrollRun: any;
    employeesProcessed: number;
    totalGross: number;
    totalNet: number;
  }> {
    const payrollRun = await this.findOneRaw(payrollRunId);

    if (!payrollRun) {
      throw new NotFoundException('PAYROLL_RUN_NOT_FOUND');
    }
    if (payrollRun.status !== PayrollRunStatus.CALCULATED) {
      throw new BadRequestException('CANNOT_RECALCULATE_NON_CALCULATED');
    }

    await this.payslipService.deleteGeneratedForRecalculation(payrollRunId);
    const cas = buildPayrollRunTransitionCas({
      runId: payrollRunId,
      organizationId: String(payrollRun.organizationId),
      expectedStatus: PayrollRunStatus.CALCULATED,
      expectedVersion: payrollRun.version,
      nextStatus: PayrollRunStatus.DRAFT,
      at: new Date(),
    });
    Object.assign(cas.update.$set, {
      totalGross: 0, totalNet: 0, totalEmployerCost: 0, processedEmployeeCount: 0,
    });
    const reset = await this.payrollRunModel.findOneAndUpdate(cas.filter, cas.update, { new: true });
    if (!reset) throw new ConflictException('PAYROLL_RUN_CAS_CONFLICT');
    await this.periodModel.findOneAndUpdate(
      { _id: payrollRun.timesheetPeriodId, payrollRunId: payrollRun._id, payrollState: PayrollRunStatus.CALCULATED },
      { $set: { payrollState: PayrollRunStatus.DRAFT } },
      { new: true },
    );

    return this.calculate(payrollRunId, userId);
  }


  /**
   * Lock a calculated payroll run (immutable).
   */
  async lock(payrollRunId: string, userId: string): Promise<any> {
    const payrollRun = await this.findOneRaw(payrollRunId);

    if (!payrollRun) {
      throw new NotFoundException('PAYROLL_RUN_NOT_FOUND');
    }

    if (payrollRun.status !== PayrollRunStatus.CALCULATED) {
      throw new BadRequestException('CANNOT_LOCK_NON_CALCULATED');
    }

    const cas = buildPayrollRunTransitionCas({ runId: payrollRunId, organizationId: String(payrollRun.organizationId), expectedStatus: PayrollRunStatus.CALCULATED, expectedVersion: payrollRun.version, nextStatus: PayrollRunStatus.LOCKED, at: new Date() });
    cas.update.$set.lockedBy = new Types.ObjectId(userId);
    cas.update.$set.lockedAt = new Date();
    const locked = await this.payrollRunModel.findOneAndUpdate(cas.filter, cas.update, { new: true });

    if (!locked) throw new NotFoundException('PAYROLL_RUN_NOT_FOUND');
    const periodUpdated = await this.periodModel.findOneAndUpdate(
      { _id: payrollRun.timesheetPeriodId, payrollRunId: payrollRun._id, payrollState: PayrollRunStatus.CALCULATED },
      { $set: { payrollState: PayrollRunStatus.LOCKED } },
      { new: true },
    );
    if (!periodUpdated) throw new ConflictException('PAYROLL_PERIOD_CAS_CONFLICT');
    return this.toResponse(locked.toObject());
  }

  /**
   * Release a locked payroll run (send payslips to employees).
   */
  async release(payrollRunId: string, userId: string): Promise<any> {
    const payrollRun = await this.findOneRaw(payrollRunId);

    if (!payrollRun) {
      throw new NotFoundException('PAYROLL_RUN_NOT_FOUND');
    }

    if (payrollRun.status !== PayrollRunStatus.LOCKED) {
      throw new BadRequestException('CANNOT_RELEASE_NON_LOCKED');
    }

    const cas = buildPayrollRunTransitionCas({ runId: payrollRunId, organizationId: String(payrollRun.organizationId), expectedStatus: PayrollRunStatus.LOCKED, expectedVersion: payrollRun.version, nextStatus: PayrollRunStatus.RELEASED, at: new Date() });
    const released = await this.payrollRunModel.findOneAndUpdate(cas.filter, cas.update, { new: true });

    // TODO: Send notifications to employees
    // await this.notificationService.sendPayslipNotifications(payrollRunId);

    if (!released) throw new NotFoundException('PAYROLL_RUN_NOT_FOUND');
    const periodUpdated = await this.periodModel.findOneAndUpdate(
      { _id: payrollRun.timesheetPeriodId, payrollRunId: payrollRun._id, payrollState: PayrollRunStatus.LOCKED },
      { $set: { payrollState: PayrollRunStatus.RELEASED } },
      { new: true },
    );
    if (!periodUpdated) throw new ConflictException('PAYROLL_PERIOD_CAS_CONFLICT');
    return this.toResponse(released.toObject());
  }

  /**
   * Calculate a single employee's payroll from their snapshot.
   */
  private async calculateEmployee(
    snapshot: any,
    insurancePolicy: any,
    organizationId: string
  ): Promise<{
    grossEarnings: number;
    taxableIncome: number;
    taxableEarnings: number;
    socialInsurance: number;
    healthInsurance: number;
    unemploymentInsurance: number;
    personalDeduction: number;
    dependentDeduction: number;
    pitAmount: number;
    netSalary: number;
  }> {
    // Gross earnings = proratedBaseSalary + allowances + attendanceBonus + kpiBonus + otPay
    const grossEarnings =
      snapshot.proratedBaseSalary +
      snapshot.totalAllowances +
      snapshot.attendanceBonus +
      (snapshot.kpiBonus || 0) +
      snapshot.otPay; // Tổng OT nhận (đã bao gồm cả phần chịu thuế và không chịu thuế)

    // Insurance contributions (from snapshot or recalculate)
    const socialInsurance = snapshot.socialInsurance || 0;
    const healthInsurance = snapshot.healthInsurance || 0;
    const unemploymentInsurance = snapshot.unemploymentInsurance || 0;
    const totalInsurance = socialInsurance + healthInsurance + unemploymentInsurance;

    // ── PIT Calculation ──
    // Truyền GROSS ĐẦY ĐỦ + cờ OT để PIT tự loại trừ — giống hệt đường tính
    // trong payslip.service.
    const pitResult = await this.pitService.calculateFullPIT({
      grossEarnings,
      insuranceContributions: totalInsurance,
      employeeProfileId: snapshot.employeeProfileId,
      organizationId,
      otPay: snapshot.otPay || 0,
      overtimeTaxable: snapshot.overtimeTaxable === true,
      nonTaxableAllowances: snapshot.nonTaxableAllowances || 0,
    });

    // Net salary = gross (có đầy đủ OT non-taxable + taxable) - insurance - PIT
    const netSalary = grossEarnings - totalInsurance - pitResult.pitAmount;

    return {
      grossEarnings,
      taxableIncome: pitResult.taxableIncome,
      taxableEarnings: pitResult.taxableEarnings,
      socialInsurance,
      healthInsurance,
      unemploymentInsurance,
      personalDeduction: pitResult.personalDeduction,
      dependentDeduction: pitResult.dependentDeduction,
      pitAmount: pitResult.pitAmount,
      netSalary,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async findOneRaw(id: string): Promise<any> {
    return this.payrollRunModel.findById(new Types.ObjectId(id)).lean();
  }

  private toResponse(doc: any): any {
    return {
      ...doc,
      _id: doc._id?.toString() || doc._id,
      organizationId: doc.organizationId?.toString() || doc.organizationId,
      timesheetPeriodId: doc.timesheetPeriodId?.toString() || doc.timesheetPeriodId,
    };
  }
}
