import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../../config/env';
import { closeConnection } from '../mongo-tools';
import { OrganizationSchema } from '../schemas/organization.schema';
import { UserSchema } from '../schemas/user.schema';
import { DepartmentSchema } from '../schemas/department.schema';
import { PositionSchema } from '../schemas/position.schema';
import { EmployeeProfileSchema } from '../schemas/employee-profile.schema';
import { EmploymentHistorySchema } from '../schemas/employment-history.schema';
import { EmploymentContractSchema } from '../schemas/employment-contract.schema';
import { EmployeeDocumentSchema } from '../schemas/employee-document.schema';
import { AllowanceCatalogSchema, AttendanceBonusTemplateSchema, LaborCompliancePolicySchema } from '../schemas/compensation.schema';
import { EmploymentStatus, Role, OrganizationStatus, normalizeEmail } from '../schemas/enums';
import { hashPassword } from '../../auth/strategies/bcrypt.strategy';
import { userFields, profileFields, type AccountInput } from './provision';
import { ORGS, HRS, DEPARTMENTS, POSITIONS, EMPLOYEES, CONTRACTS, DOCUMENTS, DEV_SEED_PASSWORD, type ContractSeed, type DocumentSeed } from './seed-data';

/**
 * Idempotent seed: TASK-019 Organizations + HR/System Admin accounts, plus the
 * TASK-020..023 demo catalog (Departments, Positions, EmployeeProfiles and the
 * EmploymentHistory rows a PROBATION→ACTIVE promotion would have produced).
 * Re-running skips rows that already exist (matched by unique key) and never
 * prints the connection URI or any password.
 *
 * Document shapes come from the shared `provision` module so seed and
 * `EmployeeService` cannot disagree about which field lives on which collection
 * (TASK-120). Seed still writes in two passes because a profile may point at
 * another seeded account's userId (directManagerId), which needs them all created.
 *
 * Run: `npm run seed` (from Apps/api).
 */
type IdDoc = { _id: mongoose.Types.ObjectId };
type OrgModel = mongoose.Model<IdDoc & { code: string }>;
type UserModel = mongoose.Model<IdDoc & Record<string, unknown>>;
type CatalogModel = mongoose.Model<IdDoc & { organizationId: mongoose.Types.ObjectId; code: string; name: string; active: boolean }>;
type ProfileModel = mongoose.Model<IdDoc & Record<string, unknown>>;
type HistoryModel = mongoose.Model<IdDoc & Record<string, unknown>>;
type ContractModel = mongoose.Model<IdDoc & Record<string, unknown>>;
type DocumentModel = mongoose.Model<IdDoc & Record<string, unknown>>;

/** Row shape shared by HRS and EMPLOYEES — every seeded account is an employee. */
interface AccountSeed {
  orgCode: string;
  email: string;
  fullName: string;
  employeeCode: string;
  role: string;
  joinDate: string;
  /** Set ⇒ profile is ACTIVE and a PROBATION→ACTIVE history row uses this date. */
  activeDate?: string;
  phone?: string;
  departmentCode?: string;
  positionCode?: string;
  managerCode?: string;
  dateOfBirth?: string;
  gender?: string;
}

interface ResolvedIds {
  deptIds: Map<string, mongoose.Types.ObjectId>;
  positionIds: Map<string, mongoose.Types.ObjectId>;
  userIds: Map<string, mongoose.Types.ObjectId>;
}

/**
 * One temp password for every seeded demo account. `SEED_PASSWORD` is required
 * outside a dev environment — the committed default is local-only (DoD §:2352).
 * Hashed once; the value is never printed.
 */
async function seedPasswordHash(): Promise<string> {
  const configured = process.env.SEED_PASSWORD;
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('[seed] SEED_PASSWORD must be set outside a dev environment (no committed demo credentials).');
  }
  return hashPassword(configured || DEV_SEED_PASSWORD);
}

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
    const Contract = connection.model('EmploymentContract', EmploymentContractSchema) as unknown as ContractModel;
    const Doc = connection.model('EmployeeDocument', EmployeeDocumentSchema) as unknown as DocumentModel;
    const LaborPolicy = connection.model('LaborCompliancePolicy', LaborCompliancePolicySchema);
    const AllowanceCatalog = connection.model('AllowanceCatalog', AllowanceCatalogSchema);
    const BonusTemplate = connection.model('AttendanceBonusTemplate', AttendanceBonusTemplateSchema);

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

    // TASK-031..034 compensation foundations. Values are seed configuration,
    // never hard-coded in calculation services. Re-running is idempotent.
    for (const organizationId of orgIds.values()) {
      await LaborPolicy.updateOne(
        { organizationId, version: 1 },
        { $setOnInsert: { organizationId, effectiveFrom: new Date('2026-01-01'), probationMinimumRate: 0.85, version: 1, active: true } },
        { upsert: true },
      );
    }
    for (const item of [
      { code: 'MEAL', defaultName: 'Phụ cấp ăn trưa', defaultTaxable: false, defaultInsuranceBased: false },
      { code: 'FUEL', defaultName: 'Phụ cấp xăng xe', defaultTaxable: false, defaultInsuranceBased: false },
      { code: 'PHONE', defaultName: 'Phụ cấp điện thoại', defaultTaxable: true, defaultInsuranceBased: false },
    ]) await AllowanceCatalog.updateOne({ code: item.code }, { $setOnInsert: { ...item, active: true } }, { upsert: true });
    await BonusTemplate.updateOne(
      { code: 'ATTENDANCE_100_70_50' },
      { $setOnInsert: { code: 'ATTENDANCE_100_70_50', name: 'Chuyên cần 100/70/50', templateVersion: 1, active: true, tiers: [
        { order: 1, percentage: 100, conditions: [{ metric: 'LATE_COUNT', operator: 'EQ', value: 0 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] },
        { order: 2, percentage: 70, conditions: [{ metric: 'LATE_COUNT', operator: 'LTE', value: 2 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] },
        { order: 3, percentage: 50, conditions: [{ metric: 'LATE_COUNT', operator: 'LTE', value: 4 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] },
      ] } },
      { upsert: true },
    );

    const passwordHash = await seedPasswordHash();
    // HR rows carry no role in seed-data; they are the tenant's HR accounts.
    const accounts: AccountSeed[] = [...HRS.map((hr) => ({ ...hr, role: Role.HR })), ...EMPLOYEES];

    // Pass 1 — every login identity, so pass 2 can resolve both userId and
    // directManagerId without a third pass. Only the User fields are read here.
    const userIds = new Map<string, mongoose.Types.ObjectId>();
    const hrIds = new Map<string, mongoose.Types.ObjectId>();
    for (const account of accounts) {
      const id = await upsertUser(User, orgIds, account, passwordHash);
      userIds.set(account.employeeCode, id);
      if (account.role === Role.HR) hrIds.set(account.orgCode, id);
    }

    const deptIds = new Map<string, mongoose.Types.ObjectId>();
    for (const dep of DEPARTMENTS) {
      deptIds.set(`${dep.orgCode}/${dep.code}`, await upsertCatalog(Department, orgIds, dep, 'department'));
    }
    const positionIds = new Map<string, mongoose.Types.ObjectId>();
    for (const pos of POSITIONS) {
      positionIds.set(`${pos.orgCode}/${pos.code}`, await upsertCatalog(Position, orgIds, pos, 'position'));
    }

    // Pass 2 — the HR business record, which owns the employeeCode (TASK-120).
    const ids: ResolvedIds = { deptIds, positionIds, userIds };
    for (const account of accounts) {
      await upsertProfile(Profile, orgIds, ids, account);
    }

    // History mirrors what the app would have written: PROBATION at creation has
    // no row (see EmploymentHistory.previousStatus); promotions get exactly one.
    // Written directly rather than through EmployeeService.changeStatus, so the
    // self-approval guard there does not apply to an HR's own seeded promotion.
    for (const account of accounts) {
      if (!account.activeDate) continue;
      const userId = userIds.get(account.employeeCode);
      const organizationId = orgIds.get(account.orgCode);
      if (!userId || !organizationId) continue;
      const profile = await Profile.findOne({ organizationId, userId }).exec();
      if (!profile) continue;
      const existing = await History.findOne({ employeeProfileId: profile._id, newStatus: EmploymentStatus.ACTIVE }).exec();
      if (existing) {
        console.log(`[seed] SKIPPED history ${account.employeeCode}`);
        continue;
      }
      await History.create({
        organizationId,
        employeeProfileId: profile._id,
        previousStatus: EmploymentStatus.PROBATION,
        newStatus: EmploymentStatus.ACTIVE,
        effectiveDate: new Date(account.activeDate),
        reason: 'Probation completed (seed data)',
        changedBy: hrIds.get(account.orgCode),
      });
      console.log(`[seed] CREATED history ${account.employeeCode}`);
    }

    // Contracts (TASK-028/030) + document metadata (TASK-029) after every
    // profile exists, so both can resolve `employeeProfileId` in one pass.
    // Offsets are day-relative so the dashboard's 30-day warning stays live.
    const contractIds = new Map<string, mongoose.Types.ObjectId>();
    for (const row of CONTRACTS) {
      const profileId = await resolveProfileId(Profile, orgIds, userIds, row);
      if (!profileId) continue;
      const key = `${row.orgCode}\\${row.employeeCode}`;
      const existing = await Contract.findOne({ organizationId: requireOrg(orgIds, row.orgCode), employeeProfileId: profileId }).exec();
      if (existing) {
        contractIds.set(key, existing._id);
        console.log(`[seed] SKIPPED contract ${row.orgCode}/${row.employeeCode}`);
        continue;
      }
      const created = await Contract.create(toContractRow(orgIds, profileId, row));
      contractIds.set(key, created._id);
      console.log(`[seed] CREATED contract ${row.orgCode}/${row.employeeCode} (${row.status})`);
    }

    for (const row of DOCUMENTS) {
      const profileId = await resolveProfileId(Profile, orgIds, userIds, row);
      if (!profileId) continue;
      const contractKey = `${row.orgCode}\\${row.contractCode}`;
      const contractId = contractIds.get(contractKey);
      if (!contractId) {
        console.error(`[seed] SKIPPED document ${row.originalName}: no seeded contract for ${row.contractCode}`);
        continue;
      }
      const organizationId = requireOrg(orgIds, row.orgCode);
      const existing = await Doc.findOne({ organizationId, employeeProfileId: profileId, originalName: row.originalName }).exec();
      if (existing) {
        console.log(`[seed] SKIPPED document ${row.originalName}`);
        continue;
      }
      // Metadata row only — storageKey is a seed ObjectId with no real S3 object
      // (downloads 404 by design; AC-CONTRACT-01 file privacy).
      const docId = new mongoose.Types.ObjectId();
      await Doc.create({
        _id: docId,
        organizationId,
        employeeProfileId: profileId,
        contractId,
        originalName: row.originalName,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        storageKey: `${row.orgCode}/${docId}`,
        uploadedBy: hrIds.get(row.orgCode),
      });
      console.log(`[seed] CREATED document ${row.originalName}`);
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

function requireOrg(orgIds: Map<string, mongoose.Types.ObjectId>, orgCode: string): mongoose.Types.ObjectId {
  const organizationId = orgIds.get(orgCode);
  if (!organizationId) throw new Error(`Seed data references unknown orgCode: ${orgCode}`);
  return organizationId;
}

/** The one place a seed row becomes the shape `provision` writes.
 * Omit `ids` for the User-only pass: the catalog/manager refs are profile fields,
 * and resolving them before the catalogs exist would fail on valid seed data. */
function toAccountInput(
  orgIds: Map<string, mongoose.Types.ObjectId>,
  account: AccountSeed,
  passwordHash: string,
  ids?: ResolvedIds,
): AccountInput {
  return {
    organizationId: requireOrg(orgIds, account.orgCode),
    email: account.email,
    fullName: account.fullName,
    phone: account.phone,
    employeeCode: account.employeeCode,
    passwordHash,
    role: account.role,
    joinDate: account.joinDate,
    // A row with an activeDate stands in for an already-promoted employee.
    employmentStatus: account.activeDate ? EmploymentStatus.ACTIVE : EmploymentStatus.PROBATION,
    departmentId: ids && account.departmentCode ? catalogId(ids.deptIds, account.orgCode, account.departmentCode, 'department') : undefined,
    positionId: ids && account.positionCode ? catalogId(ids.positionIds, account.orgCode, account.positionCode, 'position') : undefined,
    directManagerId: ids && account.managerCode ? ids.userIds.get(account.managerCode) : undefined,
    dateOfBirth: account.dateOfBirth ? new Date(account.dateOfBirth) : undefined,
    gender: account.gender,
  };
}

async function upsertUser(
  User: UserModel,
  orgIds: Map<string, mongoose.Types.ObjectId>,
  account: AccountSeed,
  passwordHash: string,
): Promise<mongoose.Types.ObjectId> {
  const organizationId = requireOrg(orgIds, account.orgCode);
  const emailN = normalizeEmail(account.email);
  const existing = await User.findOne({ organizationId, emailN }).exec();
  if (existing) {
    console.log(`[seed] SKIPPED user ${account.email}`);
    return existing._id as mongoose.Types.ObjectId;
  }
  // Builders return Record<string, unknown> (no _id yet), so the doc is cast.
  const created = (await User.create(userFields(toAccountInput(orgIds, account, passwordHash)) as never)) as unknown as IdDoc;
  console.log(`[seed] CREATED user ${account.email} (role=${account.role}, org=${account.orgCode})`);
  return created._id as mongoose.Types.ObjectId;
}

async function upsertProfile(
  Profile: ProfileModel,
  orgIds: Map<string, mongoose.Types.ObjectId>,
  ids: ResolvedIds,
  account: AccountSeed,
): Promise<void> {
  const organizationId = requireOrg(orgIds, account.orgCode);
  const userId = ids.userIds.get(account.employeeCode);
  if (!userId) throw new Error(`Seed data references unknown user: ${account.employeeCode}`);

  const existing = await Profile.findOne({ organizationId, userId }).exec();
  if (existing) {
    console.log(`[seed] SKIPPED profile ${account.employeeCode}`);
    return;
  }
  // passwordHash is irrelevant to the profile half; profileFields ignores it.
  await Profile.create(profileFields(toAccountInput(orgIds, account, '', ids), userId) as never);
  console.log(`[seed] CREATED profile ${account.employeeCode}`);
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

async function upsertCatalog(
  Model: CatalogModel,
  orgIds: Map<string, mongoose.Types.ObjectId>,
  row: { orgCode: string; code: string; name: string },
  label: string,
): Promise<mongoose.Types.ObjectId> {
  const organizationId = requireOrg(orgIds, row.orgCode);
  const existing = await Model.findOne({ organizationId, code: row.code }).exec();
  if (existing) {
    console.log(`[seed] SKIPPED ${label} ${row.orgCode}/${row.code}`);
    return existing._id;
  }
  const created = await Model.create({ organizationId, code: row.code, name: row.name, active: true });
  console.log(`[seed] CREATED ${label} ${row.orgCode}/${row.code}`);
  return created._id;
}

/** Resolves the seeded profile for a contract/document row; null when the seed is inconsistent. */
async function resolveProfileId(
  Profile: ProfileModel,
  orgIds: Map<string, mongoose.Types.ObjectId>,
  userIds: Map<string, mongoose.Types.ObjectId>,
  row: { orgCode: string; employeeCode: string },
): Promise<mongoose.Types.ObjectId | null> {
  const userId = userIds.get(row.employeeCode);
  if (!userId) throw new Error(`Seed data references unknown user: ${row.employeeCode}`);
  const profile = await Profile.findOne({ organizationId: requireOrg(orgIds, row.orgCode), userId }).exec();
  return profile?._id ?? null;
}

/** Contract seed row → document shape. Day offsets resolve against seed time so the
 * server reads the relative gaps (TASK-030 warning window) rather than stale dates. */
function toContractRow(
  orgIds: Map<string, mongoose.Types.ObjectId>,
  employeeProfileId: mongoose.Types.ObjectId,
  row: ContractSeed,
): Record<string, unknown> {
  const today = new Date();
  const inDays = (n = 0) => new Date(today.getTime() + n * 86_400_000);
  return {
    organizationId: requireOrg(orgIds, row.orgCode),
    employeeProfileId,
    contractType: row.contractType,
    status: row.status,
    effectiveDate: inDays(row.effectiveOffsetDays ?? 0),
    expiryDate: row.expiryOffsetDays !== undefined ? inDays(row.expiryOffsetDays) : undefined,
    endDate: row.endDate ? new Date(row.endDate) : undefined,
    note: row.note,
  };
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
  // A platform account is orgless and has no EmployeeProfile, so it only needs
  // the User half — which is still the shape every other account gets.
  await User.create(
    userFields({
      organizationId: undefined,
      email,
      fullName: 'Platform System Administrator',
      passwordHash: await hashPassword(password),
      role: Role.SYSTEM_ADMIN,
    }) as never,
  );
  console.log(`[seed] CREATED system admin ${email} (role=SYSTEM_ADMIN)`);
}

void main();
