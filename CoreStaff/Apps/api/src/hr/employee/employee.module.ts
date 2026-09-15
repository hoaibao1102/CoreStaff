import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { EmploymentHistorySchema } from '../../database/schemas/employment-history.schema';
import { DepartmentSchema } from '../../database/schemas/department.schema';
import { PositionSchema } from '../../database/schemas/position.schema';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';

@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'EmployeeProfile', schema: EmployeeProfileSchema },
			{ name: 'EmploymentHistory', schema: EmploymentHistorySchema },
			{ name: 'Department', schema: DepartmentSchema },
			{ name: 'Position', schema: PositionSchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [EmployeeController],
	providers: [EmployeeService, RolesGuard],
	exports: [EmployeeService],
})
export class EmployeeModule {}
