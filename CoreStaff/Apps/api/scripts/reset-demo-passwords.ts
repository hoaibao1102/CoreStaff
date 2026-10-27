import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { UserSchema } from '../src/database/schemas/user.schema';
import { hashPassword, comparePassword } from '../src/auth/strategies/bcrypt.strategy';
import { normalizeEmail } from '../src/database/schemas/enums';

/**
 * Demo helper: resets the password of the named demo accounts and clears the
 * lockout/force-change flags so they can log in again.
 *
 * Usage (from Apps/api):
 *   npx ts-node-script scripts/reset-demo-passwords.ts
 *   ... --password=Other1! --emails=a@x.local,b@x.local
 *
 * Never prints hashes; verifies each reset by re-reading and comparing.
 */
const args = process.argv.slice(2);
const arg = (name: string, fallback: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;

const EMAILS = arg('emails', 'binh.tran@tvs.local,an.nguyen@tvs.local,hr-a@tvs.local')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);
const PASSWORD = arg('password', 'TvsAdmin1!');

async function main(): Promise<void> {
  const env = resolveEnv();
  if (!hasMongoUri(env)) {
    console.error('[reset] No Mongo URI configured. Add MONGODB_URI to Apps/api/.env.');
    process.exitCode = 1;
    return;
  }

  const connection = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15000 });
  try {
    await connection.asPromise();
    const User = connection.model('User', UserSchema);
    const passwordHash = await hashPassword(PASSWORD);
    let failures = 0;

    for (const email of EMAILS) {
      const emailN = normalizeEmail(email);
      const res = await User.updateOne(
        { emailN },
        { $set: { passwordHash, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null } },
      ).exec();
      if (res.matchedCount === 0) {
        console.log(`[reset] NOT FOUND ${emailN}`);
        failures++;
        continue;
      }
      const doc = await User.findOne({ emailN }).lean<{ passwordHash: string }>().exec();
      const ok = doc ? await comparePassword(PASSWORD, doc.passwordHash) : false;
      console.log(`[reset] ${ok ? 'OK' : 'VERIFY FAILED'} ${emailN}`);
      if (!ok) failures++;
    }

    if (failures) process.exitCode = 1;
  } finally {
    await closeConnection(connection);
  }
}

void main();
