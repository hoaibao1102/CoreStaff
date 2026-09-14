import {
	SetMetadata,
	Injectable,
	CanActivate,
	ExecutionContext,
	ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'rbac:allowedRoles';

/**
 * Declares the roles allowed to hit a route. Pair with
 * `@UseGuards(AuthGuard, RolesGuard)`:
 *
 * ```
 * @UseGuards(AuthGuard, RolesGuard)
 * @Roles('HR')
 * @Get() findMany() { ... }
 * ```
 */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
	SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		// No role requirement declared → allow (AuthGuard still enforced separately).
		if (!required || required.length === 0) return true;

		const { user } = context.switchToHttp().getRequest();
		if (!user) throw new ForbiddenException('FORBIDDEN');

		// Platform admin bypasses tenant-scoped role checks.
		if (user.role === 'SYSTEM_ADMIN') return true;

		if (!required.includes(user.role)) throw new ForbiddenException('FORBIDDEN');

		return true;
	}
}
