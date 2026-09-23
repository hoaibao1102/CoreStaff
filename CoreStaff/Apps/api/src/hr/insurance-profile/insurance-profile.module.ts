import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { InsuranceProfileSchema } from '../../database/schemas/insurance-profile.schema';
import { EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { InsuranceProfileController } from './insurance-profile.controller';
import { InsuranceProfileService } from './insurance-profile.service';

@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'InsuranceProfile', schema: InsuranceProfileSchema },
			{ name: 'EmployeeProfile', schema: EmployeeProfileSchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [InsuranceProfileController],
	providers: [InsuranceProfileService, RolesGuard],
	exports: [InsuranceProfileService],
})
export class InsuranceProfileModule {}
