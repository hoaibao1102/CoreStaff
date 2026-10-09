import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, HydratedDocument, Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import { DepartmentDocument } from '../../../database/schemas/department.schema';
import { PositionDocument } from '../../../database/schemas/position.schema';
import { UserDocument } from '../../../database/schemas/user.schema';
import { EmployeeProfileDocument } from '../../../database/schemas/employee-profile.schema';
import { AttendanceBonusPolicy, OrganizationAllowance, SalaryProfileDocument } from '../../../database/schemas/compensation.schema';
import { InsuranceProfileDocument } from '../../../database/schemas/insurance-profile.schema';
import { EmploymentContractDocument } from '../../../database/schemas/employment-contract.schema';
import {
	ContractStatus,
	ContractType,
	EmploymentStatus,
	EmploymentType,
	Gender,
	Role,
	normalizeCode,
	normalizeEmail,
	normalizeEmployeeCode,
} from '../../../database/schemas/enums';
import { provisionAccount, type AccountInput } from '../../../database/seed/provision';
import { hashPassword } from '../../../auth/strategies/bcrypt.strategy';
import { generateTempPassword } from '../../../auth/strategies/password-policy';

/** Ceilings that keep one request inside a serverless function's budget. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1000;
/** Dependents are their own sheet, so their ceiling is independent of the employee one. */
export const MAX_DEPENDENT_ROWS = MAX_IMPORT_ROWS * 3;

/**
 * Roles an import may mint. `SYSTEM_ADMIN` is deliberately absent and is checked
 * in the service, not only in the sheet: otherwise HR could escalate itself to
 * platform admin by editing a cell (SRS §16.6 — HR mints nobody above itself).
 */
const IMPORTABLE_ROLES: string[] = [Role.EMPLOYEE, Role.DEPARTMENT_MANAGER, Role.HR];

export interface ImportRowError {
	row: number;
	employeeCode: string | null;
	code: string;
	message: string;
}

export interface ImportResult {
	total: number;
	created: number;
	failed: number;
	dryRun: boolean;
	errors: ImportRowError[];
	tempPasswords: { employeeCode: string; email: string; tempPassword: string }[];
}

interface ParsedDependent {
	fullName: string;
	dateOfBirth: string;
	relationship: string;
	idCardNumber?: string;
}

/**
 * Catalog `code` → `_id`, resolved once per file. `createOne` runs inside a
 * transaction, so re-querying per row would hold that transaction open across
 * thousands of round-trips on a serverless function.
 */
interface Refs {
	departments: Map<string, unknown>;
	/** Keyed by `positionKey(departmentId, code)` — a position code is only unique inside its department. */
	positions: Map<string, unknown>;
	allowances: Map<string, unknown>;
	bonusPolicies: Map<string, unknown>;
}

/**
 * Sheet 1 parsed, plus the dependent rows sheet 2 could not attach to anyone.
 * Orphans are file-level complaints rather than row errors, because there is no
 * employee row to hang them on — but they still block `abort`.
 */
export interface ParsedWorkbook {
	rows: ParsedRow[];
	orphans: ImportRowError[];
}

interface ParsedRow {
	rowNumber: number;
	employeeCode: string;
	fullName: string;
	email: string;
	role: string;
	phone?: string;
	joinDate?: string;
	dateOfBirth?: string;
	gender?: string;
	citizenId?: string;
	taxCode?: string;
	socialInsuranceCode?: string;
	bankAccount?: string;
	address?: string;
	departmentCode?: string;
	positionCode?: string;
	directManagerCode?: string;
	dependents: ParsedDependent[];
	baseSalary?: number;
	salaryEffectiveFrom?: string;
	allowances: { code: string; amount: number }[];
	/** `AttendanceBonusPolicy` code, resolved to its `_id` when the column is filled. */
	bonusPolicyCode?: string;
	insuranceEffectiveFrom?: string;
	insuranceEffectiveTo?: string;
	contractType?: string;
	contractEffectiveDate?: string;
	contractExpiryDate?: string;
	errors: ImportRowError[];
}

/**
 * Canonical column names. Matching is case-insensitive and trims.
 *
 * `employmentType` is deliberately absent: `FULL_TIME` is the only value the
 * schema accepts (`enums.ts`), so a column would be a one-option choice that HR
 * can only get wrong. `createOne` lets the schema default apply instead.
 *
 * The three `participates*` flags and `insuranceNote` are gone for the same
 * reason, one step stronger: BHXH/BHYT/BHTN are a legal obligation (D40), not an
 * HR choice, so a column offering "Không" would be a choice nobody may make.
 * `createOne` writes the schema's `true` default.
 */
const COLUMNS = [
	'employeeCode', 'fullName', 'email', 'role', 'phone',
	'joinDate', 'dateOfBirth', 'gender', 'citizenId', 'taxCode',
	'socialInsuranceCode', 'bankAccount', 'address',
	'departmentCode', 'positionCode', 'directManagerCode',
	'baseSalary', 'salaryEffectiveFrom',
	'attendanceBonusPolicyCode', 'insuranceEffectiveFrom', 'insuranceEffectiveTo',
	'contractType', 'contractEffectiveDate', 'contractExpiryDate',
] as const;

/**
 * Columns Excel should treat as dates, so the cell shows `mm/dd/yyyy` and a
 * typed `1/5/2026` is stored as a serial rather than a string. Without this the
 * cell is free text and `toIsoDate` has to guess the day/month order.
 */
const DATE_COLUMNS = [
	'joinDate', 'dateOfBirth', 'salaryEffectiveFrom',
	'insuranceEffectiveFrom', 'insuranceEffectiveTo',
	'contractEffectiveDate', 'contractExpiryDate',
] as const;

/** What the `Loại hợp đồng` dropdown offers, and the guide lists. */
const CONTRACT_TYPE_OPTIONS: [code: string, label: string][] = [
	[ContractType.PROBATION, 'Thử việc'],
	[ContractType.FIXED_TERM, 'Có thời hạn'],
	[ContractType.INDEFINITE_TERM, 'Không thời hạn'],
];
const CONTRACT_TYPES = CONTRACT_TYPE_OPTIONS.map(([code]) => code);

const REQUIRED_COLUMNS = ['employeeCode', 'fullName', 'email', 'joinDate', 'departmentCode', 'positionCode'];

const DEPENDENT_COLUMNS = ['employeeCode', 'fullName', 'dateOfBirth', 'relationship', 'idCardNumber'] as const;
const REQUIRED_DEPENDENT_COLUMNS = ['employeeCode', 'fullName', 'dateOfBirth', 'relationship'];

/**
 * The header HR actually reads. Code names (`directManagerCode`, `employeeCode`)
 * are meaningless to an HR user, so the template writes these instead — and the
 * parser still accepts the code names, because a file saved from an older
 * template must not break.
 *
 * Labels follow the web UI's own wording (`EmployeeCreateDialog`,
 * `SalaryProfileDialogs`, `EmployeeDetailDialog`) so the file and the screen
 * name the same field the same way.
 */
const HEADER_LABELS: Record<string, string> = {
	employeeCode: 'Mã nhân viên',
	fullName: 'Họ và tên',
	email: 'Email',
	role: 'Vai trò',
	phone: 'Số điện thoại',
	joinDate: 'Ngày vào làm',
	dateOfBirth: 'Ngày sinh',
	gender: 'Giới tính',
	citizenId: 'Số CCCD',
	taxCode: 'Mã số thuế',
	socialInsuranceCode: 'Số BHXH',
	bankAccount: 'Số tài khoản ngân hàng',
	address: 'Địa chỉ',
	departmentCode: 'Phòng ban',
	positionCode: 'Chức danh',
	directManagerCode: 'Quản lý trực tiếp',
	baseSalary: 'Lương cơ bản',
	salaryEffectiveFrom: 'Lương hiệu lực từ ngày',
	attendanceBonusPolicyCode: 'Chính sách thưởng chuyên cần',
	insuranceEffectiveFrom: 'Bảo hiểm hiệu lực từ ngày',
	insuranceEffectiveTo: 'Bảo hiểm hiệu lực đến ngày',
	contractType: 'Loại hợp đồng',
	contractEffectiveDate: 'Ngày hiệu lực hợp đồng',
	contractExpiryDate: 'Ngày hết hạn hợp đồng',
};

/** Sheet 2 shares no column with sheet 1, so it gets its own labels. */
const DEPENDENT_HEADER_LABELS: Record<string, string> = {
	employeeCode: 'Mã nhân viên',
	fullName: 'Họ và tên người phụ thuộc',
	dateOfBirth: 'Ngày sinh',
	relationship: 'Mối quan hệ với nhân viên',
	idCardNumber: 'Số CCCD',
};

/** Sheet names — the template writes them, the parser finds them by name. */
export const EMPLOYEE_SHEET = 'NhanVien';
export const DEPENDENT_SHEET = 'NguoiPhuThuoc';

/**
 * `Phụ cấp PHONE (Điện thoại)` / `allowance_PHONE` / `allowance-PHONE` → `PHONE`.
 * The Vietnamese prefix is what the template writes; the code one stays accepted.
 */
const ALLOWANCE_HEADER = /^(?:phụ\s*cấp|phu\s*cap|allowance)[\s_-]+(.+)$/i;

/**
 * The template writes `Phụ cấp PHONE (Điện thoại)` so HR can see what the column
 * means, but the lookup is keyed by code alone — the trailing name is a label,
 * not part of the key, so it is dropped before folding.
 */
function allowanceCodeFromHeader(header: string): string | undefined {
	const match = ALLOWANCE_HEADER.exec(header.trim());
	if (!match) return undefined;
	const code = normalizeCode(match[1].replace(/\s*\(.*\)\s*$/, ''));
	return code || undefined;
}

/**
 * Header text → internal key, folded so diacritics, case and stray spacing don't
 * matter: `Mã nhân viên`, `ma nhan vien` and `MÃ  NHÂN  VIÊN` are one column.
 *
 * `\p{Mn}` rather than a `̀-ͯ` range: Vietnamese horn marks (U+031B,
 * as in `Vợ`/`Lương`) sit above that range and would survive the strip, leaving
 * `vợ` ≠ `vo` and silently breaking every Vietnamese alias lookup.
 */
function normalizeHeader(header: string): string {
	return header
		.normalize('NFD')
		.replace(/\p{Mn}/gu, '')
		.replace(/đ/g, 'd')
		.replace(/Đ/g, 'D')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

/** Both spellings of every column, folded → internal key. */
function buildHeaderIndex(columns: readonly string[], labels: Record<string, string>): Map<string, string> {
	const index = new Map<string, string>();
	for (const key of columns) {
		index.set(normalizeHeader(key), key);
		const label = labels[key];
		if (label) index.set(normalizeHeader(label), key);
	}
	return index;
}

const EMPLOYEE_HEADERS = buildHeaderIndex(COLUMNS, HEADER_LABELS);
const DEPENDENT_HEADERS = buildHeaderIndex(DEPENDENT_COLUMNS, DEPENDENT_HEADER_LABELS);

/**
 * Enum cells → stored value, accepting the code itself and the Vietnamese name.
 * These are exactly the options the template's dropdowns offer, so anything HR
 * can pick from the file parses back — and a typed-out code still works.
 */
const ROLE_ALIASES: Record<string, string> = {
	'nhan vien': Role.EMPLOYEE,
	'quan ly phong ban': Role.DEPARTMENT_MANAGER,
	hr: Role.HR,
};

const GENDER_ALIASES: Record<string, string> = {
	nam: Gender.MALE,
	'nu': Gender.FEMALE,
	khac: Gender.OTHER,
};

const RELATIONSHIP_ALIASES: Record<string, string> = {
	con: 'CHILD',
	'vo/chong': 'SPOUSE',
	'bo/me': 'PARENT',
	'anh/chi/em ruot': 'SIBLING',
};

const CONTRACT_TYPE_ALIASES: Record<string, string> = {
	'thu viec': ContractType.PROBATION,
	'co thoi han': ContractType.FIXED_TERM,
	'khong thoi han': ContractType.INDEFINITE_TERM,
};

/**
 * `DependentItem.relationship` codes with the name HR picks — one source for the
 * dropdown, the guide sheet and the accepted-value list, so they cannot drift.
 * Order is the dropdown order. Mirrors `create-dependent.dto.ts`.
 */
const RELATIONSHIP_OPTIONS: [code: string, label: string][] = [
	['CHILD', 'Con'],
	['SPOUSE', 'Vợ/Chồng'],
	['PARENT', 'Bố/Mẹ'],
	['SIBLING', 'Anh/Chị/Em ruột'],
];
const DEPENDENT_RELATIONSHIPS = RELATIONSHIP_OPTIONS.map(([code]) => code);

/**
 * The `Chính sách thưởng chuyên cần` cell that means "none". `AttendanceBonusPolicy`
 * has no `code` (unlike department/position/allowance), so its dropdown lists the
 * policy *names* — this sentinel is the one non-name value in that list.
 */
const NO_BONUS_POLICY = 'Không áp dụng';

/**
 * Enum cell → stored value. Accepts three spellings of the same thing: the bare
 * enum code (`DEPARTMENT_MANAGER`), the Vietnamese name (`Quản lý phòng ban`),
 * and the `"CODE — nhãn"` form the template's dropdown writes.
 */
function resolveAlias(value: string, aliases: Record<string, string>, codes: readonly string[]): string | undefined {
	if (!value) return undefined;
	const folded = normalizeHeader(value);
	if (aliases[folded]) return aliases[folded];
	// Dropdown cells look like `EMPLOYEE — Nhân viên`; the code before the dash wins.
	const code = normalizeHeader(value.split('—')[0]).toUpperCase();
	return codes.find((c) => c === code);
}

const columnKey = (header: string) => header.trim().toLowerCase();

/**
 * A catalog cell → its `code`. The dropdown writes `"IT — Phòng IT"`, so the
 * part before the dash is the code; a cell HR typed by hand is taken whole.
 * `normalizeCode` folds case, matching how the catalog lookups are keyed.
 */
function codeFromCell(value: string): string | undefined {
	if (!value) return undefined;
	const code = normalizeCode(value.split('—')[0]);
	return code || undefined;
}

/**
 * `"IT — Phòng IT"` — the same shape the web UI's selects use
 * (`EmployeeCreateDialog.departmentOptions`), so HR sees one spelling in both.
 */
function catalogLabel(code: string, name?: string): string {
	return name ? `${code} — ${name}` : code;
}

/**
 * exceljs implements `Worksheet.dataValidations` but does not declare it, so the
 * one place that needs it says so here rather than casting at each call site.
 */
function addDropdown(sheet: ExcelJS.Worksheet, range: string, validation: ExcelJS.DataValidation): void {
	(sheet as unknown as {
		dataValidations: { add(address: string, validation: ExcelJS.DataValidation): void };
	}).dataValidations.add(range, validation);
}

/** Column key → the name HR sees in the error, e.g. `fullName` → `Họ và tên`. */
const columnLabel = (key: string, labels: Record<string, string>) => labels[key] ?? key;

/**
 * The values a `Vai trò` / `Giới tính` dropdown offers, as `"CODE — nhãn"`. The
 * code leads so the cell is unambiguous, and because HR may only pick a listed
 * value the parser can read it straight back: the alias lookup is tried on the
 * whole cell, then on the part before the dash.
 */
const CHOICE = (code: string, label: string) => `${code} — ${label}`;
const ROLE_CHOICES = [CHOICE(Role.EMPLOYEE, 'Nhân viên'), CHOICE(Role.DEPARTMENT_MANAGER, 'Quản lý phòng ban'), CHOICE(Role.HR, 'HR')];
const GENDER_CHOICES = [CHOICE(Gender.MALE, 'Nam'), CHOICE(Gender.FEMALE, 'Nữ'), CHOICE(Gender.OTHER, 'Khác')];

/** Vietnam wall-clock "today" — a join date one day ahead is still in the future here. */
function todayVN(): string {
	const now = new Date();
	return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Excel serial day number → `YYYY-MM-DD` (epoch 1899-12-30, Excel's own off-by-one). */
function serialToIso(serial: number): string | undefined {
	if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return undefined;
	const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000;
	return new Date(ms).toISOString().slice(0, 10);
}

const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
/**
 * Month first, matching the template's `mm/dd/yyyy` cell format. A first number
 * above 12 cannot be a month, so `15/03/2026` is read day-first instead — that
 * cell has only one possible meaning, and rejecting it would fail a file whose
 * intent was never in doubt.
 */
const MDY_DATE = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/;

/**
 * One cell → `YYYY-MM-DD`. Excel hands back a `Date` for a date-formatted cell,
 * a number for an unformatted one, and a string for text — all three are real
 * files HR will produce, so all three are accepted (see the plan's risk table).
 */
function toIsoDate(value: ExcelJS.CellValue): string | undefined {
	if (value === null || value === undefined || value === '') return undefined;
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return undefined;
		// ExcelJS rebuilds a date cell from the serial as UTC midnight
		// (`utils.excelToDate`), so the UTC calendar day IS the cell's day —
		// shifting by the local offset here would move it a day west of UTC.
		return value.toISOString().slice(0, 10);
	}
	if (typeof value === 'number') return serialToIso(value);
	const text = String(value).trim();
	if (!text) return undefined;
	const iso = ISO_DATE.exec(text);
	if (iso) {
		const [, y, m, d] = iso;
		return isoDay(y, Number(m), Number(d));
	}
	const mdy = MDY_DATE.exec(text);
	if (mdy) {
		const [, first, second, y] = mdy;
		const a = Number(first);
		const b = Number(second);
		// A first number above 12 is a day, not a month — the only reading left.
		return a > 12 ? isoDay(y, b, a) : isoDay(y, a, b);
	}
	if (/^\d+(\.\d+)?$/.test(text)) return serialToIso(Number(text));
	return undefined;
}

/**
 * Range-checked `YYYY-MM-DD`. Without the month check `15/03/2026` would come out
 * as `2026-15-03`, and `new Date()` of that is an Invalid Date that would reach
 * the database as a NaN timestamp rather than a row error.
 */
function isoDay(year: string, month: number, day: number): string | undefined {
	if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Plain text for any cell shape ExcelJS can return (rich text, formula, hyperlink). */
function cellText(value: ExcelJS.CellValue): string {
	if (value === null || value === undefined) return '';
	if (value instanceof Date) return toIsoDate(value) ?? '';
	if (typeof value === 'object') {
		const cell = value as {
			richText?: { text: string }[];
			text?: string;
			result?: unknown;
			formula?: string;
			hyperlink?: string;
		};
		if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text).join('').trim();
		if (cell.text !== undefined) return String(cell.text).trim();
		if (cell.result !== undefined) return cellText(cell.result as ExcelJS.CellValue);
		return '';
	}
	return String(value).trim();
}

/** `1.000.000` / `1,000,000` / `1000000` → 1000000. Salaries are whole VND. */
function toAmount(value: ExcelJS.CellValue): number | undefined {
	if (value === null || value === undefined || value === '') return undefined;
	if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
	const text = String(value).trim();
	// Keep the sign: stripping non-digits alone would turn "-500000" into a
	// positive 500000 and silently defeat the caller's `< 0` guard.
	const negative = text.startsWith('-');
	const digits = text.replace(/[^\d]/g, '');
	if (!digits) return undefined;
	const amount = Number(digits);
	return negative ? -amount : amount;
}

/**
 * Key for `Refs.positions`. A position code is unique only inside its department
 * (`position.schema.ts`), so the department — its id, which is what the catalog
 * lookup yields — is half the key.
 */
const positionKey = (departmentId: unknown, positionCode: string) => `${String(departmentId)}::${positionCode}`;

@Injectable()
export class EmployeeImportService {
	constructor(
		@InjectModel('EmployeeProfile') private readonly profileModel: Model<EmployeeProfileDocument>,
		@InjectModel('User') private readonly userModel: Model<UserDocument>,
		@InjectModel('Department') private readonly departmentModel: Model<DepartmentDocument>,
		@InjectModel('Position') private readonly positionModel: Model<PositionDocument>,
		@InjectModel('SalaryProfile') private readonly salaryModel: Model<SalaryProfileDocument>,
		@InjectModel('InsuranceProfile') private readonly insuranceModel: Model<InsuranceProfileDocument>,
		@InjectModel('EmploymentContract') private readonly contractModel: Model<EmploymentContractDocument>,
		@InjectModel('OrganizationAllowance') private readonly allowanceModel: Model<HydratedDocument<OrganizationAllowance>>,
		@InjectModel('AttendanceBonusPolicy') private readonly bonusPolicyModel: Model<HydratedDocument<AttendanceBonusPolicy>>,
		@InjectConnection() private readonly connection: Connection,
	) {}

	/** ── Parse ──────────────────────────────────────────────────────────── */

	/**
	 * Two sheets → one `ParsedRow` per employee, each carrying the field errors
	 * found so far, and each dependent row attached to its employee by
	 * `employeeCode`. File-level problems (no sheet, missing required column, too
	 * many rows) throw — they are not row errors, and a report of 400 identical
	 * rows helps nobody.
	 *
	 * Dependents live on their own sheet rather than in numbered columns: one row
	 * per dependent survives HR sorting or filtering the employee sheet, which
	 * would silently move a numbered column to the wrong person.
	 */
	async parseWorkbook(buffer: Buffer): Promise<ParsedWorkbook> {
		if (!buffer?.length) throw new BadRequestException('EMPLOYEE_IMPORT_FILE_REQUIRED');
		if (buffer.length > MAX_IMPORT_BYTES) throw new BadRequestException('EMPLOYEE_IMPORT_FILE_TOO_LARGE');

		const workbook = new ExcelJS.Workbook();
		try {
			await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
		} catch {
			throw new BadRequestException('EMPLOYEE_IMPORT_FILE_INVALID');
		}
		// First sheet = employees. The dependent sheet is matched by name, then by
		// its header row — HR deleting it (nobody has dependents) must not fall
		// through to the guide sheet, and renaming it must not silently drop
		// every dependent in the file.
		const sheet = workbook.getWorksheet(EMPLOYEE_SHEET) ?? workbook.worksheets[0];
		if (!sheet) throw new BadRequestException('EMPLOYEE_IMPORT_FILE_INVALID');
		const dependentSheet = this.findDependentSheet(workbook, sheet);

		const headerRow = sheet.getRow(1);
		/** canonical column name (lowercased) → column index */
		const index = new Map<string, number>();
		/** allowance code (normalized) → column index */
		const allowanceColumns = new Map<string, number>();

		headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
			const header = cellText(cell.value);
			if (!header) return;
			const canonical = EMPLOYEE_HEADERS.get(normalizeHeader(header));
			if (canonical) {
				index.set(columnKey(canonical), colNumber);
				return;
			}
			const allowanceCode = allowanceCodeFromHeader(header);
			if (allowanceCode) allowanceColumns.set(allowanceCode, colNumber);
		});

		const missing = REQUIRED_COLUMNS.filter((name) => !index.has(columnKey(name)));
		if (missing.length) {
			throw new BadRequestException(
				`EMPLOYEE_IMPORT_MISSING_COLUMNS:${EMPLOYEE_SHEET}:${missing.map((n) => columnLabel(n, HEADER_LABELS)).join(', ')}`,
			);
		}

		const read = (row: ExcelJS.Row, name: string) => {
			const col = index.get(columnKey(name));
			return col ? row.getCell(col).value : undefined;
		};
		const readText = (row: ExcelJS.Row, name: string) => cellText(read(row, name));
		const readIso = (row: ExcelJS.Row, name: string) => toIsoDate(read(row, name));

		const rows: ParsedRow[] = [];
		const today = todayVN();

		for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
			const row = sheet.getRow(rowNumber);
			const employeeCode = normalizeEmployeeCode(readText(row, 'employeeCode'));
			const fullName = readText(row, 'fullName');
			const email = readText(row, 'email');
			// A row where every mapped cell is blank is a stray line, not an error.
			if (!employeeCode && !fullName && !email) continue;

			if (rows.length >= MAX_IMPORT_ROWS) throw new BadRequestException('EMPLOYEE_IMPORT_TOO_MANY_ROWS');

			// An empty cell means the default role, so the fallback chain is
			// alias → raw enum → EMPLOYEE; the parens are load-bearing (`??`
			// and `||` may not be mixed without them).
			const roleCell = readText(row, 'role');
			const parsed: ParsedRow = {
				rowNumber,
				employeeCode,
				fullName,
				email,
				role: resolveAlias(roleCell, ROLE_ALIASES, IMPORTABLE_ROLES) ?? (roleCell.toUpperCase() || Role.EMPLOYEE),
				dependents: [],
				allowances: [],
				errors: [],
			};
			const fail = (code: string, message: string) =>
				parsed.errors.push({ row: rowNumber, employeeCode: employeeCode || null, code, message });

			// ── Group 1: account ──
			if (!employeeCode) fail('EMPLOYEE_CODE_REQUIRED', 'Thiếu mã nhân viên.');
			if (!fullName) fail('FULLNAME_REQUIRED', 'Thiếu họ và tên.');
			if (!email) fail('EMAIL_REQUIRED', 'Thiếu email — cần để tạo tài khoản đăng nhập.');
			else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('EMAIL_INVALID', `Email "${email}" không hợp lệ.`);
			if (!IMPORTABLE_ROLES.includes(parsed.role)) {
				fail('ROLE_NOT_ALLOWED', `Vai trò "${parsed.role}" không được phép import. Chỉ nhận Nhân viên, Quản lý phòng ban hoặc HR.`);
			}
			parsed.phone = readText(row, 'phone') || undefined;
			if (parsed.phone && !/^\d{10}$/.test(parsed.phone)) fail('PHONE_INVALID', 'Số điện thoại phải gồm đúng 10 chữ số.');

			// ── Group 2: HR record ──
			parsed.joinDate = readIso(row, 'joinDate');
			if (!parsed.joinDate) fail('JOIN_DATE_REQUIRED', 'Ngày vào làm không hợp lệ hoặc bị thiếu (MM/DD/YYYY).');
			else if (parsed.joinDate > today) fail('JOIN_DATE_FUTURE', 'Ngày vào làm không được ở tương lai.');

			parsed.dateOfBirth = readIso(row, 'dateOfBirth');
			if (parsed.dateOfBirth && parsed.dateOfBirth > today) fail('DOB_FUTURE_DATE', 'Ngày sinh không được ở tương lai.');

			const genderCell = readText(row, 'gender');
			const gender = resolveAlias(genderCell, GENDER_ALIASES, Object.values(Gender))
				?? genderCell.toUpperCase();
			if (gender) {
				if ((Object.values(Gender) as string[]).includes(gender)) parsed.gender = gender;
				else fail('GENDER_INVALID', `Giới tính "${gender}" không hợp lệ (Nam/Nữ/Khác).`);
			}
			// `employmentType` has no column: FULL_TIME is the only value the schema
			// accepts, so `provisionAccount` lets the schema default stand.

			const withPattern = (
				field: 'citizenId' | 'taxCode' | 'socialInsuranceCode' | 'bankAccount',
				pattern: RegExp,
				code: string,
				message: string,
			) => {
				const value = readText(row, field);
				if (!value) return;
				if (pattern.test(value)) parsed[field] = value;
				else fail(code, message);
			};
			withPattern('citizenId', /^\d{9,12}$/, 'CITIZEN_ID_INVALID', 'CCCD/CMND phải gồm 9–12 chữ số.');
			withPattern('taxCode', /^\d{10,12}$/, 'TAX_CODE_INVALID', 'Mã số thuế phải gồm 10–12 chữ số.');
			withPattern('socialInsuranceCode', /^\d{1,12}$/, 'SOCIAL_INSURANCE_CODE_INVALID', 'Mã số BHXH phải gồm 1–12 chữ số.');
			withPattern('bankAccount', /^\d{6,17}$/, 'BANK_ACCOUNT_INVALID', 'Số tài khoản phải gồm 6–17 chữ số.');
			parsed.address = readText(row, 'address') || undefined;
			if (parsed.address && parsed.address.length > 256) fail('ADDRESS_TOO_LONG', 'Địa chỉ tối đa 256 ký tự.');

			parsed.departmentCode = codeFromCell(readText(row, 'departmentCode'));
			if (!parsed.departmentCode) fail('DEPARTMENT_REQUIRED', 'Thiếu phòng ban.');
			parsed.positionCode = codeFromCell(readText(row, 'positionCode'));
			if (!parsed.positionCode) fail('POSITION_REQUIRED', 'Thiếu chức danh.');
			parsed.directManagerCode = codeFromCell(readText(row, 'directManagerCode'));

			// ── Group 3: salary ──
			parsed.baseSalary = toAmount(read(row, 'baseSalary'));
			parsed.salaryEffectiveFrom = readIso(row, 'salaryEffectiveFrom');
			if (parsed.baseSalary !== undefined) {
				if (parsed.baseSalary < 0) fail('BASE_SALARY_INVALID', 'Lương cơ bản không hợp lệ.');
			} else {
				parsed.baseSalary = undefined;
			}
			for (const [code, col] of allowanceColumns) {
				const amount = toAmount(row.getCell(col).value);
				if (amount === undefined) continue;
				if (amount < 0) {
					fail('ALLOWANCE_AMOUNT_INVALID', `Phụ cấp ${code}: số tiền không hợp lệ.`);
					continue;
				}
				parsed.allowances.push({ code, amount });
			}

			// ── Group 4: attendance-bonus policy (optional) ──
			// The cell holds the policy name, because `AttendanceBonusPolicy` has no
			// code; the sentinel means "no policy" and is not a name to look up.
			const bonusCell = readText(row, 'attendanceBonusPolicyCode');
			if (bonusCell && normalizeHeader(bonusCell) !== normalizeHeader(NO_BONUS_POLICY)) {
				parsed.bonusPolicyCode = bonusCell;
			}

			// ── Group 5: insurance ──
			// No participation columns: BHXH/BHYT/BHTN are a legal obligation (D40),
			// so `createOne` writes the schema's `true` default and HR has no choice
			// to get wrong. Only the effective window is HR's to set.
			parsed.insuranceEffectiveFrom = readIso(row, 'insuranceEffectiveFrom');
			parsed.insuranceEffectiveTo = readIso(row, 'insuranceEffectiveTo');
			if (parsed.insuranceEffectiveFrom && parsed.insuranceEffectiveTo
				&& parsed.insuranceEffectiveTo <= parsed.insuranceEffectiveFrom) {
				fail('INSURANCE_EFFECTIVE_TO_BEFORE_FROM', 'Ngày hết hạn bảo hiểm phải sau ngày hiệu lực bảo hiểm.');
			}

			// ── Group 6: employment contract (optional) ──
			// Same three date rules `EmploymentContractService.assertDateRules` enforces
			// on the single-employee route. Duplicated on purpose: the service throws,
			// while an import must report per-row so HR can find the cell. If these
			// rules grow past three lines, lift them into a shared pure helper.
			const contractTypeCell = readText(row, 'contractType');
			if (contractTypeCell) {
				const resolved = resolveAlias(contractTypeCell, CONTRACT_TYPE_ALIASES, CONTRACT_TYPES);
				if (!resolved) {
					fail('CONTRACT_TYPE_INVALID', `Loại hợp đồng "${contractTypeCell}" không hợp lệ. Chỉ nhận Thử việc, Có thời hạn hoặc Không thời hạn.`);
				} else {
					parsed.contractType = resolved;
					parsed.contractEffectiveDate = readIso(row, 'contractEffectiveDate');
					parsed.contractExpiryDate = readIso(row, 'contractExpiryDate');

					if (!parsed.contractEffectiveDate) {
						fail('CONTRACT_EFFECTIVE_DATE_REQUIRED', 'Thiếu ngày hiệu lực hợp đồng — bắt buộc khi đã chọn loại hợp đồng.');
					}
					if (resolved === ContractType.INDEFINITE_TERM) {
						// Forbidden, not merely ignored: a stray expiry on an indefinite
						// contract would silently become a fixed-term one downstream.
						if (parsed.contractExpiryDate) {
							fail('CONTRACT_INDEFINITE_TERM_NO_EXPIRY', 'Hợp đồng không thời hạn không được có ngày hết hạn.');
						}
					} else if (!parsed.contractExpiryDate) {
						fail('CONTRACT_EXPIRY_REQUIRED', 'Thiếu ngày hết hạn hợp đồng — bắt buộc với hợp đồng thử việc hoặc có thời hạn.');
					} else if (parsed.contractEffectiveDate && parsed.contractExpiryDate <= parsed.contractEffectiveDate) {
						fail('CONTRACT_EXPIRY_BEFORE_EFFECTIVE', 'Ngày hết hạn hợp đồng phải sau ngày hiệu lực.');
					}
				}
			}

			rows.push(parsed);
		}

		const orphans = dependentSheet ? this.parseDependentSheet(dependentSheet, rows, today) : [];
		return { rows, orphans };
	}

	/**
	 * The dependent sheet, by name or by its header row. Returns undefined only
	 * when the file has no dependent sheet at all — a sheet that *looks* like one
	 * but lacks a required column is returned so `parseDependentSheet` can throw
	 * the missing-columns error instead of dropping every row silently.
	 */
	private findDependentSheet(
		workbook: ExcelJS.Workbook,
		employeeSheet: ExcelJS.Worksheet,
	): ExcelJS.Worksheet | undefined {
		const named = workbook.getWorksheet(DEPENDENT_SHEET);
		if (named) return named;

		const looksLikeDependents = (ws: ExcelJS.Worksheet) => {
			if (ws === employeeSheet) return false;
			const keys = new Set<string>();
			ws.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
				const header = cellText(cell.value);
				if (!header) return;
				const canonical = DEPENDENT_HEADERS.get(normalizeHeader(header));
				if (canonical) keys.add(canonical);
			});
			// Required columns only, and via the same index the parser uses, so
			// either spelling counts and a stray sheet is never mistaken for this one.
			return REQUIRED_DEPENDENT_COLUMNS.every((name) => keys.has(name));
		};
		return workbook.worksheets.find(looksLikeDependents);
	}

	/**
	 * Sheet 2 → each dependent pushed onto the row its `employeeCode` names.
	 * A code that matches no employee sheet row is an orphan: reported against the
	 * dependent sheet's line, and (in `abort`) enough to reject the whole file.
	 */
	private parseDependentSheet(
		sheet: ExcelJS.Worksheet,
		rows: ParsedRow[],
		today: string,
	): ImportRowError[] {
		const headerRow = sheet.getRow(1);
		const index = new Map<string, number>();
		headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
			const header = cellText(cell.value);
			if (!header) return;
			const canonical = DEPENDENT_HEADERS.get(normalizeHeader(header));
			if (canonical) index.set(columnKey(canonical), colNumber);
		});

		const missing = REQUIRED_DEPENDENT_COLUMNS.filter((name) => !index.has(columnKey(name)));
		if (missing.length) {
			throw new BadRequestException(
				`EMPLOYEE_IMPORT_MISSING_COLUMNS:${DEPENDENT_SHEET}:${missing.map((n) => columnLabel(n, DEPENDENT_HEADER_LABELS)).join(', ')}`,
			);
		}

		const read = (row: ExcelJS.Row, name: string) => {
			const col = index.get(columnKey(name));
			return col ? row.getCell(col).value : undefined;
		};
		const byCode = new Map(rows.filter((r) => r.employeeCode).map((r) => [r.employeeCode, r]));
		const orphans: ImportRowError[] = [];
		let parsed = 0;

		for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
			const row = sheet.getRow(rowNumber);
			const employeeCode = normalizeEmployeeCode(cellText(read(row, 'employeeCode')));
			const fullName = cellText(read(row, 'fullName'));
			const relationshipRaw = cellText(read(row, 'relationship'));
			const relationship = resolveAlias(relationshipRaw, RELATIONSHIP_ALIASES, DEPENDENT_RELATIONSHIPS)
				?? relationshipRaw.toUpperCase();
			const idCardNumber = cellText(read(row, 'idCardNumber'));
			const dateOfBirth = toIsoDate(read(row, 'dateOfBirth'));
			if (!employeeCode && !fullName && !relationship && !idCardNumber && !dateOfBirth) continue;
			if (++parsed > MAX_DEPENDENT_ROWS) throw new BadRequestException('EMPLOYEE_IMPORT_TOO_MANY_ROWS');

			const owner = employeeCode ? byCode.get(employeeCode) : undefined;
			const fail = (code: string, message: string) => {
				if (owner) owner.errors.push({ row: rowNumber, employeeCode: employeeCode || null, code, message });
				else orphans.push({ row: rowNumber, employeeCode: employeeCode || null, code, message });
			};

			if (!employeeCode) fail('DEPENDENT_EMPLOYEE_CODE_REQUIRED', 'Thiếu mã nhân viên để gắn người phụ thuộc.');
			else if (!owner) fail('DEPENDENT_ORPHAN', `Không có nhân viên "${employeeCode}" ở sheet ${EMPLOYEE_SHEET}.`);
			if (!fullName) fail('DEPENDENT_NAME_REQUIRED', 'Người phụ thuộc thiếu họ tên.');
			if (!dateOfBirth) fail('DEPENDENT_DOB_INVALID', 'Ngày sinh người phụ thuộc không hợp lệ (MM/DD/YYYY).');
			else if (dateOfBirth > today) fail('DEPENDENT_DOB_INVALID', 'Ngày sinh người phụ thuộc không được ở tương lai.');
			if (!relationship) fail('DEPENDENT_RELATIONSHIP_REQUIRED', 'Người phụ thuộc thiếu quan hệ với nhân viên.');

			if (owner && fullName && dateOfBirth && relationship) {
				owner.dependents.push({
					fullName,
					dateOfBirth,
					relationship,
					idCardNumber: idCardNumber || undefined,
				});
			}
		}

		return orphans;
	}

	/** ── Validate against the tenant ────────────────────────────────────── */

	/**
	 * One query per catalog, never one per row: a 1000-row file must not fan out
	 * into 4000 lookups. Everything here is a *row* error, reported with its row
	 * number so HR can find the cell.
	 */
	private async validateRefs(organizationId: string, rows: ParsedRow[]): Promise<Refs> {
		const fail = (row: ParsedRow, code: string, message: string) =>
			row.errors.push({ row: row.rowNumber, employeeCode: row.employeeCode || null, code, message });

		// Duplicates *within* the file — the unique indexes cannot see these,
		// because the first row wins and the second trips a raw 11000.
		const seenCodes = new Map<string, number>();
		const seenEmails = new Map<string, number>();
		for (const row of rows) {
			if (row.employeeCode) {
				const first = seenCodes.get(row.employeeCode);
				if (first !== undefined) fail(row, 'DUPLICATE_IN_FILE', `Mã nhân viên trùng với dòng ${first} trong file.`);
				else seenCodes.set(row.employeeCode, row.rowNumber);
			}
			if (row.email) {
				const key = normalizeEmail(row.email);
				const first = seenEmails.get(key);
				if (first !== undefined) fail(row, 'DUPLICATE_IN_FILE', `Email trùng với dòng ${first} trong file.`);
				else seenEmails.set(key, row.rowNumber);
			}
		}

		const codes = [...seenCodes.keys()];
		const emails = [...seenEmails.keys()];
		const departmentCodes = [...new Set(rows.map((r) => r.departmentCode).filter(Boolean))] as string[];
		const positionCodes = [...new Set(rows.map((r) => r.positionCode).filter(Boolean))] as string[];
		const managerCodes = [...new Set(rows.map((r) => r.directManagerCode).filter(Boolean))] as string[];
		const allowanceCodes = [...new Set(rows.flatMap((r) => r.allowances.map((a) => a.code)))];
		const bonusPolicyNames = [...new Set(rows.map((r) => r.bonusPolicyCode).filter(Boolean))] as string[];

		const [existingProfiles, existingUsers, departments, positions, managers, allowances, bonusPolicies] = await Promise.all([
			this.profileModel.find({ organizationId, employeeCode: { $in: codes } }).select('employeeCode').lean(),
			this.userModel.find({ organizationId, emailN: { $in: emails } }).select('emailN').lean(),
			this.departmentModel.find({ organizationId, code: { $in: departmentCodes } }).select('_id code').lean(),
			// A position code is unique only inside its department (position.schema.ts),
			// so the whole org's positions are fetched and keyed by the pair — a
			// `code: {$in: [...]}` filter alone would happily match another
			// department's `DEV` and put the employee in the wrong job.
			this.positionModel.find({ organizationId, code: { $in: positionCodes } }).select('_id code departmentId').lean(),
			this.profileModel.find({ organizationId, employeeCode: { $in: managerCodes } }).select('employeeCode userId').lean(),
			this.allowanceModel.find({ organizationId, code: { $in: allowanceCodes } }).select('_id code').lean(),
			this.bonusPolicyModel.find({ organizationId, name: { $in: bonusPolicyNames } }).select('_id name').lean(),
		]);

		const takenCodes = new Set(existingProfiles.map((p) => p.employeeCode));
		const takenEmails = new Set(existingUsers.map((u) => u.emailN));
		const departmentByCode = new Map(departments.map((d) => [d.code, d._id]));
		const positionByPair = new Map(positions.map((p) => [positionKey(String(p.departmentId), p.code), p._id]));
		// Every position code that exists in the tenant under *some* department —
		// the difference between "wrong department" and "no such position".
		const anyDepartmentCodes = new Set(positions.map((p) => p.code));
		// A manager may be in the same file — that is the whole point of the
		// two-pass order — so both sources count as "exists".
		const knownManagerCodes = new Set([...managerCodes.filter((c) => seenCodes.has(c)), ...managers.map((m) => m.employeeCode)]);

		for (const row of rows) {
			if (row.employeeCode && takenCodes.has(row.employeeCode)) {
				fail(row, 'EMPLOYEE_CODE_TAKEN', `Mã nhân viên "${row.employeeCode}" đã tồn tại trong tổ chức.`);
			}
			if (row.email && takenEmails.has(normalizeEmail(row.email))) {
				fail(row, 'EMAIL_TAKEN', `Email "${row.email}" đã được dùng trong tổ chức.`);
			}
			const departmentId = row.departmentCode ? departmentByCode.get(row.departmentCode) : undefined;
			if (row.departmentCode && departmentId === undefined) {
				fail(row, 'DEPARTMENT_NOT_FOUND', `Không tìm thấy phòng ban có mã "${row.departmentCode}".`);
			}
			// Only meaningful once the department itself resolves: with an unknown
			// department there is no pair to look up, and the row already carries the
			// department error.
			//
			// The dropdown offers every position of the tenant, so a code that exists
			// under a *different* department is a likelier mistake than a typo — and
			// it deserves its own code, because "không còn tồn tại" would be a lie
			// about a position HR can see in that very list.
			if (row.positionCode && departmentId !== undefined
				&& !positionByPair.has(positionKey(String(departmentId), row.positionCode))) {
				const known = anyDepartmentCodes.has(row.positionCode);
				fail(row, known ? 'POSITION_DEPARTMENT_MISMATCH' : 'POSITION_NOT_FOUND',
					known
						? `Chức danh "${row.positionCode}" không thuộc phòng ban "${row.departmentCode}".`
						: `Không tìm thấy chức danh "${row.positionCode}" trong phòng ban "${row.departmentCode}".`);
			}
			if (row.directManagerCode && !knownManagerCodes.has(row.directManagerCode)) {
				fail(row, 'MANAGER_NOT_FOUND', `Không tìm thấy quản lý có mã "${row.directManagerCode}".`);
			}
		}

		const allowanceByCode = new Map(allowances.map((a) => [a.code, a._id]));
		for (const row of rows) {
			row.allowances = row.allowances.filter((entry) => {
				if (allowanceByCode.has(entry.code)) return true;
				fail(row, 'ALLOWANCE_NOT_FOUND', `Không tìm thấy phụ cấp có mã "${entry.code}".`);
				return false;
			});
		}

		const bonusPolicyByName = new Map(bonusPolicies.map((p) => [p.name, p._id]));
		for (const row of rows) {
			if (!row.bonusPolicyCode) continue;
			if (bonusPolicyByName.has(row.bonusPolicyCode)) continue;
			fail(row, 'ATTENDANCE_BONUS_POLICY_NOT_FOUND', `Không tìm thấy chính sách thưởng chuyên cần "${row.bonusPolicyCode}".`);
			row.bonusPolicyCode = undefined;
		}

		return { departments: departmentByCode, positions: positionByPair, allowances: allowanceByCode, bonusPolicies: bonusPolicyByName };
	}

	/** ── Import ─────────────────────────────────────────────────────────── */

	async import(
		organizationId: string,
		actorUserId: string,
		buffer: Buffer,
		dryRun = false,
	): Promise<ImportResult> {
		const { rows, orphans } = await this.parseWorkbook(buffer);
		const refs = await this.validateRefs(organizationId, rows);

		const report = (created: number, tempPasswords: ImportResult['tempPasswords']): ImportResult => ({
			total: rows.length,
			created,
			failed: rows.filter((r) => r.errors.length).length,
			dryRun,
			errors: [...rows.flatMap((r) => r.errors), ...orphans],
			tempPasswords,
		});

		// Dry run reports exactly what a real run would do, so it must run the
		// same validation and then stop before any write.
		if (dryRun) return report(0, []);

		// All-or-nothing: one bad row and nothing is written. `created: 0` is the
		// honest signal that the file was rejected whole. An orphaned dependent
		// row is a bad file too, even with no employee row at fault. Past this
		// point every row is clean, so `rows` is the work list.
		if (rows.some((r) => r.errors.length) || orphans.length) return report(0, []);

		// Hashed up front: bcrypt is deliberately slow and must never hold a
		// transaction open (same reason `EmployeeService.provisionProfile` does it).
		const prepared = await Promise.all(
			rows.map(async (row) => {
				const tempPassword = generateTempPassword();
				return { row, tempPassword, passwordHash: await hashPassword(tempPassword) };
			}),
		);

		const session = await this.connection.startSession();
		try {
			await session.withTransaction(async () => {
				for (const item of prepared) {
					await this.createOne(organizationId, actorUserId, item.row, item.passwordHash, refs, session);
				}
				// Pass 3, inside the same transaction: a manager may be a later
				// row in this very file, so it can only run once all exist.
				await this.assignManagers(organizationId, prepared.map((p) => p.row), session);
			});
		} catch (err) {
			throw mapDuplicateKey(err);
		} finally {
			await session.endSession();
		}
		return report(rows.length, prepared.map((p) => ({
			employeeCode: p.row.employeeCode,
			email: p.row.email,
			tempPassword: p.tempPassword,
		})));
	}

	/**
	 * The account, its HR record, and — when the row carries them — the salary
	 * and insurance records, all in the caller's transaction. `provisionAccount`
	 * is the only implementation of "User and EmployeeProfile agree" (TASK-120),
	 * so this must not re-implement it.
	 */
	private async createOne(
		organizationId: string,
		actorUserId: string,
		row: ParsedRow,
		passwordHash: string,
		refs: Refs,
		session: ClientSession,
	): Promise<void> {
		const input: AccountInput = {
			organizationId,
			email: row.email,
			fullName: row.fullName,
			phone: row.phone,
			employeeCode: row.employeeCode,
			passwordHash,
			role: row.role,
			joinDate: row.joinDate,
			// Same starting state as the single-employee flow — the promotion
			// path in changeStatus expects PROBATION as the entry state.
			employmentStatus: EmploymentStatus.PROBATION,
			dateOfBirth: row.dateOfBirth,
			gender: row.gender,
			// `directManagerId` is deliberately absent: the manager may be a later
			// row in this same file. `assignManagers` sets it once everyone exists.
			profileExtras: {
				...(row.address && { address: row.address }),
				...(row.citizenId && { citizenId: row.citizenId }),
				...(row.taxCode && { taxCode: row.taxCode }),
				...(row.socialInsuranceCode && { socialInsuranceCode: row.socialInsuranceCode }),
				...(row.bankAccount && { bankAccount: row.bankAccount }),
				...(row.dependents.length && {
					dependents: row.dependents.map((d) => ({
						fullName: d.fullName,
						dateOfBirth: d.dateOfBirth,
						relationship: d.relationship,
						idCardNumber: d.idCardNumber,
						// Not imported: the schema requires the field and defaults it to
						// false, and the form has a checkbox for the rare disabled case.
						isDisabled: false,
						active: true,
						status: 'ACTIVE',
						version: 1,
					})),
				}),
			},
		};

		const { employeeProfileId } = await provisionAccount(this.userModel, this.profileModel, input, session);

		const departmentId = row.departmentCode ? refs.departments.get(row.departmentCode) : undefined;
		const positionId = row.positionCode && departmentId !== undefined
			? refs.positions.get(positionKey(String(departmentId), row.positionCode))
			: undefined;
		await this.profileModel.updateOne(
			{ _id: employeeProfileId, organizationId },
			{ $set: { departmentId, positionId } },
			{ session },
		);

		if (row.baseSalary !== undefined) {
			const effectiveFrom = new Date(row.salaryEffectiveFrom ?? row.joinDate!);
			const allowanceRows = row.allowances.map((a) => ({ allowanceId: refs.allowances.get(a.code), amount: a.amount }));
			await this.salaryModel.create(
				[{
					organizationId,
					employeeProfileId,
					effectiveFrom,
					baseSalary: row.baseSalary,
					// Lương đóng bảo hiểm là số dẫn xuất: lương cơ bản − tổng phụ cấp.
					insuranceSalary: Math.max(0, row.baseSalary - allowanceRows.reduce((sum, a) => sum + a.amount, 0)),
					organizationAllowanceIds: row.allowances.map((a) => refs.allowances.get(a.code)).filter(Boolean),
					allowances: allowanceRows,
					...(row.bonusPolicyCode && { attendanceBonusPolicyId: refs.bonusPolicies.get(row.bonusPolicyCode) }),
					version: 1,
				}],
				{ session },
			);
		}

		// Always created, never conditional: BHXH/BHYT/BHTN are a legal obligation
		// (D40), so every imported employee has a participation record from day one
		// and the payroll engine never has to guess a missing one means "exempt".
		await this.insuranceModel.create(
			[{
				organizationId,
				employeeId: employeeProfileId,
				effectiveFrom: new Date(row.insuranceEffectiveFrom ?? row.joinDate!),
				...(row.insuranceEffectiveTo && { effectiveTo: new Date(row.insuranceEffectiveTo) }),
				participatesSocialInsurance: true,
				participatesHealthInsurance: true,
				participatesUnemploymentInsurance: true,
				version: 1,
				createdBy: actorUserId,
			}],
			{ session },
		);

		// Only when the row carries a contract type. Written straight to the model
		// rather than through `EmploymentContractService`, which takes no session —
		// so the three date rules live in `parseWorkbook`'s contract group instead
		// (see its comment).
		//
		// Created ACTIVE, not DRAFT: import backfills people who are already working,
		// and `findCompliance` only counts ACTIVE/EXPIRED — a draft would make every
		// imported employee report NO_CONTRACT and force HR to click each one.
		if (row.contractType) {
			const effectiveDate = new Date(row.contractEffectiveDate!);
			await this.contractModel.create(
				[{
					organizationId,
					employeeProfileId,
					contractType: row.contractType,
					status: ContractStatus.ACTIVE,
					effectiveDate,
					...(row.contractExpiryDate && { expiryDate: new Date(row.contractExpiryDate) }),
					// Stamped to the contract's own start, not "now": the status did not
					// just change, so the screen must not claim it did.
					statusChangedAt: effectiveDate,
				}],
				{ session },
			);
		}
	}

	/**
	 * Pass 3. A `directManagerCode` may name a row in this same file, so this can
	 * only run once every profile exists. `validateRefs` has already proved each
	 * code resolves to a file row or an existing profile.
	 */
	private async assignManagers(
		organizationId: string,
		rows: ParsedRow[],
		session: ClientSession,
	): Promise<void> {
		const wanted = rows.filter((r) => r.directManagerCode);
		if (!wanted.length) return;

		const profiles = await this.profileModel
			.find({ organizationId, employeeCode: { $in: [...new Set(wanted.map((r) => r.directManagerCode!))] } })
			.select('employeeCode userId')
			.session(session)
			.lean();
		const userIdByCode = new Map(profiles.map((p) => [p.employeeCode, p.userId]));

		for (const row of wanted) {
			const managerUserId = userIdByCode.get(row.directManagerCode!);
			if (!managerUserId) continue;
			await this.profileModel.updateOne(
				{ organizationId, employeeCode: row.employeeCode },
				{ $set: { directManagerId: managerUserId } },
				{ session },
			);
		}
	}

	/** ── Template ───────────────────────────────────────────────────────── */

	/**
	 * The download HR fills in. Two data sheets — one employee per row, one
	 * dependent per row — plus a guide listing this tenant's real catalogs.
	 *
	 * Every column whose value must come from a fixed list is a real Excel
	 * dropdown, backed by a hidden `DanhMuc` sheet: HR picks instead of typing,
	 * so `Phòng ban` cannot be a typo of a real department. Salary and allowance
	 * columns stay free-text — they are amounts, not choices.
	 */
	async buildTemplate(organizationId: string): Promise<{ buffer: Buffer; filename: string }> {
		const [departments, positions, allowances, bonusPolicies, managerProfiles] = await Promise.all([
			this.departmentModel.find({ organizationId, active: true }).select('code name').sort({ code: 1 }).lean(),
			this.positionModel.find({ organizationId, active: true }).select('code name departmentId').sort({ code: 1 }).lean(),
			this.allowanceModel.find({ organizationId, active: true }).select('code name').sort({ code: 1 }).lean(),
			this.bonusPolicyModel.find({ organizationId, active: true }).select('name').sort({ effectiveFrom: -1 }).lean(),
			this.profileModel.find({ organizationId }).select('employeeCode userId').sort({ employeeCode: 1 }).lean(),
		]);
		// The manager dropdown shows names, and names live on `User`, not the profile.
		const managerUsers = managerProfiles.length
			? await this.userModel
				.find({ _id: { $in: managerProfiles.map((p) => p.userId) } })
				.select('fullName')
				.lean()
			: [];
		const nameByUserId = new Map(managerUsers.map((u) => [String(u._id), u.fullName]));

		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet(EMPLOYEE_SHEET);

		// HR reads these headers, so they are Vietnamese labels — the code name is
		// only the internal key the parser folds them back into. The allowance
		// header carries the tenant's own name in brackets so HR knows which
		// column is which without cross-checking the guide sheet.
		const allowanceHeaders = allowances.map((a) => `Phụ cấp ${a.code} (${a.name})`);
		const headers = [...COLUMNS.map((key) => HEADER_LABELS[key] ?? key), ...allowanceHeaders];
		sheet.addRow(headers);
		sheet.getRow(1).font = { bold: true };
		sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
		headers.forEach((_, i) => { sheet.getColumn(i + 1).width = 20; });
		// Date cells get a real date format, so HR's `1/5/2026` is stored as a serial
		// (Excel reads it back as a `Date`) instead of a string the parser must guess
		// the day/month order of. Indexed off `COLUMNS`, so the trailing allowance
		// columns are never touched.
		for (const key of DATE_COLUMNS) {
			const index = (COLUMNS as readonly string[]).indexOf(key);
			if (index >= 0) sheet.getColumn(index + 1).numFmt = 'mm/dd/yyyy';
		}

		const dependents = workbook.addWorksheet(DEPENDENT_SHEET);
		dependents.addRow(DEPENDENT_COLUMNS.map((key) => DEPENDENT_HEADER_LABELS[key] ?? key));
		dependents.getRow(1).font = { bold: true };
		dependents.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
		DEPENDENT_COLUMNS.forEach((_, i) => { dependents.getColumn(i + 1).width = 20; });
		// Same date format as sheet 1 — `Ngày sinh` is the one date column here.
		const dependentDobIndex = (DEPENDENT_COLUMNS as readonly string[]).indexOf('dateOfBirth');
		if (dependentDobIndex >= 0) dependents.getColumn(dependentDobIndex + 1).numFmt = 'mm/dd/yyyy';

		// ── Dropdowns ──
		// Excel caps an inline list at 255 characters, which a real tenant's
		// department list blows past, so every list lives on a hidden sheet and
		// the validation points at that range.
		const catalog = workbook.addWorksheet('DanhMuc');
		catalog.state = 'veryHidden';

		/** List name → the range its values occupy on the catalog sheet. */
		const ranges: Record<string, string> = {};
		const addList = (name: string, values: string[]): string | undefined => {
			if (!values.length) return undefined;
			const column = catalog.getColumn(catalog.columnCount + 1);
			// Row 1 is the list's own name (a label for anyone who unhides the
			// sheet); the values start at row 2, which is what the range points at.
			column.values = [name, ...values];
			column.width = 24;
			const range = `${catalog.name}!$${column.letter}$2:$${column.letter}$${values.length + 1}`;
			ranges[name] = range;
			return range;
		};

		addList('VaiTro', ROLE_CHOICES);
		addList('GioiTinh', GENDER_CHOICES);
		addList('PhongBan', departments.map((d) => catalogLabel(d.code, d.name)));
		// Every position of the tenant, flat — deliberately not filtered by the
		// department in the same row. Excel-side cascading meant a stale or edited
		// department cell could silently narrow the list and hide the position HR
		// needed; a flat list always shows everything that exists, and the server
		// rejects a position that does not belong to the row's department (see
		// `validateRefs`), so a wrong pick costs one row error instead of a
		// dropdown that lies about what the tenant has.
		addList('ChucDanh', positions.map((p) => catalogLabel(p.code, p.name)));
		addList('QuanLy', managerProfiles.map((p) => catalogLabel(p.employeeCode, nameByUserId.get(String(p.userId)))));
		addList('QuanHe', RELATIONSHIP_OPTIONS.map(([code, label]) => catalogLabel(code, label)));
		addList('ThuongCC', [NO_BONUS_POLICY, ...new Set(bonusPolicies.map((p) => p.name))]);
		addList('LoaiHopDong', CONTRACT_TYPE_OPTIONS.map(([code, label]) => catalogLabel(code, label)));

		/** Header text → its 1-based column number on that sheet. */
		const columnOf = (target: ExcelJS.Worksheet, header: string) => {
			let found = -1;
			target.getRow(1).eachCell((cell, colNumber) => {
				if (cellText(cell.value) === header) found = colNumber;
			});
			return found;
		};

		const dropdown = (listName: string): ExcelJS.DataValidation | undefined => {
			const range = ranges[listName];
			if (!range) return undefined;
			return {
				type: 'list',
				allowBlank: true,
				formulae: [range],
				showErrorMessage: true,
				// `warning`, not `stop`: a tenant that renamed a department after HR
				// filled the file must still be able to upload and be told by the
				// row report, rather than having Excel refuse the cell outright.
				errorStyle: 'warning',
				errorTitle: 'Giá trị không có trong danh sách',
				error: 'Hãy chọn một giá trị từ danh sách. Nếu chắc chắn đúng, bấm "Yes" để giữ nguyên.',
			};
		};

		const applyDropdown = (target: ExcelJS.Worksheet, header: string, listName: string, lastRow: number) => {
			const validation = dropdown(listName);
			const col = columnOf(target, header);
			if (!validation || col < 1) return;
			const letter = target.getColumn(col).letter;
			addDropdown(target, `${letter}2:${letter}${lastRow + 1}`, validation);
		};

		applyDropdown(sheet, HEADER_LABELS.role, 'VaiTro', MAX_IMPORT_ROWS);
		applyDropdown(sheet, HEADER_LABELS.gender, 'GioiTinh', MAX_IMPORT_ROWS);
		applyDropdown(sheet, HEADER_LABELS.departmentCode, 'PhongBan', MAX_IMPORT_ROWS);
		// Flat, and deliberately not cascaded off the department column: the dropdown
		// must show every position the tenant has, and the server is what rejects a
		// position filed under the wrong department. A cascading list would go empty
		// or stale the moment a department cell was edited by hand, hiding real
		// positions from HR — a worse failure than a row error.
		applyDropdown(sheet, HEADER_LABELS.positionCode, 'ChucDanh', MAX_IMPORT_ROWS);
		applyDropdown(sheet, HEADER_LABELS.directManagerCode, 'QuanLy', MAX_IMPORT_ROWS);
		applyDropdown(sheet, HEADER_LABELS.attendanceBonusPolicyCode, 'ThuongCC', MAX_IMPORT_ROWS);
		applyDropdown(sheet, HEADER_LABELS.contractType, 'LoaiHopDong', MAX_IMPORT_ROWS);
		// The dependent sheet has its own, larger ceiling.
		applyDropdown(dependents, DEPENDENT_HEADER_LABELS.relationship, 'QuanHe', MAX_DEPENDENT_ROWS);

		const guide = workbook.addWorksheet('HuongDan');
		const guideRows: [string, string][] = [
			['Cấu trúc tệp', `Sheet "${EMPLOYEE_SHEET}": mỗi dòng là MỘT nhân viên. Sheet "${DEPENDENT_SHEET}": mỗi dòng là MỘT người phụ thuộc, nối về nhân viên qua cột "Mã nhân viên". Không giới hạn số người phụ thuộc.`],
			['Mã nhân viên', 'Bắt buộc ở cả 2 sheet. Phải viết giống nhau ở 2 sheet thì người phụ thuộc mới được gắn vào đúng nhân viên.'],
			['Vai trò', `Chọn từ danh sách: ${ROLE_CHOICES.join(' | ')}. Để trống = Nhân viên.`],
			['Giới tính', GENDER_CHOICES.join(' | ')],
			['Ngày vào làm / Ngày sinh', 'MM/DD/YYYY (hoặc YYYY-MM-DD). Ngày vào làm không được ở tương lai.'],
			['Phòng ban', departments.map((d) => catalogLabel(d.code, d.name)).join(' | ') || '(chưa có phòng ban — tạo phòng ban trước khi import)'],
			['Chức danh', positions.length
				? 'Cột "Chức danh" hiện TẤT CẢ chức danh của tổ chức. Chức danh chỉ hợp lệ khi thuộc đúng phòng ban ghi ở cột "Phòng ban" cùng dòng — xem bảng "Chức danh theo phòng ban" bên dưới. Chọn sai phòng ban thì dòng đó bị báo lỗi và không được lưu.'
				: '(chưa có chức danh — tạo chức danh trong phòng ban trước khi import)'],
			['Quản lý trực tiếp', 'Chọn mã nhân viên của quản lý. Có thể là một dòng khác trong cùng file. Để trống nếu chưa có.'],
			['Lương cơ bản', 'Số nguyên VND, không dấu chấm. Để trống nếu chưa có. Lương đóng BHXH là số tự tính (lương cơ bản − tổng phụ cấp), không nhập ở file.'],
			['Phụ cấp <MÃ>', allowances.length
				? `Mỗi mã phụ cấp là MỘT cột riêng, tên cột ghi "Phụ cấp <MÃ> (<Tên>)". Điền số tiền vào cột của mã đó, để trống nếu không có. Danh sách mã hiện có: ${allowances.map((a) => `${a.code} (${a.name})`).join(' | ')}.`
				: '(chưa có phụ cấp — tạo phụ cấp trong Cấu hình lương trước khi import)'],
			['Chính sách thưởng chuyên cần', bonusPolicies.length
				? `Chọn một chính sách đang hiệu lực, hoặc "${NO_BONUS_POLICY}". Hiện có: ${bonusPolicies.map((p) => p.name).join(' | ')}.`
				: `Chưa có chính sách nào — chọn "${NO_BONUS_POLICY}". Tạo chính sách ở màn "Thưởng chuyên cần" nếu cần.`],
			['Bảo hiểm', 'Mọi nhân viên import đều tham gia bắt buộc BHXH/BHYT/BHTN (nghĩa vụ pháp luật). Đặt ngày hiệu lực ở cột "Bảo hiểm hiệu lực từ ngày", ngày kết thúc (nếu có) ở cột "Bảo hiểm hiệu lực đến ngày".'],
			['Hợp đồng lao động', `Để trống cột "Loại hợp đồng" nếu chưa tạo hợp đồng. Nếu điền, chọn một trong: ${CONTRACT_TYPE_OPTIONS.map(([code, label]) => catalogLabel(code, label)).join(' | ')}. Bắt buộc kèm "Ngày hiệu lực hợp đồng"; "Ngày hết hạn hợp đồng" bắt buộc với Thử việc / Có thời hạn và KHÔNG được điền với Không thời hạn. Hợp đồng import được tạo ở trạng thái Đang hiệu lực.`],
			[`Sheet "${DEPENDENT_SHEET}"`, 'Để trống hoàn toàn nếu không nhân viên nào có người phụ thuộc.'],
			['Mối quan hệ với nhân viên', RELATIONSHIP_OPTIONS.map(([code, label]) => catalogLabel(code, label)).join(' | ')],
			['Giới hạn', `${MAX_IMPORT_ROWS} nhân viên và ${MAX_DEPENDENT_ROWS} người phụ thuộc / file, tối đa 5 MB.`],
			['Cập nhật danh mục', 'File mẫu được sinh từ dữ liệu HIỆN TẠI của tổ chức mỗi lần tải. Phòng ban, chức danh, phụ cấp hoặc chính sách thưởng chuyên cần vừa thay đổi thì tải lại file mẫu mới trước khi điền — file tải trước đó vẫn import được nhưng danh sách có thể đã cũ, thiếu mục vừa thêm.'],
			['Loại hình làm việc', `Mọi nhân viên import đều là ${EmploymentType.FULL_TIME} — đây là giá trị duy nhất hệ thống hỗ trợ.`],
		];
		guideRows.forEach((row) => guide.addRow(row));
		guide.getColumn(1).width = 30;
		guide.getColumn(2).width = 100;

		// The position dropdown is flat (every position in one list), so this table
		// is the only place HR can see which position belongs to which department.
		// Without it, a wrong-department pick would be a coin flip that costs a row.
		if (positions.length) {
			const byDepartment = new Map<string, string[]>();
			for (const position of positions) {
				const key = String(position.departmentId);
				const bucket = byDepartment.get(key);
				if (bucket) bucket.push(position.code);
				else byDepartment.set(key, [position.code]);
			}

			guide.addRow([]);
			const heading = guide.addRow(['Chức danh theo phòng ban', 'Cột "Phòng ban" phải khớp với cột "Chức danh" theo bảng này.']);
			heading.font = { bold: true };
			for (const department of departments) {
				const codes = byDepartment.get(String(department._id)) ?? [];
				guide.addRow([
					catalogLabel(department.code, department.name),
					codes.length ? codes.join(' | ') : '(chưa có chức danh)',
				]);
			}
		}

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		return { buffer, filename: 'mau-import-nhan-vien.xlsx' };
	}
}

/**
 * Same mapping as the single-employee route: a duplicate index names which
 * unique key fired, so the report says "email taken" instead of a generic 409.
 * Anything else passes through untouched — the caller decides what to report.
 */
function mapDuplicateKey(err: unknown): unknown {
	if (err && typeof err === 'object' && (err as { code?: number }).code === 11000) {
		const keyPattern = (err as { keyPattern?: Record<string, unknown> }).keyPattern;
		if (keyPattern?.emailN) return new ConflictException('EMAIL_TAKEN');
		if (keyPattern?.userId) return new ConflictException('EMPLOYEE_PROFILE_ALREADY_EXISTS');
		return new ConflictException('EMPLOYEE_CODE_TAKEN');
	}
	return err;
}
