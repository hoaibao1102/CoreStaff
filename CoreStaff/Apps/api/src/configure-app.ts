import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/http-exception.filter';

/** Shared HTTP config for local `listen()` and the Vercel serverless handler. */
export function configureApp(app: INestApplication): void {
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');
  // Unified error envelope (SRS §16.1) for every thrown HttpException.
  app.useGlobalFilters(new AllExceptionsFilter());
  // DTO validation (SRS §16.1): reject unknown fields, strip to schema.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
