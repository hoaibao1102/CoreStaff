import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { UserDocument } from '../../database/schemas/user.schema';
import { UserSessionDocument } from '../../database/schemas/user-session.schema';
import { hashToken } from '../strategies/token-strategy';
import { getCookie } from '../../common/parse-cookies';

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		@InjectModel('User') private readonly userModel: Model<UserDocument>,
		@InjectModel('UserSession') private readonly sessionModel: Model<UserSessionDocument>,
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

		req.user = { ...doc, organizationId: session.organizationId ?? undefined };
		// Tenant context is derived ONLY from the session, never from client input
		// (BR-TENANT-01). Every tenant-scoped query reads req.tenantContext.
		req.tenantContext = { organizationId: session.organizationId ?? null };
		return true;
	}
}
