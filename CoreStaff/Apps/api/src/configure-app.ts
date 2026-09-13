import { INestApplication } from '@nestjs/common';

/** Shared HTTP config for local `listen()` and the Vercel serverless handler. */
export function configureApp(app: INestApplication): void {
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');
}
