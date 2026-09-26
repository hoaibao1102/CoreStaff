import './env-guard';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import request from 'supertest';
import { configureApp } from '../src/configure-app';
import { AuthModule } from '../src/auth/auth.module';
import { AttendanceModule } from '../src/attendance/attendance.module';
import { EventsModule } from '../src/events/events.module';
import { HrModule } from '../src/hr/hr.module';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';

/**
 * A real Nest application over a real Mongo — the closest thing to the deployed
 * API that a test can drive, and the only way to test what this lane is about:
 * index-backed queries, unique constraints, and the exception envelope
 * (`configureApp`) that turns a thrown UPPER_SNAKE message into `error.code`.
 * Unit specs fake all three, so a bug that lives in the seams between them is
 * invisible to them.
 *
 * `AppModule` is NOT used: `src/database/database.module.ts` runs `resolveEnv()`
 * at module-load time and would connect to the live Atlas cluster. The modules
 * below are the ones an overtime flow touches, each with its own connection-less
 * `forFeature` registrations, over one `forRoot` we point at the test database.
 *
 * IMPORTANT: `MongooseModule.forRoot` calls `mongoose.createConnection()`, i.e.
 * a *dedicated* connection — the default `mongoose.connection` stays disconnected
 * and `mongoose.model()` finds nothing. Everything here (fixtures, assertions)
 * must go through `model()` below, which reads from the connection Nest actually
 * built. Grabbing the global instead fails with a confusing
 * "Cannot read properties of undefined (reading 'db')".
 */
export interface TestApp {
  app: INestApplication;
  http: () => { get: Function; post: Function; patch: Function; delete: Function };
}

let testConnection: mongoose.Connection | undefined;

/** The connection `createTestApp()` built. Throws before it exists. */
export function connection(): mongoose.Connection {
  if (!testConnection) {
    throw new Error('No test connection yet — call createTestApp() first.');
  }
  return testConnection;
}

export async function createTestApp(): Promise<TestApp> {
  const uri = process.env.TEST_MONGO_URI;
  if (!uri) throw new Error('TEST_MONGO_URI is unset — global-setup did not run. Use `npm run test:integration`.');

  const moduleRef = await Test.createTestingModule({
    imports: [
      MongooseModule.forRoot(uri, { dbName: 'corestaff_it', retryAttempts: 0 }),
      // Every collection the flow reads, so `ensureIndexes` runs for all of them
      // the way `npm run ensure-indexes` does in a real deployment.
      MongooseModule.forFeature(SCHEMA_REGISTRY.map(({ name, schema }) => ({ name, schema }))),
      EventsModule,
      AuthModule,
      HrModule,
      AttendanceModule,
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  testConnection = app.get<mongoose.Connection>(getConnectionToken());

  return {
    app,
    http: () => request(app.getHttpServer()),
  };
}

/** Drops everything but the indexes, so one spec cannot leak rows into the next. */
export async function clearDatabase(): Promise<void> {
  const collections = await connection().db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}
