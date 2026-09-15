import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { resolveEnv, hasMongoUri } from './config/env';

interface HealthResponse {
  status: string;
  service: string;
  mongo: 'configured' | 'missing';
  timezone: string;
}

@Controller()
@ApiTags('Health')
export class HealthController {
  @Get('healthz')
  @ApiOperation({ summary: 'Health check for the API process and Mongo configuration.' })
  @ApiResponse({
    status: 200,
    description: 'API process health.',
    schema: {
      type: 'object',
      required: ['status', 'service', 'mongo', 'timezone'],
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'corestaff-api' },
        mongo: { type: 'string', enum: ['configured', 'missing'], example: 'configured' },
        timezone: { type: 'string', example: 'Asia/Ho_Chi_Minh' },
      },
    },
  })
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
