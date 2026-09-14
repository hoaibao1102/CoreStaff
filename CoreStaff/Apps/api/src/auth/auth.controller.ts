import { Controller, Post, Get, Body, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { CurrentUser, SessionUser } from '../common/tenant-context';
import { getCookie } from '../common/parse-cookies';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const COOKIE_NAME = 'sid';
const SESSION_TTL_MS = 30 * 60 * 1000;

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('login')
	async login(
		@Res({ passthrough: true }) res: Response,
		@Body() dto: LoginDto,
	): Promise<{ success: true; data: { user: Record<string, unknown>; mustChangePassword: boolean } }> {
		const result = await this.authService.login(dto);

		res.cookie(COOKIE_NAME, result.sessionId, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: SESSION_TTL_MS,
			path: '/',
		});

		return {
			success: true,
			data: { user: result.user, mustChangePassword: result.mustChangePassword },
		};
	}

	@Post('logout')
	async logout(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	): Promise<{ success: true }> {
		const sid = getCookie(req.headers.cookie, COOKIE_NAME);
		if (sid) await this.authService.logout(sid);
		res.clearCookie(COOKIE_NAME, { path: '/' });
		return { success: true };
	}

	@UseGuards(AuthGuard)
	@Get('me')
	async me(@CurrentUser() user: SessionUser): Promise<{ success: true; data: Record<string, unknown> }> {
		const uid = String(user._id ?? user.id);
		const profile = await this.authService.getMe(uid);
		return { success: true, data: profile };
	}

	@UseGuards(AuthGuard)
	@Post('change-password')
	async changePassword(
		@CurrentUser() user: SessionUser,
		@Body() dto: ChangePasswordDto,
	): Promise<{ success: true }> {
		const uid = String(user._id ?? user.id);
		return this.authService.changePassword(uid, dto);
	}

	@Post('forgot-password')
	async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ success: true }> {
		return this.authService.forgotPassword(dto.email);
	}

	@Post('reset-password')
	async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ success: true }> {
		return this.authService.resetPassword(dto.token, dto.newPassword);
	}
}
