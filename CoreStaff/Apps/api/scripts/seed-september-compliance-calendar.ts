import * as mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';
import {
  AttendanceApprovalStatus,
  AttendanceEventType,
  AttendanceMethod,
  AttendanceStatus,
  CalendarExceptionType,
  DayResult,
  Role,
  WorkdayType,
} from '../src/database/schemas/enums';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VERIFY = args.includes('--verify');
const USER_ID = args.find((arg) => arg.startsWith('--user-id='))?.split('=')[1] ?? '';
const PERIOD = args.find((arg) => arg.startsWith('--period='))?.split('=')[1] ?? '2026-09';

if (!mongoose.isValidObjectId(USER_ID)) {
  throw new Error(`--user-id must be an exact 24-character ObjectId; got "${USER_ID}".`);
}
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(PERIOD)) {
  throw new Error(`--period must use YYYY-MM; got "${PERIOD}".`);
}

const year = Number(PERIOD.slice(0, 4));
const effectiveFrom = new Date(Date.UTC(year, 0, 1));
const holidaySpecs = [
  { date: `${PERIOD}-01`, name: 'Nghỉ Quốc khánh (ngày liền kề)' },
  { date: `${PERIOD}-02`, name: 'Quốc khánh Việt Nam' },
] as const;
const laborValues = {
  effectiveFrom,
  normalDailyMinutes: 480,
  normalWeeklyMinutes: 2880,
  maxCombinedDailyMinutes: 720,
  maxMonthlyOvertimeMinutes: 2400,
  maxAnnualOvertimeMinutes: 20000,
  exceptionalAnnualOvertimeMinutes: 24000,
  warningThresholdPercent: 80,
  maxRetroactiveFilingDays: 7,
  probationMinimumRate: 0.85,
  legalReference: 'Bộ luật Lao động 45/2019/QH14',
  version: 1,
  active: true,
};
const overtimeValues = {
  effectiveFrom,
  workingDayRate: 1.5,
  weeklyOffRate: 2,
  publicHolidayRate: 3,
  legalReference: 'Bộ luật Lao động 45/2019/QH14',
  version: 1,
  active: true,
};

type Action = 'planned' | 'created' | 'updated' | 'skipped' | 'verified';
const totals = new Map<string, Record<Action, number>>();
function mark(kind: string, action: Action, count = 1) {
  const row = totals.get(kind) ?? { planned: 0, created: 0, updated: 0, skipped: 0, verified: 0 };
  row[action] += count;
  totals.set(kind, row);
}
function sameDate(value: unknown, expected: Date) {
  return value instanceof Date
    ? value.getTime() === expected.getTime()
    : new Date(String(value)).getTime() === expected.getTime();
}
function policyMatches(row: any, values: Record<string, unknown>) {
  return Object.entries(values).every(([key, expected]) => {
    const actual = row?.[key];
    if (expected instanceof Date) return sameDate(actual, expected);
    return actual === expected;
  });
}

async function reconcilePolicy(
  model: mongoose.Model<any>,
  organizationId: mongoose.Types.ObjectId,
  values: Record<string, unknown>,
  kind: string,
) {
  const query = { organizationId, version: values.version };
  const existing: any = await model.findOne(query).lean();
  if (!existing) {
    if (!APPLY) {
      mark(kind, 'planned');
      return;
    }
    await model.create({ organizationId, ...values });
    mark(kind, 'created');
    return;
  }
  if (policyMatches(existing, values)) {
    mark(kind, VERIFY ? 'verified' : 'skipped');
    return;
  }
  if (!APPLY) {
    mark(kind, 'planned');
    return;
  }
  await model.updateOne({ _id: existing._id, organizationId }, { $set: values }, { runValidators: true });
  mark(kind, 'updated');
}

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');
  const db = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 });
  await db.asPromise();

  try {
    for (const { name, schema } of SCHEMA_REGISTRY) {
      if (!db.models[name]) db.model(name, schema);
    }

    const User = db.model<any>('User');
    const LaborPolicy = db.model<any>('LaborCompliancePolicy');
    const OvertimePolicy = db.model<any>('OvertimePayPolicy');
    const CalendarException = db.model<any>('CalendarException');
    const AttendanceDay = db.model<any>('AttendanceDay');
    const AttendanceEvent = db.model<any>('AttendanceEvent');
    const TimesheetPeriod = db.model<any>('TimesheetPeriod');
    const Profile = db.model<any>('EmployeeProfile');
    const Assignment = db.model<any>('Assignment');
    const ManagerRequest = db.model<any>('ManagerRequest');
    const OvertimeResult = db.model<any>('OvertimeResult');

    const targetUser: any = await User.findById(USER_ID).select('_id organizationId').lean();
    if (!targetUser?.organizationId) throw new Error(`User ${USER_ID} does not exist or has no organizationId.`);
    const organizationId = new mongoose.Types.ObjectId(String(targetUser.organizationId));
    const profile: any = await Profile.findOne({ organizationId, userId: targetUser._id }).select('_id').lean();
    const assignment: any = await Assignment.findOne({ organizationId, userId: targetUser._id, active: true })
      .select('departmentId shiftTemplateId').populate('shiftTemplateId').lean();
    if (!profile || !assignment?.departmentId) throw new Error('Target employee profile/assignment is incomplete.');
    const actor: any = await User.findOne({ organizationId, role: Role.HR, status: 'ACTIVE' }).select('_id').lean();
    if (!actor) throw new Error('Organization has no active HR user to own calendar records.');

    const period: any = await TimesheetPeriod.findOne({ organizationId, period: PERIOD }).select('_id status').lean();
    if (period?.status === 'CLOSED') {
      throw new Error(`${PERIOD} is CLOSED; refusing to rewrite historical calendar/attendance.`);
    }

    await reconcilePolicy(LaborPolicy, organizationId, laborValues, 'LaborCompliancePolicy');
    await reconcilePolicy(OvertimePolicy, organizationId, overtimeValues, 'OvertimePayPolicy');

    for (const holiday of holidaySpecs) {
      const existing: any = await CalendarException.findOne({ organizationId, date: holiday.date }).lean();
      const matches = existing
        && existing.type === CalendarExceptionType.PUBLIC_HOLIDAY
        && existing.name === holiday.name;
      if (!existing) {
        if (!APPLY) mark('CalendarException', 'planned');
        else {
          await CalendarException.create({
            organizationId,
            date: holiday.date,
            type: CalendarExceptionType.PUBLIC_HOLIDAY,
            name: holiday.name,
            createdBy: actor._id,
          });
          mark('CalendarException', 'created');
        }
      } else if (matches) {
        mark('CalendarException', VERIFY ? 'verified' : 'skipped');
      } else if (!APPLY) {
        mark('CalendarException', 'planned');
      } else {
        await CalendarException.updateOne(
          { _id: existing._id, organizationId },
          { $set: { type: CalendarExceptionType.PUBLIC_HOLIDAY, name: holiday.name, updatedBy: actor._id } },
          { runValidators: true },
        );
        mark('CalendarException', 'updated');
      }

      const attendanceRows: any[] = await AttendanceDay.find({ organizationId, workDate: holiday.date })
        .select('_id employeeId workdayType attendanceStatus checkInAt checkOutAt workingMinutes lateMinutes earlyMinutes dayResult shiftSnapshot employeeSnapshot')
        .lean();
      for (const day of attendanceRows) {
        if (String(day.employeeId) === String(targetUser._id)) {
          const checkInAt = new Date(`${holiday.date}T01:00:00.000Z`); // 08:00 VN
          const checkOutAt = new Date(`${holiday.date}T10:00:00.000Z`); // 17:00 VN
          const targetMatches = day.workdayType === WorkdayType.PUBLIC_HOLIDAY
            && day.attendanceStatus === AttendanceStatus.COMPLETED
            && day.dayResult === DayResult.PRESENT
            && new Date(day.checkInAt ?? 0).getTime() === checkInAt.getTime()
            && new Date(day.checkOutAt ?? 0).getTime() === checkOutAt.getTime()
            && day.workingMinutes === 480;

          if (!targetMatches && !APPLY) mark('AttendanceDay', 'planned');
          else if (!targetMatches) {
            await AttendanceDay.updateOne(
              { _id: day._id, organizationId },
              { $set: { workdayType: WorkdayType.PUBLIC_HOLIDAY, dayResult: DayResult.PRESENT, attendanceStatus: AttendanceStatus.COMPLETED, checkInAt, checkOutAt, workingMinutes: 480, lateMinutes: 0, earlyMinutes: 0 } },
              { runValidators: true },
            );
            mark('AttendanceDay', 'updated');
          } else mark('AttendanceDay', VERIFY ? 'verified' : 'skipped');

          if (!APPLY) {
            mark('AttendanceEvent', 'planned', 2);
            mark('ManagerRequest', 'planned');
            mark('OvertimeResult', 'planned');
            continue;
          }

          for (const [eventType, recordedAt] of [[AttendanceEventType.CHECK_IN, checkInAt], [AttendanceEventType.CHECK_OUT, checkOutAt]] as const) {
            const eventResult = await AttendanceEvent.updateOne(
              { organizationId, attendanceDayId: day._id, eventType },
              { $set: { organizationId, attendanceDayId: day._id, employeeId: targetUser._id, eventType, method: AttendanceMethod.NETWORK, recordedAt, publicIp: '127.0.0.1', validationStatus: 'VALID', approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED, isFallback: false, note: 'Seed: Hoài Bảo làm việc ngày lễ Quốc khánh.' } },
              { upsert: true, runValidators: true },
            );
            mark('AttendanceEvent', eventResult.upsertedCount ? 'created' : 'updated');
          }

          const request: any = await ManagerRequest.findOneAndUpdate(
            { organizationId, employeeUserId: targetUser._id, type: 'OVERTIME', workDate: new Date(`${holiday.date}T00:00:00.000Z`) },
            { $set: { organizationId, employeeId: profile._id, employeeUserId: targetUser._id, departmentId: assignment.departmentId, attendanceDayId: day._id, type: 'OVERTIME', workDate: new Date(`${holiday.date}T00:00:00.000Z`), reason: 'Làm việc theo phân công trong kỳ nghỉ Quốc khánh', requestedStart: checkInAt, requestedEnd: checkOutAt, approvedStart: checkInAt, approvedEnd: checkOutAt, status: 'APPROVED', reviewedBy: actor._id, reviewedAt: new Date(), reviewComment: 'Seed dữ liệu OT ngày lễ đã được duyệt', workDescription: 'Làm việc ngày lễ Quốc khánh', isRetroactive: false, version: 1 } },
            { upsert: true, new: true, runValidators: true },
          ).lean();
          mark('ManagerRequest', 'updated');

          const shift = day.shiftSnapshot ?? assignment.shiftTemplateId;
          const inputHash = createHash('sha256').update(JSON.stringify({ date: holiday.date, employeeId: String(targetUser._id), type: 'OT_PUBLIC_HOLIDAY', punches: [checkInAt.toISOString(), checkOutAt.toISOString()], policyVersion: 1 })).digest('hex');
          const result = await OvertimeResult.updateOne(
            { organizationId, overtimeRequestId: request._id },
            { $set: { organizationId, overtimeRequestId: request._id, attendanceDayId: day._id, employeeId: targetUser._id, departmentId: assignment.departmentId, workDate: holiday.date, periodKey: PERIOD, yearKey: String(year), overtimeType: 'OT_PUBLIC_HOLIDAY', classificationStatus: 'FINAL', requestedMinutes: 480, approvedMinutes: 480, actualMinutes: 480, eligibleMinutes: 480, eligibleIntervals: [{ from: checkInAt, to: checkOutAt }], scheduledMinutes: 0, calendarSnapshot: { date: holiday.date, type: CalendarExceptionType.PUBLIC_HOLIDAY, name: holiday.name }, scheduleSnapshot: shift ? { shiftTemplateId: String(shift._id ?? shift.shiftTemplateId ?? ''), startTime: shift.startTime, endTime: shift.endTime, breakMinutes: shift.breakMinutes } : undefined, policyVersion: 1, legalReference: laborValues.legalReference, inputHash, calculationNote: 'OK', calculatedAt: new Date() } },
            { upsert: true, runValidators: true },
          );
          mark('OvertimeResult', result.upsertedCount ? 'created' : 'updated');
          continue;
        }

        const normalized = day.workdayType === WorkdayType.PUBLIC_HOLIDAY
          && day.attendanceStatus === AttendanceStatus.DAY_OFF
          && !day.checkInAt
          && !day.checkOutAt
          && (day.workingMinutes ?? 0) === 0
          && (day.lateMinutes ?? 0) === 0
          && (day.earlyMinutes ?? 0) === 0
          && !day.dayResult;
        if (normalized) {
          mark('AttendanceDay', VERIFY ? 'verified' : 'skipped');
          continue;
        }
        if (!APPLY) {
          mark('AttendanceDay', 'planned');
          continue;
        }
        await AttendanceDay.updateOne(
          { _id: day._id, organizationId },
          { $set: { workdayType: WorkdayType.PUBLIC_HOLIDAY, attendanceStatus: AttendanceStatus.DAY_OFF, workingMinutes: 0, lateMinutes: 0, earlyMinutes: 0 }, $unset: { checkInAt: 1, checkOutAt: 1, dayResult: 1 } },
          { runValidators: true },
        );
        const deleted = await AttendanceEvent.deleteMany({ organizationId, attendanceDayId: day._id });
        mark('AttendanceDay', 'updated');
        if (deleted.deletedCount) mark('AttendanceEvent', 'updated', deleted.deletedCount);
      }
    }

    // Reconcile the pre-existing approved 23/09 request with real punches. The
    // history screen previously showed a 120-minute fallback from the approved
    // window while snapshot aggregation saw no OvertimeResult and returned zero.
    const regularOtDate = `${PERIOD}-23`;
    const regularOtDay: any = await AttendanceDay.findOne({ organizationId, employeeId: targetUser._id, workDate: regularOtDate }).lean();
    const regularOtRequest: any = await ManagerRequest.findOne({
      organizationId,
      employeeUserId: targetUser._id,
      type: 'OVERTIME',
      status: 'APPROVED',
      workDate: new Date(`${regularOtDate}T00:00:00.000Z`),
    }).lean();
    if (!regularOtDay || !regularOtRequest) throw new Error('Approved 23/09 overtime prerequisite is missing.');
    const regularCheckIn = new Date(`${regularOtDate}T01:00:00.000Z`); // 08:00 VN
    const regularCheckOut = new Date(`${regularOtDate}T13:00:00.000Z`); // 20:00 VN
    if (APPLY) {
      await AttendanceDay.updateOne(
        { _id: regularOtDay._id, organizationId },
        { $set: { workdayType: WorkdayType.WORKING_DAY, dayResult: DayResult.PRESENT, attendanceStatus: AttendanceStatus.COMPLETED, checkInAt: regularCheckIn, checkOutAt: regularCheckOut, workingMinutes: 660, lateMinutes: 0, earlyMinutes: 0 } },
        { runValidators: true },
      );
      await AttendanceEvent.updateOne(
        { organizationId, attendanceDayId: regularOtDay._id, eventType: AttendanceEventType.CHECK_OUT },
        { $set: { recordedAt: regularCheckOut, note: 'Seed: hoàn tất ca và 120 phút OT ngày làm việc.' } },
        { runValidators: true },
      );
      const regularHash = createHash('sha256').update(JSON.stringify({ date: regularOtDate, employeeId: String(targetUser._id), type: 'OT_WORKING_DAY', punches: [regularCheckIn.toISOString(), regularCheckOut.toISOString()], policyVersion: 1 })).digest('hex');
      const result = await OvertimeResult.updateOne(
        { organizationId, overtimeRequestId: regularOtRequest._id },
        { $set: { organizationId, overtimeRequestId: regularOtRequest._id, attendanceDayId: regularOtDay._id, employeeId: targetUser._id, departmentId: assignment.departmentId, workDate: regularOtDate, periodKey: PERIOD, yearKey: String(year), overtimeType: 'OT_WORKING_DAY', classificationStatus: 'FINAL', requestedMinutes: 120, approvedMinutes: 120, actualMinutes: 720, eligibleMinutes: 120, eligibleIntervals: [{ from: new Date(`${regularOtDate}T11:00:00.000Z`), to: regularCheckOut }], scheduledMinutes: 480, calendarSnapshot: { date: regularOtDate }, scheduleSnapshot: regularOtDay.shiftSnapshot, policyVersion: 1, legalReference: laborValues.legalReference, inputHash: regularHash, calculationNote: 'OK', calculatedAt: new Date() } },
        { upsert: true, runValidators: true },
      );
      mark('AttendanceDay', 'updated');
      mark('AttendanceEvent', 'updated');
      mark('OvertimeResult', result.upsertedCount ? 'created' : 'updated');

      // Remove stale dayResult values such as INCOMPLETE on otherwise complete
      // attendance rows so preview and history use the same facts.
      const normalized = await AttendanceDay.updateMany(
        { organizationId, employeeId: targetUser._id, periodId: period?._id, attendanceStatus: AttendanceStatus.COMPLETED, checkInAt: { $exists: true }, checkOutAt: { $exists: true } },
        { $set: { dayResult: DayResult.PRESENT } },
      );
      if (normalized.modifiedCount) mark('AttendanceDay', 'updated', normalized.modifiedCount);
    } else {
      mark('AttendanceDay', 'planned');
      mark('AttendanceEvent', 'planned');
      mark('OvertimeResult', 'planned');
    }

    const policies = {
      labor: await LaborPolicy.findOne({ organizationId, version: 1 }).lean(),
      overtime: await OvertimePolicy.findOne({ organizationId, version: 1 }).lean(),
    };
    const holidays: any[] = await CalendarException.find({
      organizationId,
      date: { $in: holidaySpecs.map((item) => item.date) },
    }).sort({ date: 1 }).lean();
    const attendanceConflicts = await AttendanceDay.countDocuments({
      organizationId,
      employeeId: { $ne: targetUser._id },
      workDate: { $in: holidaySpecs.map((item) => item.date) },
      $or: [
        { workdayType: { $ne: WorkdayType.PUBLIC_HOLIDAY } },
        { attendanceStatus: { $ne: AttendanceStatus.DAY_OFF } },
        { checkInAt: { $exists: true } },
        { checkOutAt: { $exists: true } },
        { workingMinutes: { $gt: 0 } },
      ],
    });
    const targetHolidayDays: any[] = await AttendanceDay.find({
      organizationId,
      employeeId: targetUser._id,
      workDate: { $in: holidaySpecs.map((item) => item.date) },
    }).lean();
    const targetHolidayOt: any[] = await OvertimeResult.find({
      organizationId,
      employeeId: targetUser._id,
      workDate: { $in: holidaySpecs.map((item) => item.date) },
      overtimeType: 'OT_PUBLIC_HOLIDAY',
      classificationStatus: 'FINAL',
    }).lean();
    const targetHolidayOtMinutes = targetHolidayOt.reduce((sum, row) => sum + (row.eligibleMinutes ?? 0), 0);
    const targetRegularOt: any = await OvertimeResult.findOne({ organizationId, employeeId: targetUser._id, workDate: regularOtDate, overtimeType: 'OT_WORKING_DAY', classificationStatus: 'FINAL' }).lean();

    console.log(`\nSeptember compliance/calendar seed ${VERIFY ? 'VERIFY' : APPLY ? 'APPLY' : 'DRY-RUN'}`);
    console.log(`organizationId=${organizationId} period=${PERIOD} status=${period?.status ?? 'NO_PERIOD'}`);
    console.log('labor=480/day,2880/week,720 combined/day,2400 OT/month,20000 OT/year,24000 exceptional/year');
    console.log('overtime=1.5 working day,2.0 weekly off,3.0 public holiday');
    console.log('holidays=' + holidaySpecs.map((item) => `${item.date}:${item.name}`).join(', '));
    console.log(`storedHolidays=${holidays.length}/2 attendanceConflicts=${attendanceConflicts} targetWorkedHolidays=${targetHolidayDays.filter((day) => day.attendanceStatus === AttendanceStatus.COMPLETED).length}/2 targetHolidayOtMinutes=${targetHolidayOtMinutes} targetRegularOtMinutes=${targetRegularOt?.eligibleMinutes ?? 0}`);
    console.log('\nActions:');
    for (const [kind, row] of totals) {
      console.log(`${kind.padEnd(28)} planned=${row.planned} created=${row.created} updated=${row.updated} skipped=${row.skipped} verified=${row.verified}`);
    }

    if (VERIFY) {
      const failures = [
        !policyMatches(policies.labor, laborValues) ? 'labor policy mismatch' : '',
        !policyMatches(policies.overtime, overtimeValues) ? 'overtime policy mismatch' : '',
        holidays.length !== holidaySpecs.length ? `calendar ${holidays.length}/${holidaySpecs.length}` : '',
        ...holidaySpecs.map((spec) => {
          const row = holidays.find((item) => item.date === spec.date);
          return row?.type !== CalendarExceptionType.PUBLIC_HOLIDAY || row?.name !== spec.name
            ? `${spec.date} calendar mismatch`
            : '';
        }),
        attendanceConflicts ? `${attendanceConflicts} attendance holiday conflicts` : '',
        targetHolidayDays.filter((day) => day.attendanceStatus === AttendanceStatus.COMPLETED && day.workdayType === WorkdayType.PUBLIC_HOLIDAY).length !== 2 ? 'target holiday attendance mismatch' : '',
        targetHolidayOtMinutes !== 960 ? 'target holiday OT must be 960 minutes' : '',
        targetRegularOt?.eligibleMinutes !== 120 ? 'target regular OT must be 120 minutes' : '',
      ].filter(Boolean);
      if (failures.length) throw new Error(`Verification failed: ${failures.join('; ')}`);
      console.log('\nVerification passed: policies and 01-02/09 public holidays are consistent.');
    } else if (!APPLY) {
      console.log('\nNo data was written. Re-run with --apply to reconcile this scope.');
    }
  } finally {
    await closeConnection(db);
  }
}

void main().catch((error) => {
  console.error('[seed-september-compliance-calendar] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
