import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Put, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser, SessionUser, Tenant, requireOrganizationId } from '../../common/tenant-context';
import {
	ApiCreatedSuccess,
	ApiErrorExamples,
	ApiSuccess,
	employeeExample,
	employeeReadExample,
	employmentHistoryExample,
} from '../../common/swagger-responses';
import { EmployeeService } from './employee.service';
import { CreateEmployeeProfileDto } from './dto/create-employee-profile.dto';
import { UpdateEmployeeProfileDto } from './dto/update-employee-profile.dto';
import { UpdateEmploymentStatusDto } from './dto/update-employment-status.dto';
import { CreateDependentDto } from './dto/create-dependent.dto';
import { UpdateDependentDto } from './dto/update-dependent.dto';

@ApiTags('HR / Employees')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/employees')
export class EmployeeController {
	constructor(private readonly employees: EmployeeService) {}

	@Roles('HR')
	@Post()
	@ApiOperation({
		summary: 'Add an employee: link an existing account, or create the EMPLOYEE account (TASK-020, SRS §4.1).',
		description:
			'With `userId` this only attaches a profile. Without it the server creates the login account ' +
			'(role EMPLOYEE, mustChangePassword) in the same transaction and returns `tempPassword` once — ' +
			'it is not stored and must be relayed out-of-band.',
	})
	@ApiCreatedSuccess('Employee profile created (plus `tempPassword` when the account was created).', employeeExample)
	@ApiResponse({ status: 400, description: 'EMAIL_REQUIRED | FULLNAME_REQUIRED' })
	@ApiResponse({ status: 404, description: 'USER_NOT_FOUND | DEPARTMENT_NOT_FOUND | POSITION_NOT_FOUND | MANAGER_NOT_FOUND' })
	@ApiResponse({ status: 409, description: 'EMAIL_TAKEN | EMPLOYEE_CODE_TAKEN | EMPLOYEE_PROFILE_ALREADY_EXISTS' })
	@ApiErrorExamples()
	async create(@Tenant() organizationId: string | null, @Body() dto: CreateEmployeeProfileDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.employees.create(orgId, dto);
		return { success: true, data };
	}

	@Roles('HR', 'DEPARTMENT_MANAGER')
	@Get()
	@ApiOperation({ summary: 'List employee profiles in the current tenant.' })
	@ApiSuccess('Employee profiles in the current tenant.', [employeeReadExample])
	@ApiErrorExamples()
	async findAll(
		@Tenant() organizationId: string | null,
		@Query('status') status?: string,
		@Query('departmentId') departmentId?: string,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.employees.findAll(orgId, { status, departmentId });
		return { success: true, data };
	}

	@Roles('HR')
	@Get('eligible-users')
	@ApiOperation({ summary: 'List active tenant accounts that can be linked to a new employee profile.' })
	@ApiSuccess('Eligible accounts for employee profile creation.', [])
	@ApiErrorExamples()
	async eligibleUsers(@Tenant() organizationId: string | null, @CurrentUser() user: SessionUser) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.employees.listEligibleUsers(orgId, String(user._id ?? user.id));
		return { success: true, data };
	}

	/**
	 * HR accounts are tenant admin identities, not employees: they have no
	 * EmployeeProfile and cannot self-provision one — HR staff use their own
	 * EMPLOYEE account to check in. Department Manager keeps the self-provision
	 * path (FR-HRCFG-02 names only Employee and Department Manager as HR's to
	 * create). An EMPLOYEE calling it is harmless rather than privileged: they
	 * get their own record, which they could otherwise not have at all. A
	 * SYSTEM_ADMIN cannot, because there is no tenant to attach it to.
	 */
	@Roles('EMPLOYEE', 'DEPARTMENT_MANAGER')
	@Post('me')
	@ApiOperation({
		summary: 'Create my own EmployeeProfile (Phase C — HR / Department Manager self-provisioning).',
		description:
			'The profile is attached to the calling account; `userId` may not be sent. Only the HR record is written ' +
			'(the login already exists), so no account or password is involved. The caller starts on PROBATION and ' +
			'cannot approve their own status change — see PATCH /:id/status.',
	})
	@ApiCreatedSuccess('Own employee profile created.', employeeReadExample)
	@ApiResponse({ status: 400, description: 'USER_ID_NOT_ALLOWED' })
	@ApiResponse({ status: 403, description: 'TENANT_CONTEXT_REQUIRED' })
	@ApiResponse({ status: 404, description: 'USER_NOT_FOUND | DEPARTMENT_NOT_FOUND | POSITION_NOT_FOUND | MANAGER_NOT_FOUND' })
	@ApiResponse({ status: 409, description: 'EMPLOYEE_CODE_TAKEN | EMPLOYEE_PROFILE_ALREADY_EXISTS' })
	@ApiErrorExamples()
	async createMe(@Tenant() organizationId: string | null, @CurrentUser() user: SessionUser, @Body() dto: CreateEmployeeProfileDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.employees.createSelf(orgId, String(user._id ?? user.id), dto);
		return { success: true, data };
	}

	@Roles('EMPLOYEE', 'DEPARTMENT_MANAGER')
	@Get('me')
	@ApiOperation({ summary: "Current user's own EmployeeProfile." })
	@ApiSuccess("Current user's employee profile.", employeeReadExample)
	@ApiResponse({ status: 404, description: 'EMPLOYEE_PROFILE_NOT_FOUND' })
	@ApiErrorExamples()
	async me(@Tenant() organizationId: string | null, @CurrentUser() user: SessionUser) {
		const orgId = requireOrganizationId(organizationId);
		const uid = String(user._id ?? user.id);
		const data = await this.employees.findByUserId(orgId, uid);
		return { success: true, data };
	}

	@Roles('HR')
	@Get(':id')
	@ApiOperation({ summary: 'Get an employee profile by id.' })
	@ApiSuccess('Employee profile detail.', employeeReadExample)
	@ApiResponse({ status: 404, description: 'EMPLOYEE_PROFILE_NOT_FOUND' })
	@ApiErrorExamples()
	async findOne(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.employees.findOne(orgId, id);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id')
	@ApiOperation({ summary: 'Update HR business fields on an employee profile.' })
	@ApiSuccess('Employee profile updated.', employeeExample)
	@ApiErrorExamples()
	async update(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Body() dto: UpdateEmployeeProfileDto,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.employees.update(orgId, id, dto);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id/status')
	@ApiOperation({
		summary: 'Transition employmentStatus and append an EmploymentHistory record (TASK-023, BR-HIST-01).',
	})
	@ApiSuccess('Employment status changed.', { ...employeeExample, employmentStatus: 'ACTIVE' })
	@ApiResponse({ status: 404, description: 'EMPLOYEE_PROFILE_NOT_FOUND' })
	@ApiResponse({ status: 409, description: 'EMPLOYMENT_STATUS_TRANSITION_INVALID' })
	@ApiErrorExamples()
	async changeStatus(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@CurrentUser() user: SessionUser,
		@Body() dto: UpdateEmploymentStatusDto,
	) {
		const orgId = requireOrganizationId(organizationId);
		const changedBy = String(user._id ?? user.id);
		const data = await this.employees.changeStatus(orgId, id, changedBy, dto);
		return { success: true, data };
	}

	@Roles('HR')
	@Get(':id/history')
	@ApiOperation({ summary: 'Employment status history for an employee (TASK-023).' })
	@ApiSuccess('Employment status history for an employee.', [employmentHistoryExample])
	@ApiResponse({ status: 404, description: 'EMPLOYEE_PROFILE_NOT_FOUND' })
	@ApiErrorExamples()
	async history(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.employees.listHistory(orgId, id);
		return { success: true, data };
	}

	/** ── Dependent CRUD (embedded in EmployeeProfile) ── */

	@Roles('HR')
	@Get(':id/dependents')
	@ApiOperation({ summary: 'List dependents of an employee profile.' })
	@ApiSuccess('Dependents of the employee profile.', [])
	@ApiResponse({ status: 404, description: 'EMPLOYEE_PROFILE_NOT_FOUND' })
	@ApiErrorExamples()
	async listDependents(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.employees.listDependents(orgId, id);
		return { success: true, data };
	}

	@Roles('HR')
	@Post(':id/dependents')
	@ApiOperation({ summary: 'Add a dependent to an employee profile.' })
	@ApiCreatedSuccess('Dependent added.', [])
	@ApiResponse({ status: 400, description: 'DOB_FUTURE_DATE | VALIDATION_ERROR' })
	@ApiResponse({ status: 404, description: 'EMPLOYEE_PROFILE_NOT_FOUND' })
	@ApiErrorExamples()
	async addDependent(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Body() dto: CreateDependentDto,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.employees.addDependent(orgId, id, dto);
		return { success: true, data };
	}

	/**
	 * Legacy index-based DELETE — kept so older clients don't break. With
	 * `:index` being a non-numeric or out-of-range value the service throws 404
	 * (not found) instead of 400, matching how the spec calls
	 * DELETE /dependents/1 with no real dependent at position 1.
	 */
	@Roles('HR')
	@Delete(':id/dependents/:index')
	@ApiOperation({ summary: 'Legacy — remove a dependent by array index.' })
	@ApiResponse({ status: 404, description: 'EMPLOYEE_PROFILE_NOT_FOUND | DEPENDENT_INDEX_OUT_OF_RANGE' })
	@ApiErrorExamples()
	async removeDependentLegacy(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Param('index') index: string,
	) {
		const orgId = requireOrganizationId(organizationId);
		const idx = Number(index);
		// Treat any non-numeric or out-of-range index as "not found" so callers
		// that pass an id-shaped path segment get a clean 404.
		if (!Number.isInteger(idx) || idx < 0) {
			throw new NotFoundException('DEPENDENT_NOT_FOUND');
		}
		const data = await this.employees.updateDependentLegacy(orgId, id, idx);
		return { success: true, data };
	}
}
