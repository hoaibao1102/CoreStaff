import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { DepartmentSchema } from '../../database/schemas/department.schema';
import { ShiftTemplateSchema } from '../../database/schemas/shift-template.schema';
import { ShiftTemplateController } from './shift-template.controller';
import { ShiftTemplateService } from './shift-template.service';
import { ShiftResolverService } from './shift-resolver.service';
import { EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { EmployeeAssignmentSchema } from '../../database/schemas/assignment.schema';
import { PoliciesModule } from '../policies/policies.module';
import { AttendanceDaySchema } from '../../database/schemas/attendance-day.schema';

@Module({
	imports: [
		AuthModule,
		PoliciesModule,
		MongooseModule.forFeature([
			{ name: 'ShiftTemplate', schema: ShiftTemplateSchema },
			{ name: 'Department', schema: DepartmentSchema },
			{ name: 'EmployeeProfile', schema: EmployeeProfileSchema },
			{ name: 'Assignment', schema: EmployeeAssignmentSchema },
			{ name: 'AttendanceDay', schema: AttendanceDaySchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [ShiftTemplateController],
	providers: [ShiftTemplateService, ShiftResolverService, RolesGuard],
	exports: [ShiftTemplateService, ShiftResolverService],
})
export class ShiftTemplateModule {}
