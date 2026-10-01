import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';

const USER_ID = '6aad6aedf0643efc4ddf03eb';
const PERIOD = '2026-09';

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');
  const db = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 });
  await db.asPromise();
  try {
    for (const { name, schema } of SCHEMA_REGISTRY) if (!db.models[name]) db.model(name, schema);
    const User = db.model<any>('User');
    const Profile = db.model<any>('EmployeeProfile');
    const Period = db.model<any>('TimesheetPeriod');
    const AttendanceDay = db.model<any>('AttendanceDay');
    const AttendanceEvent = db.model<any>('AttendanceEvent');
    const CalendarException = db.model<any>('CalendarException');
    const ManagerRequest = db.model<any>('ManagerRequest');
    const OvertimeResult = db.model<any>('OvertimeResult');
    const TimesheetSummary = db.model<any>('TimesheetSummary');
    const PayrollInputSnapshot = db.model<any>('PayrollInputSnapshot');

    const user: any = await User.findById(USER_ID).select('_id organizationId fullName').lean();
    if (!user) throw new Error('Target user not found.');
    const organizationId = user.organizationId;
    const profile: any = await Profile.findOne({ organizationId, userId: user._id }).select('_id employeeCode').lean();
    const period: any = await Period.findOne({ organizationId, period: PERIOD }).select('_id status departmentSnapshots').lean();
    if (!profile || !period) throw new Error('Target profile/period not found.');

    const days: any[] = await AttendanceDay.find({ organizationId, employeeId: user._id, periodId: period._id })
      .select('_id workDate workdayType dayResult attendanceStatus checkInAt checkOutAt workingMinutes lateMinutes earlyMinutes shiftSnapshot')
      .sort({ workDate: 1 }).lean();
    const dayIds = days.map((day) => day._id);
    const events: any[] = await AttendanceEvent.find({ organizationId, attendanceDayId: { $in: dayIds } })
      .select('attendanceDayId eventType recordedAt approvalStatus validationStatus').sort({ recordedAt: 1 }).lean();
    const calendars: any[] = await CalendarException.find({ organizationId, date: { $gte: `${PERIOD}-01`, $lte: `${PERIOD}-30` } })
      .select('date type name').sort({ date: 1 }).lean();
    const requests: any[] = await ManagerRequest.find({ organizationId, employeeUserId: user._id, type: 'OVERTIME' })
      .select('_id workDate requestedStart requestedEnd approvedStart approvedEnd status departmentId').sort({ workDate: 1 }).lean();
    const results: any[] = await OvertimeResult.find({ organizationId, employeeId: user._id, periodKey: PERIOD })
      .select('overtimeRequestId attendanceDayId workDate overtimeType classificationStatus requestedMinutes approvedMinutes actualMinutes eligibleMinutes calendarSnapshot scheduleSnapshot').sort({ workDate: 1 }).lean();
    const summary: any = await TimesheetSummary.findOne({ organizationId, periodId: period._id, employeeProfileId: profile._id }).lean();
    const snapshot: any = await PayrollInputSnapshot.findOne({ organizationId, periodId: period._id, employeeProfileId: profile._id }).lean();

    const eventByDay = new Map<string, any[]>();
    for (const event of events) {
      const key = String(event.attendanceDayId);
      eventByDay.set(key, [...(eventByDay.get(key) ?? []), event]);
    }
    console.log(JSON.stringify({
      identity: { userId: String(user._id), profileId: String(profile._id), fullName: user.fullName, employeeCode: profile.employeeCode, organizationId: String(organizationId) },
      period: { id: String(period._id), status: period.status, managerSnapshotClosed: period.departmentSnapshots?.length ?? 0 },
      calendar: calendars,
      days: days.map((day) => ({
        id: String(day._id), workDate: day.workDate, workdayType: day.workdayType, dayResult: day.dayResult ?? null,
        attendanceStatus: day.attendanceStatus, checkInAt: day.checkInAt ?? null, checkOutAt: day.checkOutAt ?? null,
        workingMinutes: day.workingMinutes, lateMinutes: day.lateMinutes, earlyMinutes: day.earlyMinutes,
        shift: day.shiftSnapshot ? { startTime: day.shiftSnapshot.startTime, endTime: day.shiftSnapshot.endTime, breakMinutes: day.shiftSnapshot.breakMinutes } : null,
        events: (eventByDay.get(String(day._id)) ?? []).map((event) => ({ type: event.eventType, at: event.recordedAt, approval: event.approvalStatus, validation: event.validationStatus })),
      })),
      overtimeRequests: requests,
      overtimeResults: results,
      storedSummary: summary ? {
        workingDays: summary.workingDays, presentDays: summary.presentDays, absentDays: summary.absentDays,
        incompleteDays: summary.incompleteDays, holidayDays: summary.holidayDays, paidLeaveDays: summary.paidLeaveDays,
        totalWorkingMinutes: summary.totalWorkingMinutes, otWorkingDayMinutes: summary.otWorkingDayMinutes,
        otWeeklyOffMinutes: summary.otWeeklyOffMinutes, otPublicHolidayMinutes: summary.otPublicHolidayMinutes,
        totalOvertimeMinutes: summary.totalOvertimeMinutes,
      } : null,
      storedSnapshot: snapshot ? { status: snapshot.status, otMinutesByType: snapshot.otMinutesByType, sourceHash: snapshot.sourceHash } : null,
    }, null, 2));
  } finally {
    await closeConnection(db);
  }
}

void main().catch((error) => {
  console.error('[audit-hoai-bao-september] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
