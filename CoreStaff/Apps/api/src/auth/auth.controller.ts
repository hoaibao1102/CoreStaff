import { Controller, Post, Get, Body, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('login')
	@ApiOperation({ summary: 'Log in; sets the HttpOnly `sid` session cookie.' })
	@ApiResponse({ status: 200, description: 'Authenticated. `sessionId` is cookie-only, never in the body.' })
	@ApiResponse({ status: 401, description: 'AUTH_INVALID_CREDENTIALS' })
	@ApiResponse({ status: 403, description: 'AUTH_ACCOUNT_DISABLED' })
	@ApiResponse({ status: 423, description: 'AUTH_ACCOUNT_LOCKED' })
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
	@ApiOperation({ summary: 'Revoke the current session and clear the `sid` cookie.' })
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
	@ApiOperation({ summary: 'Current user profile (requires the `sid` cookie from login).' })
	@ApiResponse({ status: 401, description: 'AUTH_SESSION_EXPIRED' })
	async me(@CurrentUser() user: SessionUser): Promise<{ success: true; data: Record<string, unknown> }> {
		const uid = String(user._id ?? user.id);
		const profile = await this.authService.getMe(uid);
		return { success: true, data: profile };
	}

	@UseGuards(AuthGuard)
	@Post('change-password')
	@ApiOperation({ summary: 'Change own password; revokes all other sessions.' })
	@ApiResponse({ status: 400, description: 'AUTH_CURRENT_PASSWORD_INVALID | AUTH_PASSWORD_POLICY_FAILED' })
	async changePassword(
		@CurrentUser() user: SessionUser,
		@Body() dto: ChangePasswordDto,
	): Promise<{ success: true }> {
		const uid = String(user._id ?? user.id);
		return this.authService.changePassword(uid, dto);
	}

	@Post('forgot-password')
	@ApiOperation({ summary: 'Request a password-reset email.', deprecated: true })
	@ApiResponse({ status: 200, description: 'Always succeeds — no user enumeration. STUB (SRS SHOULD).' })
	async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ success: true }> {
		return this.authService.forgotPassword(dto.email);
	}

	@Post('reset-password')
	@ApiOperation({ summary: 'Consume a reset token.', deprecated: true })
	@ApiResponse({ status: 200, description: 'STUB (SRS SHOULD) — token issuance not implemented yet.' })
	async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ success: true }> {
		return this.authService.resetPassword(dto.token, dto.newPassword);
	}
}
