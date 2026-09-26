import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { vnTimeToUtc } from '../src/common/vietnam-time';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';
import {
  AttendanceApprovalStatus,
  AttendanceEventType,
  AttendanceMethod,
  AttendanceStatus,
  WorkMode,
} from '../src/database/schemas/enums';

/**
 * Demo helper: no GPS radio and no office-network egress on a dev PC, so
 * `AttendanceService.checkIn` can only answer SELFIE_REQUIRED. This writes the
 * two documents that method would have written (AttendanceDay + its CHECK_IN /
 * CHECK_OUT AttendanceEvents) so the employee screens have something to render.
 *
 * Usage (from Apps/api):
 *   npx ts-node-script scripts/seed-binh-tran-attendance.ts                      # checked in, today
 *   ... --status=COMPLETED                                                       # full day
 *   ... --email=cuong.le@tvs.local --date=2026-09-25 --in=07:55 --out=17:20
 */

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;

/** Same rule as AttendanceService.getTodayWorkDate(). */
const todayVn = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const nowVnMinutes = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()).split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
};
const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

async function main() {
  const email = arg('email', 'binh.tran@tvs.local');
  const status = arg('status', AttendanceStatus.CHECKED_IN);
  const isCompleted = status === AttendanceStatus.COMPLETED;
  const target = {
    [AttendanceStatus.CHECKED_IN]: AttendanceStatus.CHECKED_IN,
    [AttendanceStatus.COMPLETED]: AttendanceStatus.COMPLETED,
  }[status];
  if (!target) throw new Error(`--status must be CHECKED_IN or COMPLETED, got "${status}"`);

  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');
  const connection = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15000 });

  try {
    await connection.asPromise();
    // Register every schema so `populate()` on Assignment can resolve
    // Workplace/ShiftTemplate/Department, not just the models used below.
    for (const { name, schema } of SCHEMA_REGISTRY) {
      if (!connection.models[name]) connection.model(name, schema);
    }
    const AttendanceDay = connection.model<any>('AttendanceDay');
    const AttendanceEvent = connection.model<any>('AttendanceEvent');
    const User = connection.model<any>('User');
    const Assignment = connection.model<any>('Assignment');
    const Profile = connection.model<any>('EmployeeProfile');

    const employee: any = await User.findOne({ emailN: email.trim().toLowerCase() }).lean();
    if (!employee?.organizationId) throw new Error(`No seeded user "${email}" — run the base seed first.`);
    const organizationId = new mongoose.Types.ObjectId(String(employee.organizationId));
    const employeeId = new mongoose.Types.ObjectId(String(employee._id));

    const workDate = arg('date', todayVn());
    // Clamped so a punch is never stamped in the future: default 08:05 (inside
    // the 08:00 + 10 min grace of the HC-0800 shift), or now − 30 min.
    const minutesAgo = 30;
    const defaultIn = Math.max(8 * 60 + 5, nowVnMinutes() - minutesAgo);
    const inAt = arg('in', hhmm(Math.min(defaultIn, 23 * 60 + 59)));
    const outAt = arg('out', hhmm(Math.max(17 * 60, Math.min(nowVnMinutes(), 23 * 60 + 59))));

    // Match the shift/workplace the real punch would have snapshotted.
    const assignment: any = await Assignment.findOne({ organizationId, userId: employeeId, active: true })
      .populate('workplaceId').populate('shiftTemplateId').lean();
    const workplace = assignment?.workplaceId;
    const shift = assignment?.shiftTemplateId;
    const shiftSnapshot = {
      shiftTemplateId: shift?._id ? String(shift._id) : undefined,
      shiftName: shift?.name || 'Ca hành chính',
      startTime: shift?.startTime || '08:00',
      endTime: shift?.endTime || '17:00',
      breakMinutes: shift?.breakMinutes ?? 60,
      gracePeriodMinutes: shift?.gracePeriodMinutes ?? 15,
    };
    const workplaceSnapshot = {
      workplaceId: workplace?._id ? String(workplace._id) : undefined,
      workplaceName: workplace?.name || 'Văn phòng chính',
      workplaceType: workplace?.type || WorkMode.IN_OFFICE,
      address: workplace?.address,
      latitude: workplace?.latitude,
      longitude: workplace?.longitude,
      allowedRadiusMeters: workplace?.allowedRadiusMeters,
    };
    const profile: any = await Profile.findOne({ organizationId, userId: employeeId }).lean();
    const employeeSnapshot = profile
      ? { employeeCode: profile.employeeCode, fullName: profile.fullName, departmentId: profile.departmentId ? String(profile.departmentId) : undefined, departmentName: profile.departmentName }
      : undefined;

    const checkInAt = new Date(vnTimeToUtc(workDate, inAt));
    const checkOutAt = isCompleted ? new Date(vnTimeToUtc(workDate, outAt)) : undefined;
    if (checkOutAt && checkOutAt <= checkInAt) throw new Error(`--out ${outAt} must be after --in ${inAt}`);

    // AttendanceCalculatorService.calculate(), inlined for the same inputs.
    const allowedIn = new Date(vnTimeToUtc(workDate, shiftSnapshot.startTime) + shiftSnapshot.gracePeriodMinutes * 60000);
    const lateMinutes = Math.max(0, Math.floor((checkInAt.getTime() - allowedIn.getTime()) / 60000));
    const scheduleEnd = new Date(vnTimeToUtc(workDate, shiftSnapshot.endTime));
    const earlyMinutes = checkOutAt ? Math.max(0, Math.floor((scheduleEnd.getTime() - checkOutAt.getTime()) / 60000)) : 0;
    const span = checkOutAt ? Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60000) : 0;
    const breakMins = shiftSnapshot.breakMinutes || 0;
    const workingMinutes = checkOutAt ? (span >= breakMins ? span - breakMins : span) : undefined;

    const day = await AttendanceDay.findOneAndUpdate(
      { organizationId, employeeId, workDate },
      {
        $set: {
          workMode: WorkMode.IN_OFFICE,
          attendanceStatus: target,
          overallApprovalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
          checkInAt,
          lateMinutes,
          earlyMinutes,
          workingMinutes,
          shiftSnapshot,
          workplaceSnapshot,
          employeeSnapshot,
        },
        $setOnInsert: { organizationId, employeeId, workDate },
        $unset: { dayResult: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const punch = (eventType: AttendanceEventType, recordedAt: Date) => ({
      organizationId,
      attendanceDayId: day._id,
      employeeId,
      eventType,
      // NETWORK: the truthy claim a dev box can make without a GPS fix, and the
      // only method the UI does not gate behind approval.
      method: AttendanceMethod.NETWORK,
      recordedAt,
      publicIp: '127.0.0.1',
      address: workplaceSnapshot.workplaceName,
      validationStatus: 'VALID',
      approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
      isFallback: false,
      note: 'Dữ liệu demo — tạo bằng scripts/seed-binh-tran-attendance.ts',
    });

    await AttendanceEvent.findOneAndUpdate(
      { organizationId, attendanceDayId: day._id, eventType: AttendanceEventType.CHECK_IN },
      { $set: punch(AttendanceEventType.CHECK_IN, checkInAt), $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true },
    );
    if (checkOutAt) {
      await AttendanceEvent.findOneAndUpdate(
        { organizationId, attendanceDayId: day._id, eventType: AttendanceEventType.CHECK_OUT },
        { $set: punch(AttendanceEventType.CHECK_OUT, checkOutAt), $setOnInsert: { createdAt: new Date() } },
        { upsert: true, new: true },
      );
    } else {
      // Re-opening a seeded COMPLETED day as CHECKED_IN must not leave a stale
      // CHECK_OUT behind — getHistory would still count the day as punched out.
      await AttendanceEvent.deleteOne({ organizationId, attendanceDayId: day._id, eventType: AttendanceEventType.CHECK_OUT });
    }

    console.log(
      `[seed:attendance] ${email} ${workDate} → ${target}` +
      ` | in ${inAt}${checkOutAt ? ` out ${outAt}` : ''}` +
      ` | late=${lateMinutes}m early=${earlyMinutes}m working=${workingMinutes ?? '-'}m` +
      ` | day=${day._id} events=${checkOutAt ? 2 : 1}`,
    );
    if (!workplace) {
      console.warn('[seed:attendance] no active Assignment/Workplace for this user — snapshots use defaults. Run `npm run seed:scheduling:an`-style provisioning if the UI needs a real workplace.');
    }
  } finally {
    await closeConnection(connection);
  }
}

void main().catch((error) => {
  console.error('[seed:attendance] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
