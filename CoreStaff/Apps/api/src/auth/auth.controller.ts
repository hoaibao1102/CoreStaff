import { Controller, Post, Get, Body, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AllowTempPassword, AuthGuard } from './guards/auth.guard';
import { CurrentUser, SessionUser } from '../common/tenant-context';
import { getCookie } from '../common/parse-cookies';
import { ApiCreatedSuccess, ApiErrorExamples, ApiSuccess, userExample } from '../common/swagger-responses';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const COOKIE_NAME = 'sid';
const SESSION_TTL_MS = 30 * 60 * 1000;

export function sessionCookieOptions(): CookieOptions {
	const production = process.env.NODE_ENV === 'production';
	return {
		httpOnly: true,
		secure: production,
		sameSite: production ? 'none' : 'lax',
		path: '/',
	};
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('login')
	@ApiOperation({ summary: 'Log in; sets the HttpOnly `sid` session cookie.' })
	@ApiCreatedSuccess('Authenticated. `sessionId` is cookie-only, never in the body.', {
		user: userExample,
		mustChangePassword: false,
	})
	@ApiResponse({ status: 401, description: 'AUTH_INVALID_CREDENTIALS' })
	@ApiResponse({ status: 403, description: 'AUTH_ACCOUNT_DISABLED' })
	@ApiResponse({ status: 423, description: 'AUTH_ACCOUNT_LOCKED' })
	@ApiErrorExamples()
	async login(
		@Res({ passthrough: true }) res: Response,
		@Body() dto: LoginDto,
	): Promise<{ success: true; data: { user: Record<string, unknown>; mustChangePassword: boolean } }> {
		const result = await this.authService.login(dto);

		res.cookie(COOKIE_NAME, result.sessionId, {
			...sessionCookieOptions(),
			maxAge: SESSION_TTL_MS,
		});

		return {
			success: true,
			data: { user: result.user, mustChangePassword: result.mustChangePassword },
		};
	}

	@Post('logout')
	@ApiOperation({ summary: 'Revoke the current session and clear the `sid` cookie.' })
	@ApiCreatedSuccess('Current session revoked and `sid` cookie cleared.')
	@ApiErrorExamples()
	async logout(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	): Promise<{ success: true }> {
		const sid = getCookie(req.headers.cookie, COOKIE_NAME);
		if (sid) await this.authService.logout(sid);
		res.clearCookie(COOKIE_NAME, sessionCookieOptions());
		return { success: true };
	}

	@AllowTempPassword() // the change-password screen needs the profile to render
	@UseGuards(AuthGuard)
	@Get('me')
	@ApiOperation({ summary: 'Current user profile (requires the `sid` cookie from login).' })
	@ApiSuccess('Current user profile.', userExample)
	@ApiResponse({ status: 401, description: 'AUTH_SESSION_EXPIRED' })
	@ApiErrorExamples()
	async me(@CurrentUser() user: SessionUser): Promise<{ success: true; data: Record<string, unknown> }> {
		const uid = String(user._id ?? user.id);
		const profile = await this.authService.getMe(uid);
		return { success: true, data: profile };
	}

	@AllowTempPassword() // the whole point of the forced-change flow
	@UseGuards(AuthGuard)
	@Post('change-password')
	@ApiOperation({ summary: 'Change own password; revokes all other sessions.' })
	@ApiCreatedSuccess('Password changed; all other sessions revoked.')
	@ApiResponse({ status: 400, description: 'AUTH_CURRENT_PASSWORD_INVALID | AUTH_PASSWORD_POLICY_FAILED' })
	@ApiErrorExamples()
	async changePassword(
		@Req() req: Request,
		@CurrentUser() user: SessionUser,
		@Body() dto: ChangePasswordDto,
	): Promise<{ success: true }> {
		const uid = String(user._id ?? user.id);
		// keepToken = the caller's own sid, so the session in use survives.
		const keepToken = getCookie(req.headers.cookie, COOKIE_NAME);
		return this.authService.changePassword(uid, dto, keepToken);
	}

	@Post('forgot-password')
	@ApiOperation({ summary: 'Request a password-reset email (FR-AUTH-05).' })
	@ApiCreatedSuccess('Request accepted. Response is identical whether or not the email exists.')
	@ApiErrorExamples()
	async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ success: true }> {
		return this.authService.forgotPassword(dto.email);
	}

	@Post('reset-password')
	@ApiOperation({ summary: 'Consume a one-time reset token; revokes all sessions.' })
	@ApiCreatedSuccess('Password set. `mustChangePassword` cleared.')
	@ApiResponse({ status: 401, description: 'AUTH_RESET_TOKEN_INVALID (expired / used / unknown; one code for all)' })
	@ApiResponse({ status: 400, description: 'AUTH_PASSWORD_POLICY_FAILED' })
	@ApiErrorExamples()
	async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ success: true }> {
		return this.authService.resetPassword(dto.token, dto.newPassword);
	}
}
