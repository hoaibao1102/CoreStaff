import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { DepartmentSchema } from '../../database/schemas/department.schema';
import { WorkplaceSchema } from '../../database/schemas/workplace.schema';
import { ShiftTemplateSchema } from '../../database/schemas/shift-template.schema';
import { EmployeeAssignmentSchema } from '../../database/schemas/assignment.schema';
import { EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { AssignmentController } from './assignment.controller';
import { AssignmentService } from './assignment.service';

@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'Assignment', schema: EmployeeAssignmentSchema },
			{ name: 'Department', schema: DepartmentSchema },
			{ name: 'EmployeeProfile', schema: EmployeeProfileSchema },
			{ name: 'Workplace', schema: WorkplaceSchema },
			{ name: 'ShiftTemplate', schema: ShiftTemplateSchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [AssignmentController],
	providers: [AssignmentService, RolesGuard],
	exports: [AssignmentService],
})
export class AssignmentModule {}
