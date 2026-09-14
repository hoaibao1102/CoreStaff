import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../../config/env';
import { closeConnection } from '../mongo-tools';
import { OrganizationSchema } from '../schemas/organization.schema';
import { UserSchema } from '../schemas/user.schema';
import { Role, UserStatus, OrganizationStatus, normalizeEmail } from '../schemas/enums';
import { hashPassword } from '../../auth/strategies/bcrypt.strategy';
import { ORGS, HRS } from './seed-data';

/**
 * Idempotent seed for TASK-019 — two Organizations, one HR each, plus a platform
 * System Admin. Re-running skips rows that already exist (matched by unique key)
 * and never prints the connection URI or any password.
 *
 * Run: `npm run seed` (from Apps/api).
 */
type OrgModel = mongoose.Model<{ _id: mongoose.Types.ObjectId; code: string }>;
type UserModel = mongoose.Model<{
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
}>;

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

    const orgIds = new Map<string, mongoose.Types.ObjectId>();
    for (const { code, name } of ORGS) {
      const existing = await Org.findOne({ code }).exec();
      if (existing) {
        orgIds.set(code, existing._id);
        console.log(`[seed] SKIPPED org ${code}`);
        continue;
      }
      const created = await Org.create({
        code,
        name,
        status: OrganizationStatus.ACTIVE,
      });
      orgIds.set(code, created._id);
      console.log(`[seed] CREATED org ${code}`);
    }

    for (const hr of HRS) {
      const organizationId = orgIds.get(hr.orgCode);
      if (!organizationId) throw new Error(`Seed data references unknown orgCode: ${hr.orgCode}`);
      const emailN = normalizeEmail(hr.email);
      const existing = await User.findOne({ organizationId, emailN }).exec();
      if (existing) {
        console.log(`[seed] SKIPPED user ${hr.email}`);
        continue;
      }
      await User.create({
        organizationId,
        email: hr.email,
        fullName: hr.fullName,
        employeeCode: hr.employeeCode,
        passwordHash: await hashPassword(hr.tempPassword),
        role: Role.HR,
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
        failedLoginCount: 0,
      });
      console.log(`[seed] CREATED user ${hr.email} (role=HR, org=${hr.orgCode})`);
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
