import './env-guard';
import * as mongoose from 'mongoose';
import { Schema } from 'mongoose';
import { hashToken } from '../src/auth/strategies/token-strategy';
import { VN_OFFSET_MS, vnDayBounds } from '../src/common/vietnam-time';
import { RETROACTIVE_GRACE_DAYS } from '../src/hr/overtime/overtime.service';
import { Role, UserStatus } from '../src/database/schemas/enums';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';
import { connection } from './app-factory';

/**
 * Fixtures for the integration lane. These write through the real schemas (so
 * required fields and unique indexes are exercised) but skip the HTTP layer —
 * seeding a tenant over the API would make every test depend on auth working.
 *
 * Models come from `connection()`, the one Nest built, never from the global
 * `mongoose.connection` — `forRoot` uses `createConnection()`, so the global one
 * has none of these registered on it.
 */
const schemas = new Map<string, Schema>(SCHEMA_REGISTRY.map(({ name, schema }) => [name, schema]));

function model(name: string): mongoose.Model<any> {
  const existing = connection().models[name];
  if (existing) return existing;
  const schema = schemas.get(name);
  if (!schema) throw new Error(`"${name}" is not in SCHEMA_REGISTRY — nothing to seed`);
  return connection().model(name, schema);
}

const VN = '+07:00';

/** `2026-09-22 18:00` Vietnam → the instant the web app sends for that wall clock. */
export function vn(workDate: string, hhmm: string): Date {
  return new Date(`${workDate}T${hhmm}:00${VN}`);
}

/** Today's date as the app sees it: a 'YYYY-MM-DD' in Vietnam wall-clock terms. */
export function vnToday(): string {
  return new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * A Vietnam weekday (Mon–Fri) a report may still be filed for *without* owing a
 * retroactive reason.
 *
 * Tests must not hard-code a work date: `RETROACTIVE_GRACE_DAYS` makes a report
 * older than the window need `retroactiveReason`, so a fixed date would turn
 * every run a week later into a 409 that has nothing to do with the code under
 * test. A weekday is what makes the seeded shift template apply, so the day
 * classifies as a working day.
 *
 * Candidates are tried nearest-first (today, then back, then forward) and the
 * grace deadline is checked with the same rule the service uses — which is what
 * makes a Sunday run pick forward to Monday rather than back to a Friday that is
 * already out of window.
 */
export function recentWorkDate(): string {
  const now = Date.now();
  for (let offset = 0; offset <= 3; offset += 1) {
    for (const sign of offset === 0 ? [0] : [-1, 1]) {
      const date = new Date(now + VN_OFFSET_MS + sign * offset * 86_400_000);
      if (date.getUTCDay() < 1 || date.getUTCDay() > 5) continue;
      const workDate = date.toISOString().slice(0, 10);
      const graceDeadline = vnDayBounds(workDate).to - 1 + RETROACTIVE_GRACE_DAYS * 86_400_000;
      if (now <= graceDeadline) return workDate;
    }
  }
  return vnToday();
}

export interface Fixture {
  organizationId: string;
  departmentId: string;
  employeeId: string;        // User id
  profileId: string;         // EmployeeProfile id — NOT the punch key
  managerId: string;
  hrId: string;
  policyVersion: number;
}

let sequence = 0;

/**
 * One tenant with everything an overtime request needs to resolve: a department,
 * users + profiles, a manager assignment, a weekday shift and a labor policy.
 * `overrides` lets a spec shrink a cap without touching the legal seed defaults.
 */
export async function seedTenant(overrides: Record<string, unknown> = {}): Promise<Fixture> {
  sequence += 1;
  const slug = `it${sequence}`;
  const organizationId = (await model('Organization').create({
    code: slug.toUpperCase(),
    name: `Integration ${slug}`,
    status: 'ACTIVE',
    timezone: 'Asia/Ho_Chi_Minh',
  }))._id;

  const departmentId = (await model('Department').create({
    organizationId, code: `${slug}-KT`, name: `Kỹ thuật ${slug}`, active: true,
  }))._id;

  const mkUser = (role: Role, tag: string) => model('User').create({
    organizationId,
    email: `${tag}.${slug}@example.test`,
    emailN: `${tag}.${slug}@example.test`,
    passwordHash: 'not-a-real-hash',
    fullName: `NV ${tag}`,
    role,
    status: UserStatus.ACTIVE,
    mustChangePassword: false,
  });

  const employee = await mkUser(Role.EMPLOYEE, 'emp');
  const manager = await mkUser(Role.DEPARTMENT_MANAGER, 'mgr');
  const hr = await mkUser(Role.HR, 'hr');
  const profile = await model('EmployeeProfile').create({
    organizationId, userId: employee._id, employeeCode: `NV${slug}`.toUpperCase(),
    employmentType: 'FULL_TIME', employmentStatus: 'ACTIVE', joinDate: new Date('2026-01-01'),
    departmentId,
  });
  await model('ManagerAssignment').create({
    organizationId, managerUserId: manager._id, departmentId,
    effectiveFrom: new Date('2026-01-01'), active: true, createdBy: hr._id,
  });
  await model('Assignment').create({
    organizationId, userId: employee._id, departmentId, active: true,
  });

  // A weekday (Mon–Fri) department shift: 08:00–17:00 with a 60-minute break.
  // `ShiftResolverService` reads it via EmployeeProfile.departmentId, which the
  // profile above carries — so this row is what makes the day a *working* day.
  await model('ShiftTemplate').create({
    organizationId, scope: 'DEPARTMENT', departmentId, weekdays: [1, 2, 3, 4, 5],
    name: `Hành chính ${slug}`, startTime: '08:00', endTime: '17:00',
    breakMinutes: 60, gracePeriodMinutes: 5, effectiveFrom: '2026-01-01', active: true,
  });

  // SRS §30B.1 Vietnam seed. `overrides` only ever lowers a cap for a test —
  // nothing here encodes a legal number the team has not confirmed (§30K).
  const policy = await model('LaborCompliancePolicy').create({
    organizationId, effectiveFrom: new Date('2026-01-01'),
    normalDailyMinutes: 480, normalWeeklyMinutes: 2880, maxCombinedDailyMinutes: 720,
    maxMonthlyOvertimeMinutes: 2400, maxAnnualOvertimeMinutes: 20000,
    exceptionalAnnualOvertimeMinutes: 24000, warningThresholdPercent: 80,
    probationMinimumRate: 0.85, legalReference: 'BLLĐ 45/2019/QH14 điều 107',
    version: 1, active: true,
    ...overrides,
  });

  return {
    organizationId: String(organizationId), departmentId: String(departmentId),
    employeeId: String(employee._id), profileId: String(profile._id),
    managerId: String(manager._id), hrId: String(hr._id),
    policyVersion: policy.version,
  };
}

export async function setLaborPolicy(organizationId: string, changes: Record<string, unknown>): Promise<void> {
  await model('LaborCompliancePolicy').updateOne({ organizationId }, { $set: changes });
}

/** A completed attendance day — the punches the eligible calculation reads. */
export async function seedAttendanceDay(
  fixture: Fixture,
  workDate: string,
  checkInAt: Date,
  checkOutAt: Date,
  workingMinutes: number,
): Promise<string> {
  const day = await model('AttendanceDay').create({
    organizationId: fixture.organizationId,
    employeeId: fixture.employeeId,
    workDate,
    attendanceStatus: 'COMPLETED',
    checkInAt, checkOutAt, workingMinutes,
    shiftSnapshot: { startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 5 },
    employeeSnapshot: { departmentId: fixture.departmentId },
  });
  return String(day._id);
}

export async function addCalendarException(fixture: Fixture, date: string, type: string, name: string): Promise<void> {
  await model('CalendarException').create({
    organizationId: fixture.organizationId, date, type, name, createdBy: fixture.hrId,
  });
}

/** A registered model by name, for direct assertions on stored documents. */
export function collection(name: string) {
  return model(name);
}

/**
 * A live session cookie for one of the fixture users — the guard then runs for
 * real (token hash lookup, expiry, tenant derivation), so `req.user` and
 * `req.tenantContext` are exactly what production sets. No guard is overridden.
 */
export async function cookieFor(userId: string, organizationId: string): Promise<string> {
  const token = `sid-${userId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await model('UserSession').create({
    userId, organizationId, tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 30 * 60_000), revokedAt: null,
  });
  return `sid=${token}`;
}
