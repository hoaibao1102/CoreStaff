import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { EnterpriseInsurancePolicySchema } from '../../database/schemas/enterprise-insurance-policy.schema';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { EnterpriseInsurancePolicyController } from './enterprise-insurance-policy.controller';
import { EnterpriseInsurancePolicyService } from './enterprise-insurance-policy.service';

@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'EnterpriseInsurancePolicy', schema: EnterpriseInsurancePolicySchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [EnterpriseInsurancePolicyController],
	providers: [EnterpriseInsurancePolicyService, RolesGuard],
	exports: [EnterpriseInsurancePolicyService],
})
export class EnterpriseInsurancePolicyModule {}
