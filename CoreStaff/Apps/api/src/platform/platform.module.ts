import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/rbac.decorator';
import { OrganizationSchema } from '../database/schemas/organization.schema';
import { UserSchema } from '../database/schemas/user.schema';
import { UserSessionSchema } from '../database/schemas/user-session.schema';
import { EmployeeProfileSchema } from '../database/schemas/employee-profile.schema';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
	imports: [
		AuthModule, // AuthGuard's dependencies
		MongooseModule.forFeature([
			{ name: 'Organization', schema: OrganizationSchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
			{ name: 'EmployeeProfile', schema: EmployeeProfileSchema },
		]),
	],
	controllers: [PlatformController],
	providers: [PlatformService, RolesGuard],
	exports: [PlatformService],
})
export class PlatformModule {}
