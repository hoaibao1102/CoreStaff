import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { resolveEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = resolveEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');
  await app.listen(env.port);
  // eslint-disable-next-line no-console
  console.log(`[corestaff-api] listening on http://localhost:${env.port}/api (tz=${env.tz})`);
}

void bootstrap();