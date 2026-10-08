import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { TimesheetSummary, TimesheetSummaryDocument } from '../../database/schemas/timesheet-summary.schema';
import { AttendanceDay } from '../../database/schemas/attendance-day.schema';
import { OvertimeResult } from '../../database/schemas/overtime-result.schema';
import { EmployeeProfile } from '../../database/schemas/employee-profile.schema';
import { EmployeeAssignment, EmployeeAssignmentDocument } from '../../database/schemas/assignment.schema';
import { User } from '../../database/schemas/user.schema';
import { DayResult, Role, WorkdayType } from '../../database/schemas/enums';
import { OvertimeType } from '../policies/policies-domain';

/**
 * TASK-077 / SRS §7.4 — Aggregate attendance & overtime data into immutable summaries.
 *
 * Runs when HR closes a timesheet period (TASK-078). Reads from:
 * - `attendance_days` → work count, minutes, leave days
 * - `overtime_results` → approved OT minutes by type
 *
 * Creates one TimesheetSummary per (period, employee) combination.
 * Immutable after creation — re-generation creates a new version.
 */
@Injectable()
export class TimesheetSummaryService {
  constructor(
    @InjectModel('TimesheetSummary')
    private readonly summaryModel: Model<TimesheetSummaryDocument>,
    @InjectModel('AttendanceDay')
    private readonly attendanceDayModel: Model<AttendanceDay>,
    @InjectModel('OvertimeResult')
    private readonly overtimeResultModel: Model<OvertimeResult>,
    @InjectModel('EmployeeProfile')
    private readonly employeeProfileModel: Model<EmployeeProfile>,
    @InjectModel('User')
    private readonly userModel: Model<User>,
    @InjectModel('EmployeeAssignment')
    private readonly employeeAssignmentModel: Model<EmployeeAssignmentDocument>,
  ) {}

  /**
   * Generate summaries for all employees in a closed period.
   * Called inside the close-period transaction (TASK-078).
   *
   * @param periodId — The closed TimesheetPeriod id
   * @param periodKey — Period key in 'YYYY-MM' format
   * @param session — MongoDB session for atomicity
   * @returns Number of summaries created
   */
  async generateSummaries(
    periodId: string,
    periodKey: string,
    organizationId: string,
    session: ClientSession,
  ): Promise<number> {
    return this.generateSummariesForDepartment(periodId, periodKey, organizationId, undefined, session);
  }

  /**
   * Generate summaries for employees in a specific department, or all employees if departmentId is omitted.
   */
  async generateSummariesForDepartment(
    periodId: string,
    periodKey: string,
    organizationId: string,
    departmentId: string | undefined,
    session: ClientSession,
  ): Promise<number> {
    const year = parseInt(periodKey.slice(0, 4));
    const month = parseInt(periodKey.slice(5, 7));
    const totalDays = new Date(year, month, 0).getDate();

    // Step 1: Get all attendance days for this period
    const attendanceDays = await this.attendanceDayModel
      .find({ organizationId: new Types.ObjectId(organizationId), periodId: new Types.ObjectId(periodId) }, { _id: 1, employeeId: 1, workDate: 1, workdayType: 1, dayResult: 1, attendanceStatus: 1, checkInAt: 1, checkOutAt: 1, workingMinutes: 1, lateMinutes: 1, earlyMinutes: 1 })
      .session(session)
      .lean();

    // Step 2: Group by employee
    const employeeDaysMap = new Map<string, AttendanceDay[]>();
    for (const day of attendanceDays) {
      const empId = String(day.employeeId);
      if (!employeeDaysMap.has(empId)) {
        employeeDaysMap.set(empId, []);
      }
      employeeDaysMap.get(empId)!.push(day);
    }

    // Step 3: Get overtime results for this period
    const overtimeResults = await this.overtimeResultModel
      .find(
        {
          organizationId: new Types.ObjectId(organizationId),
          periodKey,
          classificationStatus: 'FINAL', // Only approved/finalized OT
        },
        { _id: 1, employeeId: 1, eligibleMinutes: 1, overtimeType: 1 },
      )
      .session(session)
      .lean();

    // Group OT by employee
    const employeeOtMap = new Map<string, Array<{ eligibleMinutes: number; overtimeType: string }>>();
    for (const ot of overtimeResults) {
      const empId = String(ot.employeeId);
      if (!employeeOtMap.has(empId)) {
        employeeOtMap.set(empId, []);
      }
      employeeOtMap.get(empId)!.push({
        eligibleMinutes: ot.eligibleMinutes,
        overtimeType: ot.overtimeType,
      });
    }

    // Step 4: Resolve the complete employee population. Summaries are payroll
    // inputs, so an active employee must not disappear merely because no
    // AttendanceDay was generated (or an older day missed periodId).
    let allowedEmployeeIds: Set<string>;
    if (departmentId) {
      const profileUserIds = await this.resolveDepartmentEmployeeIds(
        organizationId,
        departmentId,
      );
      allowedEmployeeIds = new Set(profileUserIds);
    } else {
      const activeProfiles = await this.employeeProfileModel
        .find({
          organizationId: new Types.ObjectId(organizationId),
          employmentStatus: { $in: ['ACTIVE', 'PROBATION'] },
        }, { userId: 1 })
        .session(session)
        .lean();
      allowedEmployeeIds = new Set(await this.excludeHrUsers(
        activeProfiles.map((profile) => String(profile.userId)),
        session,
      ));
    }

    // Re-generation also repairs legacy periods that were created before HR
    // accounts were excluded from the attendance/payroll population.
    await this.summaryModel.deleteMany({
      periodId: new Types.ObjectId(periodId),
      organizationId: new Types.ObjectId(organizationId),
      userId: { $nin: [...allowedEmployeeIds].map((id) => new Types.ObjectId(id)) },
    }).session(session);

    // Step 5: Generate one summary for every eligible employee. Empty
    // attendance is represented by a zero-valued summary, not by omission.
    let count = 0;
    for (const employeeId of allowedEmployeeIds) {
      await this.createSummaryForEmployee(
        periodId,
        periodKey,
        organizationId,
        employeeId,
        totalDays,
        employeeDaysMap.get(employeeId) ?? [],
        employeeOtMap.get(employeeId) ?? [],
        session,
      );
      count++;
    }

    return count;
  }

  /**
   * Preview summaries for employees in a specific department without persisting.
   */
  async previewSummariesForDepartment(
    periodId: string,
    periodKey: string,
    organizationId: string,
    departmentId?: string,
  ): Promise<any[]> {
    const year = parseInt(periodKey.slice(0, 4));
    const month = parseInt(periodKey.slice(5, 7));
    const totalDays = new Date(year, month, 0).getDate();

    const attendanceDays = await this.attendanceDayModel
      .find({ organizationId: new Types.ObjectId(organizationId), periodId: new Types.ObjectId(periodId) }, { _id: 1, employeeId: 1, workDate: 1, workdayType: 1, dayResult: 1, attendanceStatus: 1, checkInAt: 1, checkOutAt: 1, workingMinutes: 1, lateMinutes: 1, earlyMinutes: 1 })
      .lean();

    const employeeDaysMap = new Map<string, AttendanceDay[]>();
    for (const day of attendanceDays) {
      const empId = String(day.employeeId);
      if (!employeeDaysMap.has(empId)) {
        employeeDaysMap.set(empId, []);
      }
      employeeDaysMap.get(empId)!.push(day);
    }

    const overtimeResults = await this.overtimeResultModel
      .find(
        {
          organizationId: new Types.ObjectId(organizationId),
          classificationStatus: 'FINAL',
        },
        { _id: 1, employeeId: 1, eligibleMinutes: 1, overtimeType: 1 },
      )
      .lean();

    const employeeOtMap = new Map<string, Array<{ eligibleMinutes: number; overtimeType: string }>>();
    for (const ot of overtimeResults) {
      const empId = String(ot.employeeId);
      if (!employeeOtMap.has(empId)) {
        employeeOtMap.set(empId, []);
      }
      employeeOtMap.get(empId)!.push({
        eligibleMinutes: ot.eligibleMinutes,
        overtimeType: ot.overtimeType,
      });
    }

    let allowedEmployeeIds: Set<string>;
    if (departmentId) {
      allowedEmployeeIds = new Set(await this.resolveDepartmentEmployeeIds(organizationId, departmentId));
    } else {
      const activeProfiles = await this.employeeProfileModel
        .find({
          organizationId: new Types.ObjectId(organizationId),
          employmentStatus: { $in: ['ACTIVE', 'PROBATION'] },
        }, { userId: 1 })
        .lean();
      allowedEmployeeIds = new Set(await this.excludeHrUsers(
        activeProfiles.map((profile) => String(profile.userId)),
      ));
    }

    const results: any[] = [];
    for (const employeeId of allowedEmployeeIds) {
      const summary = await this.buildSummaryForEmployee(
        periodId,
        periodKey,
        organizationId,
        employeeId,
        totalDays,
        employeeDaysMap.get(employeeId) ?? [],
        employeeOtMap.get(employeeId) ?? [],
      );
      results.push(summary);
    }

    return results;
  }

  /**
   * Build a summary object for one employee without persisting it.
   */
  private async buildSummaryForEmployee(
    periodId: string,
    periodKey: string,
    organizationId: string,
    employeeId: string,
    totalDays: number,
    days: AttendanceDay[],
    overtimeRecords: Array<{ eligibleMinutes: number; overtimeType: string }>,
    session?: ClientSession,
  ): Promise<any> {
    const agg = this.aggregateWorkCounts(days);
    const otAgg = this.aggregateOvertimeMinutes(overtimeRecords);
    const leaveBreakdown = this.calculateLeaveBreakdown(days);
    const employeeData = await this.fetchEmployeeSnapshot(employeeId, organizationId, session);
    const sourceHash = this.generateSourceHash(days, overtimeRecords);

    return {
      periodId: new Types.ObjectId(periodId),
      employeeProfileId: new Types.ObjectId(employeeData.profileId),
      userId: new Types.ObjectId(employeeId),
      organizationId: new Types.ObjectId(organizationId),
      departmentId: employeeData.departmentId ? new Types.ObjectId(employeeData.departmentId) : undefined,
      departmentName: employeeData.departmentName,
      employeeCode: employeeData.employeeCode,
      fullName: employeeData.fullName,
      periodKey,

      // Work count
      totalDays,
      workingDays: agg.workingDays,
      paidLeaveDays: agg.paidLeaveDays,
      unpaidLeaveDays: agg.unpaidLeaveDays,
      holidayDays: agg.holidayDays,
      absentDays: agg.absentDays,
      presentDays: agg.presentDays,
      incompleteDays: agg.incompleteDays,

      // Minutes
      totalWorkingMinutes: agg.totalWorkingMinutes,
      totalLateMinutes: agg.totalLateMinutes,
      totalEarlyMinutes: agg.totalEarlyMinutes,

      // Overtime (by type)
      otWorkingDayMinutes: otAgg.otWorkingDayMinutes,
      otWeeklyOffMinutes: otAgg.otWeeklyOffMinutes,
      otPublicHolidayMinutes: otAgg.otPublicHolidayMinutes,
      totalOvertimeMinutes: otAgg.totalOvertimeMinutes,

      // Leave breakdown
      sickLeaveDays: leaveBreakdown.sickLeaveDays,
      personalLeaveDays: leaveBreakdown.personalLeaveDays,
      annualLeaveDays: leaveBreakdown.annualLeaveDays,
      otherPaidLeaveDays: leaveBreakdown.otherPaidLeaveDays,
      otherUnpaidLeaveDays: leaveBreakdown.otherUnpaidLeaveDays,

      // Integrity
      sourceHash,
      version: 1,
      generatedAt: new Date(),
    };
  }

  /**
   * Create a single summary document for one employee in a period.
   */
  private async createSummaryForEmployee(
    periodId: string,
    periodKey: string,
    organizationId: string,
    employeeId: string,
    totalDays: number,
    days: AttendanceDay[],
    overtimeRecords: Array<{ eligibleMinutes: number; overtimeType: string }>,
    session: ClientSession,
  ): Promise<void> {
    const summaryData = await this.buildSummaryForEmployee(
      periodId, periodKey, organizationId, employeeId, totalDays, days, overtimeRecords, session,
    );
    await this.summaryModel.findOneAndUpdate(
      { periodId: new Types.ObjectId(periodId), employeeProfileId: new Types.ObjectId(summaryData.employeeProfileId) },
      { $set: summaryData },
      { upsert: true, session, new: true },
    );
  }

  /**
   * Aggregate work counts from attendance days.
   */
  private aggregateWorkCounts(days: AttendanceDay[]): {
    workingDays: number;
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    holidayDays: number;
    absentDays: number;
    presentDays: number;
    incompleteDays: number;
    totalWorkingMinutes: number;
    totalLateMinutes: number;
    totalEarlyMinutes: number;
  } {
    let workingDays = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let holidayDays = 0;
    let absentDays = 0;
    let presentDays = 0;
    let incompleteDays = 0;
    let totalWorkingMinutes = 0;
    let totalLateMinutes = 0;
    let totalEarlyMinutes = 0;

    for (const day of days) {
      // Count by workdayType
      if (day.workdayType === WorkdayType.WORKING_DAY) {
        workingDays++;
      } else if (day.workdayType === WorkdayType.PAID_LEAVE) {
        workingDays++;
        paidLeaveDays++;
      } else if (day.workdayType === WorkdayType.UNPAID_LEAVE) {
        workingDays++;
        unpaidLeaveDays++;
      } else if (day.workdayType === WorkdayType.PUBLIC_HOLIDAY || day.workdayType === WorkdayType.WEEKLY_OFF) {
        holidayDays++;
      }

      // Count actual attendance independently from the calendar obligation.
      // A public holiday with no punches is a valid day off, not incomplete;
      // a public holiday with completed punches is actual work (and its OT is
      // classified separately by OvertimeResult).
      const hasCheckIn = Boolean(day.checkInAt);
      const hasCheckOut = Boolean(day.checkOutAt);
      // Punches are the source of truth. Older approved adjustments may still
      // carry a stale INCOMPLETE dayResult even though both timestamps exist.
      if (hasCheckIn && hasCheckOut) {
        presentDays++;
      } else if (hasCheckIn || hasCheckOut || day.dayResult === DayResult.INCOMPLETE) {
        incompleteDays++;
      } else if (day.dayResult === DayResult.PRESENT || day.attendanceStatus === 'COMPLETED') {
        presentDays++;
      } else if (day.dayResult === DayResult.ABSENT) {
        absentDays++;
      }

      // Accumulate minutes
      totalWorkingMinutes += day.workingMinutes ?? 0;
      totalLateMinutes += day.lateMinutes ?? 0;
      totalEarlyMinutes += day.earlyMinutes ?? 0;
    }

    return {
      workingDays,
      paidLeaveDays,
      unpaidLeaveDays,
      holidayDays,
      absentDays,
      presentDays,
      incompleteDays,
      totalWorkingMinutes,
      totalLateMinutes,
      totalEarlyMinutes,
    };
  }

  /**
   * Aggregate overtime minutes by type from approved overtime results.
   */
  private aggregateOvertimeMinutes(overtimeRecords: Array<{ eligibleMinutes: number; overtimeType: string }>): {
    otWorkingDayMinutes: number;
    otWeeklyOffMinutes: number;
    otPublicHolidayMinutes: number;
    totalOvertimeMinutes: number;
  } {
    let otWorkingDayMinutes = 0;
    let otWeeklyOffMinutes = 0;
    let otPublicHolidayMinutes = 0;

    for (const record of overtimeRecords) {
      switch (record.overtimeType) {
        case OvertimeType.WORKING_DAY:
          otWorkingDayMinutes += record.eligibleMinutes;
          break;
        case OvertimeType.WEEKLY_OFF:
          otWeeklyOffMinutes += record.eligibleMinutes;
          break;
        case OvertimeType.PUBLIC_HOLIDAY:
          otPublicHolidayMinutes += record.eligibleMinutes;
          break;
      }
    }

    const totalOvertimeMinutes = otWorkingDayMinutes + otWeeklyOffMinutes + otPublicHolidayMinutes;

    return {
      otWorkingDayMinutes,
      otWeeklyOffMinutes,
      otPublicHolidayMinutes,
      totalOvertimeMinutes,
    };
  }

  /**
   * Calculate leave days breakdown from attendance days.
   * Maps dayResult values to specific leave types.
   */
  private calculateLeaveBreakdown(days: AttendanceDay[]): {
    sickLeaveDays: number;
    personalLeaveDays: number;
    annualLeaveDays: number;
    otherPaidLeaveDays: number;
    otherUnpaidLeaveDays: number;
  } {
    // Note: In a full implementation, this would join with leave_requests
    // to determine the specific leave type. For now, we count by workdayType.
    let sickLeaveDays = 0;
    let personalLeaveDays = 0;
    let annualLeaveDays = 0;
    let otherPaidLeaveDays = 0;
    let otherUnpaidLeaveDays = 0;

    for (const day of days) {
      if (day.workdayType === WorkdayType.PAID_LEAVE) {
        // Default: count as other paid leave
        // TODO: Enhance with leave_request join for specific type
        otherPaidLeaveDays++;
      } else if (day.workdayType === WorkdayType.UNPAID_LEAVE) {
        otherUnpaidLeaveDays++;
      }
    }

    return {
      sickLeaveDays,
      personalLeaveDays,
      annualLeaveDays,
      otherPaidLeaveDays,
      otherUnpaidLeaveDays,
    };
  }

  /**
   * Fetch employee snapshot data (name, code, department) frozen at summary time.
   */
  private async fetchEmployeeSnapshot(
    userId: string,
    organizationId: string,
    session?: ClientSession,
  ): Promise<{
    profileId: string;
    employeeCode?: string;
    fullName?: string;
    departmentId?: string;
    departmentName?: string;
  }> {
    // Find employee profile linked to this user
    const profileQuery = this.employeeProfileModel
      .findOne({ userId: new Types.ObjectId(userId), organizationId: new Types.ObjectId(organizationId) });
    const profile = session ? await profileQuery.session(session).lean() : await profileQuery.lean();

    if (!profile) {
      // Fallback: use user data directly
      const userQuery = this.userModel.findById(new Types.ObjectId(userId));
      const user = session ? await userQuery.session(session).lean() : await userQuery.lean();

      return {
        profileId: userId,
        fullName: user?.fullName,
      };
    }

    // Get full name from the linked User record
    const userQuery = this.userModel.findById(profile.userId);
    const user = session ? await userQuery.session(session).lean() : await userQuery.lean();

    // Get department name from employeeSnapshot on any attendance day
    let departmentName: string | undefined;
    const sampleDayQuery = this.attendanceDayModel.findOne({ employeeId: new Types.ObjectId(userId) });
    const sampleDay = session ? await sampleDayQuery.session(session).lean() : await sampleDayQuery.lean();
    if (sampleDay?.employeeSnapshot?.departmentName) {
      departmentName = sampleDay.employeeSnapshot.departmentName;
    }

    return {
      profileId: String(profile._id),
      employeeCode: profile.employeeCode,
      fullName: user?.fullName,
      departmentId: profile.departmentId ? String(profile.departmentId) : undefined,
      departmentName,
    };
  }

  /**
   * Generate a source hash for integrity verification.
   * Combines counts of attendance days and overtime records.
   * If source data changes, hash will mismatch → trigger re-aggregation.
   */
  private generateSourceHash(
    days: AttendanceDay[],
    overtimeRecords: Array<{ eligibleMinutes: number; overtimeType: string }>,
  ): string {
    // Simple hash: combine counts and sums
    const dayCount = days.length;
    const daySums = days.reduce(
      (acc, day) => ({
        working: acc.working + (day.workingMinutes ?? 0),
        late: acc.late + (day.lateMinutes ?? 0),
        early: acc.early + (day.earlyMinutes ?? 0),
      }),
      { working: 0, late: 0, early: 0 },
    );
    const otCount = overtimeRecords.length;
    const otTotal = overtimeRecords.reduce((sum, r) => sum + r.eligibleMinutes, 0);

    const hashInput = `${dayCount}-${daySums.working}-${daySums.late}-${daySums.early}-${otCount}-${otTotal}`;

    // Use Node.js crypto for a real hash
    const crypto = require('crypto');
    return crypto.createHash('md5').update(hashInput).digest('hex').slice(0, 16);
  }

  /**
   * Resolve userIds belonging to a department from profile + active assignments.
   */
  private async resolveDepartmentEmployeeIds(
    organizationId: string,
    departmentId: string,
  ): Promise<string[]> {
    const objectOrgId = new Types.ObjectId(organizationId);
    const objectDeptId = new Types.ObjectId(departmentId);

    const [activeAssignments, profiles] = await Promise.all([
      this.employeeAssignmentModel
        ?.find({
          organizationId: objectOrgId,
          departmentId: objectDeptId,
          active: true,
        })
        .lean() ?? Promise.resolve([]),
      this.employeeProfileModel
        .find({
          organizationId: objectOrgId,
          departmentId: objectDeptId,
        }, { userId: 1 })
        .lean(),
    ]);

    const assignedUserIds = (activeAssignments as any[]).map(a => String(a.userId));
    const profileUserIds = profiles.map(p => String(p.userId));

    return this.excludeHrUsers([...new Set([...assignedUserIds, ...profileUserIds])]);
  }

  private async excludeHrUsers(userIds: string[], session?: ClientSession): Promise<string[]> {
    if (!userIds.length) return [];
    const query = this.userModel.find({
      _id: { $in: userIds.map((id) => new Types.ObjectId(id)) },
      role: { $ne: Role.HR },
    }, { _id: 1 });
    const users = session ? await query.session(session).lean() : await query.lean();
    return users.map((user) => String(user._id));
  }

  /**
   * Get a single summary by period and employee.
   */
  async findOne(
    periodId: string,
    employeeProfileId: string,
  ): Promise<any> {
    const doc = await this.summaryModel
      .findOne({
        periodId: new Types.ObjectId(periodId),
        employeeProfileId: new Types.ObjectId(employeeProfileId),
      })
      .lean();

    if (!doc) {
      throw new NotFoundException('TIMESHEET_SUMMARY_NOT_FOUND');
    }

    return doc;
  }

  /**
   * List all summaries for a period.
   */
  async findByPeriod(periodId: string): Promise<any[]> {
    const summaries = await this.summaryModel
      .find({ periodId: new Types.ObjectId(periodId) })
      .sort({ 'employeeSnapshot.fullName': 1 })
      .lean();
    const eligibleUserIds = new Set(await this.excludeHrUsers(summaries.map((row: any) => String(row.userId))));
    return summaries.filter((row: any) => eligibleUserIds.has(String(row.userId)));
  }

  /**
   * List summaries for a period filtered by department.
   */
  async findByPeriodAndDepartment(periodId: string, departmentId: string): Promise<any[]> {
    return this.summaryModel
      .find({
        periodId: new Types.ObjectId(periodId),
        departmentId: new Types.ObjectId(departmentId),
      })
      .sort({ fullName: 1 })
      .lean();
  }

  /**
   * List all summaries for an employee across periods.
   */
  async findByEmployee(employeeProfileId: string): Promise<any[]> {
    return this.summaryModel
      .find({ employeeProfileId: new Types.ObjectId(employeeProfileId) })
      .sort({ periodKey: -1 })
      .lean();
  }

  /**
   * Check if summary exists for a period and employee.
   */
  async exists(periodId: string, employeeProfileId: string): Promise<boolean> {
    const count = await this.summaryModel.countDocuments({
      periodId: new Types.ObjectId(periodId),
      employeeProfileId: new Types.ObjectId(employeeProfileId),
    });
    return count > 0;
  }

  /**
   * Verify source integrity — compare stored hash with current source data.
   * Returns true if data is unchanged since summary generation.
   */
  async verifyIntegrity(summaryId: string): Promise<boolean> {
    const summary = await this.summaryModel.findById(summaryId).lean();
    if (!summary) return false;

    // Re-read current source data
    const days = await this.attendanceDayModel
      .find({ periodId: summary.periodId, employeeId: summary.userId })
      .lean();

    const otRecords = await this.overtimeResultModel
      .find({
        employeeId: summary.userId,
        classificationStatus: 'FINAL',
      })
      .lean();

    const currentHash = this.generateSourceHash(days, otRecords);
    return currentHash === summary.sourceHash;
  }
}
