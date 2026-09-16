import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard, PlatformOnly, ROLES_KEY, PLATFORM_ONLY_KEY } from './rbac.decorator';

function ctx(user: { role: string } | undefined): ExecutionContext {
	return {
		switchToHttp: () => ({ getRequest: () => ({ user }) }),
		// getAllAndOverride is what the guard uses; these satisfy the arg shape.
		getHandler: () => ({}),
		getClass: () => ({}),
	} as unknown as ExecutionContext;
}

describe('RolesGuard (TASK-018)', () => {
	// Key-aware: the guard reads @Roles and @PlatformOnly from the same reflector.
	function guardWith(allowed: string[] | undefined, platformOnly = false) {
		const reflector = {
			getAllAndOverride: (key: string, _args: unknown[]) =>
				key === ROLES_KEY ? allowed : platformOnly,
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

	// AC-SYS-01: a platform route is closed to tenant roles, and the admin bypass
	// above is not a licence to reach tenant routes — @PlatformOnly is what makes
	// the bypass directional.
	describe('@PlatformOnly', () => {
		it('lets the platform admin through with no @Roles list', () => {
			expect(guardWith(undefined, true).canActivate(ctx({ role: 'SYSTEM_ADMIN' }))).toBe(true);
		});

		it.each(['HR', 'EMPLOYEE', 'DEPARTMENT_MANAGER'])('rejects %s → PLATFORM_ONLY', (role) => {
			expect(() => guardWith(undefined, true).canActivate(ctx({ role }))).toThrow(/PLATFORM_ONLY/);
		});

		it('still rejects a tenant role on a platform route that also names roles', () => {
			expect(() => guardWith(['HR'], true).canActivate(ctx({ role: 'HR' }))).toThrow(/PLATFORM_ONLY/);
		});

		it('rejects an anonymous request before the platform check', () => {
			expect(() => guardWith(undefined, true).canActivate(ctx(undefined))).toThrow(/FORBIDDEN/);
		});

		it('writes the marker the guard reads', () => {
			const target = {} as Record<string, unknown>;
			(PlatformOnly() as unknown as (t: object) => void)(target);
			expect(Reflect.getMetadata(PLATFORM_ONLY_KEY, target)).toBe(true);
		});
	});
});
