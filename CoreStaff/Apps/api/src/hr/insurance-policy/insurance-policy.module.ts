import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { InsurancePolicySchema } from '../../database/schemas/insurance-policy.schema';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { InsurancePolicyController } from './insurance-policy.controller';
import { InsurancePolicyService } from './insurance-policy.service';

@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'InsurancePolicy', schema: InsurancePolicySchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [InsurancePolicyController],
	providers: [InsurancePolicyService, RolesGuard],
	exports: [InsurancePolicyService],
})
export class InsurancePolicyModule {}
