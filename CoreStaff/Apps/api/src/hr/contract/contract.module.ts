import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { EmploymentContractSchema } from '../../database/schemas/employment-contract.schema';
import { EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';

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
	controllers: [ContractController],
	providers: [ContractService, RolesGuard],
	exports: [ContractService],
})
export class ContractModule {}
