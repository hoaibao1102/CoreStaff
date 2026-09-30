import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaxPolicyService } from './tax-policy.service';
import { TaxPolicyController } from './tax-policy.controller';
import { TaxPolicy, TaxPolicySchema } from '../../database/schemas/tax-policy.schema';
import { AuthModule } from '../../auth/auth.module';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';

/**
 * TASK-041 — TaxPolicy module.
 * Provides organization-wide tax policy management and PIT calculation preview.
 */
@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'TaxPolicy', schema: TaxPolicySchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [TaxPolicyController],
	providers: [TaxPolicyService],
	exports: [TaxPolicyService],
})
export class TaxPolicyModule {}
