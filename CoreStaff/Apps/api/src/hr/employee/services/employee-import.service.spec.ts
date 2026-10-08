import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { EmployeeImportService, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from './employee-import.service';

// bcrypt is deliberately slow; the import's own logic is what is under test here.
jest.mock('../../../auth/strategies/bcrypt.strategy', () => ({
	hashPassword: async (password: string) => `hashed:${password}`,
}));

/* ───────── Fakes ───────── */

type Row = Record<string, any>;

/** Minimal `$in`-aware matcher — enough for the four shapes the service queries. */
function matches(row: Row, filter: Row): boolean {
	return Object.entries(filter).every(([key, want]) => {
		if (want && typeof want === 'object' && Array.isArray((want as { $in?: unknown[] }).$in)) {
			return (want as { $in: unknown[] }).$in.includes(row[key]);
		}
		return row[key] === want;
	});
}

/** Chainable, thenable stand-in for a Mongoose Query. */
function query(rows: Row[], filter: Row) {
	const result = rows.filter((r) => matches(r, filter));
	const chain: any = {
		select: () => chain,
		sort: () => chain,
		session: () => chain,
		lean: async () => result.map((r) => ({ ...r })),
		then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
			Promise.resolve(result.map((r) => ({ ...r }))).then(resolve, reject),
	};
	return chain;
}

function fakeModel(rows: Row[]) {
	let nextId = rows.length + 1;
	return {
		rows,
		create: jest.fn(async (docOrDocs: Row | Row[]) => {
			const docs = Array.isArray(docOrDocs) ? docOrDocs : [docOrDocs];
			const created = docs.map((doc) => {
				const row = { _id: `id-${nextId++}`, ...doc };
				rows.push(row);
				return { ...row, toObject: () => row };
			});
			return Array.isArray(docOrDocs) ? created : created[0];
		}),
		find: jest.fn((filter: Row) => query(rows, filter)),
		findOne: jest.fn((filter: Row) => {
			const found = rows.find((r) => matches(r, filter));
			const chain: any = {
				select: () => chain,
				sort: () => chain,
				session: () => chain,
				lean: async () => (found ? { ...found } : null),
			};
			return chain;
		}),
		updateOne: jest.fn(async (filter: Row, update: { $set: Row }) => {
			const found = rows.find((r) => matches(r, filter));
			if (found) Object.assign(found, update.$set);
			return { modifiedCount: found ? 1 : 0 };
		}),
	};
}

/** Transactions are exercised for real in the integration suite; here `withTransaction` just runs the body. */
function fakeConnection() {
	return {
		startSession: async () => ({
			withTransaction: async (fn: () => Promise<unknown>) => fn(),
			endSession: async () => undefined,
		}),
	};
}

const HEADERS = [
	'employeeCode', 'fullName', 'email', 'role', 'phone',
	'joinDate', 'dateOfBirth', 'gender', 'citizenId', 'taxCode',
	'socialInsuranceCode', 'bankAccount', 'address',
	'departmentCode', 'positionCode', 'directManagerCode',
	'baseSalary', 'salaryEffectiveFrom',
	'attendanceBonusPolicyCode', 'insuranceEffectiveFrom', 'insuranceEffectiveTo',
	'contractType', 'contractEffectiveDate', 'contractExpiryDate',
];

/** The headers the template actually writes — HR-facing Vietnamese labels. */
const VI_HEADERS = [
	'Mã nhân viên', 'Họ và tên', 'Email', 'Vai trò', 'Số điện thoại',
	'Ngày vào làm', 'Ngày sinh', 'Giới tính', 'Số CCCD', 'Mã số thuế',
	'Số BHXH', 'Số tài khoản ngân hàng', 'Địa chỉ',
	'Phòng ban', 'Chức danh', 'Quản lý trực tiếp',
	'Lương cơ bản', 'Lương hiệu lực từ ngày',
	'Chính sách thưởng chuyên cần', 'Bảo hiểm hiệu lực từ ngày', 'Bảo hiểm hiệu lực đến ngày',
	'Loại hợp đồng', 'Ngày hiệu lực hợp đồng', 'Ngày hết hạn hợp đồng',
];

const DEPENDENT_HEADERS = ['employeeCode', 'fullName', 'dateOfBirth', 'relationship', 'idCardNumber'];
const VI_DEPENDENT_HEADERS = ['Mã nhân viên', 'Họ và tên người phụ thuộc', 'Ngày sinh', 'Mối quan hệ với nhân viên', 'Số CCCD'];

/**
 * A test row is keyed by the *code* name regardless of which spelling the header
 * uses, so map each written header back to its code key — falling back to the
 * header itself, which is what `allowance_PHONE` and partial header lists need.
 */
function toCodeKey(header: string, codes: string[], labels: string[]): string {
	const at = labels.indexOf(header);
	return at === -1 ? header : codes[at];
}

/**
 * Header row + one row per object. `rows`/`dependentRows` are keyed by the code
 * name; `headers` is what gets written, so a test can exercise either spelling.
 */
async function workbook(
	rows: Row[],
	headers: string[] = HEADERS,
	dependentRows: Row[] = [],
	dependentHeaders: string[] = DEPENDENT_HEADERS,
): Promise<Buffer> {
	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet('NhanVien');
	ws.addRow(headers);
	for (const row of rows) ws.addRow(headers.map((h) => row[toCodeKey(h, HEADERS, VI_HEADERS)] ?? ''));

	const deps = wb.addWorksheet('NguoiPhuThuoc');
	deps.addRow(dependentHeaders);
	for (const row of dependentRows) {
		deps.addRow(dependentHeaders.map((h) => row[toCodeKey(h, DEPENDENT_HEADERS, VI_DEPENDENT_HEADERS)] ?? ''));
	}

	return Buffer.from(await wb.xlsx.writeBuffer());
}

const validRow = (overrides: Row = {}): Row => ({
	employeeCode: 'TVS-001',
	fullName: 'Nguyễn Văn An',
	email: 'an@tvs.vn',
	joinDate: '2026-01-05',
	departmentCode: 'IT',
	positionCode: 'DEV',
	...overrides,
});

interface Fixture {
	service: EmployeeImportService;
	profiles: ReturnType<typeof fakeModel>;
	users: ReturnType<typeof fakeModel>;
	salaries: ReturnType<typeof fakeModel>;
	insurances: ReturnType<typeof fakeModel>;
	contracts: ReturnType<typeof fakeModel>;
	bonusPolicies: ReturnType<typeof fakeModel>;
}

interface FixtureSeed {
	profiles?: Row[];
	users?: Row[];
	departments?: Row[];
	positions?: Row[];
	allowances?: Row[];
	bonusPolicies?: Row[];
}

function buildFixture(seed: FixtureSeed = {}): Fixture {
	const profiles = fakeModel(seed.profiles ?? []);
	const users = fakeModel(seed.users ?? []);
	const departments = fakeModel(seed.departments ?? [{ _id: 'd1', organizationId: 'org', code: 'IT', name: 'IT', active: true }]);
	const positions = fakeModel(seed.positions ?? [{ _id: 'p1', organizationId: 'org', code: 'DEV', name: 'Dev', departmentId: 'd1', active: true }]);
	const allowances = fakeModel(seed.allowances ?? []);
	const bonusPolicies = fakeModel(seed.bonusPolicies ?? []);
	const salaries = fakeModel([]);
	const insurances = fakeModel([]);
	const contracts = fakeModel([]);

	const service = new EmployeeImportService(
		profiles as never, users as never, departments as never, positions as never,
		salaries as never, insurances as never, contracts as never, allowances as never, bonusPolicies as never,
		fakeConnection() as never,
	);
	return { service, profiles, users, salaries, insurances, contracts, bonusPolicies };
}

const ORG = 'org';
const ACTOR = 'actor-1';

/* ───────── Parse ───────── */

describe('EmployeeImportService.parseWorkbook', () => {
	it('reads a valid sheet into rows with no errors', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([validRow()]));

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ employeeCode: 'TVS-001', email: 'an@tvs.vn', joinDate: '2026-01-05', role: 'EMPLOYEE' });
		expect(rows[0].errors).toEqual([]);
	});

	it('skips rows that are blank across every mapped column', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([validRow(), {}]));
		expect(rows).toHaveLength(1);
	});

	it('reports missing required fields per row', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([{ employeeCode: 'TVS-002', joinDate: '2026-01-05', departmentCode: 'IT', positionCode: 'DEV' }]));

		const codes = rows[0].errors.map((e) => e.code);
		expect(codes).toContain('FULLNAME_REQUIRED');
		expect(codes).toContain('EMAIL_REQUIRED');
	});

	it('rejects SYSTEM_ADMIN and any unknown role', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([validRow({ role: 'SYSTEM_ADMIN' })]));
		expect(rows[0].errors.map((e) => e.code)).toContain('ROLE_NOT_ALLOWED');
	});

	it('accepts DEPARTMENT_MANAGER and HR', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([validRow({ role: 'HR' }), validRow({ employeeCode: 'TVS-003', email: 'm@tvs.vn', role: 'DEPARTMENT_MANAGER' })]));
		expect(rows.flatMap((r) => r.errors)).toEqual([]);
	});

	it('normalizes Excel date serials and MM/DD/YYYY to ISO', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([
			validRow({ joinDate: '05/01/2026', dateOfBirth: 43831 }),
		]));
		// Month first: `05/01` is 1 May, not 5 January. The template formats date
		// cells `mm/dd/yyyy`, so this is the order HR types and Excel shows.
		expect(rows[0].joinDate).toBe('2026-05-01');
		expect(rows[0].dateOfBirth).toBe('2020-01-01');
	});

	it('keeps reading ISO dates, so a file saved from an older template still works', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([validRow({ joinDate: '2026-01-05' })]));
		expect(rows[0].joinDate).toBe('2026-01-05');
		expect(rows[0].errors).toEqual([]);
	});

	it('reads an unambiguous day-first string the same as its month-first twin', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([validRow({ joinDate: '15/03/2026' })]));
		// 15 cannot be a month, so only one reading survives the regex.
		expect(rows[0].joinDate).toBe('2026-03-15');
		expect(rows[0].errors).toEqual([]);
	});

	it('flags a future join date', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([validRow({ joinDate: '2099-01-01' })]));
		expect(rows[0].errors.map((e) => e.code)).toContain('JOIN_DATE_FUTURE');
	});

	it('reads dependents from their own sheet, joined by employeeCode', async () => {
		const { service } = buildFixture();
		const { rows, orphans } = await service.parseWorkbook(await workbook(
			[validRow()],
			HEADERS,
			[
				{ employeeCode: 'TVS-001', fullName: 'Nguyễn Bé', dateOfBirth: '2020-05-01', relationship: 'CHILD' },
				{ employeeCode: 'TVS-001', fullName: 'Nguyễn Tí', dateOfBirth: '2022-09-09', relationship: 'SPOUSE' },
			],
		));

		expect(orphans).toEqual([]);
		expect(rows[0].dependents).toEqual([
			{ fullName: 'Nguyễn Bé', dateOfBirth: '2020-05-01', relationship: 'CHILD', idCardNumber: undefined },
			{ fullName: 'Nguyễn Tí', dateOfBirth: '2022-09-09', relationship: 'SPOUSE', idCardNumber: undefined },
		]);
	});

	it('reports an orphan dependent as a file error, not an employee row error', async () => {
		const { service } = buildFixture();
		const { rows, orphans } = await service.parseWorkbook(await workbook(
			[validRow()],
			HEADERS,
			[{ employeeCode: 'TVS-999', fullName: 'Nguyễn Bé', dateOfBirth: '2020-05-01', relationship: 'CHILD' }],
		));

		expect(rows[0].errors).toEqual([]);
		expect(orphans.map((e) => e.code)).toEqual(['DEPENDENT_ORPHAN']);
		expect(orphans[0].employeeCode).toBe('TVS-999');
	});

	it('accepts a file whose dependent sheet was deleted, and one whose tab was renamed', async () => {
		const { service } = buildFixture();
		const wb = new ExcelJS.Workbook();
		const ws = wb.addWorksheet('NhanVien');
		ws.addRow(HEADERS);
		ws.addRow(HEADERS.map((h) => validRow()[h] ?? ''));

		// Deleted: only the employee sheet remains.
		const withoutDeps = await service.parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
		expect(withoutDeps.rows[0].dependents).toEqual([]);

		// Renamed: same columns, different tab name — dependents must still attach.
		const deps = wb.addWorksheet('PhuThuoc');
		deps.addRow(DEPENDENT_HEADERS);
		deps.addRow(['TVS-001', 'Nguyễn Bé', '2020-05-01', 'CHILD', '']);
		const renamed = await service.parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
		expect(renamed.rows[0].dependents).toHaveLength(1);
	});

	it('reads only the insurance effective date — participation has no column', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([
			validRow({ insuranceEffectiveFrom: '2026-01-05' }),
		]));
		// Participation is mandatory (D40), so the columns that could waive it are
		// gone; the effective date is the one insurance cell HR still fills.
		expect(rows[0].errors).toEqual([]);
		expect(rows[0].insuranceEffectiveFrom).toBe('2026-01-05');
	});

	it('reads an insurance end date and rejects one on or before the start', async () => {
		const { service } = buildFixture();
		const ok = await service.parseWorkbook(await workbook([
			validRow({ insuranceEffectiveFrom: '2026-01-05', insuranceEffectiveTo: '2027-01-04' }),
		]));
		expect(ok.rows[0].errors).toEqual([]);
		expect(ok.rows[0].insuranceEffectiveTo).toBe('2027-01-04');

		const bad = await service.parseWorkbook(await workbook([
			validRow({ insuranceEffectiveFrom: '2026-01-05', insuranceEffectiveTo: '2026-01-05' }),
		]));
		expect(bad.rows[0].errors.map((e) => e.code)).toContain('INSURANCE_EFFECTIVE_TO_BEFORE_FROM');
	});

	it('leaves contract fields empty when the row names no contract type', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([validRow()]));
		expect(rows[0].errors).toEqual([]);
		expect(rows[0].contractType).toBeUndefined();
	});

	it('reads a fixed-term contract from its Vietnamese dropdown value', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([
			validRow({
				contractType: 'Có thời hạn',
				contractEffectiveDate: '2026-01-05',
				contractExpiryDate: '2027-01-04',
			}),
		]));
		expect(rows[0].errors).toEqual([]);
		expect(rows[0].contractType).toBe('FIXED_TERM');
		expect(rows[0].contractExpiryDate).toBe('2027-01-04');
	});

	it('accepts an indefinite contract with no expiry, and rejects one that has it', async () => {
		const { service } = buildFixture();
		const ok = await service.parseWorkbook(await workbook([
			validRow({ contractType: 'Không thời hạn', contractEffectiveDate: '2026-01-05' }),
		]));
		expect(ok.rows[0].errors).toEqual([]);

		const bad = await service.parseWorkbook(await workbook([
			validRow({ contractType: 'Không thời hạn', contractEffectiveDate: '2026-01-05', contractExpiryDate: '2027-01-04' }),
		]));
		expect(bad.rows[0].errors.map((e) => e.code)).toContain('CONTRACT_INDEFINITE_TERM_NO_EXPIRY');
	});

	it('requires an expiry for probation and fixed-term contracts', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([
			validRow({ contractType: 'Thử việc', contractEffectiveDate: '2026-01-05' }),
		]));
		expect(rows[0].errors.map((e) => e.code)).toContain('CONTRACT_EXPIRY_REQUIRED');
	});

	it('requires an effective date once a contract type is chosen', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([
			validRow({ contractType: 'Không thời hạn' }),
		]));
		expect(rows[0].errors.map((e) => e.code)).toContain('CONTRACT_EFFECTIVE_DATE_REQUIRED');
	});

	it('rejects an expiry on or before the contract effective date', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([
			validRow({ contractType: 'Có thời hạn', contractEffectiveDate: '2026-01-05', contractExpiryDate: '2025-12-31' }),
		]));
		expect(rows[0].errors.map((e) => e.code)).toContain('CONTRACT_EXPIRY_BEFORE_EFFECTIVE');
	});

	it('rejects a contract type outside the three the dropdown offers', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([
			validRow({ contractType: 'Hợp đồng dài hạn', contractEffectiveDate: '2026-01-05' }),
		]));
		expect(rows[0].errors.map((e) => e.code)).toContain('CONTRACT_TYPE_INVALID');
	});

	it('ignores a bonus policy cell holding the "no policy" sentinel', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([
			validRow({ attendanceBonusPolicyCode: 'Không áp dụng' }),
		]));
		expect(rows[0].errors).toEqual([]);
		expect(rows[0].bonusPolicyCode).toBeUndefined();
	});

	it('rejects a negative salary written as text', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([
			validRow({ baseSalary: '-500000' }),
		]));
		expect(rows[0].errors.map((e) => e.code)).toContain('BASE_SALARY_INVALID');
	});

	it('reads an allowance column whose header carries the catalog name', async () => {
		// The template writes `Phụ cấp PHONE (Điện thoại)`; the name is a label for
		// HR and must not leak into the code the parser looks up.
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook(
			[validRow({ 'Phụ cấp PHONE (Điện thoại)': '500000' })],
			[...HEADERS, 'Phụ cấp PHONE (Điện thoại)'],
		));
		expect(rows[0].errors).toEqual([]);
		expect(rows[0].allowances).toEqual([{ code: 'PHONE', amount: 500000 }]);
	});

	it('rejects a sheet without the required columns', async () => {
		const { service } = buildFixture();
		await expect(service.parseWorkbook(await workbook([validRow()], ['employeeCode', 'fullName']))).rejects.toThrow(BadRequestException);
	});

	it('rejects a non-workbook buffer', async () => {
		const { service } = buildFixture();
		await expect(service.parseWorkbook(Buffer.from('not an xlsx'))).rejects.toThrow('EMPLOYEE_IMPORT_FILE_INVALID');
	});

	it('reads the Vietnamese headers the template writes', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook(
			[validRow({ role: 'Quản lý phòng ban', gender: 'Nam' })],
			VI_HEADERS,
		));

		expect(rows[0].errors).toEqual([]);
		expect(rows[0]).toMatchObject({ employeeCode: 'TVS-001', role: 'DEPARTMENT_MANAGER', gender: 'MALE' });
	});

	it('reads the "CODE — nhãn" cells the dropdowns write', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook(
			[validRow({
				role: 'DEPARTMENT_MANAGER — Quản lý phòng ban',
				gender: 'FEMALE — Nữ',
				departmentCode: 'IT — Phòng IT',
				positionCode: 'DEV — Lập trình viên',
			})],
			VI_HEADERS,
			[{ employeeCode: 'TVS-001', fullName: 'Nguyễn Bé', dateOfBirth: '2020-05-01', relationship: 'CHILD — Con' }],
			VI_DEPENDENT_HEADERS,
		));

		expect(rows[0].errors).toEqual([]);
		expect(rows[0]).toMatchObject({
			role: 'DEPARTMENT_MANAGER',
			gender: 'FEMALE',
			departmentCode: 'IT',
			positionCode: 'DEV',
		});
		expect(rows[0].dependents[0].relationship).toBe('CHILD');
	});

	it('accepts Vietnamese values for dependent relationship', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook(
			[validRow()],
			VI_HEADERS,
			[{ employeeCode: 'TVS-001', fullName: 'Nguyễn Bé', dateOfBirth: '2020-05-01', relationship: 'Con' }],
			VI_DEPENDENT_HEADERS,
		));

		expect(rows[0].dependents).toEqual([
			{ fullName: 'Nguyễn Bé', dateOfBirth: '2020-05-01', relationship: 'CHILD', idCardNumber: undefined },
		]);
	});

	it('still accepts the older code-name headers', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook(
			[validRow({ role: 'HR', gender: 'FEMALE' })],
			HEADERS,
			[{ employeeCode: 'TVS-001', fullName: 'Nguyễn Bé', dateOfBirth: '2020-05-01', relationship: 'CHILD' }],
			DEPENDENT_HEADERS,
		));

		expect(rows[0].errors).toEqual([]);
		expect(rows[0]).toMatchObject({ role: 'HR', gender: 'FEMALE' });
		expect(rows[0].dependents).toHaveLength(1);
	});
});

/* ───────── Per-field rules ───────── */

/**
 * One broken cell at a time. The all-or-nothing rule means each of these must be
 * caught at parse time — if a validator is missing, the bad value reaches Mongo
 * and the whole file dies on a schema error nobody can trace back to a cell.
 */
describe('EmployeeImportService.parseWorkbook — field rules', () => {
	/** Codes a single-row file reports. */
	async function codesFor(overrides: Row): Promise<string[]> {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([validRow(overrides)]));
		return rows[0].errors.map((e) => e.code);
	}

	it('requires an employee code, name and email', async () => {
		expect(await codesFor({ employeeCode: '' })).toContain('EMPLOYEE_CODE_REQUIRED');
		expect(await codesFor({ fullName: '' })).toContain('FULLNAME_REQUIRED');
		expect(await codesFor({ email: '' })).toContain('EMAIL_REQUIRED');
	});

	it('rejects a malformed email', async () => {
		expect(await codesFor({ email: 'khong-phai-email' })).toContain('EMAIL_INVALID');
	});

	it('rejects a phone that is not exactly 10 digits', async () => {
		expect(await codesFor({ phone: '090123456' })).toContain('PHONE_INVALID');
		expect(await codesFor({ phone: '09012345ab' })).toContain('PHONE_INVALID');
	});

	it('accepts a 10-digit phone, and an absent one', async () => {
		expect(await codesFor({ phone: '0901234567' })).toEqual([]);
		expect(await codesFor({ phone: '' })).toEqual([]);
	});

	it('rejects a join date that is not a date at all', async () => {
		// `JOIN_DATE_REQUIRED` covers both "blank" and "unparseable" on purpose —
		// HR sees one message naming the format, not two that mean the same fix.
		expect(await codesFor({ joinDate: 'hôm qua' })).toContain('JOIN_DATE_REQUIRED');
		expect(await codesFor({ joinDate: '' })).toContain('JOIN_DATE_REQUIRED');
	});

	it('rejects a birth date in the future but leaves a blank one alone', async () => {
		expect(await codesFor({ dateOfBirth: '2099-01-01' })).toContain('DOB_FUTURE_DATE');
		expect(await codesFor({ dateOfBirth: '' })).toEqual([]);
	});

	it('rejects a gender outside Nam/Nữ/Khác', async () => {
		expect(await codesFor({ gender: 'Không rõ' })).toContain('GENDER_INVALID');
		expect(await codesFor({ gender: 'Khác' })).toEqual([]);
	});

	it('checks the digit-count of every identity number', async () => {
		expect(await codesFor({ citizenId: '12345678' })).toContain('CITIZEN_ID_INVALID');
		expect(await codesFor({ taxCode: '123456789' })).toContain('TAX_CODE_INVALID');
		expect(await codesFor({ socialInsuranceCode: '1234567890123' })).toContain('SOCIAL_INSURANCE_CODE_INVALID');
		expect(await codesFor({ bankAccount: '12345' })).toContain('BANK_ACCOUNT_INVALID');
	});

	it('accepts the shortest and longest legal identity numbers', async () => {
		expect(await codesFor({ citizenId: '123456789' })).toEqual([]);
		expect(await codesFor({ citizenId: '123456789012' })).toEqual([]);
		expect(await codesFor({ taxCode: '1234567890' })).toEqual([]);
		expect(await codesFor({ bankAccount: '123456' })).toEqual([]);
	});

	it('caps the address at 256 characters', async () => {
		expect(await codesFor({ address: 'x'.repeat(256) })).toEqual([]);
		expect(await codesFor({ address: 'x'.repeat(257) })).toContain('ADDRESS_TOO_LONG');
	});

	it('requires a department and a position', async () => {
		expect(await codesFor({ departmentCode: '' })).toContain('DEPARTMENT_REQUIRED');
		expect(await codesFor({ positionCode: '' })).toContain('POSITION_REQUIRED');
	});

	it('treats the base salary column as optional and standalone', async () => {
		// Lương đóng BHXH là số dẫn xuất (lương cơ bản − tổng phụ cấp) nên chỉ còn
		// một cột lương; điền hay bỏ trống đều hợp lệ, không còn cặp cột ràng buộc nhau.
		expect(await codesFor({ baseSalary: '20000000' })).toEqual([]);
		expect(await codesFor({ baseSalary: '' })).toEqual([]);
		expect(await codesFor({})).toEqual([]);
	});

	it('rejects a negative allowance amount', async () => {
		const { service } = buildFixture();
		const headers = [...HEADERS, 'allowance_PHONE'];
		const { rows } = await service.parseWorkbook(await workbook(
			[validRow({ allowance_PHONE: '-1' })],
			headers,
		));
		expect(rows[0].errors.map((e) => e.code)).toContain('ALLOWANCE_AMOUNT_INVALID');
	});

	it('reads a thousands-separated salary as a number', async () => {
		const { service } = buildFixture();
		const { rows } = await service.parseWorkbook(await workbook([
			validRow({ baseSalary: '20.000.000' }),
		]));
		expect(rows[0].errors).toEqual([]);
		expect(rows[0].baseSalary).toBe(20000000);
	});
});

/* ───────── Catalog lookups (validateRefs) ───────── */

/**
 * Everything that needs the tenant's catalogs runs after `parseWorkbook`, in
 * `validateRefs` — so these go through `import()` in dry-run, which runs the same
 * validation and stops before any write.
 */
describe('EmployeeImportService.import — catalog lookups', () => {
	/** Codes a dry run reports for a one-row file. */
	async function codesFor(seed: FixtureSeed, overrides: Row = {}): Promise<string[]> {
		const { service } = buildFixture(seed);
		const result = await service.import(ORG, ACTOR, await workbook([validRow(overrides)]), true);
		return result.errors.map((e) => e.code);
	}

	it('reports a manager code that is in no row and in no profile', async () => {
		expect(await codesFor({}, { directManagerCode: 'KHONG-CO' })).toContain('MANAGER_NOT_FOUND');
	});

	it('accepts a manager that is another row in the same file', async () => {
		// The lookup counts same-file codes as existing, because pass 3 links them
		// after everyone is created — rejecting the reference here would make the
		// feature unusable.
		const { service } = buildFixture();
		const result = await service.import(ORG, ACTOR, await workbook([
			validRow({ employeeCode: 'TVS-010', email: 'lead@tvs.vn' }),
			validRow({ employeeCode: 'TVS-011', email: 'dev@tvs.vn', directManagerCode: 'TVS-010' }),
		]), true);

		expect(result.errors).toEqual([]);
	});

	it('accepts a manager who is already an employee of the tenant', async () => {
		expect(await codesFor(
			{ profiles: [{ _id: 'pf0', organizationId: ORG, employeeCode: 'TVS-000', userId: 'u0' }] },
			{ directManagerCode: 'TVS-000' },
		)).toEqual([]);
	});

	it('reports DUPLICATE_IN_FILE for a repeated email, not just a repeated code', async () => {
		const { service } = buildFixture();
		const result = await service.import(ORG, ACTOR, await workbook([
			validRow({ employeeCode: 'TVS-030' }),
			validRow({ employeeCode: 'TVS-031' }),
		]), true);

		expect(result.errors.map((e) => e.code)).toContain('DUPLICATE_IN_FILE');
	});

	it('matches an existing email case-insensitively', async () => {
		// `emailN` is the folded key the unique index uses, so `AN@TVS.VN` must
		// collide with a stored `an@tvs.vn` — otherwise the import trips a raw 11000.
		expect(await codesFor(
			{ users: [{ _id: 'u2', organizationId: ORG, emailN: 'an@tvs.vn' }] },
			{ email: 'AN@TVS.VN' },
		)).toContain('EMAIL_TAKEN');
	});

	it('folds an existing employee code the same way login does', async () => {
		expect(await codesFor(
			{ profiles: [{ _id: 'x', organizationId: ORG, employeeCode: 'TVS-001', userId: 'u1' }] },
			{ employeeCode: 'tvs-001' },
		)).toContain('EMPLOYEE_CODE_TAKEN');
	});
});

/* ───────── Dependent-sheet rules ───────── */

describe('EmployeeImportService.parseWorkbook — dependent rules', () => {
	/** A single dependent line under the one valid employee row. */
	async function dependentErrors(dep: Row) {
		const { service } = buildFixture();
		const { rows, orphans } = await service.parseWorkbook(
			await workbook([validRow()], HEADERS, [dep]),
		);
		return { rowCodes: rows[0].errors.map((e) => e.code), orphans: orphans.map((e) => e.code) };
	}

	it('requires the employee code that links the dependent to a row', async () => {
		const { orphans } = await dependentErrors({
			fullName: 'Nguyễn Bé', dateOfBirth: '2020-05-01', relationship: 'CHILD',
		});
		expect(orphans).toContain('DEPENDENT_EMPLOYEE_CODE_REQUIRED');
	});

	it('requires a name, a birth date and a relationship', async () => {
		expect((await dependentErrors({ employeeCode: 'TVS-001', dateOfBirth: '2020-05-01', relationship: 'CHILD' })).rowCodes)
			.toContain('DEPENDENT_NAME_REQUIRED');
		expect((await dependentErrors({ employeeCode: 'TVS-001', fullName: 'Nguyễn Bé', relationship: 'CHILD' })).rowCodes)
			.toContain('DEPENDENT_DOB_INVALID');
		expect((await dependentErrors({ employeeCode: 'TVS-001', fullName: 'Nguyễn Bé', dateOfBirth: '2020-05-01' })).rowCodes)
			.toContain('DEPENDENT_RELATIONSHIP_REQUIRED');
	});

	it('rejects a dependent born in the future', async () => {
		const { rowCodes } = await dependentErrors({
			employeeCode: 'TVS-001', fullName: 'Bé Tương lai', dateOfBirth: '2099-01-01', relationship: 'CHILD',
		});
		expect(rowCodes).toContain('DEPENDENT_DOB_INVALID');
	});

	it('attributes a dependent error to the employee row it names', async () => {
		// A dependent with a resolvable code is the *employee's* problem — the row
		// number is the dependent sheet's, so HR is sent to the right line of the
		// right tab rather than to a clean employee row.
		const { rowCodes } = await dependentErrors({
			employeeCode: 'TVS-001', fullName: 'Nguyễn Bé', dateOfBirth: '2020-05-01',
		});
		expect(rowCodes).toEqual(['DEPENDENT_RELATIONSHIP_REQUIRED']);
	});

	it('rejects a dependent sheet that is missing a required column', async () => {
		const { service } = buildFixture();
		const wb = new ExcelJS.Workbook();
		const ws = wb.addWorksheet('NhanVien');
		ws.addRow(HEADERS);
		ws.addRow(HEADERS.map((h) => validRow()[h] ?? ''));
		// `Mối quan hệ` dropped: the sheet still looks like the dependent one, so it
		// must be reported, not silently skipped along with every row on it.
		const deps = wb.addWorksheet('NguoiPhuThuoc');
		deps.addRow(['employeeCode', 'fullName', 'dateOfBirth']);

		await expect(service.parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer())))
			.rejects.toThrow(/EMPLOYEE_IMPORT_MISSING_COLUMNS:NguoiPhuThuoc/);
	});
});

/* ───────── File-level guards ───────── */

describe('EmployeeImportService.parseWorkbook — file guards', () => {
	it('rejects an empty buffer before it tries to open a workbook', async () => {
		const { service } = buildFixture();
		await expect(service.parseWorkbook(Buffer.alloc(0))).rejects.toThrow('EMPLOYEE_IMPORT_FILE_REQUIRED');
	});

	it('rejects a file past the size ceiling', async () => {
		// Checked on the raw bytes, before `xlsx.load` — parsing a huge file is
		// exactly the cost the ceiling exists to avoid.
		const { service } = buildFixture();
		await expect(service.parseWorkbook(Buffer.alloc(MAX_IMPORT_BYTES + 1)))
			.rejects.toThrow('EMPLOYEE_IMPORT_FILE_TOO_LARGE');
	});

	it('names the missing required columns in the error', async () => {
		const { service } = buildFixture();
		await expect(service.parseWorkbook(await workbook([validRow()], ['employeeCode', 'fullName'])))
			.rejects.toThrow(/EMPLOYEE_IMPORT_MISSING_COLUMNS:NhanVien:.*Phòng ban/);
	});

	it('rejects a file past the row ceiling', async () => {
		const { service } = buildFixture();
		const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) =>
			validRow({ employeeCode: `TVS-${i}`, email: `e${i}@tvs.vn` }));

		await expect(service.parseWorkbook(await workbook(rows)))
			.rejects.toThrow('EMPLOYEE_IMPORT_TOO_MANY_ROWS');
	});
});

/* ───────── Import ───────── */

describe('EmployeeImportService.import', () => {
	it('creates every valid row, with salary and a mandatory insurance record', async () => {
		const { service, profiles, salaries, insurances } = buildFixture();
		const buffer = await workbook([validRow({ baseSalary: '20000000' })]);

		const result = await service.import(ORG, ACTOR, buffer);

		expect(result).toMatchObject({ total: 1, created: 1, failed: 0, dryRun: false });
		expect(result.errors).toEqual([]);
		expect(result.tempPasswords).toHaveLength(1);
		expect(profiles.rows).toHaveLength(1);
		// Lương đóng BHXH là số dẫn xuất: không phụ cấp → bằng đúng lương cơ bản.
		expect(salaries.rows[0]).toMatchObject({ baseSalary: 20000000, insuranceSalary: 20000000, version: 1 });
		// Written even though the row carried no insurance column at all: D40 makes
		// participation a legal obligation, not an opt-in.
		expect(insurances.rows).toHaveLength(1);
		expect(insurances.rows[0]).toMatchObject({
			participatesSocialInsurance: true,
			participatesHealthInsurance: true,
			participatesUnemploymentInsurance: true,
			createdBy: ACTOR,
		});
	});

	it('resolves departmentCode and positionCode to their ids', async () => {
		const { service, profiles } = buildFixture();
		await service.import(ORG, ACTOR, await workbook([validRow()]));
		expect(profiles.rows[0]).toMatchObject({ departmentId: 'd1', positionId: 'p1' });
	});

	it('writes the insurance effective dates the row carries, not the join date', async () => {
		const { service, insurances } = buildFixture();
		await service.import(ORG, ACTOR, await workbook([
			validRow({ insuranceEffectiveFrom: '2026-03-15', insuranceEffectiveTo: '2027-03-14' }),
		]));

		expect(insurances.rows[0].effectiveFrom).toEqual(new Date('2026-03-15'));
		expect(insurances.rows[0].effectiveTo).toEqual(new Date('2027-03-14'));
	});

	it('omits the insurance end date when the column is blank', async () => {
		const { service, insurances } = buildFixture();
		await service.import(ORG, ACTOR, await workbook([validRow()]));
		// Absent, not `undefined`-valued: the schema stores no `effectiveTo` key.
		expect('effectiveTo' in insurances.rows[0]).toBe(false);
	});

	it('creates an ACTIVE contract when the row carries a contract type', async () => {
		const { service, contracts } = buildFixture();
		await service.import(ORG, ACTOR, await workbook([
			validRow({ contractType: 'Có thời hạn', contractEffectiveDate: '2026-01-05', contractExpiryDate: '2027-01-04' }),
		]));

		expect(contracts.rows).toHaveLength(1);
		expect(contracts.rows[0]).toMatchObject({ contractType: 'FIXED_TERM', status: 'ACTIVE' });
		expect(contracts.rows[0].effectiveDate).toEqual(new Date('2026-01-05'));
		expect(contracts.rows[0].expiryDate).toEqual(new Date('2027-01-04'));
		// Stamped to the contract's own start so the screen does not report a status
		// change that never happened.
		expect(contracts.rows[0].statusChangedAt).toEqual(new Date('2026-01-05'));
	});

	it('creates no contract for a row that names no contract type', async () => {
		const { service, contracts } = buildFixture();
		const result = await service.import(ORG, ACTOR, await workbook([validRow()]));

		expect(result.created).toBe(1);
		expect(contracts.create).not.toHaveBeenCalled();
	});

	it('creates nothing at all when a contract date rule is broken', async () => {
		const { service, contracts, profiles } = buildFixture();
		const result = await service.import(ORG, ACTOR, await workbook([
			validRow({ employeeCode: 'TVS-020', email: 'a@tvs.vn' }),
			validRow({ employeeCode: 'TVS-021', email: 'b@tvs.vn', contractType: 'Không thời hạn', contractEffectiveDate: '2026-01-05', contractExpiryDate: '2027-01-04' }),
		]));

		expect(result).toMatchObject({ total: 2, created: 0, failed: 1 });
		expect(result.errors.map((e) => e.code)).toContain('CONTRACT_INDEFINITE_TERM_NO_EXPIRY');
		expect(contracts.create).not.toHaveBeenCalled();
		expect(profiles.create).not.toHaveBeenCalled();
	});

	it('refuses a position that belongs to a different department, and says so', async () => {
		// `DEV` exists, but under department `d1`; this row names department `d2`.
		// The dropdown offers every position flat, so this is the common mistake —
		// it must not be reported as "position does not exist", which would send HR
		// looking for a typo in a code that is right there in the list.
		const { service } = buildFixture({
			departments: [
				{ _id: 'd1', organizationId: ORG, code: 'IT', name: 'IT', active: true },
				{ _id: 'd2', organizationId: ORG, code: 'HR', name: 'HR', active: true },
			],
			positions: [{ _id: 'p1', organizationId: ORG, code: 'DEV', name: 'Dev', departmentId: 'd1', active: true }],
		});

		const result = await service.import(ORG, ACTOR, await workbook([validRow({ departmentCode: 'HR' })]));

		expect(result.created).toBe(0);
		expect(result.errors.map((e) => e.code)).toContain('POSITION_DEPARTMENT_MISMATCH');
	});

	it('still reports POSITION_NOT_FOUND for a code no department has', async () => {
		// The other half of the split: a genuine typo, not a mis-filed position.
		const { service } = buildFixture();

		const result = await service.import(ORG, ACTOR, await workbook([validRow({ positionCode: 'KHONG-CO' })]));

		expect(result.created).toBe(0);
		expect(result.errors.map((e) => e.code)).toContain('POSITION_NOT_FOUND');
	});

	it('attaches the attendance-bonus policy named in the row', async () => {
		const { service, salaries } = buildFixture({
			bonusPolicies: [{ _id: 'b1', organizationId: ORG, name: 'Thưởng chuyên cần 09/2026', active: true }],
		});
		const buffer = await workbook([validRow({
			baseSalary: '1000',
			attendanceBonusPolicyCode: 'Thưởng chuyên cần 09/2026',
		})]);

		const result = await service.import(ORG, ACTOR, buffer);

		expect(result.errors).toEqual([]);
		expect(salaries.rows[0].attendanceBonusPolicyId).toBe('b1');
	});

	it('reports ATTENDANCE_BONUS_POLICY_NOT_FOUND for an unknown policy name', async () => {
		const { service } = buildFixture({ bonusPolicies: [] });
		const buffer = await workbook([validRow({
			baseSalary: '1000',
			attendanceBonusPolicyCode: 'Không tồn tại',
		})]);

		const result = await service.import(ORG, ACTOR, buffer);

		expect(result.created).toBe(0);
		expect(result.errors.map((e) => e.code)).toContain('ATTENDANCE_BONUS_POLICY_NOT_FOUND');
	});

	it('assigns directManagerId when the manager is another row in the same file', async () => {
		const { service, profiles } = buildFixture();
		const buffer = await workbook([
			validRow({ employeeCode: 'TVS-010', email: 'lead@tvs.vn' }),
			validRow({ employeeCode: 'TVS-011', email: 'dev@tvs.vn', directManagerCode: 'TVS-010' }),
		]);

		const result = await service.import(ORG, ACTOR, buffer);

		expect(result.created).toBe(2);
		const dev = profiles.rows.find((r) => r.employeeCode === 'TVS-011');
		const lead = profiles.rows.find((r) => r.employeeCode === 'TVS-010');
		expect(dev?.directManagerId).toBe(lead?.userId);
	});

	it('reports DUPLICATE_IN_FILE for a repeated employeeCode and creates nothing', async () => {
		const { service, profiles } = buildFixture();
		const buffer = await workbook([validRow(), validRow({ email: 'other@tvs.vn' })]);

		const result = await service.import(ORG, ACTOR, buffer);

		expect(result.errors.map((e) => e.code)).toContain('DUPLICATE_IN_FILE');
		expect(result.created).toBe(0);
		expect(profiles.create).not.toHaveBeenCalled();
	});

	it('reports EMPLOYEE_CODE_TAKEN and EMAIL_TAKEN against existing records', async () => {
		const { service } = buildFixture({
			profiles: [{ _id: 'x', organizationId: ORG, employeeCode: 'TVS-001', userId: 'u1' }],
			users: [{ _id: 'u2', organizationId: ORG, emailN: 'an@tvs.vn' }],
		});

		const result = await service.import(ORG, ACTOR, await workbook([validRow()]));

		const codes = result.errors.map((e) => e.code);
		expect(codes).toContain('EMPLOYEE_CODE_TAKEN');
		expect(codes).toContain('EMAIL_TAKEN');
	});

	it('reports DEPARTMENT_NOT_FOUND for an unknown code', async () => {
		const { service } = buildFixture();
		const result = await service.import(ORG, ACTOR, await workbook([validRow({ departmentCode: 'NOPE' })]));
		expect(result.errors.map((e) => e.code)).toContain('DEPARTMENT_NOT_FOUND');
	});

	it('reports ALLOWANCE_NOT_FOUND for an allowance code this tenant does not have', async () => {
		const { service, salaries } = buildFixture();
		const headers = [...HEADERS, 'allowance_PHONE'];
		const buffer = await workbook([validRow({ baseSalary: '1000', allowance_PHONE: '500000' })], headers);

		const result = await service.import(ORG, ACTOR, buffer);

		expect(result.errors.map((e) => e.code)).toContain('ALLOWANCE_NOT_FOUND');
		expect(result.created).toBe(0);
		expect(salaries.create).not.toHaveBeenCalled();
	});

	it('writes dependents from the second sheet onto the employee profile', async () => {
		const { service, profiles } = buildFixture();
		const buffer = await workbook(
			[validRow()],
			HEADERS,
			[{ employeeCode: 'TVS-001', fullName: 'Nguyễn Bé', dateOfBirth: '2020-05-01', relationship: 'CHILD' }],
		);

		const result = await service.import(ORG, ACTOR, buffer);

		expect(result.created).toBe(1);
		// `isDisabled` has no column: the schema requires it, so the import writes
		// the same `false` the schema would default to rather than inventing one.
		expect(profiles.rows[0].dependents).toMatchObject([
			{ fullName: 'Nguyễn Bé', dateOfBirth: '2020-05-01', relationship: 'CHILD', isDisabled: false, active: true, status: 'ACTIVE', version: 1 },
		]);
	});

	it('writes nothing when a dependent row points at no employee', async () => {
		const { service, profiles } = buildFixture();
		const buffer = await workbook(
			[validRow()],
			HEADERS,
			[{ employeeCode: 'TVS-999', fullName: 'Nguyễn Bé', dateOfBirth: '2020-05-01', relationship: 'CHILD' }],
		);

		const result = await service.import(ORG, ACTOR, buffer);

		expect(result.errors.map((e) => e.code)).toContain('DEPENDENT_ORPHAN');
		expect(result.created).toBe(0);
		expect(profiles.create).not.toHaveBeenCalled();
	});

	it('writes nothing when a single row is invalid', async () => {
		const { service, profiles, users } = buildFixture();
		const buffer = await workbook([validRow(), validRow({ employeeCode: 'TVS-002', email: 'b@tvs.vn', departmentCode: 'NOPE' })]);

		const result = await service.import(ORG, ACTOR, buffer);

		expect(result.created).toBe(0);
		expect(result.failed).toBe(1);
		expect(profiles.create).not.toHaveBeenCalled();
		expect(users.create).not.toHaveBeenCalled();
	});

	it('keeps the valid rows out of the database when one row in the file is bad', async () => {
		// All-or-nothing: the two clean rows are not written either, so HR cannot
		// end up with a half-imported file and no record of which half landed.
		const { service, profiles } = buildFixture();
		const buffer = await workbook([
			validRow({ employeeCode: 'TVS-020', email: 'a@tvs.vn' }),
			validRow({ employeeCode: 'TVS-021', email: 'b@tvs.vn', departmentCode: 'NOPE' }),
			validRow({ employeeCode: 'TVS-022', email: 'c@tvs.vn' }),
		]);

		const result = await service.import(ORG, ACTOR, buffer);

		expect(result).toMatchObject({ total: 3, created: 0, failed: 1 });
		expect(result.errors).toHaveLength(1);
		expect(profiles.create).not.toHaveBeenCalled();
	});

	it('dry run validates and reports without writing anything', async () => {
		const { service, profiles, users } = buildFixture();
		const result = await service.import(ORG, ACTOR, await workbook([validRow()]), true);

		expect(result).toMatchObject({ total: 1, created: 0, dryRun: true });
		expect(result.tempPasswords).toEqual([]);
		expect(profiles.create).not.toHaveBeenCalled();
		expect(users.create).not.toHaveBeenCalled();
	});

	it('never puts a plaintext password in the persisted documents', async () => {
		const { service, users } = buildFixture();
		const result = await service.import(ORG, ACTOR, await workbook([validRow()]));

		const passwordHash = users.rows[0].passwordHash as string;
		expect(passwordHash.startsWith('hashed:')).toBe(true);
		// The hash is of the temp password, but the stored value is never the plaintext.
		expect(passwordHash).not.toBe(result.tempPasswords[0].tempPassword);
	});

	it('starts every imported employee on PROBATION', async () => {
		// Import is backfill for people already working, but the state machine in
		// `changeStatus` only accepts PROBATION as an entry state — writing ACTIVE
		// here would strand the row, because ACTIVE never transitions to PROBATION.
		const { service, profiles } = buildFixture();
		await service.import(ORG, ACTOR, await workbook([validRow()]));
		expect(profiles.rows[0].employmentStatus).toBe('PROBATION');
	});

	it('mints a login whose role is the one the row named', async () => {
		const { service, users } = buildFixture();
		await service.import(ORG, ACTOR, await workbook([validRow({ role: 'HR' })]));
		expect(users.rows[0]).toMatchObject({ role: 'HR', organizationId: ORG, mustChangePassword: true });
	});

	it('writes one temp password per created employee, in row order', async () => {
		const { service } = buildFixture();
		const result = await service.import(ORG, ACTOR, await workbook([
			validRow({ employeeCode: 'TVS-020', email: 'a@tvs.vn' }),
			validRow({ employeeCode: 'TVS-021', email: 'b@tvs.vn' }),
		]));

		expect(result.tempPasswords.map((p) => p.employeeCode)).toEqual(['TVS-020', 'TVS-021']);
		// Never the same password twice: a shared temp password is a shared account.
		expect(new Set(result.tempPasswords.map((p) => p.tempPassword)).size).toBe(2);
	});

	it('returns no temp passwords when the file is rejected', async () => {
		// Nothing was written, so handing back passwords would be a lie — and the
		// dialog would render a table of credentials for accounts that do not exist.
		const { service } = buildFixture();
		const result = await service.import(ORG, ACTOR, await workbook([
			validRow({ departmentCode: 'NOPE' }),
		]));

		expect(result.created).toBe(0);
		expect(result.tempPasswords).toEqual([]);
	});

	it('reports a dry run over a broken file the same way a real run would', async () => {
		const { service } = buildFixture();
		const result = await service.import(ORG, ACTOR, await workbook([
			validRow({ departmentCode: 'NOPE' }),
		]), true);

		expect(result).toMatchObject({ total: 1, created: 0, failed: 1, dryRun: true });
		expect(result.errors.map((e) => e.code)).toContain('DEPARTMENT_NOT_FOUND');
	});

	it('writes every dependent of one employee, not just the first', async () => {
		const { service, profiles } = buildFixture();
		const buffer = await workbook(
			[validRow()],
			HEADERS,
			[
				{ employeeCode: 'TVS-001', fullName: 'Nguyễn Bé', dateOfBirth: '2020-05-01', relationship: 'CHILD' },
				{ employeeCode: 'TVS-001', fullName: 'Nguyễn Tí', dateOfBirth: '2022-09-09', relationship: 'CHILD' },
				{ employeeCode: 'TVS-001', fullName: 'Trần Thị Mẹ', dateOfBirth: '1960-01-01', relationship: 'PARENT' },
			],
		);

		await service.import(ORG, ACTOR, buffer);
		expect(profiles.rows[0].dependents).toHaveLength(3);
	});

	it('falls back to the join date for salary and insurance effective dates', async () => {
		// Both columns are optional, and a row without them is still a complete
		// employee — the join date is the only date the file guarantees.
		const { service, salaries, insurances } = buildFixture();
		await service.import(ORG, ACTOR, await workbook([
			validRow({ joinDate: '2026-03-15', baseSalary: '1000' }),
		]));

		expect(salaries.rows[0].effectiveFrom).toEqual(new Date('2026-03-15'));
		expect(insurances.rows[0].effectiveFrom).toEqual(new Date('2026-03-15'));
	});

	it('does not create a salary record for a row with no salary at all', async () => {
		const { service, salaries } = buildFixture();
		const result = await service.import(ORG, ACTOR, await workbook([validRow()]));

		expect(result.created).toBe(1);
		expect(salaries.create).not.toHaveBeenCalled();
	});
});

/* ───────── Template ───────── */

describe('EmployeeImportService.buildTemplate', () => {
		function templateFixture() {
		return buildFixture({
			departments: [
				{ _id: 'd1', organizationId: ORG, code: 'IT', name: 'IT', active: true },
				{ _id: 'd2', organizationId: ORG, code: 'HR', name: 'HR', active: true },
			],
			positions: [
				{ _id: 'p1', organizationId: ORG, code: 'DEV', name: 'Dev', departmentId: 'd1', active: true },
				{ _id: 'p2', organizationId: ORG, code: 'HR-EXEC', name: 'Nhân sự', departmentId: 'd2', active: true },
			],
			allowances: [{ _id: 'a1', organizationId: ORG, code: 'PHONE', name: 'Điện thoại', active: true }],
			bonusPolicies: [{ _id: 'b1', organizationId: ORG, name: 'Thưởng chuyên cần 09/2026', active: true }],
			// One existing employee, so the manager dropdown has something to list
			// (its label needs the name, which lives on `User`).
			profiles: [{ _id: 'pf0', organizationId: ORG, employeeCode: 'TVS-000', userId: 'u0' }],
			users: [{ _id: 'u0', organizationId: ORG, fullName: 'Trần Quản Lý' }],
		});
	}

	/**
	 * The distinct list ranges a sheet validates against.
	 *
	 * exceljs implements `dataValidations` but does not declare it, and it expands
	 * a range `sqref` into one model entry *per cell* on load
	 * (`data-validations-xform.js`) — so a 1000-row validation appears 1000 times,
	 * all sharing one object. Keying by the formula string collapses that, and also
	 * the columns that legitimately point at the same list.
	 */
	function validationFormulae(sheet: ExcelJS.Worksheet): string[] {
		const model = (sheet as unknown as { dataValidations: { model: Record<string, { formulae?: string[] }> } })
			.dataValidations.model;
		return [...new Set(Object.values(model).map((dv) => dv.formulae?.[0]))] as string[];
	}

	it('emits a readable workbook whose headers the parser accepts', async () => {
		const { service } = templateFixture();
		const { buffer, filename } = await service.buildTemplate(ORG);
		expect(filename).toBe('mau-import-nhan-vien.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
		expect(wb.worksheets.map((w) => w.name)).toEqual(['NhanVien', 'NguoiPhuThuoc', 'DanhMuc', 'HuongDan']);

		// The template's own header rows must round-trip through the parser.
		const { rows, orphans } = await service.parseWorkbook(buffer);
		expect(rows).toEqual([]);
		expect(orphans).toEqual([]);
	});

	it('gives every fixed-list column a dropdown backed by the hidden catalog sheet', async () => {
		const { service } = templateFixture();
		const { buffer } = await service.buildTemplate(ORG);

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
		const employees = wb.getWorksheet('NhanVien')!;
		const dependents = wb.getWorksheet('NguoiPhuThuoc')!;
		const catalog = wb.getWorksheet('DanhMuc')!;

		expect(catalog.state).toBe('veryHidden');
		// The catalog holds the tenant's real values, not the code names.
		// `.slice(1)` drops the sparse hole at index 0 (`Column.values` is 1-based).
		expect(catalog.getColumn(1).values.slice(1)).toEqual([
			'VaiTro', 'EMPLOYEE — Nhân viên', 'DEPARTMENT_MANAGER — Quản lý phòng ban', 'HR — HR',
		]);

		// One list per fixed-list column, all of them flat: nothing here filters by
		// another column's value.
		const formulae = validationFormulae(employees);
		expect(formulae).toContain('DanhMuc!$A$2:$A$4'); // VaiTro — 3 roles
		expect(formulae).toContain('DanhMuc!$B$2:$B$4'); // GioiTinh — 3 genders
		expect(formulae).toContain('DanhMuc!$C$2:$C$3'); // PhongBan — 2 departments
		expect(formulae).toContain('DanhMuc!$D$2:$D$3'); // ChucDanh — flat, both departments
		expect(formulae).toContain('DanhMuc!$E$2:$E$2'); // QuanLy — the one seeded employee
		expect(formulae).toContain('DanhMuc!$G$2:$G$3'); // ThuongCC — sentinel + 1 policy
		expect(formulae).toContain('DanhMuc!$H$2:$H$4'); // LoaiHopDong — 3 fixed contract types

		// QuanHe is the dependent sheet's only list.
		expect(validationFormulae(dependents)).toEqual(['DanhMuc!$F$2:$F$5']);
	});

	it('formats every date column mm/dd/yyyy so Excel stores a real date', async () => {
		const { service } = templateFixture();
		const { buffer } = await service.buildTemplate(ORG);

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
		const employees = wb.getWorksheet('NhanVien')!;

		// Header text → 1-based column, the same way `buildTemplate` finds it.
		const numFmtOf = (header: string) => {
			let found = -1;
			employees.getRow(1).eachCell((cell, col) => {
				if (String(cell.value) === header) found = col;
			});
			return found < 1 ? undefined : employees.getColumn(found).numFmt;
		};

		for (const header of [
			'Ngày vào làm', 'Ngày sinh', 'Lương hiệu lực từ ngày',
			'Bảo hiểm hiệu lực từ ngày', 'Bảo hiểm hiệu lực đến ngày',
			'Ngày hiệu lực hợp đồng', 'Ngày hết hạn hợp đồng',
		]) {
			expect(numFmtOf(header)).toBe('mm/dd/yyyy');
		}
		// A non-date column must not be dragged along by the index arithmetic.
		expect(numFmtOf('Lương cơ bản')).not.toBe('mm/dd/yyyy');
		expect(wb.getWorksheet('NguoiPhuThuoc')!.getColumn(3).numFmt).toBe('mm/dd/yyyy');
	});

	it('offers every position in one flat list, with no Excel-side cascade', async () => {
		const { service } = templateFixture();
		const { buffer } = await service.buildTemplate(ORG);

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
		const employees = wb.getWorksheet('NhanVien')!;
		const catalog = wb.getWorksheet('DanhMuc')!;

		// Column D is the flat ChucDanh list: every position, from every department.
		// `.slice(1)` drops the sparse hole at index 0 (`Column.values` is 1-based).
		expect(catalog.getColumn(4).values.slice(1)).toEqual(['ChucDanh', 'DEV — Dev', 'HR-EXEC — Nhân sự']);

		// No `INDIRECT` and no per-department defined names: the department cell must
		// not narrow this list. A cascading list goes empty or stale the moment HR
		// edits the department cell by hand, hiding real positions from the dropdown;
		// the server is what rejects a wrong-department pick instead.
		const definedNames = (wb.definedNames as unknown as { matrixMap: Record<string, unknown> }).matrixMap;
		expect(Object.keys(definedNames)).toEqual([]);
		expect(validationFormulae(employees).some((f) => f.includes('INDIRECT'))).toBe(false);
	});

	it('lists which positions belong to which department on the guide sheet', async () => {
		// The dropdown is flat, so this table is the only place HR can see the
		// pairing that the server enforces.
		const { service } = templateFixture();
		const { buffer } = await service.buildTemplate(ORG);

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
		const guide = wb.getWorksheet('HuongDan')!;

		const firstColumn = guide.getColumn(1).values.slice(1) as string[];
		expect(firstColumn).toContain('Chức danh theo phòng ban');

		const at = firstColumn.indexOf('IT — IT');
		expect(at).toBeGreaterThan(-1);
		expect(guide.getRow(at + 1).getCell(2).value).toBe('DEV');
		const hrAt = firstColumn.indexOf('HR — HR');
		expect(guide.getRow(hrAt + 1).getCell(2).value).toBe('HR-EXEC');
	});

	it('skips a dropdown whose list the tenant has no rows for', async () => {
		// No departments/positions yet: a validation pointing at an empty range
		// would be malformed, so those columns stay free text.
		const { service } = buildFixture({ departments: [], positions: [], profiles: [], users: [] });
		const { buffer } = await service.buildTemplate(ORG);

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

		// Role, gender, the bonus-policy list (sentinel only) and the contract-type
		// list (fixed, tenant-independent) survive — department, position and
		// manager do not.
		expect(validationFormulae(wb.getWorksheet('NhanVien')!)).toHaveLength(4);
		expect(validationFormulae(wb.getWorksheet('NguoiPhuThuoc')!)).toHaveLength(1);
	});
});
