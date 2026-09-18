import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { StorageModule } from '../../storage/storage.module';
import { EmployeeDocumentSchema } from '../../database/schemas/employee-document.schema';
import { EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { EmploymentContractSchema } from '../../database/schemas/employment-contract.schema';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { EmployeeDocumentService } from './employee-document.service';
import { HrEmployeeDocumentController } from './hr-employee-document.controller';
import { AppEmployeeDocumentController } from './app-employee-document.controller';

@Module({
	imports: [
		AuthModule,
		StorageModule,
		MongooseModule.forFeature([
			{ name: 'EmployeeDocument', schema: EmployeeDocumentSchema },
			{ name: 'EmployeeProfile', schema: EmployeeProfileSchema },
			{ name: 'EmploymentContract', schema: EmploymentContractSchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [HrEmployeeDocumentController, AppEmployeeDocumentController],
	providers: [EmployeeDocumentService, RolesGuard],
	exports: [EmployeeDocumentService],
})
export class EmployeeDocumentModule {}