import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PayrollRun, PayrollRunDocument, PayrollRunStatus } from '../../database/schemas/payroll-run.schema';
import { PayrollInputSnapshot, PayrollInputSnapshotDocument } from '../../database/schemas/payroll-input-snapshot.schema';
import { TimesheetPeriod, TimesheetPeriodDocument, TimesheetPeriodStatus } from '../../database/schemas/timesheet-period.schema';
import { EmployeeProfile, EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { InsuranceService } from './insurance.service';
import { PitService } from './pit.service';
import { PayslipService } from './payslip.service';

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

    // ponytail: manager-snapshot closing is optional; HR can close the period directly.
    // Auto-close the period if it is ready, otherwise accept an already closed period.
    if (period.status === TimesheetPeriodStatus.READY_TO_CLOSE) {
      await this.periodModel.findByIdAndUpdate(
        timesheetPeriodId,
        {
          $set: {
            status: TimesheetPeriodStatus.CLOSED,
            closedBy: userId,
            closedAt: new Date(),
          },
        },
        { new: true, runValidators: true },
      );
    } else if (period.status !== TimesheetPeriodStatus.CLOSED) {
      throw new BadRequestException('Kỳ công chưa sẵn sàng — cần ở trạng thái READY_TO_CLOSE hoặc CLOSED.');
    }

    // Defensive: ensure snapshots exist for the period
    const snapshotCount = await this.snapshotModel.countDocuments({
      organizationId: new Types.ObjectId(organizationId),
      periodId: new Types.ObjectId(timesheetPeriodId),
    });

    if (snapshotCount === 0) {
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

    // Get total employee count from snapshots
    const totalEmployeeCount = await this.snapshotModel.countDocuments({
      organizationId: new Types.ObjectId(organizationId),
      periodId: new Types.ObjectId(timesheetPeriodId),
    });

    const periodLabel = period.period || `${(period.startDate as Date)?.toISOString().slice(0, 7)}`;

    const payrollRun = await this.payrollRunModel.create({
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
    return this.payrollRunModel
      .find({ organizationId: new Types.ObjectId(organizationId), active: true })
      .sort({ runDate: -1 })
      .lean();
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
    return this.toResponse(doc);
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

    // Get snapshots for this payroll run's period
    const snapshots = await this.snapshotModel
      .find({
        periodId: payrollRun.timesheetPeriodId,
        organizationId: payrollRun.organizationId,
      })
      .lean();

    if (!snapshots.length) {
      throw new BadRequestException('NO_SNAPSHOTS_FOUND');
    }

    // Get insurance policy for calculations
    const insurancePolicy = await this.insuranceService.getEffectivePolicy(
      String(payrollRun.organizationId)
    );

    let totalGross = 0;
    let totalNet = 0;
    let processedCount = 0;

    // Process each employee
    for (const snapshot of snapshots) {
      try {
        const result = await this.calculateEmployee(
          snapshot,
          insurancePolicy,
          String(payrollRun.organizationId)
        );

        totalGross += result.grossEarnings;
        totalNet += result.netSalary;
        processedCount++;
      } catch (error) {
        // Log error but continue processing other employees
        console.error(`Failed to calculate for employee ${snapshot.employeeProfileId}:`, error);
      }
    }

    // Update payroll run totals
    await this.payrollRunModel.findByIdAndUpdate(payrollRunId, {
      $set: {
        status: PayrollRunStatus.CALCULATED,
        totalGross,
        totalNet,
        processedEmployeeCount: processedCount,
        version: payrollRun.version + 1,
      },
    });

    // Generate payslips for all employees after calculation
    try {
      const payslipCount = await this.payslipService.generateForPayrollRun(payrollRunId);
      console.log(`✅ Generated ${payslipCount} payslips for payroll run ${payrollRunId}`);
    } catch (error) {
      console.error('Failed to generate payslips:', error);
      // Don't throw — payroll run is already CALCULATED, payslips can be generated later
    }

    return {
      payrollRun: await this.findOneRaw(payrollRunId),
      employeesProcessed: processedCount,
      totalGross,
      totalNet,
    };
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

    const locked = await this.payrollRunModel.findByIdAndUpdate(
      payrollRunId,
      {
        $set: {
          status: PayrollRunStatus.LOCKED,
          lockedBy: new Types.ObjectId(userId),
          lockedAt: new Date(),
          version: payrollRun.version + 1,
        },
      },
      { new: true }
    );

    if (!locked) throw new NotFoundException('PAYROLL_RUN_NOT_FOUND');
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

    const released = await this.payrollRunModel.findByIdAndUpdate(
      payrollRunId,
      {
        $set: {
          status: PayrollRunStatus.RELEASED,
          version: payrollRun.version + 1,
        },
      },
      { new: true }
    );

    // TODO: Send notifications to employees
    // await this.notificationService.sendPayslipNotifications(payrollRunId);

    if (!released) throw new NotFoundException('PAYROLL_RUN_NOT_FOUND');
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
    taxableEarnings: number;
    socialInsurance: number;
    healthInsurance: number;
    unemploymentInsurance: number;
    personalDeduction: number;
    dependentDeduction: number;
    pitAmount: number;
    netSalary: number;
  }> {
    // Gross earnings = proratedBaseSalary + allowances + attendanceBonus + TOTAL_OT (otPay = otNonTaxable + otTaxable)
    const grossEarnings =
      snapshot.proratedBaseSalary +
      snapshot.totalAllowances +
      snapshot.attendanceBonus +
      snapshot.otPay; // Tổng OT nhận (đã bao gồm cả phần chịu thuế và không chịu thuế)

    // Insurance contributions (from snapshot or recalculate)
    const socialInsurance = snapshot.socialInsurance || 0;
    const healthInsurance = snapshot.healthInsurance || 0;
    const unemploymentInsurance = snapshot.unemploymentInsurance || 0;
    const totalInsurance = socialInsurance + healthInsurance + unemploymentInsurance;

    // ── PIT Calculation — chỉ đưa OT CHỊU THUẾ vào taxable earnings ──
    // Theo luật thuế Việt Nam:
    // - OT không chịu thuế = hệ số 1.0 (tiền cơ bản) → KHÔNG đưa vào PIT base
    // - OT chịu thuế = hệ số 0.5 (tiền hệ số cộng thêm) → ĐƯA VÀO PIT base
    const otTaxableEarnings = snapshot.otTaxableEarnings || 0;
    const otNonTaxableEarnings = snapshot.otNonTaxableEarnings || 0;
    
    // Taxable income cho PIT = base + allowances + bonus + otTaxable
    const taxableIncomeForPIT = 
      snapshot.proratedBaseSalary + 
      snapshot.totalAllowances + 
      snapshot.attendanceBonus + 
      otTaxableEarnings;

    const pitResult = await this.pitService.calculateFullPIT({
      grossEarnings: taxableIncomeForPIT,
      insuranceContributions: totalInsurance,
      employeeProfileId: snapshot.employeeProfileId,
      organizationId,
      otNonTaxableEarnings,  // ✅ Truyền OT không chịu thuế
      nonTaxableAllowances: 0,  // TODO: Thêm field này vào snapshot nếu có phụ cấp miễn thuế
    });

    // Net salary = gross (có đầy đủ OT non-taxable + taxable) - insurance - PIT
    const netSalary = grossEarnings - totalInsurance - pitResult.pitAmount;

    return {
      grossEarnings,
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
