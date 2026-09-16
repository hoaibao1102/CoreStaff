import { userFields, profileFields, provisionAccount, attachProfile } from './provision';
import type { AccountInput } from './provision';

/**
 * The invariant TASK-120 exists to protect: one account, two documents, and each
 * field on exactly the collection that owns it. Seed and EmployeeService both
 * build their writes here, so pinning it once covers both paths.
 */
const INPUT: AccountInput = {
	organizationId: 'org1',
	email: 'An@Example.com',
	fullName: 'Nguyễn Văn An',
	phone: '0901000001',
	employeeCode: 'TVS-0001',
	passwordHash: 'hash-not-a-plaintext',
	role: 'EMPLOYEE',
	joinDate: '2026-01-01',
	employmentStatus: 'PROBATION',
};

function fakeModel(store: Record<string, unknown>[]) {
	return {
		async create(doc: Record<string, unknown>) {
			const _id = `id${store.length + 1}`;
			store.push({ _id, ...doc });
			return { _id };
		},
	};
}

describe('provision (TASK-120)', () => {
	it('puts the login identity on the User and the code on the profile only', () => {
		const user = userFields(INPUT);
		const profile = profileFields(INPUT, 'u1');

		expect(user).not.toHaveProperty('employeeCode'); // sole owner: the profile
		expect(profile.employeeCode).toBe('TVS-0001');
		// email/phone are deliberately on both (SRS §15.2A), from one write path.
		expect(user.email).toBe(profile.email);
		expect(user.phone).toBe(profile.phone);
		expect(user.passwordHash).toBe('hash-not-a-plaintext');
	});

	it('defaults a fresh account to ACTIVE, must-change-password, unlocked', () => {
		expect(userFields(INPUT)).toMatchObject({ status: 'ACTIVE', mustChangePassword: true, failedLoginCount: 0 });
	});

	it('writes both halves as a unit, linking the profile to the new userId', async () => {
		const users: Record<string, unknown>[] = [];
		const profiles: Record<string, unknown>[] = [];
		const { userId, employeeProfileId } = await provisionAccount(fakeModel(users), fakeModel(profiles), INPUT);

		expect(users).toHaveLength(1);
		expect(profiles).toHaveLength(1);
		expect(profiles[0].userId).toBe(userId);
		expect(employeeProfileId).toBeTruthy();
	});

	it('attachProfile writes only the profile — the self-provisioning half', async () => {
		const profiles: Record<string, unknown>[] = [];
		await attachProfile(fakeModel(profiles), INPUT, 'caller-user');

		expect(profiles).toHaveLength(1);
		expect(profiles[0].userId).toBe('caller-user');
		expect(profiles[0].employeeCode).toBe('TVS-0001');
	});
});
