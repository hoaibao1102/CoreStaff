/** Read-only compensation seed inventory. Never prints secrets or session data. */
import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { OrganizationSchema } from '../src/database/schemas/organization.schema';
import { EmployeeProfileSchema } from '../src/database/schemas/employee-profile.schema';
import { UserSchema } from '../src/database/schemas/user.schema';
import { PositionSchema } from '../src/database/schemas/position.schema';

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured');
  const db = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 });
  await db.asPromise();
  const Org = db.model('Organization', OrganizationSchema);
  const Profile = db.model('EmployeeProfile', EmployeeProfileSchema);
  const User = db.model('User', UserSchema);
  const Position = db.model('Position', PositionSchema);
  const orgs = await Org.find({}).select('_id code name').sort({ code: 1 }).lean();
  for (const org of orgs) {
    console.log(`\n${org.code} | ${org.name} | ${org._id}`);
    const profiles = await Profile.find({ organizationId: org._id }).select('_id userId employeeCode employmentStatus positionId').sort({ employeeCode: 1 }).lean();
    const userIds = profiles.map(p => p.userId);
    const positionIds = profiles.map(p => p.positionId).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select('_id fullName').lean();
    const positions = await Position.find({ _id: { $in: positionIds } }).select('_id code name').lean();
    const names = new Map(users.map(u => [String(u._id), u.fullName]));
    const pos = new Map(positions.map(p => [String(p._id), `${p.code}/${p.name}`]));
    for (const p of profiles) console.log(`  ${p.employeeCode} | ${names.get(String(p.userId)) ?? '-'} | ${p.employmentStatus} | ${pos.get(String(p.positionId)) ?? '-'} | ${p._id}`);
  }
  await db.close();
}
main().catch(e => { console.error(e.message); process.exit(1); });
