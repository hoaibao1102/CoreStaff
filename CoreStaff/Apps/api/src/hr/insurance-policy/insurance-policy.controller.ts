import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser, SessionUser, Tenant, requireOrganizationId } from '../../common/tenant-context';
import { ApiCreatedSuccess, ApiErrorExamples, ApiSuccess, insurancePolicyExample } from '../../common/swagger-responses';
import { InsurancePolicyService } from './insurance-policy.service';
import { CreateInsurancePolicyDto } from './dto/create-insurance-policy.dto';

/** TASK-039, route per SRS §30G ("/hr/policies/insurance"). HR only. */
@ApiTags('HR / Insurance Policy')
@UseGuards(AuthGuard, RolesGuard)
@Roles('HR')
@Controller('hr/policies/insurance')
export class InsurancePolicyController {
	constructor(private readonly insurancePolicies: InsurancePolicyService) {}

	@Post()
	@ApiOperation({ summary: 'Create an insurance policy version (TASK-039). Never updated in place; corrections are a new version.' })
	@ApiCreatedSuccess('Insurance policy created.', insurancePolicyExample)
	@ApiResponse({ status: 400, description: 'SALARYBASERULES_MUST_COVER_ALL_TYPES | CAPRULES_MUST_COVER_ALL_TYPES | EMPLOYERCONTRIBUTIONRATES_MUST_COVER_ALL_TYPES | INSURANCE_POLICY_FLOOR_ABOVE_CAP' })
	@ApiResponse({ status: 409, description: 'INSURANCE_POLICY_DATE_RANGE_INVALID | INSURANCE_POLICY_PERIOD_OVERLAPS' })
	@ApiErrorExamples()
	async create(@Tenant() organizationId: string | null, @CurrentUser() user: SessionUser, @Body() dto: CreateInsurancePolicyDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.insurancePolicies.create(orgId, String(user._id ?? user.id), dto);
		return { success: true, data };
	}

	@Get()
	@ApiOperation({ summary: 'List insurance policy versions in the tenant.' })
	@ApiSuccess('Insurance policies.', [insurancePolicyExample])
	@ApiErrorExamples()
	async findAll(@Tenant() organizationId: string | null) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.insurancePolicies.findAll(orgId);
		return { success: true, data };
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get an insurance policy version by id.' })
	@ApiSuccess('Insurance policy detail.', insurancePolicyExample)
	@ApiResponse({ status: 404, description: 'INSURANCE_POLICY_NOT_FOUND' })
	@ApiErrorExamples()
	async findOne(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.insurancePolicies.findOne(orgId, id);
		return { success: true, data };
	}
}
