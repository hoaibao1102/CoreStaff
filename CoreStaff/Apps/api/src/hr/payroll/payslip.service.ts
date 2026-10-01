import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payslip, PayslipDocument, PayslipStatus } from '../../database/schemas/payslip.schema';
import { PayrollRun, PayrollRunDocument, PayrollRunStatus } from '../../database/schemas/payroll-run.schema';
import { PayrollInputSnapshot, PayrollInputSnapshotDocument } from '../../database/schemas/payroll-input-snapshot.schema';
import { EmployeeProfile, EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { TaxPolicy, TaxPolicyDocument } from '../../database/schemas/tax-policy.schema';
import { InsuranceService } from './insurance.service';
import { PitService } from './pit.service';

type EarningItem = { type: string; label: string; amount: number; taxable: boolean };

export function buildPayslipEarnings(snapshot: any): {
  grossEarnings: number;
  earningBreakdown: EarningItem[];
  allowanceBreakdown: EarningItem[];
} {
  const allowanceBreakdown: EarningItem[] = Array.isArray(snapshot.allowanceBreakdown)
    ? snapshot.allowanceBreakdown.map((item: any) => ({
        type: item.type,
        label: item.label || item.type,
        amount: item.amount || 0,
        taxable: item.taxable !== false,
      }))
    : [];
  const totalAllowances = allowanceBreakdown.length
    ? allowanceBreakdown.reduce((sum, item) => sum + item.amount, 0)
    : snapshot.totalAllowances || 0;
  const earningBreakdown: EarningItem[] = [
    { type: 'BASE_SALARY', label: 'Lương cơ bản theo công', amount: snapshot.proratedBaseSalary || 0, taxable: true },
    ...(totalAllowances > 0 ? [{ type: 'ALLOWANCE', label: 'Tổng phụ cấp', amount: totalAllowances, taxable: true }] : []),
    ...(snapshot.attendanceBonus > 0 ? [{ type: 'ATTENDANCE_BONUS', label: 'Thưởng chuyên cần', amount: snapshot.attendanceBonus, taxable: true }] : []),
    ...(snapshot.kpiBonus > 0 ? [{ type: 'KPI_BONUS', label: 'Thưởng KPI', amount: snapshot.kpiBonus, taxable: true }] : []),
    ...(snapshot.otPay > 0 ? [{ type: 'OVERTIME', label: 'Tiền làm thêm giờ', amount: snapshot.otPay, taxable: false }] : []),
  ];
  return {
    grossEarnings: earningBreakdown.reduce((sum, item) => sum + item.amount, 0),
    earningBreakdown,
    allowanceBreakdown,
  };
}

/**
 * TASK-098/099 — Payslip generation, release, and self-view service.
 * 
 * Generates payslips when payroll run is calculated, releases them to employees,
 * and provides employee self-service view.
 */
@Injectable()
export class PayslipService {
  constructor(
    @InjectModel('Payslip') private readonly payslipModel: Model<PayslipDocument>,
    @InjectModel('PayrollRun') private readonly payrollRunModel: Model<PayrollRunDocument>,
    @InjectModel('PayrollInputSnapshot') private readonly snapshotModel: Model<PayrollInputSnapshotDocument>,
    @InjectModel('EmployeeProfile') private readonly employeeProfileModel: Model<EmployeeProfileDocument>,
    @InjectModel('TaxPolicy') private readonly taxPolicyModel: Model<TaxPolicyDocument>,
    private readonly insuranceService: InsuranceService,
    private readonly pitService: PitService,
  ) {}

  /**
   * Remove only unpublished payslips before recalculating a payroll run.
   * A released or viewed payslip is immutable and blocks recalculation.
   */
  async deleteGeneratedForRecalculation(payrollRunId: string): Promise<number> {
    const runObjectId = new Types.ObjectId(payrollRunId);
    const immutablePayslipExists = await this.payslipModel.exists({
      payrollRunId: runObjectId,
      status: { $ne: PayslipStatus.GENERATED },
    });

    if (immutablePayslipExists) {
      throw new BadRequestException('CANNOT_RECALCULATE_RELEASED_PAYSLIPS');
    }

    const result = await this.payslipModel.deleteMany({
      payrollRunId: runObjectId,
      status: PayslipStatus.GENERATED,
    });
    return result.deletedCount;
  }

  /**
   * Generate payslips for all employees in a payroll run.
   * Called automatically when payroll run status changes to CALCULATED.
   */
  async generateForPayrollRun(payrollRunId: string): Promise<number> {
    try {
      const payrollRun = await this.payrollRunModel.findOne({
        _id: new Types.ObjectId(payrollRunId),
        status: PayrollRunStatus.CALCULATED,
      }).lean();

      if (!payrollRun) {
        throw new BadRequestException('PAYROLL_RUN_NOT_FOUND_OR_NOT_CALCULATED');
      }

      // Get snapshots for this period
      const snapshots = await this.snapshotModel
        .find({
          periodId: payrollRun.timesheetPeriodId,
          organizationId: payrollRun.organizationId,
        })
        .lean();

      let count = 0;
      for (const snapshot of snapshots) {
        await this.createPayslipForEmployee(
          payrollRunId,
          snapshot
        );
        count++;
      }

      return count;
    } catch (error) {
      console.error('Failed to generate payslips:', error);
      throw error;
    }
  }

  /**
   * Create a single payslip document for an employee.
   */
  private async createPayslipForEmployee(
    payrollRunId: string,
    snapshot: any
  ): Promise<void> {
    // Get employee profile for name and dependents
    const profile = await this.employeeProfileModel
      .findById(snapshot.employeeProfileId)
      .lean();

    if (!profile) {
      throw new NotFoundException(`EMPLOYEE_PROFILE_NOT_FOUND: ${snapshot.employeeProfileId}`);
    }

    // Get active dependents snapshot
    const dependents = (profile.dependents || [])
      .filter((d: any) => d.status === 'ACTIVE' || !d.status)
      .map((d: any) => ({
        fullName: d.fullName,
        relationship: d.relationship,
        birthDate: d.dateOfBirth,
      }));

    // Populate user info for employee name (fullName lives on User, not EmployeeProfile)
    const user = await this.employeeProfileModel.db
      .collection('users')
      .findOne({ _id: new Types.ObjectId(String(profile.userId)) });
    const employeeName = user?.fullName || profile.employeeCode || 'Unknown';

    // Calculate PIT for this employee
    // ── PIT Calculation ──────────────────────────────────────────────
    // Theo luật thuế Việt Nam:
    // Step 1: Gross Earnings = TẤT CẢ thu nhập (có cả OT non-taxable + taxable)
    // Step 2: Taxable Gross = Gross - OT_nonTaxable - NonTaxableAllowances
    // Step 3: Taxable Earnings = Taxable Gross - Insurance - Deductions
    
    const earnings = buildPayslipEarnings(snapshot);
    const grossEarnings = earnings.grossEarnings;

    const totalInsurance =
      snapshot.socialInsurance +
      snapshot.healthInsurance +
      snapshot.unemploymentInsurance;

    const otTaxableEarnings = snapshot.otTaxableEarnings || 0;
    const otNonTaxableEarnings = snapshot.otNonTaxableEarnings || 0;
    const nonTaxableAllowances = snapshot.nonTaxableAllowances || 0;
    
    // ✅ Truyền grossEarnings ĐẦY ĐỦ vào calculateFullPIT
    // Bên trong calculateTaxableEarnings sẽ tự trừ otNonTaxable + nonTaxableAllowances
    const pitResult = await this.pitService.calculateFullPIT({
      grossEarnings: grossEarnings,           // ✅ Tổng thu nhập đầy đủ
      insuranceContributions: totalInsurance,
      employeeProfileId: snapshot.employeeProfileId,
      organizationId: String(snapshot.organizationId),
      otNonTaxableEarnings,                   // ✅ Sẽ được trừ trong calculateTaxableEarnings
      nonTaxableAllowances,                   // ✅ Sẽ được trừ trong calculateTaxableEarnings
    });

    // Net salary = gross (có đầy đủ OT non-taxable + taxable) - insurance - PIT
    const netSalary = grossEarnings - totalInsurance - pitResult.pitAmount;

    // Reconciliation check
    const calculatedNet = grossEarnings - totalInsurance - pitResult.pitAmount;
    const variance = Math.abs(calculatedNet - netSalary);
    if (variance > 1) {
      console.warn(`Reconciliation variance for ${snapshot.employeeProfileId}: ${variance} VND`);
    }

    const { earningBreakdown, allowanceBreakdown } = earnings;

    // Build OT breakdown (chi tiết làm thêm giờ theo luật thuế)
    // ✅ LOGIC ĐÚNG: 1 tháng = 192 giờ chuẩn, phút → giờ trước khi tính
    const otBreakdown = snapshot.otMinutesByType ? (() => {
      const hourlyRate = snapshot.proratedBaseSalary / 192; // Tiền công 1 giờ (chuẩn 192h/tháng)
      const otMinutes = snapshot.otMinutesByType;
      
      // Đổi phút → giờ cho tất cả các loại OT
      const workingDayHours = (otMinutes.otWorkingDayMinutes || 0) / 60;
      const weeklyOffHours = (otMinutes.otWeeklyOffMinutes || 0) / 60;
      const publicHolidayHours = (otMinutes.otPublicHolidayMinutes || 0) / 60;
      const totalHours = (otMinutes.totalOvertimeMinutes || 0) / 60;
      
      const otNonTaxable = snapshot.otNonTaxableEarnings || 0;
      const otTaxable = snapshot.otTaxableEarnings || 0;
      
      return {
        totalMinutes: otMinutes.totalOvertimeMinutes || 0,
        totalHours: totalHours,
        workingDayMinutes: otMinutes.otWorkingDayMinutes || 0,
        workingDayHours: workingDayHours,
        weeklyOffMinutes: otMinutes.otWeeklyOffMinutes || 0,
        weeklyOffHours: weeklyOffHours,
        publicHolidayMinutes: otMinutes.otPublicHolidayMinutes || 0,
        publicHolidayHours: publicHolidayHours,
        hourlyRate: Math.round(hourlyRate),
        otNonTaxable,
        otTaxable,
        otPay: snapshot.otPay,
        breakdown: [
          ...(otMinutes.otWorkingDayMinutes > 0 ? [{
            type: 'WORKING_DAY',
            label: 'Ngày thường (hệ số 1.5)',
            minutes: otMinutes.otWorkingDayMinutes,
            hours: workingDayHours,
            coefficient: 1.5,
            amount: Math.round(workingDayHours * hourlyRate * 1.5),
            nonTaxable: Math.round(workingDayHours * hourlyRate * 1.0),
            taxable: Math.round(workingDayHours * hourlyRate * 0.5),
          }] : []),
          ...(otMinutes.otWeeklyOffMinutes > 0 ? [{
            type: 'WEEKLY_OFF',
            label: 'Cuối tuần (hệ số 2.0)',
            minutes: otMinutes.otWeeklyOffMinutes,
            hours: weeklyOffHours,
            coefficient: 2.0,
            amount: Math.round(weeklyOffHours * hourlyRate * 2.0),
            nonTaxable: Math.round(weeklyOffHours * hourlyRate * 1.0),
            taxable: Math.round(weeklyOffHours * hourlyRate * 1.0),
          }] : []),
          ...(otMinutes.otPublicHolidayMinutes > 0 ? [{
            type: 'PUBLIC_HOLIDAY',
            label: 'Lễ, Tết (hệ số 3.0)',
            minutes: otMinutes.otPublicHolidayMinutes,
            hours: publicHolidayHours,
            coefficient: 3.0,
            amount: Math.round(publicHolidayHours * hourlyRate * 3.0),
            nonTaxable: Math.round(publicHolidayHours * hourlyRate * 1.0),
            taxable: Math.round(publicHolidayHours * hourlyRate * 2.0),
          }] : []),
        ],
      };
    })() : null;

    // Build deduction breakdown
    const deductionBreakdown = [
      ...(snapshot.socialInsurance > 0 ? [{ type: 'SOCIAL_INSURANCE', label: `BHXH (${InsuranceService.SOCIAL_INSURANCE_RATE * 100}%)`, amount: snapshot.socialInsurance }] : []),
      ...(snapshot.healthInsurance > 0 ? [{ type: 'HEALTH_INSURANCE', label: `BHYT (${InsuranceService.HEALTH_INSURANCE_RATE * 100}%)`, amount: snapshot.healthInsurance }] : []),
      ...(snapshot.unemploymentInsurance > 0 ? [{ type: 'UNEMPLOYMENT_INSURANCE', label: `BHTN (${InsuranceService.UNEMPLOYMENT_INSURANCE_RATE * 100}%)`, amount: snapshot.unemploymentInsurance }] : []),
      ...(pitResult.pitAmount > 0 ? [{ type: 'PIT', label: 'Thuế TNCN', amount: pitResult.pitAmount }] : []),
    ];

    // PIT breakdown (chi tiết tính thuế theo bậc)
    const pitBreakdown = pitResult.breakdown || [];

    // Create payslip document
    await this.payslipModel.create({
      payrollRunId: new Types.ObjectId(payrollRunId),
      organizationId: new Types.ObjectId(snapshot.organizationId),
      employeeProfileId: new Types.ObjectId(snapshot.employeeProfileId),
      employeeName: employeeName || 'Unknown',
      employeeCode: profile.employeeCode,
      taxCode: profile.taxCode,
      periodLabel: (await this.payrollRunModel.findById(payrollRunId).lean())?.periodLabel || '',
      
      // Earnings
      grossEarnings,
      taxableEarnings: pitResult.taxableEarnings,
      
      // Insurance — calculated on contributionBase (not baseSalary)
      contributionBase: snapshot.contributionBase,
      socialInsuranceRate: snapshot.socialInsuranceRate,
      healthInsuranceRate: snapshot.healthInsuranceRate,
      unemploymentInsuranceRate: snapshot.unemploymentInsuranceRate,
      socialInsurance: snapshot.socialInsurance,
      healthInsurance: snapshot.healthInsurance,
      unemploymentInsurance: snapshot.unemploymentInsurance,
      
      // PIT
      personalDeduction: pitResult.personalDeduction,
      dependentDeduction: pitResult.dependentDeduction,
      pitAmount: pitResult.pitAmount,
      
      // Other deductions
      otherDeductions: 0,
      
      // Net
      netSalary,
      
      // Breakdowns — chi tiết thu nhập
      earningBreakdown,
      allowanceBreakdown,
      otBreakdown,
      deductionBreakdown,
      pitBreakdown,
      
      // Dependents snapshot
      dependents,
      
      // Status
      status: PayslipStatus.GENERATED,
      generatedAt: new Date(),
    });
  }

  /**
   * Release payslips for a payroll run (send to employees).
   */
  async releaseForPayrollRun(payrollRunId: string, userId: string): Promise<void> {
    const payrollRun = await this.payrollRunModel.findOne({
      _id: new Types.ObjectId(payrollRunId),
      status: PayrollRunStatus.LOCKED,
    });

    if (!payrollRun) {
      throw new BadRequestException('PAYROLL_RUN_NOT_FOUND_OR_NOT_LOCKED');
    }

    // Update all payslips to RELEASED
    await this.payslipModel.updateMany(
      { payrollRunId: new Types.ObjectId(payrollRunId) },
      { $set: { status: PayslipStatus.RELEASED, releasedAt: new Date() } }
    );

    // Update payroll run status
    await this.payrollRunModel.findByIdAndUpdate(payrollRunId, {
      $set: { status: PayrollRunStatus.RELEASED },
    });
  }

  /**
   * Get employee's own payslips (self-service).
   * FIX: Allow both GENERATED and RELEASED status so employees can see their payslips immediately.
   */
  async getMyPayslips(employeeProfileId: string, organizationId: string, filters?: {
    periodLabel?: string;
    status?: string;
  }): Promise<any[]> {
    const filter: Record<string, unknown> = {
      employeeProfileId: new Types.ObjectId(employeeProfileId),
      organizationId: new Types.ObjectId(organizationId),
    };

    // Only filter by specific status if provided in filters
    if (filters?.status) {
      filter.status = filters.status;
    } else {
      // Default: show both GENERATED and RELEASED payslips
      filter.status = { $in: [PayslipStatus.GENERATED, PayslipStatus.RELEASED, PayslipStatus.VIEWED] };
    }

    if (filters?.periodLabel) {
      filter.periodLabel = filters.periodLabel;
    }

    return this.payslipModel
      .find(filter)
      .sort({ periodLabel: -1 })
      .lean();
  }

  /**
   * Get employee's own single payslip detail (self-service).
   * FIX: Allow both GENERATED and RELEASED status.
   */
  async getMyPayslip(payslipId: string, employeeProfileId: string): Promise<any> {
    const doc = await this.payslipModel.findOne({
      _id: new Types.ObjectId(payslipId),
      employeeProfileId: new Types.ObjectId(employeeProfileId),
      status: { $in: [PayslipStatus.GENERATED, PayslipStatus.RELEASED, PayslipStatus.VIEWED] },
    }).lean();

    if (!doc) {
      throw new NotFoundException('PAYSLIP_NOT_FOUND_OR_NOT_ACCESSIBLE');
    }

    return doc;
  }

  /**
   * Mark a payslip as viewed by employee.
   * Returns silently if already viewed (FE-friendly, no 404).
   */
  async markAsViewed(payslipId: string, employeeProfileId: string): Promise<void> {
    const payslip = await this.payslipModel.findOne({
      _id: new Types.ObjectId(payslipId),
      employeeProfileId: new Types.ObjectId(employeeProfileId),
      status: { $in: [PayslipStatus.GENERATED, PayslipStatus.RELEASED] },
    });

    // If already viewed or not found, just return silently (204 behavior)
    if (!payslip || payslip.status === PayslipStatus.VIEWED) {
      return;
    }

    await this.payslipModel.findByIdAndUpdate(payslipId, {
      $set: { status: PayslipStatus.VIEWED, viewedAt: new Date() },
    });
  }

  /**
   * Get a single payslip detail (for HR preview).
   */
  async findOne(payslipId: string, organizationId: string): Promise<any> {
    const doc = await this.payslipModel.findOne({
      _id: new Types.ObjectId(payslipId),
      organizationId: new Types.ObjectId(organizationId),
    }).lean();

    if (!doc) throw new NotFoundException('PAYSLIP_NOT_FOUND');
    return doc;
  }

  /**
   * Get payslips summary for payroll run dashboard.
   */
  async getSummary(payrollRunId: string): Promise<{
    total: number;
    generated: number;
    released: number;
    viewed: number;
    draft: number;
  }> {
    const counts = await this.payslipModel.aggregate([
      { $match: { payrollRunId: new Types.ObjectId(payrollRunId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = {
      total: 0,
      generated: 0,
      released: 0,
      viewed: 0,
      draft: 0,
    };

    for (const item of counts) {
      summary.total += item.count;
      switch (item._id) {
        case PayslipStatus.GENERATED:
          summary.generated = item.count;
          break;
        case PayslipStatus.RELEASED:
          summary.released = item.count;
          break;
        case PayslipStatus.VIEWED:
          summary.viewed = item.count;
          break;
        case PayslipStatus.DRAFT:
          summary.draft = item.count;
          break;
      }
    }

    return summary;
  }

  /**
   * List all payslips for a payroll run (HR view).
   */
  async findByPayrollRun(payrollRunId: string): Promise<any[]> {
    return this.payslipModel
      .find({ payrollRunId: new Types.ObjectId(payrollRunId) })
      .sort({ employeeName: 1 })
      .lean();
  }

  /**
   * Lookup EmployeeProfile by userId — used by employee self-service endpoints.
   * FIX: Use employmentStatus (not status which doesn't exist in schema).
   * Returns null if no active profile found.
   */
  async findEmployeeProfileByUserId(userId: any): Promise<any> {
    try {
      // Handle both string and ObjectId types
      const userIdObj = userId instanceof Types.ObjectId ? userId : new Types.ObjectId(String(userId));
      
      // FIX: Use employmentStatus instead of non-existent status field
      const profile = await this.employeeProfileModel.findOne({
        userId: userIdObj,
        employmentStatus: 'ACTIVE',
      }).lean();
      
      return profile;
    } catch (error) {
      console.error('[ERROR] Failed to lookup profile:', error.message);
      return null;
    }
  }
}
