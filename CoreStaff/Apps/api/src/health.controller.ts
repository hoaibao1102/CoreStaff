import { Controller, Get } from '@nestjs/common';
import { resolveEnv, hasMongoUri } from './config/env';

interface HealthResponse {
  status: string;
  service: string;
  mongo: 'configured' | 'missing';
  timezone: string;
}

@Controller()
export class HealthController {
  @Get('healthz')
  health(): HealthResponse {
    const env = resolveEnv();
    return {
      status: 'ok',
      service: 'corestaff-api',
      mongo: hasMongoUri(env) ? 'configured' : 'missing',
      timezone: env.tz,
    };
  }
}