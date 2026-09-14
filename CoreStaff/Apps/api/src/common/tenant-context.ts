import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Request-scoped auth context attached by AuthGuard after session resolution.
 * `organizationId` is null only for platform-local SYSTEM_ADMIN sessions.
 */
export interface SessionUser {
	_id: unknown;
	id?: string;
	role: string;
	organizationId?: string;
	[k: string]: unknown;
}

/** Tenant scope derived strictly from the session (BR-TENANT-01). */
export interface TenantContext {
	organizationId: string | null;
}

/** Inject the current tenant's organizationId into a handler argument. */
export const Tenant = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): string | null => {
		const req = ctx.switchToHttp().getRequest();
		return (req.tenantContext as TenantContext | undefined)?.organizationId ?? null;
	},
);

/** Inject the authenticated user (populated by AuthGuard) into a handler arg. */
export const CurrentUser = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): SessionUser | undefined => {
		const req = ctx.switchToHttp().getRequest();
		return req.user as SessionUser | undefined;
	},
);
