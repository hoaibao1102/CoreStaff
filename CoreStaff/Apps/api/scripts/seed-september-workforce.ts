import * as mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { vnTimeToUtc } from '../src/common/vietnam-time';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';
import {
  AttendanceApprovalStatus,
  AttendanceEventType,
  AttendanceMethod,
  AttendanceStatus,
  DayResult,
  EmploymentStatus,
  LeaveRequestStatus,
  LeaveType,
  Role,
  WorkMode,
  WorkdayType,
} from '../src/database/schemas/enums';
import { KpiSource, KpiStatus } from '../src/database/schemas/compensation.schema';
import { scenarioForIndex, standardWorkdays, type WorkforceScenario } from './lib/september-workforce-fixtures';
import { TimesheetSummaryService } from '../src/hr/timesheet/timesheet-summary.service';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VERIFY = args.includes('--verify');
const ANCHOR_USER_ID = args.find((arg) => arg.startsWith('--anchor-user-id='))?.split('=')[1] ?? '';
const PERIOD = args.find((arg) => arg.startsWith('--period='))?.split('=')[1] ?? '2026-09';
if (!mongoose.isValidObjectId(ANCHOR_USER_ID)) throw new Error('Invalid --anchor-user-id.');
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(PERIOD)) throw new Error('Invalid --period; expected YYYY-MM.');

const STANDARD_DAYS = standardWorkdays(PERIOD);
const HOLIDAYS = [`${PERIOD}-01`, `${PERIOD}-02`];
const EFFECTIVE_FROM = new Date(`${PERIOD}-01T00:00:00.000Z`);
const PERIOD_END = new Date(`${PERIOD}-30T23:59:59.999Z`);
const EXPECTED_TARGETS = 11;

type Action = 'planned' | 'created' | 'updated' | 'skipped' | 'verified';
const totals = new Map<string, Record<Action, number>>();
function mark(kind: string, action: Action, count = 1) {
  const row = totals.get(kind) ?? { planned: 0, created: 0, updated: 0, skipped: 0, verified: 0 };
  row[action] += count;
  totals.set(kind, row);
}
function sameValue(actual: unknown, expected: unknown): boolean {
  if (actual instanceof Date || expected instanceof Date) return new Date(String(actual)).getTime() === new Date(String(expected)).getTime();
  if (actual && typeof actual === 'object' && '_id' in (actual as any)) return String((actual as any)._id) === String(expected);
  return String(actual ?? '') === String(expected ?? '');
}
function matches(row: any, expected: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([key, value]) => sameValue(row?.[key], value));
}
function eventTime(date: string, hhmm: string) { return new Date(vnTimeToUtc(date, hhmm)); }
function hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

interface TargetContext {
  profile: any;
  user: any;
  assignment: any;
  scenario: WorkforceScenario;
}

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');
  const db = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 });
  await db.asPromise();
  try {
    for (const { name, schema } of SCHEMA_REGISTRY) if (!db.models[name]) db.model(name, schema);
    const User = db.model('User');
    const Profile = db.model('EmployeeProfile');
    const Assignment = db.model('Assignment');
    const ManagerAssignment = db.model('ManagerAssignment');
    const Period = db.model('TimesheetPeriod');
    const AttendanceDay = db.model('AttendanceDay');
    const AttendanceEvent = db.model('AttendanceEvent');
    const LeaveRequest = db.model('LeaveRequest');
    const LeaveAction = db.model('LeaveAction');
    const DayOverride = db.model('EmployeeDayOverride');
    const ManagerRequest = db.model('ManagerRequest');
    const OvertimeResult = db.model('OvertimeResult');
    const Salary = db.model('SalaryProfile');
    const InsuranceProfile = db.model('InsuranceProfile');
    const KpiInput = db.model('KpiPayrollInput');
    const KpiPolicy = db.model('KpiPolicy');
    const TimesheetSummary = db.model('TimesheetSummary');
    const Snapshot = db.model('PayrollInputSnapshot');
    const PayrollRun = db.model('PayrollRun');
    const Payslip = db.model('Payslip');
    const ShiftTemplate = db.model('ShiftTemplate');
    const Workplace = db.model('Workplace');

    const anchor: any = await User.findById(ANCHOR_USER_ID).select('_id organizationId fullName').lean();
    if (!anchor?.organizationId) throw new Error('Anchor user not found or missing organization.');
    const organizationId = new mongoose.Types.ObjectId(String(anchor.organizationId));
    const period: any = await Period.findOne({ organizationId, period: PERIOD }).lean();
    if (!period) throw new Error(`Period ${PERIOD} not found.`);
    if (!['OPEN', 'REVIEWING'].includes(period.status)) throw new Error(`Period ${PERIOD} is ${period.status}; refusing mutation.`);
    const profiles: any[] = await Profile.find({ organizationId, employmentStatus: { $in: [EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION] } }).sort({ employeeCode: 1 }).lean();
    const anchorProfile = profiles.find((profile) => String(profile.userId) === ANCHOR_USER_ID);
    const targetProfiles = profiles.filter((profile) => String(profile.userId) !== ANCHOR_USER_ID);
    if (!anchorProfile || profiles.length !== 12 || targetProfiles.length !== EXPECTED_TARGETS) {
      throw new Error(`Scope mismatch: employees=${profiles.length}, targets=${targetProfiles.length}, anchor=${Boolean(anchorProfile)}.`);
    }
    const downstreamRuns = await PayrollRun.countDocuments({ organizationId, timesheetPeriodId: period._id, active: true });
    const downstreamPayslips = await Payslip.countDocuments({ organizationId, periodLabel: { $in: ['09/2026', PERIOD] } });
    if (downstreamRuns || downstreamPayslips) throw new Error('Downstream payroll artifacts already exist; refusing source reconciliation.');

    const hr: any = await User.findOne({ organizationId, role: Role.HR, status: 'ACTIVE' }).select('_id').lean();
    const manager: any = await User.findOne({ organizationId, role: Role.DEPARTMENT_MANAGER, status: 'ACTIVE' }).select('_id').lean();
    if (!hr || !manager) throw new Error('Active HR and DEPARTMENT_MANAGER are required.');
    let shift: any = await ShiftTemplate.findOne({ organizationId, active: true }).sort({ effectiveFrom: -1 }).lean();
    if (!shift) {
      const planned = { _id: new mongoose.Types.ObjectId(), organizationId, code: 'HC-0800-DEMO', name: 'Ca hành chính demo', scope: 'ORGANIZATION', weekdays: [1, 2, 3, 4, 5], effectiveFrom: '2026-01-01', startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 10, active: true };
      if (APPLY) shift = (await ShiftTemplate.create(planned)).toObject(); else shift = planned;
      mark('ShiftTemplate', APPLY ? 'created' : 'planned');
    } else mark('ShiftTemplate', VERIFY ? 'verified' : 'skipped');
    let workplace: any = await Workplace.findOne({ organizationId, active: true }).lean();
    if (!workplace) {
      const planned = { _id: new mongoose.Types.ObjectId(), organizationId, code: 'DEMO-HQ', name: 'Văn phòng chính', type: WorkMode.IN_OFFICE, address: 'TP. Hồ Chí Minh', active: true, defaultShiftTemplateId: shift._id };
      if (APPLY) workplace = (await Workplace.create(planned)).toObject(); else workplace = planned;
      mark('Workplace', APPLY ? 'created' : 'planned');
    } else mark('Workplace', VERIFY ? 'verified' : 'skipped');
    const anchorAssignment: any = await Assignment.findOne({ organizationId, userId: anchor._id, active: true }).lean();
    const fallbackDepartmentId = anchorAssignment?.departmentId ?? profiles.find((profile) => profile.departmentId)?.departmentId;
    if (!fallbackDepartmentId) throw new Error('No department is available for fallback assignment.');

    const anchorSalary: any = await Salary.findOne({ organizationId, employeeProfileId: anchorProfile._id, active: true }).lean();
    const anchorInsurance: any = await InsuranceProfile.findOne({ organizationId, employeeId: anchorProfile._id }).lean();
    const anchorKpi: any = await KpiInput.findOne({ organizationId, employeeProfileId: anchorProfile._id, period: PERIOD }).lean();
    const kpiPolicy: any = anchorKpi?.policyId ? await KpiPolicy.findById(anchorKpi.policyId).lean() : await KpiPolicy.findOne({ organizationId, active: true }).lean();
    if (!anchorSalary || !anchorInsurance || !kpiPolicy) throw new Error('Anchor compensation prerequisites are incomplete.');

    const targets: TargetContext[] = [];
    for (let index = 0; index < targetProfiles.length; index++) {
      const profile = targetProfiles[index];
      const user: any = await User.findById(profile.userId).select('_id fullName role status').lean();
      if (!user) throw new Error(`User missing for profile ${profile._id}.`);
      let assignment: any = await Assignment.findOne({ organizationId, userId: profile.userId, active: true }).lean();
      const departmentId = assignment?.departmentId ?? profile.departmentId ?? fallbackDepartmentId;
      if (!departmentId) throw new Error(`No department can be resolved for ${profile.employeeCode}.`);
      const assignmentValues = {
        organizationId,
        userId: profile.userId,
        departmentId,
        workplaceId: assignment?.workplaceId ?? workplace._id,
        shiftTemplateId: assignment?.shiftTemplateId ?? shift._id,
        effectiveFrom: assignment?.effectiveFrom ?? `${PERIOD}-01`,
        active: true,
      };
      if (!assignment) {
        if (APPLY) assignment = await Assignment.create(assignmentValues);
        else assignment = { _id: new mongoose.Types.ObjectId(), ...assignmentValues };
        mark('Assignment', APPLY ? 'created' : 'planned');
      } else if (!assignment.shiftTemplateId || !assignment.workplaceId || String(assignment.departmentId) !== String(departmentId)) {
        if (APPLY) await Assignment.updateOne({ _id: assignment._id, organizationId }, { $set: assignmentValues }, { runValidators: true });
        assignment = { ...assignment, ...assignmentValues };
        mark('Assignment', APPLY ? 'updated' : 'planned');
      } else mark('Assignment', VERIFY ? 'verified' : 'skipped');

      const managerScope: any = await ManagerAssignment.findOne({ organizationId, managerUserId: manager._id, departmentId, active: true }).lean();
      if (!managerScope) {
        if (APPLY) await ManagerAssignment.create({ organizationId, managerUserId: manager._id, departmentId, effectiveFrom: EFFECTIVE_FROM, active: true, createdBy: hr._id });
        mark('ManagerAssignment', APPLY ? 'created' : 'planned');
      } else mark('ManagerAssignment', VERIFY ? 'verified' : 'skipped');

      const salary: any = await Salary.findOne({ organizationId, employeeProfileId: profile._id, active: true, effectiveFrom: { $lte: PERIOD_END } }).sort({ effectiveFrom: -1 }).lean();
      if (!salary) {
        const baseSalary = profile.employmentStatus === EmploymentStatus.PROBATION ? 14_000_000 : 18_000_000 + index * 500_000;
        const values = { organizationId, employeeProfileId: profile._id, effectiveFrom: EFFECTIVE_FROM, baseSalary, insuranceSalary: Math.round(baseSalary * 0.8), probationJobSalary: baseSalary, probationAgreedSalary: Math.ceil(baseSalary * 0.85), probationRate: 0.85, organizationAllowanceIds: anchorSalary.organizationAllowanceIds ?? [], attendanceBonusPolicyId: anchorSalary.attendanceBonusPolicyId, currency: 'VND', roundingRule: 'ROUND_HALF_UP_TO_VND', version: 1, active: true };
        if (APPLY) await Salary.create(values);
        mark('SalaryProfile', APPLY ? 'created' : 'planned');
      } else mark('SalaryProfile', VERIFY ? 'verified' : 'skipped');

      const insurance: any = await InsuranceProfile.findOne({ organizationId, employeeId: profile._id, effectiveFrom: { $lte: PERIOD_END } }).lean();
      if (!insurance) {
        const values = { organizationId, employeeId: profile._id, effectiveFrom: EFFECTIVE_FROM, participatesSocialInsurance: true, participatesHealthInsurance: true, participatesUnemploymentInsurance: true, note: 'Dữ liệu demo tháng 09/2026.', version: 1, createdBy: hr._id };
        if (APPLY) await InsuranceProfile.create(values);
        mark('InsuranceProfile', APPLY ? 'created' : 'planned');
      } else mark('InsuranceProfile', VERIFY ? 'verified' : 'skipped');

      const kpi: any = await KpiInput.findOne({ organizationId, employeeProfileId: profile._id, period: PERIOD }).lean();
      if (!kpi) {
        const values = { organizationId, employeeProfileId: profile._id, departmentId, policyId: kpiPolicy._id, period: PERIOD, score: 90, tierName: 'A', tierPercentage: 100, baseAmount: kpiPolicy.baseAmount ?? 2_000_000, amount: kpiPolicy.baseAmount ?? 2_000_000, source: KpiSource.MANUAL, note: 'KPI demo tháng 09/2026.', status: KpiStatus.CONFIRMED, version: 1, confirmedAt: new Date(), confirmedBy: hr._id, evaluatedAt: new Date(), evaluatedBy: hr._id };
        if (APPLY) await KpiInput.create(values);
        mark('KpiPayrollInput', APPLY ? 'created' : 'planned');
      } else mark('KpiPayrollInput', VERIFY ? 'verified' : 'skipped');

      targets.push({ profile, user, assignment, scenario: scenarioForIndex(index) });
    }

    for (const target of targets) {
      await reconcileEmployee({ db, organizationId, period, hr, manager, shift, workplace, target });
    }

    if (VERIFY) await verify({ db, organizationId, period, anchorProfile, targets });
    printReport(organizationId, period, targets);
  } finally {
    await closeConnection(db);
  }
}

async function reconcileEmployee(input: any) {
  const { db, organizationId, period, hr, manager, shift, workplace, target } = input;
  const AttendanceDay = db.model('AttendanceDay');
  const AttendanceEvent = db.model('AttendanceEvent');
  const LeaveRequest = db.model('LeaveRequest');
  const LeaveAction = db.model('LeaveAction');
  const DayOverride = db.model('EmployeeDayOverride');
  const ManagerRequest = db.model('ManagerRequest');
  const OvertimeResult = db.model('OvertimeResult');
  const { profile, user, assignment, scenario } = target as TargetContext;
  const departmentId = assignment.departmentId;
  const shiftSnapshot = { shiftTemplateId: String(shift._id), shiftName: shift.name, startTime: shift.startTime, endTime: shift.endTime, breakMinutes: shift.breakMinutes ?? 60, gracePeriodMinutes: shift.gracePeriodMinutes ?? 10 };
  const workplaceSnapshot = { workplaceId: workplace?._id ? String(workplace._id) : undefined, workplaceName: workplace?.name ?? 'Văn phòng chính', workplaceType: workplace?.type ?? WorkMode.IN_OFFICE, address: workplace?.address, latitude: workplace?.latitude, longitude: workplace?.longitude, allowedRadiusMeters: workplace?.allowedRadiusMeters };
  const employeeSnapshot = { employeeCode: profile.employeeCode, fullName: user.fullName, departmentId: String(departmentId) };

  for (const date of HOLIDAYS) {
    const workedHoliday = scenario.key === 'OT_PUBLIC_HOLIDAY' && scenario.overtime?.date === date;
    await reconcileDay({ AttendanceDay, AttendanceEvent, organizationId, periodId: period._id, employeeId: user._id, date, workdayType: WorkdayType.PUBLIC_HOLIDAY, status: workedHoliday ? AttendanceStatus.COMPLETED : AttendanceStatus.DAY_OFF, dayResult: workedHoliday ? DayResult.PRESENT : undefined, checkIn: workedHoliday ? '08:00' : undefined, checkOut: workedHoliday ? '17:00' : undefined, workingMinutes: workedHoliday ? 480 : 0, lateMinutes: 0, earlyMinutes: 0, shiftSnapshot, workplaceSnapshot, employeeSnapshot });
  }

  for (const date of STANDARD_DAYS) {
    const exception = scenario.exceptionDate === date;
    if (exception && ['PAID_LEAVE', 'UNPAID_LEAVE'].includes(scenario.key)) {
      const leaveType = scenario.key === 'PAID_LEAVE' ? LeaveType.PAID_LEAVE : LeaveType.UNPAID_LEAVE;
      await reconcileLeave({ LeaveRequest, LeaveAction, DayOverride, organizationId, employeeId: user._id, departmentId, date, leaveType, actorId: hr._id });
      await reconcileDay({ AttendanceDay, AttendanceEvent, organizationId, periodId: period._id, employeeId: user._id, date, workdayType: leaveType, status: AttendanceStatus.DAY_OFF, workingMinutes: 0, lateMinutes: 0, earlyMinutes: 0, shiftSnapshot, workplaceSnapshot, employeeSnapshot });
      continue;
    }
    if (exception && scenario.key === 'ABSENT') {
      await reconcileDay({ AttendanceDay, AttendanceEvent, organizationId, periodId: period._id, employeeId: user._id, date, workdayType: WorkdayType.WORKING_DAY, status: AttendanceStatus.NOT_CHECKED_IN, dayResult: DayResult.ABSENT, workingMinutes: 0, lateMinutes: 0, earlyMinutes: 0, shiftSnapshot, workplaceSnapshot, employeeSnapshot });
      continue;
    }
    if (exception && scenario.key === 'INCOMPLETE') {
      await reconcileDay({ AttendanceDay, AttendanceEvent, organizationId, periodId: period._id, employeeId: user._id, date, workdayType: WorkdayType.WORKING_DAY, status: AttendanceStatus.CHECKED_IN, dayResult: DayResult.INCOMPLETE, checkIn: '08:00', workingMinutes: 0, lateMinutes: 0, earlyMinutes: 0, shiftSnapshot, workplaceSnapshot, employeeSnapshot });
      continue;
    }
    let checkIn = '08:00';
    let checkOut = '17:00';
    let lateMinutes = 0;
    let earlyMinutes = 0;
    let workingMinutes = 480;
    if (exception && scenario.key === 'LATE') { checkIn = '08:45'; lateMinutes = 45; workingMinutes = 435; }
    if (exception && scenario.key === 'EARLY') { checkOut = '16:00'; earlyMinutes = 60; workingMinutes = 420; }
    if (exception && scenario.key === 'LATE_EARLY') { checkIn = '08:30'; checkOut = '16:30'; lateMinutes = 30; earlyMinutes = 30; workingMinutes = 420; }
    if (scenario.key === 'OT_WORKING_DAY' && scenario.overtime?.date === date) { checkOut = '19:00'; workingMinutes = 600; }
    await reconcileDay({ AttendanceDay, AttendanceEvent, organizationId, periodId: period._id, employeeId: user._id, date, workdayType: WorkdayType.WORKING_DAY, status: AttendanceStatus.COMPLETED, dayResult: DayResult.PRESENT, checkIn, checkOut, workingMinutes, lateMinutes, earlyMinutes, shiftSnapshot, workplaceSnapshot, employeeSnapshot });
  }

  if (scenario.key === 'OT_WEEKLY_OFF' && scenario.overtime) {
    await reconcileDay({ AttendanceDay, AttendanceEvent, organizationId, periodId: period._id, employeeId: user._id, date: scenario.overtime.date, workdayType: WorkdayType.WEEKLY_OFF, status: AttendanceStatus.COMPLETED, dayResult: DayResult.PRESENT, checkIn: '08:00', checkOut: '12:00', workingMinutes: 240, lateMinutes: 0, earlyMinutes: 0, shiftSnapshot, workplaceSnapshot, employeeSnapshot });
  }
  if (scenario.overtime) {
    const day: any = await AttendanceDay.findOne({ organizationId, employeeId: user._id, workDate: scenario.overtime.date }).lean();
    if (!day && !APPLY) {
      mark('ManagerRequest', 'planned'); mark('OvertimeResult', 'planned');
    } else await reconcileOvertime({ ManagerRequest, OvertimeResult, organizationId, profileId: profile._id, employeeId: user._id, departmentId, attendanceDayId: day?._id, scenario, actorId: manager._id, shiftSnapshot });
  }
}

async function reconcileDay(input: any) {
  const { AttendanceDay, AttendanceEvent, organizationId, periodId, employeeId, date, workdayType, status, dayResult, checkIn, checkOut, workingMinutes, lateMinutes, earlyMinutes, shiftSnapshot, workplaceSnapshot, employeeSnapshot } = input;
  const checkInAt = checkIn ? eventTime(date, checkIn) : undefined;
  const checkOutAt = checkOut ? eventTime(date, checkOut) : undefined;
  const expected: any = { organizationId, employeeId, periodId, workDate: date, workMode: WorkMode.IN_OFFICE, workdayType, attendanceStatus: status, overallApprovalStatus: AttendanceApprovalStatus.NOT_REQUIRED, workingMinutes, lateMinutes, earlyMinutes, shiftSnapshot, workplaceSnapshot, employeeSnapshot };
  if (dayResult) expected.dayResult = dayResult;
  if (checkInAt) expected.checkInAt = checkInAt;
  if (checkOutAt) expected.checkOutAt = checkOutAt;
  let row: any = await AttendanceDay.findOne({ organizationId, employeeId, workDate: date }).lean();
  const same = row && matches(row, { periodId, workdayType, attendanceStatus: status, dayResult, checkInAt, checkOutAt, workingMinutes, lateMinutes, earlyMinutes });
  if (!same && !APPLY) { mark('AttendanceDay', 'planned'); return; }
  if (!same) {
    const update: any = { $set: expected };
    const unset: any = {};
    if (!dayResult) unset.dayResult = 1;
    if (!checkInAt) unset.checkInAt = 1;
    if (!checkOutAt) unset.checkOutAt = 1;
    if (Object.keys(unset).length) update.$unset = unset;
    row = await AttendanceDay.findOneAndUpdate({ organizationId, employeeId, workDate: date }, update, { upsert: true, new: true, runValidators: true }).lean();
    mark('AttendanceDay', row ? 'updated' : 'created');
  } else mark('AttendanceDay', VERIFY ? 'verified' : 'skipped');
  if (!row) row = await AttendanceDay.findOne({ organizationId, employeeId, workDate: date }).lean();
  const expectedEvents = [[AttendanceEventType.CHECK_IN, checkInAt], [AttendanceEventType.CHECK_OUT, checkOutAt]].filter(([, at]) => Boolean(at)) as Array<[string, Date]>;
  if (APPLY) {
    await AttendanceEvent.deleteMany({ organizationId, attendanceDayId: row._id, eventType: { $nin: expectedEvents.map(([type]) => type) } });
    for (const [eventType, recordedAt] of expectedEvents) {
      const current: any = await AttendanceEvent.findOne({ organizationId, attendanceDayId: row._id, eventType }).lean();
      const eventExpected = { organizationId, attendanceDayId: row._id, employeeId, eventType, method: AttendanceMethod.NETWORK, recordedAt, publicIp: '127.0.0.1', validationStatus: 'VALID', approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED, isFallback: false, note: 'Dữ liệu demo kỳ công 09/2026.' };
      if (current && matches(current, { employeeId, eventType, recordedAt })) mark('AttendanceEvent', 'skipped');
      else { await AttendanceEvent.updateOne({ organizationId, attendanceDayId: row._id, eventType }, { $set: eventExpected }, { upsert: true, runValidators: true }); mark('AttendanceEvent', current ? 'updated' : 'created'); }
    }
  } else mark('AttendanceEvent', expectedEvents.length ? 'planned' : (VERIFY ? 'verified' : 'skipped'), expectedEvents.length || 1);
}

async function reconcileLeave(input: any) {
  const { LeaveRequest, LeaveAction, DayOverride, organizationId, employeeId, departmentId, date, leaveType, actorId } = input;
  let request: any = await LeaveRequest.findOne({ organizationId, employeeId, startDate: date, endDate: date }).lean();
  if (!request && !APPLY) { mark('LeaveRequest', 'planned'); mark('LeaveAction', 'planned'); mark('EmployeeDayOverride', 'planned'); return; }
  if (!request) {
    request = (await LeaveRequest.create({ organizationId, employeeId, departmentId, startDate: date, endDate: date, leaveType, reason: 'Nghỉ phép demo đã được phê duyệt', status: LeaveRequestStatus.HR_APPLIED, reviewedBy: actorId, reviewedAt: new Date(), reviewComment: 'Dữ liệu demo', appliedBy: actorId, appliedAt: new Date() })).toObject();
    mark('LeaveRequest', 'created');
  } else mark('LeaveRequest', VERIFY ? 'verified' : 'skipped');
  if (APPLY) {
    const action: any = await LeaveAction.findOne({ organizationId, leaveRequestId: request._id, action: 'APPLY' }).lean();
    if (!action) { await LeaveAction.create({ organizationId, leaveRequestId: request._id, actorId, action: 'APPLY', previousStatus: LeaveRequestStatus.APPROVED, newStatus: LeaveRequestStatus.HR_APPLIED, comment: 'Dữ liệu demo' }); mark('LeaveAction', 'created'); } else mark('LeaveAction', 'skipped');
    const override: any = await DayOverride.findOne({ organizationId, employeeId, date }).lean();
    if (!override || override.type !== leaveType) { await DayOverride.updateOne({ organizationId, employeeId, date }, { $set: { organizationId, employeeId, date, type: leaveType, leaveRequestId: request._id, reason: 'Nghỉ phép demo đã được phê duyệt', createdBy: actorId } }, { upsert: true, runValidators: true }); mark('EmployeeDayOverride', override ? 'updated' : 'created'); } else mark('EmployeeDayOverride', 'skipped');
  }
}

async function reconcileOvertime(input: any) {
  const { ManagerRequest, OvertimeResult, organizationId, profileId, employeeId, departmentId, attendanceDayId, scenario, actorId, shiftSnapshot } = input;
  const overtime = scenario.overtime;
  const start = overtime.type === 'OT_WORKING_DAY' ? eventTime(overtime.date, '17:00') : eventTime(overtime.date, '08:00');
  const end = new Date(start.getTime() + overtime.minutes * 60_000);
  let request: any = await ManagerRequest.findOne({ organizationId, employeeUserId: employeeId, type: 'OVERTIME', workDate: new Date(`${overtime.date}T00:00:00.000Z`) }).lean();
  if (!request && !APPLY) { mark('ManagerRequest', 'planned'); mark('OvertimeResult', 'planned'); return; }
  if (!request) {
    request = (await ManagerRequest.create({ organizationId, employeeId: profileId, employeeUserId: employeeId, departmentId, attendanceDayId, type: 'OVERTIME', workDate: new Date(`${overtime.date}T00:00:00.000Z`), reason: 'Làm thêm theo kế hoạch demo tháng 09/2026', requestedStart: start, requestedEnd: end, approvedStart: start, approvedEnd: end, status: 'APPROVED', reviewedBy: actorId, reviewedAt: new Date(), reviewComment: 'Đã duyệt dữ liệu demo', workDescription: 'Công việc demo', isRetroactive: false, version: 1 })).toObject();
    mark('ManagerRequest', 'created');
  } else mark('ManagerRequest', VERIFY ? 'verified' : 'skipped');
  const current: any = await OvertimeResult.findOne({ organizationId, overtimeRequestId: request._id }).lean();
  const resultExpected = { organizationId, overtimeRequestId: request._id, attendanceDayId, employeeId, departmentId, workDate: overtime.date, periodKey: PERIOD, yearKey: PERIOD.slice(0, 4), overtimeType: overtime.type, classificationStatus: 'FINAL', requestedMinutes: overtime.minutes, approvedMinutes: overtime.minutes, actualMinutes: overtime.minutes, eligibleMinutes: overtime.minutes, eligibleIntervals: [{ from: start, to: end }], scheduledMinutes: overtime.type === 'OT_WORKING_DAY' ? 480 : 0, calendarSnapshot: { date: overtime.date, type: overtime.type === 'OT_PUBLIC_HOLIDAY' ? 'PUBLIC_HOLIDAY' : overtime.type === 'OT_WEEKLY_OFF' ? 'WEEKLY_OFF' : undefined }, scheduleSnapshot: shiftSnapshot, policyVersion: 1, legalReference: 'Bộ luật Lao động 45/2019/QH14', inputHash: hash({ employeeId: String(employeeId), overtime }), calculationNote: 'OK', calculatedAt: new Date() };
  const same = current && matches(current, { employeeId, workDate: overtime.date, overtimeType: overtime.type, classificationStatus: 'FINAL', eligibleMinutes: overtime.minutes });
  if (!same && APPLY) { await OvertimeResult.updateOne({ organizationId, overtimeRequestId: request._id }, { $set: resultExpected }, { upsert: true, runValidators: true }); mark('OvertimeResult', current ? 'updated' : 'created'); }
  else mark('OvertimeResult', same ? (VERIFY ? 'verified' : 'skipped') : 'planned');
}

async function verify(input: any) {
  const { db, organizationId, period, anchorProfile, targets } = input;
  const AttendanceDay = db.model('AttendanceDay');
  const AttendanceEvent = db.model('AttendanceEvent');
  const Summary = db.model('TimesheetSummary');
  const Snapshot = db.model('PayrollInputSnapshot');
  const OvertimeResult = db.model('OvertimeResult');
  const summaryService = new TimesheetSummaryService(Summary as any, AttendanceDay as any, OvertimeResult as any, db.model('EmployeeProfile') as any, db.model('User') as any, db.model('Assignment') as any);
  const failures: string[] = [];
  const anchorDays = await AttendanceDay.countDocuments({ organizationId, employeeId: anchorProfile.userId, periodId: period._id });
  if (anchorDays !== 22) failures.push(`anchor attendance changed (${anchorDays})`);
  for (const target of targets as TargetContext[]) {
    const days: any[] = await AttendanceDay.find({ organizationId, employeeId: target.user._id, periodId: period._id }).lean();
    if (days.length < 22) failures.push(`${target.profile.employeeCode}: attendance=${days.length}`);
    const duplicateDates = days.length - new Set(days.map((day) => day.workDate)).size;
    if (duplicateDates) failures.push(`${target.profile.employeeCode}: duplicate attendance dates`);
    const dayIds = days.map((day) => day._id);
    const events: any[] = await AttendanceEvent.find({ organizationId, attendanceDayId: { $in: dayIds } }).lean();
    const eventKeys = new Set(events.map((event) => `${event.attendanceDayId}:${event.eventType}`));
    if (eventKeys.size !== events.length) failures.push(`${target.profile.employeeCode}: duplicate events`);
  }
  const departments = [...new Set((targets as TargetContext[]).map((target) => String(target.assignment.departmentId)))];
  const previews: any[] = [];
  for (const departmentId of departments) previews.push(...await summaryService.previewSummariesForDepartment(String(period._id), PERIOD, String(organizationId), departmentId));
  const uniquePreview = new Set(previews.map((summary) => String(summary.employeeProfileId)));
  const targetIds = new Set((targets as TargetContext[]).map((target) => String(target.profile._id)));
  const previewTargetCount = [...uniquePreview].filter((id) => targetIds.has(id)).length;
  if (uniquePreview.size !== 12 || previewTargetCount !== 11 || !uniquePreview.has(String(anchorProfile._id))) {
    failures.push(`preview employees=${uniquePreview.size}/12 targets=${previewTargetCount}/11 anchor=${uniquePreview.has(String(anchorProfile._id))}`);
  }
  const targetSummaryCount = await Summary.countDocuments({ organizationId, periodId: period._id, employeeProfileId: { $in: (targets as TargetContext[]).map((target) => target.profile._id) } });
  const targetSnapshotCount = await Snapshot.countDocuments({ organizationId, periodId: period._id, employeeProfileId: { $in: (targets as TargetContext[]).map((target) => target.profile._id) } });
  if (targetSummaryCount || targetSnapshotCount) failures.push(`workflow boundary violated summaries=${targetSummaryCount} snapshots=${targetSnapshotCount}`);
  if (failures.length) throw new Error(`Verification failed: ${failures.join('; ')}`);
  console.log(`Verification passed: 11 target employees, ${uniquePreview.size} total preview summaries, no downstream artifacts.`);
}

function printReport(organizationId: unknown, period: any, targets: TargetContext[]) {
  console.log(`\nSeptember workforce seed ${VERIFY ? 'VERIFY' : APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`organizationId=${organizationId} period=${PERIOD} status=${period.status} targets=${targets.length}`);
  console.log('scenarios=' + targets.map((target) => `${target.profile.employeeCode}:${target.scenario.key}`).join(', '));
  console.log('\nActions:');
  for (const [kind, row] of totals) console.log(`${kind.padEnd(26)} planned=${row.planned} created=${row.created} updated=${row.updated} skipped=${row.skipped} verified=${row.verified}`);
  if (!APPLY && !VERIFY) console.log('\nNo data was written. Re-run with --apply to persist the 11 employee fixtures.');
}

void main().catch((error) => {
  console.error('[seed-september-workforce] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
