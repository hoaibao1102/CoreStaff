import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser, SessionUser, Tenant, requireOrganizationId } from '../../common/tenant-context';
import { ApiCreatedSuccess, ApiErrorExamples, ApiSuccess, insuranceProfileExample } from '../../common/swagger-responses';
import { InsuranceProfileService } from './insurance-profile.service';
import { CreateInsuranceProfileDto } from './dto/create-insurance-profile.dto';

/**
 * TASK-038. Route path is an engineering proposal — the SRS route table
 * (§30G) never lists InsuranceProfile explicitly, only InsurancePolicy
 * (`/hr/policies/insurance`). Named to mirror `/hr/salary-profiles`.
 */
@ApiTags('HR / Insurance Profiles')
@UseGuards(AuthGuard, RolesGuard)
@Roles('HR')
@Controller('hr/insurance-profiles')
export class InsuranceProfileController {
	constructor(private readonly insuranceProfiles: InsuranceProfileService) {}

	@Post()
	@ApiOperation({ summary: 'Create an insurance participation period (TASK-038). Never updated in place; corrections are a new version.' })
	@ApiCreatedSuccess('Insurance profile created.', insuranceProfileExample)
	@ApiResponse({ status: 404, description: 'EMPLOYEE_PROFILE_NOT_FOUND' })
	@ApiResponse({ status: 409, description: 'INSURANCE_PROFILE_DATE_RANGE_INVALID | INSURANCE_PROFILE_PERIOD_OVERLAPS' })
	@ApiErrorExamples()
	async create(@Tenant() organizationId: string | null, @CurrentUser() user: SessionUser, @Body() dto: CreateInsuranceProfileDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.insuranceProfiles.create(orgId, String(user._id ?? user.id), dto);
		return { success: true, data };
	}

	@Get()
	@ApiOperation({ summary: 'List insurance profiles in the tenant, optionally filtered by employeeId.' })
	@ApiSuccess('Insurance profiles.', [insuranceProfileExample])
	@ApiErrorExamples()
	async findAll(@Tenant() organizationId: string | null, @Query('employeeId') employeeId?: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.insuranceProfiles.findAll(orgId, employeeId);
		return { success: true, data };
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get an insurance profile by id.' })
	@ApiSuccess('Insurance profile detail.', insuranceProfileExample)
	@ApiResponse({ status: 404, description: 'INSURANCE_PROFILE_NOT_FOUND' })
	@ApiErrorExamples()
	async findOne(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.insuranceProfiles.findOne(orgId, id);
		return { success: true, data };
	}
}
