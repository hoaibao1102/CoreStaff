import {
	SetMetadata,
	Injectable,
	CanActivate,
	ExecutionContext,
	ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'rbac:allowedRoles';
export const PLATFORM_ONLY_KEY = 'rbac:platformOnly';

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

/**
 * Restricts a route to the platform admin (AC-SYS-01). Without it the
 * `SYSTEM_ADMIN` bypass below is one-directional — an admin can reach any tenant
 * route, but no route can be closed to everyone *except* an admin, because
 * `@Roles` is an allow-list that admins skip rather than a ceiling.
 */
export const PlatformOnly = (): MethodDecorator & ClassDecorator =>
	SetMetadata(PLATFORM_ONLY_KEY, true);

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const targets = [context.getHandler(), context.getClass()];
		const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets);
		// Read before the "nothing declared → allow" shortcut: a platform-only
		// route has no @Roles list, so the marker is its only requirement.
		const platformOnly = this.reflector.getAllAndOverride<boolean>(PLATFORM_ONLY_KEY, targets);
		if (!required?.length && !platformOnly) return true;

		const { user } = context.switchToHttp().getRequest();
		if (!user) throw new ForbiddenException('FORBIDDEN');

		// Platform admin bypasses tenant-scoped role checks.
		if (user.role === 'SYSTEM_ADMIN') return true;
		if (platformOnly) throw new ForbiddenException('PLATFORM_ONLY');

		if (!required?.includes(user.role)) throw new ForbiddenException('FORBIDDEN');

		return true;
	}
}
