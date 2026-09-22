import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { SalaryProfileSchema } from '../../database/schemas/salary-profile.schema';
import { EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { SalaryProfileController } from './salary-profile.controller';
import { SalaryProfileService } from './salary-profile.service';

@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'SalaryProfile', schema: SalaryProfileSchema },
			{ name: 'EmployeeProfile', schema: EmployeeProfileSchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [SalaryProfileController],
	providers: [SalaryProfileService, RolesGuard],
	exports: [SalaryProfileService],
})
export class SalaryProfileModule {}
