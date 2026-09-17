import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { WorkplaceSchema } from '../../database/schemas/workplace.schema';
import { EmployeeAssignmentSchema } from '../../database/schemas/assignment.schema';
import { ShiftTemplateSchema } from '../../database/schemas/shift-template.schema';
import { ShiftTemplateController } from './shift-template.controller';
import { ShiftTemplateService } from './shift-template.service';

@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'ShiftTemplate', schema: ShiftTemplateSchema },
            { name: 'Workplace', schema: WorkplaceSchema },
			{ name: 'Assignment', schema: EmployeeAssignmentSchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [ShiftTemplateController],
	providers: [ShiftTemplateService, RolesGuard],
	exports: [ShiftTemplateService],
})
export class ShiftTemplateModule {}
