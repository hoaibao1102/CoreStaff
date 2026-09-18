import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { EmploymentContractSchema } from '../../database/schemas/employment-contract.schema';
import { EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { EmploymentContractController } from './employment-contract.controller';
import { EmploymentContractService } from './employment-contract.service';

@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'EmploymentContract', schema: EmploymentContractSchema },
			{ name: 'EmployeeProfile', schema: EmployeeProfileSchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [EmploymentContractController],
	providers: [EmploymentContractService, RolesGuard],
	exports: [EmploymentContractService],
})
export class EmploymentContractModule {}