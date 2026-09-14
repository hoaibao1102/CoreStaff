import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { resolveEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = resolveEnv();
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(env.port);
  // eslint-disable-next-line no-console
  console.log(`[corestaff-api] listening on http://localhost:${env.port}/api (tz=${env.tz})`);
}

void bootstrap();
