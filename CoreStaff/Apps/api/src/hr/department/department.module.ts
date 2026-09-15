import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { DepartmentSchema } from '../../database/schemas/department.schema';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';

@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'Department', schema: DepartmentSchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [DepartmentController],
	providers: [DepartmentService, RolesGuard],
	exports: [DepartmentService],
})
export class DepartmentModule {}
