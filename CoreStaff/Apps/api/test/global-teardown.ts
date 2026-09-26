import './env-guard';
import { stopMongo } from './mongo-memory';

/** Pairs with `global-setup.ts`. Only ever stops a server this process started. */
export default async function globalTeardown(): Promise<void> {
  if (process.env.TEST_MONGO_EPHEMERAL === '1') await stopMongo();
}
