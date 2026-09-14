import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard, ROLES_KEY } from './rbac.decorator';

function ctx(user: { role: string } | undefined): ExecutionContext {
	return {
		switchToHttp: () => ({ getRequest: () => ({ user }) }),
		// getAllAndOverride is what the guard uses; these satisfy the arg shape.
		getHandler: () => ({}),
		getClass: () => ({}),
	} as unknown as ExecutionContext;
}

describe('RolesGuard (TASK-018)', () => {
	function guardWith(allowed: string[] | undefined) {
		const reflector = {
			getAllAndOverride: (_key: string, _args: unknown[]) => allowed,
		} as unknown as Reflector;
		return new RolesGuard(reflector);
	}

	it('allows when no roles declared', () => {
		expect(guardWith(undefined).canActivate(ctx({ role: 'EMPLOYEE' }))).toBe(true);
	});

	it('allows a declared role', () => {
		expect(guardWith(['HR']).canActivate(ctx({ role: 'HR' }))).toBe(true);
	});

	it('rejects an undeclared role → FORBIDDEN', () => {
		expect(() => guardWith(['HR']).canActivate(ctx({ role: 'EMPLOYEE' }))).toThrow(/FORBIDDEN/);
	});

	it('SYSTEM_ADMIN bypasses any role list', () => {
		expect(guardWith(['HR']).canActivate(ctx({ role: 'SYSTEM_ADMIN' }))).toBe(true);
	});

	it('rejects anonymous request', () => {
		expect(() => guardWith(['HR']).canActivate(ctx(undefined))).toThrow(/FORBIDDEN/);
	});

	it('exposes the metadata key used by @Roles', () => {
		expect(ROLES_KEY).toBe('rbac:allowedRoles');
	});
});
