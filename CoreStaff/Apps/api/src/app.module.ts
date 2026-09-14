import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { HrModule } from './hr/hr.module';
import { HealthController } from './health.controller';
import { loadEnv } from './config/env';

loadEnv();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    HrModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}