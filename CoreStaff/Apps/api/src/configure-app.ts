import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // OpenAPI spec + Swagger UI, served at `/docs` (root, NOT under the `api`
  // global prefix — SwaggerModule.setup mounts there by default). No explicit
  // server is declared, so the UI calls same-origin against the prefixed paths
  // baked into the document (`/api/auth/...`). `sid` is an HttpOnly cookie set
  // by POST /api/auth/login, so Try-it-out works without manual auth config.
  const config = new DocumentBuilder()
    .setTitle('CoreStaff API')
    .setDescription('SRS_CORESTAFF §16 — unified `success`/`error` envelope, tenant-scoped.')
    .setVersion('0.1.0')
    .addTag('Auth')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'CoreStaff API',
  });
}
