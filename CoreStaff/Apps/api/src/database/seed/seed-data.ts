/**
 * Seed data — TASK-019 Organizations/HR accounts plus the TASK-020..023 demo
 * catalog (departments, positions, employees) so the employee API and the UIs
 * have rows to exercise without hand-inserting documents.
 *
 * No passwords here (DoD §:2352): `seed.ts` hashes one env-supplied temp
 * password per org, with a dev-only default. See `SEED_PASSWORD` in .env.example.
 */

import { Gender, Role, ContractStatus, ContractType } from '../schemas/enums';

export interface OrgSeed {
	code: string;
	name: string;
}

export interface HrSeed {
	email: string;
	fullName: string;
	employeeCode: string;
	/** Which OrgSeed.code this HR belongs to. */
	orgCode: string;
	/** joinDate for the HR's own EmployeeProfile (HR staff are employees too). */
	joinDate: string;
	/** PROBATION→ACTIVE date for the HR's profile. */
	activeDate: string;
}

/** Department and Position share the same tenant-scoped {code, name} shape. */
export interface CatalogSeed {
	orgCode: string;
	code: string;
	name: string;
}

export interface EmployeeSeed {
	email: string;
	fullName: string;
	employeeCode: string;
	orgCode: string;
	/** Role only — `Role`'s type alias shadows its const, so no member types here. */
	role: 'DEPARTMENT_MANAGER' | 'EMPLOYEE';
	/** Key into DEPARTMENTS within the same orgCode. */
	departmentCode?: string;
	/** Key into POSITIONS within the same orgCode. */
	positionCode?: string;
	/** employeeCode of another EmployeeSeed in the same org — seeded as directManagerId. */
	managerCode?: string;
	joinDate: string;
	/** When set, profile is seeded as ACTIVE and a PROBATION→ACTIVE history row uses this date. */
	activeDate?: string;
	dateOfBirth?: string;
	gender?: Gender;
	phone?: string;
}

export const ORGS: OrgSeed[] = [
	{ code: 'TVS', name: 'TVS Corporation' },
	{ code: 'ABC', name: 'ABC JSC' },
];

export const HRS: HrSeed[] = [
	{ email: 'hr-a@tvs.local', fullName: 'HR A — TVS', employeeCode: 'HR-A', orgCode: 'TVS', joinDate: '2025-01-02', activeDate: '2025-04-02' },
	{ email: 'hr-b@abc.local', fullName: 'HR B — ABC', employeeCode: 'HR-B', orgCode: 'ABC', joinDate: '2025-01-02', activeDate: '2025-04-02' },
];

export const DEPARTMENTS: CatalogSeed[] = [
	{ orgCode: 'TVS', code: 'ENG', name: 'Engineering' },
	{ orgCode: 'TVS', code: 'FIN', name: 'Finance' },
	{ orgCode: 'TVS', code: 'OPS', name: 'Operations' },
	{ orgCode: 'ABC', code: 'SAL', name: 'Sales' },
	{ orgCode: 'ABC', code: 'FIN', name: 'Finance' },
];

export const POSITIONS: CatalogSeed[] = [
	{ orgCode: 'TVS', code: 'DLEAD', name: 'Engineering Lead' },
	{ orgCode: 'TVS', code: 'DEV', name: 'Software Developer' },
	{ orgCode: 'TVS', code: 'QA', name: 'QA Engineer' },
	{ orgCode: 'TVS', code: 'ACC', name: 'Accountant' },
	{ orgCode: 'TVS', code: 'OPS', name: 'Operations Staff' },
	{ orgCode: 'ABC', code: 'SLM', name: 'Sales Manager' },
	{ orgCode: 'ABC', code: 'SLS', name: 'Sales Staff' },
	{ orgCode: 'ABC', code: 'ACC', name: 'Accountant' },
];

export const EMPLOYEES: EmployeeSeed[] = [
	// --- TVS ---
	{
		email: 'an.nguyen@tvs.local', fullName: 'Nguyễn Văn An', employeeCode: 'TVS-0001',
		orgCode: 'TVS', role: Role.DEPARTMENT_MANAGER,
		departmentCode: 'ENG', positionCode: 'DLEAD',
		joinDate: '2025-03-03', activeDate: '2025-06-15', dateOfBirth: '1990-05-14',
		gender: Gender.MALE, phone: '0901000001',
	},
	{
		email: 'binh.tran@tvs.local', fullName: 'Trần Thị Bình', employeeCode: 'TVS-0002',
		orgCode: 'TVS', role: Role.EMPLOYEE,
		departmentCode: 'ENG', positionCode: 'DEV', managerCode: 'TVS-0001',
		joinDate: '2025-06-02', activeDate: '2025-09-01', dateOfBirth: '1995-11-08',
		gender: Gender.FEMALE, phone: '0901000002',
	},
	{
		email: 'cuong.le@tvs.local', fullName: 'Lê Văn Cường', employeeCode: 'TVS-0003',
		orgCode: 'TVS', role: Role.EMPLOYEE,
		departmentCode: 'ENG', positionCode: 'DEV', managerCode: 'TVS-0001',
		joinDate: '2026-08-03', dateOfBirth: '1999-01-20', gender: Gender.MALE, phone: '0901000003',
	},
	{
		email: 'dung.pham@tvs.local', fullName: 'Phạm Thị Dung', employeeCode: 'TVS-0004',
		orgCode: 'TVS', role: Role.EMPLOYEE,
		departmentCode: 'ENG', positionCode: 'QA', managerCode: 'TVS-0001',
		joinDate: '2025-09-01', activeDate: '2025-12-01', dateOfBirth: '1997-07-30',
		gender: Gender.FEMALE, phone: '0901000004',
	},
	{
		email: 'em.hoang@tvs.local', fullName: 'Hoàng Văn Em', employeeCode: 'TVS-0005',
		orgCode: 'TVS', role: Role.EMPLOYEE,
		departmentCode: 'FIN', positionCode: 'ACC',
		joinDate: '2024-11-11', activeDate: '2025-02-10', dateOfBirth: '1992-03-25',
		gender: Gender.MALE, phone: '0901000005',
	},
	{
		email: 'giang.vu@tvs.local', fullName: 'Vũ Thị Giang', employeeCode: 'TVS-0006',
		orgCode: 'TVS', role: Role.EMPLOYEE,
		departmentCode: 'OPS', positionCode: 'OPS',
		joinDate: '2026-09-01', dateOfBirth: '2000-10-12', gender: Gender.FEMALE, phone: '0901000006',
	},
	// --- ABC ---
	{
		email: 'ha.tran@abc.local', fullName: 'Trần Văn Hà', employeeCode: 'ABC-0001',
		orgCode: 'ABC', role: Role.DEPARTMENT_MANAGER,
		departmentCode: 'SAL', positionCode: 'SLM',
		joinDate: '2025-01-15', activeDate: '2025-04-15', dateOfBirth: '1988-12-02',
		gender: Gender.MALE, phone: '0902000001',
	},
	{
		email: 'my.ngo@abc.local', fullName: 'Ngô Thị Mỹ', employeeCode: 'ABC-0002',
		orgCode: 'ABC', role: Role.EMPLOYEE,
		departmentCode: 'SAL', positionCode: 'SLS', managerCode: 'ABC-0001',
		joinDate: '2025-05-05', activeDate: '2025-08-05', dateOfBirth: '1996-06-18',
		gender: Gender.FEMALE, phone: '0902000002',
	},
	{
		email: 'nam.duong@abc.local', fullName: 'Dương Văn Nam', employeeCode: 'ABC-0003',
		orgCode: 'ABC', role: Role.EMPLOYEE,
		departmentCode: 'FIN', positionCode: 'ACC',
		joinDate: '2026-07-01', dateOfBirth: '1998-09-09', gender: Gender.MALE, phone: '0902000003',
	},
];

/** System Admin credentials come from env, never hardcoded. */
export interface AdminSeed {
	email: string;
	fullName: string;
	tempPassword: string;
}

/**
 * Temp password for every seeded account when `SEED_PASSWORD` is unset. Local
 * demo data only — `seed.ts` refuses this default outside a dev environment, so a
 * real run must supply SEED_PASSWORD (DoD §:2352: no committed credentials).
 */
export const DEV_SEED_PASSWORD = 'TvsAdmin1!';

/** Day offsets are resolved against *today* at seed time (TASK-030 reads them
 * relative to the server clock). `expiryOffsetDays` beyond the warning window
 * (30) → no "Sắp hết hạn" badge on the dashboard. */
export interface ContractSeed {
	orgCode: string;
	employeeCode: string;
	contractType: ContractType;
	status: ContractStatus;
	/** Days from today for effectiveDate. None ⇒ date stays 0. */
	effectiveOffsetDays?: number;
	/** Days from today for expiryDate (unset for INDEFINITE_TERM). */
	expiryOffsetDays?: number;
	endDate?: string;
	note?: string;
}

export const CONTRACTS: ContractSeed[] = [
	// TVS-0001: ACTIVE FIXED_TERM inside the 30-day warning window.
	{ orgCode: 'TVS', employeeCode: 'TVS-0001', contractType: ContractType.FIXED_TERM, status: ContractStatus.ACTIVE, effectiveOffsetDays: -60, expiryOffsetDays: 15, note: 'Hợp đồng 2025, gia hạn theo đợt.' },
	// TVS-0003: ACTIVE INDEFINITE_TERM — never expires.
	{ orgCode: 'TVS', employeeCode: 'TVS-0003', contractType: ContractType.INDEFINITE_TERM, status: ContractStatus.ACTIVE, effectiveOffsetDays: -10, note: 'Chính thức nhận việc sau thử việc.' },
	// TVS-0005: EXPIRED FIXED_TERM (end in the past).
	{ orgCode: 'TVS', employeeCode: 'TVS-0005', contractType: ContractType.FIXED_TERM, status: ContractStatus.EXPIRED, effectiveOffsetDays: -400, expiryOffsetDays: -30 },
	// ABC-0002: ACTIVE INDEFINITE_TERM, far outside the warning window.
	{ orgCode: 'ABC', employeeCode: 'ABC-0002', contractType: ContractType.INDEFINITE_TERM, status: ContractStatus.ACTIVE, effectiveOffsetDays: -120 },
	// ABC-0003: DRAFT PROBATION — HR is drafting, expiry in 60 days.
	{ orgCode: 'ABC', employeeCode: 'ABC-0003', contractType: ContractType.PROBATION, status: ContractStatus.DRAFT, effectiveOffsetDays: 0, expiryOffsetDays: 60 },
];

/** Document rows are metadata-only: storageKey points at a seed ObjectId that has
 * no real S3 object, so downloads 404 — they exist purely to populate the lists. */
export interface DocumentSeed {
	orgCode: string;
	employeeCode: string;
	contractCode: string;
	originalName: string;
	mimeType: string;
	sizeBytes: number;
}

export const DOCUMENTS: DocumentSeed[] = [
	{ orgCode: 'TVS', employeeCode: 'TVS-0001', contractCode: 'TVS-0001', originalName: 'CV_NguyenVanAn.pdf', mimeType: 'application/pdf', sizeBytes: 48_536 },
	{ orgCode: 'TVS', employeeCode: 'TVS-0005', contractCode: 'TVS-0005', originalName: 'CCCD_HoangVanEm.jpg', mimeType: 'image/jpeg', sizeBytes: 1_204_671 },
];
