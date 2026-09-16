import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PlatformOnly, RolesGuard } from '../common/rbac.decorator';
import { CurrentUser, SessionUser } from '../common/tenant-context';
import { ApiCreatedSuccess, ApiErrorExamples, ApiSuccess } from '../common/swagger-responses';
import { OrganizationStatus } from '../database/schemas/enums';
import { CreateInitialHrDto, CreateOrganizationDto } from './dto/platform.dto';
import { PlatformService } from './platform.service';

const organizationExample = {
	_id: '66f1b2c3d4e5f60718293a40',
	code: 'TVS',
	name: 'TVS Corporation',
	status: 'ACTIVE',
	timezone: 'Asia/Ho_Chi_Minh',
	evidenceRetentionDays: 90,
	payrollSeparationOfDuties: false,
	createdBy: '66f1b2c3d4e5f60718293a99',
	createdAt: '2026-09-15T03:20:00.000Z',
	updatedAt: '2026-09-15T03:20:00.000Z',
};

/** A platform-minted login: no `employeeCode` (the profile owns one, TASK-120)
 * and no `passwordHash` — neither field is in the response at all. */
const initialHrExample = {
	_id: '66f1b2c3d4e5f60718293a4b',
	organizationId: '66f1b2c3d4e5f60718293a40',
	email: 'hr-a@tvs.local',
	emailN: 'hr-a@tvs.local',
	fullName: 'Nguyễn Thị HR',
	role: 'HR',
	status: 'ACTIVE',
	mustChangePassword: true,
	failedLoginCount: 0,
	createdAt: '2026-09-15T03:20:00.000Z',
	updatedAt: '2026-09-15T03:20:00.000Z',
};

/**
 * SRS §16.6 — the two spec routes that make up "admin creates an org and its
 * first HR". Deliberately *not* one transaction: a failed second step is
 * retried against the org that already exists, which is why the UI keeps the new
 * org id on step-2 failure rather than rolling the pair back.
 */
@ApiTags('Platform / Organizations')
@UseGuards(AuthGuard, RolesGuard)
@PlatformOnly()
@Controller('platform/organizations')
export class PlatformController {
	constructor(private readonly platform: PlatformService) {}

	@Get()
	@ApiOperation({ summary: 'List every tenant on the platform (FR-SYS-03).' })
	@ApiSuccess('Organizations, ordered by code.', [organizationExample])
	@ApiErrorExamples()
	async findAll() {
		const data = await this.platform.listOrganizations();
		return { success: true, data };
	}

	@Post()
	@ApiOperation({
		summary: 'Create an Organization (FR-SYS-01).',
		description: '`code` is upper-cased and unique platform-wide. No tenant scope is read from the session — ' +
			'a platform admin has none by design.',
	})
	@ApiCreatedSuccess('Organization created.', organizationExample)
	@ApiResponse({ status: 400, description: 'ORGANIZATION_CODE_INVALID' })
	@ApiResponse({ status: 409, description: 'ORGANIZATION_CODE_TAKEN' })
	@ApiErrorExamples()
	async create(
		@CurrentUser() user: SessionUser,
		@Body() dto: CreateOrganizationDto,
	) {
		const data = await this.platform.createOrganization(dto, String(user._id ?? user.id));
		return { success: true, data };
	}

	@Post(':id/initial-hr')
	@ApiOperation({
		summary: 'Create the tenant’s first HR account (FR-SYS-02).',
		description:
			'Creates only the login `User` (role HR, mustChangePassword) and returns `tempPassword` once — not stored, ' +
			'not logged, relay out-of-band. No EmployeeProfile: that record is HR’s own to create ' +
			'(`POST /api/hr/employees/me`), because auto-creating it would grant attendance eligibility (SRS §162).',
	})
	@ApiParam({ name: 'id', description: 'organizationId' })
	@ApiCreatedSuccess('HR account created — `tempPassword` appears in this response once and is never stored.', {
		...initialHrExample,
		tempPassword: '(returned once — relay out-of-band)',
	})
	@ApiResponse({ status: 404, description: 'ORGANIZATION_NOT_FOUND' })
	@ApiResponse({ status: 409, description: 'EMAIL_TAKEN' })
	@ApiErrorExamples()
	async createInitialHr(@Param('id') id: string, @Body() dto: CreateInitialHrDto) {
		const data = await this.platform.createInitialHr(id, dto);
		return { success: true, data };
	}

	@Post(':id/suspend')
	@ApiOperation({
		summary: 'Suspend a tenant and revoke its live sessions (AC-SYS-02, BR-AUTH-03).',
	})
	@ApiCreatedSuccess('Tenant suspended.', { ...organizationExample, status: 'SUSPENDED' })
	@ApiResponse({ status: 404, description: 'ORGANIZATION_NOT_FOUND' })
	@ApiErrorExamples()
	async suspend(@Param('id') id: string) {
		const data = await this.platform.setOrganizationStatus(id, OrganizationStatus.SUSPENDED);
		return { success: true, data };
	}

	@Post(':id/activate')
	@ApiOperation({ summary: 'Reactivate a suspended tenant. Revokes nothing.' })
	@ApiCreatedSuccess('Tenant active.', organizationExample)
	@ApiResponse({ status: 404, description: 'ORGANIZATION_NOT_FOUND' })
	@ApiErrorExamples()
	async activate(@Param('id') id: string) {
		const data = await this.platform.setOrganizationStatus(id, OrganizationStatus.ACTIVE);
		return { success: true, data };
	}
}
