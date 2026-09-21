import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import {
  LaborCompliancePolicySchema,
  OvertimePayPolicySchema,
} from '../../database/schemas/compensation.schema';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';

/**
 * TASK-036/037 — effective-dated tenant policies (Labor Compliance + Overtime
 * Pay), SRS §30B/§30D.2/§30G. Routes: /hr/policies/labor, /hr/policies/overtime.
 */
@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: 'LaborCompliancePolicy', schema: LaborCompliancePolicySchema },
      { name: 'OvertimePayPolicy', schema: OvertimePayPolicySchema },
      // AuthGuard resolves these model tokens from the *importing* module's
      // context, so every module that puts AuthGuard on a controller must
      // register them itself (same convention as workplace/department/etc.).
      { name: 'User', schema: UserSchema },
      { name: 'UserSession', schema: UserSessionSchema },
    ]),
  ],
  controllers: [PoliciesController],
  providers: [PoliciesService, RolesGuard],
  exports: [PoliciesService],
})
export class PoliciesModule {}