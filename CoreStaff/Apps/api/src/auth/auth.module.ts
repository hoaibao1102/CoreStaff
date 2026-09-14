import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { UserSchema } from '../database/schemas/user.schema';
import { UserSessionSchema } from '../database/schemas/user-session.schema';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
	],
	controllers: [AuthController],
	providers: [AuthService, AuthGuard],
	exports: [AuthService, AuthGuard],
})
export class AuthModule {}
