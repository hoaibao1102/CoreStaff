import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { ensureSrvCapableResolver } from './dns';

/**
 * Loads environment for the API. Real credentials live in `Apps/api/.env` (git-ignored).
 *
 * Tooling and logs MUST NOT print values.
 *
 * Also the single startup choke point shared by `main.ts`, `vercel.ts` and the
 * standalone `seed`/`ensure-indexes` scripts, so the SRV-capable resolver check
 * (see config/dns.ts) runs once everywhere a Mongo URI is about to be used.
 */
export function loadEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  ensureSrvCapableResolver();
}

const URI_KEYS = ['MONGODB_URI', 'MONGO_URI', 'MONGODB_URL', 'ATLAS_URI', 'DATABASE_URL'] as const;

interface Env {
  mongodbUri: string | undefined;
  /** Name of the source variable that supplied the URI (value is never exposed). */
  mongodbSourceKey: string | undefined;
  port: number;
  tz: string;
}

export function resolveEnv(): Env {
  loadEnv();
  let mongodbUri: string | undefined;
  let mongodbSourceKey: string | undefined;
  for (const key of URI_KEYS) {
    if (process.env[key]) {
      mongodbUri = process.env[key];
      mongodbSourceKey = key;
      break;
    }
  }
  return {
    mongodbUri,
    mongodbSourceKey,
    port: Number(process.env.PORT ?? 3000),
    // APP_TZ: Vercel (and some hosts) reserve TZ. Local .env may still use TZ.
    tz: process.env.APP_TZ ?? process.env.TZ ?? 'Asia/Ho_Chi_Minh',
  };
}

/** True when a Mongo URI is configured (does not leak the URI). */
export function hasMongoUri(env: Env): env is Env & { mongodbUri: string } {
  return Boolean(env.mongodbUri);
}