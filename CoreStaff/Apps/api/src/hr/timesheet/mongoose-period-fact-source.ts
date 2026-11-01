import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { PeriodFactInput, PeriodFactSource } from './period-obligation.service';

function leanWithSession(query: any, session?: ClientSession) {
  return query.session(session ?? null).lean();
}

@Injectable()
export class MongoosePeriodFactSource implements PeriodFactSource {
  constructor(
    @InjectModel('EmployeeProfile') private readonly profiles: Model<any>,
    @InjectModel('Assignment') private readonly assignments: Model<any>,
    @InjectModel('ShiftTemplate') private readonly shifts: Model<any>,
    @InjectModel('CalendarException') private readonly calendars: Model<any>,
    @InjectModel('LeaveRequest') private readonly leaves: Model<any>,
    @InjectModel('AttendanceDay') private readonly attendance: Model<any>,
    @InjectModel('OvertimeResult') private readonly overtime: Model<any>,
  ) {}

  async load(request: Omit<import('./period-obligation.service').LoadPeriodRequest, 'session' | 'overtimeStatus'>, session?: ClientSession): Promise<PeriodFactInput> {
    const organizationId = new Types.ObjectId(request.organizationId);
    const [profiles, assignments, shifts, calendarExceptions, leaveRequests, attendanceDays, overtimeResults] = await Promise.all([
      leanWithSession(this.profiles.find({ organizationId, employmentStatus: { $in: ['ACTIVE', 'PROBATION', 'ON_LEAVE'] } }), session),
      leanWithSession(this.assignments.find({
        organizationId,
        active: true,
        $and: [
          { $or: [{ effectiveFrom: { $exists: false } }, { effectiveFrom: { $lte: request.endDate } }] },
          { $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: { $gte: request.startDate } }] },
        ],
      }), session),
      leanWithSession(this.shifts.find({ organizationId, active: true, $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: { $gte: request.startDate } }], effectiveFrom: { $lte: request.endDate } }), session),
      leanWithSession(this.calendars.find({ organizationId, date: { $gte: request.startDate, $lte: request.endDate } }), session),
      leanWithSession(this.leaves.find({ organizationId, status: { $in: ['APPROVED', 'HR_APPLIED'] }, startDate: { $lte: request.endDate }, endDate: { $gte: request.startDate } }), session),
      leanWithSession(this.attendance.find({ organizationId, workDate: { $gte: request.startDate, $lte: request.endDate } }), session),
      leanWithSession(this.overtime.find({ organizationId, periodKey: request.periodKey }), session),
    ]);
    return {
      ...request,
      employees: profiles.map((row: any) => ({ employeeProfileId: String(row._id), userId: String(row.userId), departmentIds: row.departmentId ? [String(row.departmentId)] : [] })),
      assignments: assignments.map((row: any) => ({ id: String(row._id), userId: String(row.userId), departmentId: String(row.departmentId), effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo, active: row.active })),
      shifts: shifts.map((row: any) => ({ id: String(row._id), version: row.version, scope: row.scope, departmentId: row.departmentId ? String(row.departmentId) : undefined, weekdays: row.weekdays, effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo, startTime: row.startTime, endTime: row.endTime, breakMinutes: row.breakMinutes, active: row.active })),
      calendarExceptions: calendarExceptions.map((row: any) => ({ id: String(row._id), version: row.version, date: row.date, type: row.type })),
      leaveRequests: leaveRequests.map((row: any) => ({ id: String(row._id), userId: String(row.employeeId), startDate: row.startDate, endDate: row.endDate, leaveType: row.leaveType, status: row.status, calculatedMinutes: row.calculatedMinutes, approvedLeaveIntervals: row.approvedLeaveIntervals })),
      attendanceDays: attendanceDays.map((row: any) => ({
        id: String(row._id), userId: String(row.employeeId), workDate: row.workDate,
        workingMinutes: row.workingMinutes, attendanceStatus: row.attendanceStatus,
        dayResult: row.dayResult, resolutionType: row.resolution?.type,
        checkInAt: row.checkInAt instanceof Date ? row.checkInAt.toISOString() : row.checkInAt,
        checkOutAt: row.checkOutAt instanceof Date ? row.checkOutAt.toISOString() : row.checkOutAt,
        lateMinutes: row.lateMinutes, earlyMinutes: row.earlyMinutes,
        checkInProvenance: row.checkInProvenance ? JSON.parse(JSON.stringify(row.checkInProvenance)) : undefined,
        checkOutProvenance: row.checkOutProvenance ? JSON.parse(JSON.stringify(row.checkOutProvenance)) : undefined,
        overallApprovalStatus: row.overallApprovalStatus,
      })),
      overtimeResults: overtimeResults.map((row: any) => ({ id: String(row._id), userId: String(row.employeeId), workDate: row.workDate, periodKey: row.periodKey, classificationStatus: row.classificationStatus, eligibleMinutes: row.eligibleMinutes,
        calculationContract: row.calculationContract, rawEligibleMinutes: row.rawEligibleMinutes,
        payableMinutes: row.payableMinutes, roundingDroppedMinutes: row.roundingDroppedMinutes,
        minimumThresholdApplied: row.minimumThresholdApplied, reasons: row.reasons,
        policySnapshot: row.policySnapshot ? JSON.parse(JSON.stringify(row.policySnapshot)) : undefined,
        provenanceSnapshot: row.provenanceSnapshot ? JSON.parse(JSON.stringify(row.provenanceSnapshot)) : undefined,
        inputHash: row.inputHash,
      })),
    };
  }
}
