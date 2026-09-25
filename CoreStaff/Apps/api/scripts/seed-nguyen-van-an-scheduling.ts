import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { OrganizationSchema } from '../src/database/schemas/organization.schema';
import { UserSchema } from '../src/database/schemas/user.schema';
import { EmployeeProfileSchema } from '../src/database/schemas/employee-profile.schema';
import { WorkplaceSchema, WorkplaceType } from '../src/database/schemas/workplace.schema';
import { ShiftTemplateSchema } from '../src/database/schemas/shift-template.schema';
import { EmployeeAssignmentSchema } from '../src/database/schemas/assignment.schema';
import { CalendarExceptionSchema } from '../src/database/schemas/calendar-exception.schema';
import { LeaveRequestSchema } from '../src/database/schemas/leave-request.schema';
import { LeaveActionSchema } from '../src/database/schemas/leave-action.schema';
import { EmployeeDayOverrideSchema } from '../src/database/schemas/employee-day-override.schema';
import { CalendarExceptionType, LeaveRequestStatus, LeaveType, Role, ShiftScope } from '../src/database/schemas/enums';

const EMPLOYEE_EMAIL = 'an.nguyen@tvs.local';
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, count: number) => { const next = new Date(date); next.setUTCDate(next.getUTCDate() + count); return next; };
const nextWeekday = (start: Date, offset: number) => {
  let date = addDays(start, offset);
  while ([0, 6].includes(date.getUTCDay())) date = addDays(date, 1);
  return date;
};

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');
  const connection = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15000 });
  try {
    await connection.asPromise();
    const Organization = connection.model('Organization', OrganizationSchema);
    const User = connection.model('User', UserSchema);
    const Profile = connection.model('EmployeeProfile', EmployeeProfileSchema);
    const Workplace = connection.model('Workplace', WorkplaceSchema);
    const Shift = connection.model('ShiftTemplate', ShiftTemplateSchema);
    const Assignment = connection.model('Assignment', EmployeeAssignmentSchema);
    const Calendar = connection.model('CalendarException', CalendarExceptionSchema);
    const Leave = connection.model('LeaveRequest', LeaveRequestSchema);
    const LeaveAction = connection.model('LeaveAction', LeaveActionSchema);
    const Override = connection.model('EmployeeDayOverride', EmployeeDayOverrideSchema);

    const employee = await User.findOne({ emailN: EMPLOYEE_EMAIL }).lean();
    if (!employee?.organizationId) throw new Error(`Run the base seed first; employee ${EMPLOYEE_EMAIL} was not found.`);
    const organizationId = employee.organizationId;
    const [organization, profile, hr] = await Promise.all([
      Organization.findById(organizationId).lean(),
      Profile.findOne({ organizationId, userId: employee._id }).lean(),
      User.findOne({ organizationId, role: Role.HR }).lean(),
    ]);
    if (!organization || !profile?.departmentId || !hr) throw new Error('Employee organization, department, or HR seed account is missing.');

    const workplace = await Workplace.findOneAndUpdate(
      { organizationId, code: 'TVS-HQ' },
      { $setOnInsert: { organizationId, code: 'TVS-HQ', name: 'Văn phòng TVS', type: WorkplaceType.IN_OFFICE, address: 'Thành phố Hồ Chí Minh', latitude: 10.7769, longitude: 106.7009, allowedRadiusMeters: 200, maximumAccuracyMeters: 100, active: true } },
      { upsert: true, new: true },
    );
    const shift = await Shift.findOneAndUpdate(
      { organizationId, code: 'HC-0800' },
      { $set: { organizationId, code: 'HC-0800', name: 'Ca hành chính 1', scope: ShiftScope.DEPARTMENT, departmentId: profile.departmentId, weekdays: [1,2,3,4,5], effectiveFrom: '2026-01-01', startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 10, active: true }, $unset: { workplaceId: 1 } },
      { upsert: true, new: true },
    );

    const today = new Date(`${isoDate(new Date())}T00:00:00.000Z`);
    const monthStart = `${isoDate(today).slice(0, 7)}-01`;
    await Assignment.updateOne(
      { organizationId, userId: employee._id, active: true },
      { $set: { departmentId: profile.departmentId, workplaceId: workplace._id, shiftTemplateId: shift._id, effectiveFrom: monthStart, active: true } },
      { upsert: true },
    );
    const holiday = nextWeekday(today, 7);
    const specialWorkingDay = (() => { let date = addDays(today, 1); while (date.getUTCDay() !== 6) date = addDays(date, 1); return date; })();
    await Calendar.updateOne(
      { organizationId, date: isoDate(holiday) },
      { $setOnInsert: { organizationId, date: isoDate(holiday), type: CalendarExceptionType.PUBLIC_HOLIDAY, name: 'Ngày nghỉ nội bộ TVS', createdBy: hr._id } },
      { upsert: true },
    );
    await Calendar.updateOne(
      { organizationId, date: isoDate(specialWorkingDay) },
      { $setOnInsert: { organizationId, date: isoDate(specialWorkingDay), type: CalendarExceptionType.SPECIAL_WORKING_DAY, name: 'Ngày làm việc bù', createdBy: hr._id } },
      { upsert: true },
    );

    const leaveStart = isoDate(nextWeekday(today, 14));
    const leaveEnd = isoDate(nextWeekday(new Date(`${leaveStart}T00:00:00.000Z`), 1));
    const approved = await Leave.findOneAndUpdate(
      { organizationId, employeeId: employee._id, startDate: leaveStart, endDate: leaveEnd },
      { $setOnInsert: { organizationId, employeeId: employee._id, departmentId: profile.departmentId, startDate: leaveStart, endDate: leaveEnd, leaveType: LeaveType.PAID_LEAVE, reason: 'Nghỉ phép gia đình theo kế hoạch cá nhân', status: LeaveRequestStatus.APPROVED, reviewedBy: hr._id, reviewedAt: new Date(), reviewComment: 'Dữ liệu demo đã được duyệt' } },
      { upsert: true, new: true },
    );
    await LeaveAction.updateOne(
      { organizationId, leaveRequestId: approved._id, action: 'APPROVE' },
      { $setOnInsert: { organizationId, leaveRequestId: approved._id, actorId: hr._id, action: 'APPROVE', previousStatus: LeaveRequestStatus.PENDING_MANAGER, newStatus: LeaveRequestStatus.APPROVED, comment: 'Dữ liệu demo' } },
      { upsert: true },
    );

    const appliedDate = isoDate(nextWeekday(addDays(today, -14), 0));
    const applied = await Leave.findOneAndUpdate(
      { organizationId, employeeId: employee._id, startDate: appliedDate, endDate: appliedDate },
      { $setOnInsert: { organizationId, employeeId: employee._id, departmentId: profile.departmentId, startDate: appliedDate, endDate: appliedDate, leaveType: LeaveType.PAID_LEAVE, reason: 'Nghỉ phép cá nhân đã hoàn tất quy trình', status: LeaveRequestStatus.HR_APPLIED, reviewedBy: hr._id, reviewedAt: new Date(), appliedBy: hr._id, appliedAt: new Date() } },
      { upsert: true, new: true },
    );
    await Override.updateOne(
      { organizationId, employeeId: employee._id, date: appliedDate },
      { $setOnInsert: { organizationId, employeeId: employee._id, date: appliedDate, type: LeaveType.PAID_LEAVE, leaveRequestId: applied._id, reason: applied.reason, createdBy: hr._id } },
      { upsert: true },
    );

    console.log(`[seed:scheduling] Nguyễn Văn An (${String(employee._id)}): scoped shift=1, calendar=2, leave requests=2, override=1`);
  } finally {
    await closeConnection(connection);
  }
}

void main().catch(error => { console.error('[seed:scheduling] failed:', error instanceof Error ? error.message : error); process.exitCode = 1; });
