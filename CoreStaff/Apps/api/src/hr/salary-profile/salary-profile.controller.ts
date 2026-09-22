import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser, SessionUser, Tenant, requireOrganizationId } from '../../common/tenant-context';
import { ApiCreatedSuccess, ApiErrorExamples, ApiSuccess, salaryProfileExample } from '../../common/swagger-responses';
import { SalaryProfileService } from './salary-profile.service';
import { CreateSalaryProfileDto } from './dto/create-salary-profile.dto';

/** TASK-032, route per SRS §30G ("/hr/salary-profiles"). HR only. */
@ApiTags('HR / Salary Profiles')
@UseGuards(AuthGuard, RolesGuard)
@Roles('HR')
@Controller('hr/salary-profiles')
export class SalaryProfileController {
	constructor(private readonly salaryProfiles: SalaryProfileService) {}

	@Post()
	@ApiOperation({ summary: 'Create a salary profile period (TASK-032). Never updated in place; corrections are a new version.' })
	@ApiCreatedSuccess('Salary profile created.', salaryProfileExample)
	@ApiResponse({ status: 404, description: 'EMPLOYEE_PROFILE_NOT_FOUND' })
	@ApiResponse({ status: 409, description: 'SALARY_PROFILE_DATE_RANGE_INVALID | SALARY_PROFILE_PERIOD_OVERLAPS' })
	@ApiErrorExamples()
	async create(@Tenant() organizationId: string | null, @CurrentUser() user: SessionUser, @Body() dto: CreateSalaryProfileDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.salaryProfiles.create(orgId, String(user._id ?? user.id), dto);
		return { success: true, data };
	}

	@Get()
	@ApiOperation({ summary: 'List salary profiles in the tenant, optionally filtered by employeeId.' })
	@ApiSuccess('Salary profiles.', [salaryProfileExample])
	@ApiErrorExamples()
	async findAll(@Tenant() organizationId: string | null, @Query('employeeId') employeeId?: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.salaryProfiles.findAll(orgId, employeeId);
		return { success: true, data };
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get a salary profile by id.' })
	@ApiSuccess('Salary profile detail.', salaryProfileExample)
	@ApiResponse({ status: 404, description: 'SALARY_PROFILE_NOT_FOUND' })
	@ApiErrorExamples()
	async findOne(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.salaryProfiles.findOne(orgId, id);
		return { success: true, data };
	}
}
