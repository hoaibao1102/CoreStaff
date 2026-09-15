import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

@ApiTags('HR / Employees')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/employees')
export class EmployeeController {
	constructor(private readonly employees: EmployeeService) {}

	@Roles('HR')
	@Post()
	@ApiOperation({ summary: 'Create an EmployeeProfile for an existing User (TASK-020, SRS 15.2A).' })
	@ApiCreatedSuccess('Employee profile created.', employeeExample)
	@ApiResponse({ status: 404, description: 'USER_NOT_FOUND | DEPARTMENT_NOT_FOUND | POSITION_NOT_FOUND | MANAGER_NOT_FOUND' })
	@ApiResponse({ status: 409, description: 'EMPLOYEE_CODE_TAKEN | EMPLOYEE_PROFILE_ALREADY_EXISTS' })
	@ApiErrorExamples()
	async create(@Tenant() organizationId: string | null, @Body() dto: CreateEmployeeProfileDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.employees.create(orgId, dto);
		return { success: true, data };
	}

	@Roles('HR')
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
	@ApiErrorExamples()
	async history(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.employees.listHistory(orgId, id);
		return { success: true, data };
	}
}
