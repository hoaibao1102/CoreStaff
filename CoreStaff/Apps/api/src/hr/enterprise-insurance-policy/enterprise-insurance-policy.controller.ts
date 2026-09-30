import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser, SessionUser, Tenant, requireOrganizationId } from '../../common/tenant-context';
import { ApiCreatedSuccess, ApiErrorExamples, ApiSuccess, enterpriseInsurancePolicyExample } from '../../common/swagger-responses';
import { EnterpriseInsurancePolicyService } from './enterprise-insurance-policy.service';
import { CreateEnterpriseInsurancePolicyDto } from './dto/create-enterprise-insurance-policy.dto';
import { CloseEnterpriseInsurancePolicyDto } from './dto/close-enterprise-insurance-policy.dto';

/**
 * New module (D40, 2026-09-28). Route sits alongside `/hr/policies/insurance`
 * (TASK-039) in the `/hr/policies/*` group but is a separate, voluntary
 * commercial policy — see schema header for why it is not merged into
 * InsurancePolicy. HR only.
 */
@ApiTags('HR / Enterprise Insurance Policy')
@UseGuards(AuthGuard, RolesGuard)
@Roles('HR')
@Controller('hr/policies/enterprise-insurance')
export class EnterpriseInsurancePolicyController {
	constructor(private readonly enterpriseInsurancePolicies: EnterpriseInsurancePolicyService) {}

	@Post()
	@ApiOperation({ summary: 'Create an enterprise (voluntary commercial) insurance policy version. Never updated in place; corrections are a new version.' })
	@ApiCreatedSuccess('Enterprise insurance policy created.', enterpriseInsurancePolicyExample)
	@ApiResponse({ status: 400, description: 'ENTERPRISE_INSURANCE_EMPLOYEE_CONTRIBUTION_NOT_ALLOWED' })
	@ApiResponse({ status: 409, description: 'ENTERPRISE_INSURANCE_POLICY_DATE_RANGE_INVALID | ENTERPRISE_INSURANCE_POLICY_PERIOD_OVERLAPS' })
	@ApiErrorExamples()
	async create(@Tenant() organizationId: string | null, @CurrentUser() user: SessionUser, @Body() dto: CreateEnterpriseInsurancePolicyDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.enterpriseInsurancePolicies.create(orgId, String(user._id ?? user.id), dto);
		return { success: true, data };
	}

	@Get()
	@ApiOperation({ summary: 'List enterprise insurance policy versions in the tenant.' })
	@ApiSuccess('Enterprise insurance policies.', [enterpriseInsurancePolicyExample])
	@ApiErrorExamples()
	async findAll(@Tenant() organizationId: string | null) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.enterpriseInsurancePolicies.findAll(orgId);
		return { success: true, data };
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get an enterprise insurance policy version by id.' })
	@ApiSuccess('Enterprise insurance policy detail.', enterpriseInsurancePolicyExample)
	@ApiResponse({ status: 404, description: 'ENTERPRISE_INSURANCE_POLICY_NOT_FOUND' })
	@ApiErrorExamples()
	async findOne(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.enterpriseInsurancePolicies.findOne(orgId, id);
		return { success: true, data };
	}

	@Patch(':id/close')
	@ApiOperation({ summary: 'D42: close an open-ended enterprise insurance policy (set effectiveTo) so a next version can be created. The only allowed mutation on an existing policy.' })
	@ApiSuccess('Enterprise insurance policy closed.', enterpriseInsurancePolicyExample)
	@ApiResponse({ status: 404, description: 'ENTERPRISE_INSURANCE_POLICY_NOT_FOUND' })
	@ApiResponse({ status: 409, description: 'ENTERPRISE_INSURANCE_POLICY_ALREADY_CLOSED | ENTERPRISE_INSURANCE_POLICY_DATE_RANGE_INVALID' })
	@ApiErrorExamples()
	async close(@Tenant() organizationId: string | null, @Param('id') id: string, @Body() dto: CloseEnterpriseInsurancePolicyDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.enterpriseInsurancePolicies.close(orgId, id, dto.effectiveTo);
		return { success: true, data };
	}
}
