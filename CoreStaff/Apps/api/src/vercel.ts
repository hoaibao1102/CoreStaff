import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import type { Request, Response } from 'express';

type ExpressApp = (req: Request, res: Response) => void;

let expressApp: ExpressApp | undefined;
let boot: Promise<ExpressApp> | undefined;

/**
 * Vercel invokes a function per request — do not call `app.listen()`.
 * The Express instance is reused across warm invocations in the same isolate.
 */
async function getExpressApp(): Promise<ExpressApp> {
  if (expressApp) {
    return expressApp;
  }
  if (!boot) {
    boot = (async () => {
      const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
      configureApp(app);
      await app.init();
      expressApp = app.getHttpAdapter().getInstance() as ExpressApp;
      return expressApp;
    })();
  }
  return boot;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  const server = await getExpressApp();
  server(req, res);
}
