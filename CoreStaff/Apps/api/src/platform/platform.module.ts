import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/rbac.decorator';
import { OrganizationSchema } from '../database/schemas/organization.schema';
import { UserSchema } from '../database/schemas/user.schema';
import { UserSessionSchema } from '../database/schemas/user-session.schema';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
	imports: [
		AuthModule, // AuthGuard's dependencies
		MongooseModule.forFeature([
			{ name: 'Organization', schema: OrganizationSchema },
			{ name: 'User', schema: UserSchema },
			// AuthGuard is exported by AuthModule but this module's own models are
			// resolved from its imports, so each one lists what it injects
			// (precedent: employee.module.ts).
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [PlatformController],
	providers: [PlatformService, RolesGuard],
	exports: [PlatformService],
})
export class PlatformModule {}
