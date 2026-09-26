import { startMongo } from './mongo-memory';

/**
 * Boots the one Mongo the whole integration lane shares.
 *
 * Depends on `--runInBand` (which `npm run test:integration` passes): with an
 * in-band run the tests execute in this same process, so the server handle can
 * live on `globalThis` and `global-teardown.ts` can stop it. Fork workers would
 * not see it and each would start its own mongod.
 */
export default async function globalSetup(): Promise<void> {
  await startMongo();
}
