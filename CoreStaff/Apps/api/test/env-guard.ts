/**
 * Import this module BEFORE anything that might call `loadEnv()`
 * (`src/config/env.ts` reads `Apps/api/.env` and, on Windows, dotenv fills
 * `process.env` before Nest boots). dotenv does not overwrite keys that already
 * exist, and every consumer of the URI treats an empty string as unset, so
 * blanking these keys here means the real Atlas cluster cannot be reached from
 * this lane no matter what gets imported.
 *
 * Key names only — values are never read or printed.
 */
for (const key of ['MONGODB_URI', 'MONGO_URI', 'MONGODB_URL', 'ATLAS_URI', 'DATABASE_URL']) {
  process.env[key] = '';
}
