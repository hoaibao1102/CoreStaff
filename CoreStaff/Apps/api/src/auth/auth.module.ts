import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { UserSchema } from '../database/schemas/user.schema';
import { UserSessionSchema } from '../database/schemas/user-session.schema';
import { PasswordResetTokenSchema } from '../database/schemas/password-reset-token.schema';
import { ConsoleResetMailer, RESET_MAILER } from './strategies/reset-mailer';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
			{ name: 'PasswordResetToken', schema: PasswordResetTokenSchema },
		]),
	],
	controllers: [AuthController],
	providers: [AuthService, AuthGuard, { provide: RESET_MAILER, useClass: ConsoleResetMailer }],
	exports: [AuthService, AuthGuard],
})
export class AuthModule {}
