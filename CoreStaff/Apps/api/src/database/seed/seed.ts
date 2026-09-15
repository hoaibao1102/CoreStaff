import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../../config/env';
import { closeConnection } from '../mongo-tools';
import { OrganizationSchema } from '../schemas/organization.schema';
import { UserSchema } from '../schemas/user.schema';
import { DepartmentSchema } from '../schemas/department.schema';
import { PositionSchema } from '../schemas/position.schema';
import { EmployeeProfileSchema } from '../schemas/employee-profile.schema';
import { EmploymentHistorySchema } from '../schemas/employment-history.schema';
import { EmploymentStatus, Role, UserStatus, OrganizationStatus, normalizeEmail } from '../schemas/enums';
import { hashPassword } from '../../auth/strategies/bcrypt.strategy';
import { ORGS, HRS, DEPARTMENTS, POSITIONS, EMPLOYEES } from './seed-data';

/**
 * Idempotent seed: TASK-019 Organizations + HR/System Admin accounts, plus the
 * TASK-020..023 demo catalog (Departments, Positions, EmployeeProfiles and the
 * EmploymentHistory rows a PROBATION→ACTIVE promotion would have produced).
 * Re-running skips rows that already exist (matched by unique key) and never
 * prints the connection URI or any password.
 *
 * Run: `npm run seed` (from Apps/api).
 */
type IdDoc = { _id: mongoose.Types.ObjectId };
type OrgModel = mongoose.Model<IdDoc & { code: string }>;
type UserModel = mongoose.Model<
  IdDoc & {
    organizationId?: mongoose.Types.ObjectId;
    emailN: string;
    email: string;
    fullName: string;
    passwordHash: string;
    role: string;
    status: string;
    mustChangePassword: boolean;
    failedLoginCount: number;
    employeeCode?: string;
  }
>;
type CatalogModel = mongoose.Model<IdDoc & { organizationId: mongoose.Types.ObjectId; code: string; name: string; active: boolean }>;
type ProfileModel = mongoose.Model<IdDoc & Record<string, unknown>>;
type HistoryModel = mongoose.Model<IdDoc & Record<string, unknown>>;

async function main(): Promise<void> {
  const env = resolveEnv();
  if (!hasMongoUri(env)) {
    console.error(
      `[seed] No Mongo URI configured (checked ${env.mongodbSourceKey ?? 'MONGODB_URI'}). ` +
        'Add MONGODB_URI to Apps/api/.env.',
    );
    process.exitCode = 1;
    return;
  }

  const connection = mongoose.createConnection(env.mongodbUri, {
    serverSelectionTimeoutMS: 15000,
  });

  try {
    await connection.asPromise();
    const Org = connection.model('Organization', OrganizationSchema) as unknown as OrgModel;
    const User = connection.model('User', UserSchema) as unknown as UserModel;
    const Department = connection.model('Department', DepartmentSchema) as unknown as CatalogModel;
    const Position = connection.model('Position', PositionSchema) as unknown as CatalogModel;
    const Profile = connection.model('EmployeeProfile', EmployeeProfileSchema) as unknown as ProfileModel;
    const History = connection.model('EmploymentHistory', EmploymentHistorySchema) as unknown as HistoryModel;

    const orgIds = new Map<string, mongoose.Types.ObjectId>();
    for (const { code, name } of ORGS) {
      const existing = await Org.findOne({ code }).exec();
      if (existing) {
        orgIds.set(code, existing._id);
        console.log(`[seed] SKIPPED org ${code}`);
        continue;
      }
      const created = await Org.create({ code, name, status: OrganizationStatus.ACTIVE });
      orgIds.set(code, created._id);
      console.log(`[seed] CREATED org ${code}`);
    }

    // userIds/employeeIds are filled for every seeded account (HR included) so
    // profiles and directManagerId can resolve without a second pass.
    const userIds = new Map<string, mongoose.Types.ObjectId>();
    const hrIds = new Map<string, mongoose.Types.ObjectId>();

    for (const hr of HRS) {
      const id = await upsertUser(User, orgIds, hr.orgCode, hr.email, hr.fullName, hr.employeeCode, hr.tempPassword, Role.HR);
      userIds.set(hr.employeeCode, id);
      hrIds.set(hr.orgCode, id);
    }
    for (const emp of EMPLOYEES) {
      userIds.set(emp.employeeCode, await upsertUser(User, orgIds, emp.orgCode, emp.email, emp.fullName, emp.employeeCode, emp.tempPassword, emp.role));
    }

    const deptIds = new Map<string, mongoose.Types.ObjectId>();
    for (const dep of DEPARTMENTS) {
      deptIds.set(`${dep.orgCode}/${dep.code}`, await upsertCatalog(Department, orgIds, dep, 'department'));
    }
    const positionIds = new Map<string, mongoose.Types.ObjectId>();
    for (const pos of POSITIONS) {
      positionIds.set(`${pos.orgCode}/${pos.code}`, await upsertCatalog(Position, orgIds, pos, 'position'));
    }

    // HR staff are employees too — a profile with no dept/position, promoted to ACTIVE.
    for (const hr of HRS) {
      await upsertProfile(Profile, orgIds, userIds, deptIds, positionIds, {
        orgCode: hr.orgCode,
        employeeCode: hr.employeeCode,
        joinDate: hr.joinDate,
        activeDate: hr.activeDate,
        email: hr.email,
      });
    }
    for (const emp of EMPLOYEES) {
      await upsertProfile(Profile, orgIds, userIds, deptIds, positionIds, emp);
    }

    // History mirrors what the app would have written: PROBATION at creation has
    // no row (see EmploymentHistory.previousStatus); promotions get exactly one.
    for (const seed of [...HRS, ...EMPLOYEES]) {
      if (!seed.activeDate) continue;
      const userId = userIds.get(seed.employeeCode);
      const organizationId = orgIds.get(seed.orgCode);
      if (!userId || !organizationId) continue;
      const profile = await Profile.findOne({ organizationId, userId }).exec();
      if (!profile) continue;
      const existing = await History.findOne({ employeeProfileId: profile._id, newStatus: EmploymentStatus.ACTIVE }).exec();
      if (existing) {
        console.log(`[seed] SKIPPED history ${seed.employeeCode}`);
        continue;
      }
      await History.create({
        organizationId,
        employeeProfileId: profile._id,
        previousStatus: EmploymentStatus.PROBATION,
        newStatus: EmploymentStatus.ACTIVE,
        effectiveDate: new Date(seed.activeDate),
        reason: 'Probation completed (seed data)',
        changedBy: hrIds.get(seed.orgCode),
      });
      console.log(`[seed] CREATED history ${seed.employeeCode}`);
    }

    await seedSystemAdmin(User);
    console.log('[seed] done');
  } catch (err) {
    console.error('[seed] failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await closeConnection(connection);
  }
}

interface ProfileSeed {
  orgCode: string;
  employeeCode: string;
  joinDate: string;
  activeDate?: string;
  email: string;
  departmentCode?: string;
  positionCode?: string;
  managerCode?: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
}

async function upsertProfile(
  Profile: ProfileModel,
  orgIds: Map<string, mongoose.Types.ObjectId>,
  userIds: Map<string, mongoose.Types.ObjectId>,
  deptIds: Map<string, mongoose.Types.ObjectId>,
  positionIds: Map<string, mongoose.Types.ObjectId>,
  seed: ProfileSeed,
): Promise<void> {
  const organizationId = orgIds.get(seed.orgCode);
  const userId = userIds.get(seed.employeeCode);
  if (!organizationId || !userId) throw new Error(`Seed data references unknown org/user: ${seed.employeeCode}`);

  const existing = await Profile.findOne({ organizationId, userId }).exec();
  if (existing) {
    console.log(`[seed] SKIPPED profile ${seed.employeeCode}`);
    return;
  }
  await Profile.create({
    organizationId,
    userId,
    employeeCode: seed.employeeCode,
    joinDate: new Date(seed.joinDate),
    // The service always creates PROBATION and only reaches ACTIVE via a
    // validated transition, so ACTIVE here stands for "already promoted".
    employmentStatus: seed.activeDate ? EmploymentStatus.ACTIVE : EmploymentStatus.PROBATION,
    email: seed.email,
    departmentId: catalogId(deptIds, seed.orgCode, seed.departmentCode, 'department'),
    positionId: catalogId(positionIds, seed.orgCode, seed.positionCode, 'position'),
    directManagerId: seed.managerCode ? userIds.get(seed.managerCode) : undefined,
    dateOfBirth: seed.dateOfBirth ? new Date(seed.dateOfBirth) : undefined,
    gender: seed.gender,
    phone: seed.phone,
  });
  console.log(`[seed] CREATED profile ${seed.employeeCode}`);
}

function catalogId(
  ids: Map<string, mongoose.Types.ObjectId>,
  orgCode: string,
  code: string | undefined,
  label: string,
): mongoose.Types.ObjectId | undefined {
  if (!code) return undefined;
  const id = ids.get(`${orgCode}/${code}`);
  if (!id) throw new Error(`Seed data references unknown ${label}: ${orgCode}/${code}`);
  return id;
}

async function upsertUser(
  User: UserModel,
  orgIds: Map<string, mongoose.Types.ObjectId>,
  orgCode: string,
  email: string,
  fullName: string,
  employeeCode: string,
  tempPassword: string,
  role: string,
): Promise<mongoose.Types.ObjectId> {
  const organizationId = orgIds.get(orgCode);
  if (!organizationId) throw new Error(`Seed data references unknown orgCode: ${orgCode}`);
  const emailN = normalizeEmail(email);
  const existing = await User.findOne({ organizationId, emailN }).exec();
  if (existing) {
    console.log(`[seed] SKIPPED user ${email}`);
    return existing._id;
  }
  const created = await User.create({
    organizationId,
    email,
    fullName,
    employeeCode,
    passwordHash: await hashPassword(tempPassword),
    role,
    status: UserStatus.ACTIVE,
    mustChangePassword: true,
    failedLoginCount: 0,
  });
  console.log(`[seed] CREATED user ${email} (role=${role}, org=${orgCode})`);
  return created._id;
}

async function upsertCatalog(
  Model: CatalogModel,
  orgIds: Map<string, mongoose.Types.ObjectId>,
  row: { orgCode: string; code: string; name: string },
  label: string,
): Promise<mongoose.Types.ObjectId> {
  const organizationId = orgIds.get(row.orgCode);
  if (!organizationId) throw new Error(`Seed data references unknown orgCode: ${row.orgCode}`);
  const existing = await Model.findOne({ organizationId, code: row.code }).exec();
  if (existing) {
    console.log(`[seed] SKIPPED ${label} ${row.orgCode}/${row.code}`);
    return existing._id;
  }
  const created = await Model.create({ organizationId, code: row.code, name: row.name, active: true });
  console.log(`[seed] CREATED ${label} ${row.orgCode}/${row.code}`);
  return created._id;
}

/** Platform-local SYSTEM_ADMIN from env (PLATFORM_ADMIN_EMAIL / _PASSWORD); orgId null. */
async function seedSystemAdmin(User: UserModel): Promise<void> {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('[seed] SKIPPED system admin (PLATFORM_ADMIN_EMAIL/_PASSWORD not set)');
    return;
  }
  const emailN = normalizeEmail(email);
  const existing = await User.findOne({ emailN }).exec();
  if (existing) {
    console.log(`[seed] SKIPPED system admin ${email}`);
    return;
  }
  await User.create({
    email,
    fullName: 'Platform System Administrator',
    passwordHash: await hashPassword(password),
    role: Role.SYSTEM_ADMIN,
    status: UserStatus.ACTIVE,
    mustChangePassword: true,
    failedLoginCount: 0,
  });
  console.log(`[seed] CREATED system admin ${email} (role=SYSTEM_ADMIN)`);
}

void main();
