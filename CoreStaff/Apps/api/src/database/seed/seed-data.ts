/**
 * Seed data for TASK-019 — two Organizations (A & B), one HR each, plus a platform
 * System Admin. Plaintext temp passwords are hashed at seed time by `seed.ts`;
 * nothing secret is committed here beyond demo-only local credentials.
 */

export interface OrgSeed {
	code: string;
	name: string;
}

export interface HrSeed {
	email: string;
	fullName: string;
	employeeCode: string;
	/** Demo-only temp password; hashed before persist. User must change on first login. */
	tempPassword: string;
	/** Which OrgSeed.code this HR belongs to. */
	orgCode: string;
}

export const ORGS: OrgSeed[] = [
	{ code: 'TVS', name: 'TVS Corporation' },
	{ code: 'ABC', name: 'ABC JSC' },
];

export const HRS: HrSeed[] = [
	{ email: 'hr-a@tvs.local', fullName: 'HR A — TVS', employeeCode: 'HR-A', tempPassword: 'TvsAdmin1!', orgCode: 'TVS' },
	{ email: 'hr-b@abc.local', fullName: 'HR B — ABC', employeeCode: 'HR-B', tempPassword: 'AbcAdmin1!', orgCode: 'ABC' },
];

/** System Admin credentials come from env, never hardcoded. */
export interface AdminSeed {
	email: string;
	fullName: string;
	tempPassword: string;
}
