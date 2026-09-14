import {
	Injectable,
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	SetMetadata,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { UserDocument } from '../../database/schemas/user.schema';
import { UserSessionDocument } from '../../database/schemas/user-session.schema';
import { hashToken } from '../strategies/token-strategy';
import { getCookie } from '../../common/parse-cookies';

export const PASSWORD_CHANGE_EXEMPT_KEY = 'auth:allowedWithTempPassword';

/**
 * FR-AUTH-01/AC-AUTH-07: an account whose password is still the temporary one
 * may only reach the change-password screen — AuthGuard 403s everything else
 * with AUTH_PASSWORD_CHANGE_REQUIRED (SRS §17). Routes the forced-change
 * screen itself needs (me/change-password/logout) opt out via this decorator.
 */
export const AllowTempPassword = () => SetMetadata(PASSWORD_CHANGE_EXEMPT_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		@InjectModel('User') private readonly userModel: Model<UserDocument>,
		@InjectModel('UserSession') private readonly sessionModel: Model<UserSessionDocument>,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = context.switchToHttp().getRequest();
		const rawCookie = req.headers.cookie;
		if (!rawCookie) throw new UnauthorizedException('AUTH_SESSION_EXPIRED');

		const sid = getCookie(rawCookie, 'sid');
		if (!sid) throw new UnauthorizedException('AUTH_SESSION_EXPIRED');

		const session = await this.sessionModel.findOne({
			tokenHash: hashToken(sid),
			revokedAt: null,
			expiresAt: { $gte: new Date() },
		}).lean();

		if (!session) throw new UnauthorizedException('AUTH_SESSION_EXPIRED');

		const doc = await this.userModel.findById(session.userId).select('-passwordHash').lean();
		if (!doc) throw new UnauthorizedException('AUTH_SESSION_EXPIRED');

		// AC-AUTH-07: temp password locks out every API the change-password
		// screen does not explicitly need. Backend-enforced (FR-AUTH-06: FE
		// redirect is not a security boundary).
		if (doc.mustChangePassword) {
			const exempt = this.reflector.getAllAndOverride<boolean>(PASSWORD_CHANGE_EXEMPT_KEY, [
				context.getHandler(),
				context.getClass(),
			]);
			if (!exempt) throw new ForbiddenException('AUTH_PASSWORD_CHANGE_REQUIRED');
		}

		req.user = { ...doc, organizationId: session.organizationId ?? undefined };
		// Tenant context is derived ONLY from the session, never from client input
		// (BR-TENANT-01). Every tenant-scoped query reads req.tenantContext.
		req.tenantContext = { organizationId: session.organizationId ?? null };
		return true;
	}
}
