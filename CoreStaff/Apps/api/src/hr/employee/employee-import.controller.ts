import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Post,
	StreamableFile,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser, SessionUser, Tenant, requireOrganizationId } from '../../common/tenant-context';
import { ApiErrorExamples } from '../../common/swagger-responses';
import { EmployeeImportService, MAX_IMPORT_BYTES } from './services/employee-import.service';
import { ImportEmployeesDto } from './dto/import-employee.dto';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Bulk employee import — HR only, for the same reason `POST /hr/employees` is:
 * it mints login accounts (with temporary passwords) and salary records, and a
 * manager may do neither. See Docs/EMPLOYEE_IMPORT_PLAN.md.
 */
@ApiTags('HR / Employees')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/employees/import')
export class EmployeeImportController {
	constructor(private readonly importer: EmployeeImportService) {}

	@Roles('HR')
	@Post()
	@UseInterceptors(
		FileInterceptor('file', {
			limits: { fileSize: MAX_IMPORT_BYTES },
			fileFilter(_req, file, cb) {
				const ok = file.mimetype === XLSX_MIME
					|| file.originalname.toLowerCase().endsWith('.xlsx');
				cb(ok ? null : new BadRequestException('EMPLOYEE_IMPORT_FILE_TYPE_NOT_ALLOWED'), ok);
			},
		}),
	)
	@ApiOperation({
		summary: 'Import employees from an .xlsx file (multipart).',
		description:
			'Creates User + EmployeeProfile (+ SalaryProfile/InsuranceProfile/EmploymentContract when the row carries ' +
			'them) for every row. All-or-nothing: one invalid row and nothing is written, so the report tells HR ' +
			'exactly what to fix. `dryRun=true` validates and reports without writing. Returned `tempPasswords` are ' +
			'shown once and never stored or logged.',
	})
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		description: 'File part `file` + form field `dryRun?`.',
		type: ImportEmployeesDto,
	})
	@ApiResponse({ status: 201, description: '{ total, created, failed, dryRun, errors[], tempPasswords[] }' })
	@ApiResponse({ status: 400, description: 'EMPLOYEE_IMPORT_FILE_REQUIRED | EMPLOYEE_IMPORT_FILE_TYPE_NOT_ALLOWED | EMPLOYEE_IMPORT_FILE_TOO_LARGE | EMPLOYEE_IMPORT_FILE_INVALID | EMPLOYEE_IMPORT_MISSING_COLUMNS | EMPLOYEE_IMPORT_TOO_MANY_ROWS' })
	@ApiResponse({ status: 409, description: 'EMAIL_TAKEN | EMPLOYEE_CODE_TAKEN | EMPLOYEE_PROFILE_ALREADY_EXISTS' })
	@ApiErrorExamples()
	async import(
		@Tenant() organizationId: string | null,
		@CurrentUser() user: SessionUser,
		@Body() dto: ImportEmployeesDto,
		@UploadedFile() file?: Express.Multer.File,
	) {
		const orgId = requireOrganizationId(organizationId);
		if (!file?.buffer?.length) throw new BadRequestException('EMPLOYEE_IMPORT_FILE_REQUIRED');
		const data = await this.importer.import(
			orgId,
			String(user._id ?? user.id),
			file.buffer,
			dto.dryRun ?? false,
		);
		return { success: true, data };
	}

	@Roles('HR')
	@Get('template')
	@ApiOperation({ summary: 'Download the import template (.xlsx), pre-filled with this tenant’s catalogs.' })
	@ApiResponse({ status: 200, description: 'The workbook bytes.' })
	@ApiErrorExamples()
	async template(@Tenant() organizationId: string | null): Promise<StreamableFile> {
		const orgId = requireOrganizationId(organizationId);
		const { buffer, filename } = await this.importer.buildTemplate(orgId);
		return new StreamableFile(buffer, {
			type: XLSX_MIME,
			disposition: `attachment; filename="${encodeURIComponent(filename)}"`,
		});
	}
}
