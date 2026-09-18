import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { WorkplaceSchema } from './workplace.schema';
import { EmployeeAssignmentSchema } from '../../database/schemas/assignment.schema';
import { WorkplaceController } from './workplace.controller';
import { WorkplaceService } from './workplace.service';

@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'Workplace', schema: WorkplaceSchema },
			{ name: 'Assignment', schema: EmployeeAssignmentSchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [WorkplaceController],
	providers: [WorkplaceService, RolesGuard],
	exports: [WorkplaceService],
})
export class WorkplaceModule {}
