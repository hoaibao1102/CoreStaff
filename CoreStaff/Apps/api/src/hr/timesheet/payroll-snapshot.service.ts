import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { PayrollInputSnapshot, PayrollInputSnapshotDocument } from '../../database/schemas/payroll-input-snapshot.schema';
import { TimesheetSummary, TimesheetSummaryDocument } from '../../database/schemas/timesheet-summary.schema';
import { EmployeeProfile, EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { SalaryProfile, SalaryProfileDocument } from '../../database/schemas/compensation.schema';
import { InsurancePolicy, InsurancePolicyDocument } from '../../database/schemas/insurance-policy.schema';
import { TaxPolicy, TaxPolicyDocument } from '../../database/schemas/tax-policy.schema';
import { EmploymentStatus } from '../../database/schemas/enums';

/**
 * TASK-081/082 / SRS §30C.2 — Generate immutable PayrollInputSnapshots.
 *
 * Runs inside the close-period transaction (TASK-078) after TimesheetSummary is created.
 * Reads from:
 * - TimesheetSummary → work counts, OT minutes, leave days
 * - EmployeeProfile → personal info, dependents
 * - SalaryProfile → base salary
 * - InsurancePolicy → BHXH/BHYT/BHTN rates
 * - TaxPolicy → personal/dependent deductions
 *
 * Creates one PayrollInputSnapshot per employee — immutable data cho payroll calculation.
 */
@Injectable()
export class PayrollSnapshotService {
  constructor(
    @InjectModel('PayrollInputSnapshot')
    private readonly snapshotModel: Model<PayrollInputSnapshotDocument>,
    @InjectModel('TimesheetSummary')
    private readonly summaryModel: Model<TimesheetSummaryDocument>,
    @InjectModel('EmployeeProfile')
    private readonly employeeProfileModel: Model<EmployeeProfileDocument>,
    @InjectModel('SalaryProfile')
    private readonly salaryProfileModel: Model<SalaryProfileDocument>,
    @InjectModel('InsurancePolicy')
    private readonly insurancePolicyModel: Model<InsurancePolicyDocument>,
    @InjectModel('TaxPolicy')
    private readonly taxPolicyModel: Model<TaxPolicyDocument>,
  ) {}

  /**
   * Generate snapshots for all employees in a closed period.
   * Called inside the close-period transaction (TASK-078).
   *
   * @param periodId — The closed TimesheetPeriod id
   * @param periodKey — Period key in 'YYYY-MM' format
   * @param organizationId — Organization id
   * @param session — MongoDB session for atomicity
   * @returns Number of snapshots created
   */
  async generateSnapshots(
    periodId: string,
    periodKey: string,
    organizationId: string,
    session: ClientSession,
  ): Promise<number> {
    return this.generateSnapshotsForDepartment(periodId, periodKey, organizationId, undefined, session);
  }

  /**
   * Generate snapshots for employees in a specific department, or all employees if departmentId is omitted.
   */
  async generateSnapshotsForDepartment(
    periodId: string,
    periodKey: string,
    organizationId: string,
    departmentId: string | undefined,
    session: ClientSession,
  ): Promise<number> {
    // Step 1: Get all summaries for this period (optionally filtered by department)
    const summaryQuery: any = { periodId: new Types.ObjectId(periodId), organizationId: new Types.ObjectId(organizationId) };
    if (departmentId) {
      summaryQuery.departmentId = new Types.ObjectId(departmentId);
    }
    const summaries = await this.summaryModel
      .find(summaryQuery)
      .session(session)
      .lean();

    if (!summaries.length) {
      return 0;
    }

    // Step 2: Get policies effective for this period
    const { insurancePolicy, taxPolicy } = await this.getPolicies(organizationId, periodKey, session);

    // Step 3: Generate snapshot for each employee
    let count = 0;
    for (const summary of summaries) {
      await this.createSnapshotForEmployee(
        periodId,
        periodKey,
        organizationId,
        summary,
        insurancePolicy,
        taxPolicy,
        session,
      );
      count++;
    }

    return count;
  }

  /**
   * Preview snapshots for a department without persisting.
   */
  async previewSnapshotsForDepartment(
    periodId: string,
    periodKey: string,
    organizationId: string,
    summaries: TimesheetSummary[],
  ): Promise<any[]> {
    const { insurancePolicy, taxPolicy } = await this.getPolicies(organizationId, periodKey);
    const results: any[] = [];
    for (const summary of summaries) {
      const snapshot = await this.buildSnapshotForEmployee(
        periodId,
        periodKey,
        organizationId,
        summary,
        insurancePolicy,
        taxPolicy,
      );
      results.push(snapshot);
    }
    return results;
  }

  private async getPolicies(
    organizationId: string,
    periodKey: string,
    session?: ClientSession,
  ): Promise<{ insurancePolicy: any; taxPolicy: any }> {
    const insurancePolicy = await this.insurancePolicyModel
      .findOne({
        organizationId: new Types.ObjectId(organizationId),
        effectiveDate: { $lte: `${periodKey}-01` },
      })
      .sort({ effectiveDate: -1 })
      .session(session ?? null)
      .lean();

    const taxPolicy = await this.taxPolicyModel
      .findOne({
        organizationId: new Types.ObjectId(organizationId),
        effectiveDate: { $lte: `${periodKey}-01` },
      })
      .sort({ effectiveDate: -1 })
      .session(session ?? null)
      .lean();

    return { insurancePolicy, taxPolicy };
  }

  /**
   * Create a single snapshot document for one employee in a period.
   */
  private async createSnapshotForEmployee(
    periodId: string,
    periodKey: string,
    organizationId: string,
    summary: TimesheetSummary,
    insurancePolicy: any,
    taxPolicy: any,
    session: ClientSession,
  ): Promise<void> {
    const snapshotData = await this.buildSnapshotForEmployee(
      periodId,
      periodKey,
      organizationId,
      summary,
      insurancePolicy,
      taxPolicy,
    );
    await this.snapshotModel.findOneAndUpdate(
      { periodId: new Types.ObjectId(periodId), employeeProfileId: new Types.ObjectId(summary.employeeProfileId) },
      { $set: snapshotData },
      { upsert: true, session, new: true },
    );
  }

  /**
   * Build a snapshot object for one employee without persisting it.
   */
  private async buildSnapshotForEmployee(
    periodId: string,
    periodKey: string,
    organizationId: string,
    summary: TimesheetSummary,
    insurancePolicy: any,
    taxPolicy: any,
  ): Promise<any> {
    // Fetch employee profile
    const profile = await this.employeeProfileModel
      .findById(summary.employeeProfileId)
      .lean();

    if (!profile) {
      throw new NotFoundException(`EMPLOYEE_PROFILE_NOT_FOUND: ${summary.employeeProfileId}`);
    }

    // Fetch salary profile
    const salaryProfile = await this.salaryProfileModel
      .findOne({
        employeeProfileId: new Types.ObjectId(summary.employeeProfileId),
        organizationId: new Types.ObjectId(organizationId),
      })
      .lean();

    // Calculate prorated base salary (TASK-087): salary per working day = monthly / 24
    const monthlyBaseSalary = salaryProfile?.baseSalary ?? 0;
    const workingDays = summary.workingDays || 0;
    const proratedBaseSalary = workingDays > 0 ? Math.round((monthlyBaseSalary / 24) * workingDays) : 0;

    // Calculate allowances from SalaryProfile (TASK-088)
    const salaryProfileAllowances = Array.isArray(salaryProfile?.allowances) ? salaryProfile.allowances : [];
    const allowanceBreakdown = salaryProfileAllowances.map((allowance: any) => ({
      type: allowance.allowanceId?.toString?.() ?? allowance.allowanceId ?? 'unknown',
      label: allowance.label ?? '',
      amount: allowance.amount ?? 0,
      taxable: allowance.taxable ?? true,
    }));
    const totalAllowances = allowanceBreakdown.reduce((sum: number, item: any) => sum + item.amount, 0);
    const nonTaxableAllowances = allowanceBreakdown
      .filter((item: any) => !item.taxable)
      .reduce((sum: number, item: any) => sum + item.amount, 0);

    // Calculate attendance bonus (simplified — full logic in TASK-088)
    const attendanceBonus = 0; // TODO: Read from attendance bonus policy

    // Calculate OT pay (simplified — full logic in TASK-089)
    const otWorkingDayRate = 1.5; // 150% for working day OT
    const otWeeklyOffRate = 2.0; // 200% for weekly off OT
    const otPublicHolidayRate = 3.0; // 300% for public holiday OT
    const hourlyRate = workingDays > 0
      ? proratedBaseSalary / (workingDays * 8)
      : monthlyBaseSalary / (24 * 8); // 8 hours/day, fallback to standard month

    const otPay =
      (summary.otWorkingDayMinutes * otWorkingDayRate * hourlyRate) / 60 +
      (summary.otWeeklyOffMinutes * otWeeklyOffRate * hourlyRate) / 60 +
      (summary.otPublicHolidayMinutes * otPublicHolidayRate * hourlyRate) / 60;

    // Split OT into non-taxable (base 100%) and taxable (premium above 100%)
    const otNonTaxableEarnings =
      (summary.otWorkingDayMinutes * hourlyRate) / 60 +
      (summary.otWeeklyOffMinutes * hourlyRate) / 60 +
      (summary.otPublicHolidayMinutes * hourlyRate) / 60;

    const otTaxableEarnings = otPay - otNonTaxableEarnings;

    // Calculate insurance contributions (TASK-090/091/092)
    const socialInsuranceRate = 0.08; // 8% employee BHXH
    const healthInsuranceRate = 0.015; // 1.5% employee BHYT
    const unemploymentInsuranceRate = 0.01; // 1% employee BHTN

    const contributionBase = Math.min(proratedBaseSalary, insurancePolicy?.maxContributionBase ?? 20 * (taxPolicy?.baseSalaryMin ?? 1490000));

    const socialInsurance = Math.round(contributionBase * socialInsuranceRate);
    const healthInsurance = Math.round(contributionBase * healthInsuranceRate);
    const unemploymentInsurance = Math.round(contributionBase * unemploymentInsuranceRate);

    // Calculate dependent deductions (TASK-095)
    const dependents = profile.dependents?.filter(d => d.status === 'ACTIVE') || [];
    const dependentDeductionPerPerson = taxPolicy?.dependentDeduction ?? 4400000; // 2026 rate
    const totalDependentDeductions = dependents.length * dependentDeductionPerPerson;

    // Generate source hash for integrity verification
    const sourceHash = this.generateSourceHash(summary, salaryProfile, insurancePolicy, taxPolicy, dependents.length);

    return {
      periodId: new Types.ObjectId(periodId),
      employeeProfileId: new Types.ObjectId(summary.employeeProfileId),
      userId: summary.userId,
      organizationId: new Types.ObjectId(organizationId),
      departmentId: summary.departmentId ? new Types.ObjectId(summary.departmentId) : undefined,
      periodKey,

      // Earnings inputs
      monthlyBaseSalary,
      proratedBaseSalary,
      totalAllowances,
      attendanceBonus,
      nonTaxableAllowances,
      allowanceBreakdown,
      otMinutesByType: {
        otWorkingDayMinutes: summary.otWorkingDayMinutes,
        otWeeklyOffMinutes: summary.otWeeklyOffMinutes,
        otPublicHolidayMinutes: summary.otPublicHolidayMinutes,
        totalOvertimeMinutes: summary.totalOvertimeMinutes,
      },
      otPay,
      otNonTaxableEarnings: Math.max(0, otNonTaxableEarnings),
      otTaxableEarnings: Math.max(0, otTaxableEarnings),

      // Insurance inputs
      socialInsuranceRate,
      healthInsuranceRate,
      unemploymentInsuranceRate,
      contributionBase,
      socialInsurance,
      healthInsurance,
      unemploymentInsurance,

      // PIT inputs
      taxableEarnings: Math.max(0, proratedBaseSalary + totalAllowances + attendanceBonus + otPay - socialInsurance - healthInsurance - unemploymentInsurance),
      totalDependentDeductions,
      dependentCount: dependents.length,
      taxPolicyVersion: taxPolicy?.version ?? 1,
      legalReference: taxPolicy?.legalReference ?? '',

      // Status & integrity
      status: 'GENERATED',
      version: 1,
      sourceHash,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate a source hash for integrity verification.
   * Combines key input values — if any change, hash will mismatch → trigger re-generation.
   */
  private generateSourceHash(
    summary: TimesheetSummary,
    salaryProfile: any,
    insurancePolicy: any,
    taxPolicy: any,
    dependentCount: number,
  ): string {
    const hashInput = [
      String(summary.periodId),
      String(summary.employeeProfileId),
      String(summary.totalDays),
      String(summary.workingDays),
      String(summary.totalWorkingMinutes),
      String(summary.otWorkingDayMinutes),
      String(summary.otWeeklyOffMinutes),
      String(summary.otPublicHolidayMinutes),
      String(salaryProfile?._id ?? 'none'),
      String(salaryProfile?.baseSalary ?? 0),
      String(insurancePolicy?._id ?? 'none'),
      String(taxPolicy?._id ?? 'none'),
      String(dependentCount),
    ].join('|');

    const crypto = require('crypto');
    return crypto.createHash('md5').update(hashInput).digest('hex').slice(0, 16);
  }

  /**
   * Get a single snapshot by period and employee.
   */
  async findOne(
    periodId: string,
    employeeProfileId: string,
  ): Promise<any> {
    const doc = await this.snapshotModel
      .findOne({
        periodId: new Types.ObjectId(periodId),
        employeeProfileId: new Types.ObjectId(employeeProfileId),
      })
      .lean();

    if (!doc) {
      throw new NotFoundException('PAYROLL_SNAPSHOT_NOT_FOUND');
    }

    return doc;
  }

  /**
   * List all snapshots for a period.
   */
  async findByPeriod(periodId: string): Promise<any[]> {
    return this.snapshotModel
      .find({ periodId: new Types.ObjectId(periodId) })
      .sort({ 'employeeSnapshot.fullName': 1 })
      .lean();
  }

  /**
   * List snapshots for a period filtered by department.
   */
  async findByPeriodAndDepartment(periodId: string, departmentId: string): Promise<any[]> {
    return this.snapshotModel
      .find({
        periodId: new Types.ObjectId(periodId),
        departmentId: new Types.ObjectId(departmentId),
      })
      .sort({ fullName: 1 })
      .lean();
  }

  /**
   * List all snapshots for an employee across periods.
   */
  async findByEmployee(employeeProfileId: string): Promise<any[]> {
    return this.snapshotModel
      .find({ employeeProfileId: new Types.ObjectId(employeeProfileId) })
      .sort({ periodKey: -1 })
      .lean();
  }

  /**
   * Verify source integrity — compare stored hash with current source data.
   */
  async verifyIntegrity(snapshotId: string): Promise<boolean> {
    const snapshot = await this.snapshotModel.findById(snapshotId).lean();
    if (!snapshot) return false;

    // Re-read current source data
    const summary = await this.summaryModel
      .findOne({ _id: snapshot.periodId, employeeProfileId: snapshot.employeeProfileId })
      .lean();

    if (!summary) return false;

    const currentHash = this.generateSourceHash(
      summary as any,
      null, // salaryProfile would need separate fetch
      null, // insurancePolicy would need separate fetch
      null, // taxPolicy would need separate fetch
      snapshot.dependentCount,
    );

    return currentHash === snapshot.sourceHash;
  }
}
