import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId } from '../../common/tenant-context';
import { TaxPolicyService } from './tax-policy.service';
import { CreateTaxPolicyDto } from '../policies/dto/create-tax-policy.dto';
import { UpdateTaxPolicyDto } from '../policies/dto/update-tax-policy.dto';

class CalculatePitDto {
	@IsNumber()
	grossIncome: number;

	@IsNumber()
	dependentCount: number;

	@IsNumber()
	insuranceContributions: number;

	@IsOptional()
	@IsString()
	period?: string;
}

/**
 * TASK-041 — TaxPolicy REST controller.
 *
 * Endpoints:
 * - GET /hr/policies/tax — List all tax policies (tenant-scoped)
 * - POST /hr/policies/tax — Create new tax policy version
 * - PATCH /hr/policies/tax/:id — Update (creates new version)
 * - GET /hr/policies/tax/effective?org=...&at=YYYY-MM-DD — Get effective policy
 * - POST /hr/policies/tax/calculate — Preview PIT
 */
@ApiTags('HR — Tax Policy')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/policies/tax')
export class TaxPolicyController {
	constructor(private readonly taxPolicyService: TaxPolicyService) {}

	@Roles('HR', 'DEPARTMENT_MANAGER')
	@Get()
	@ApiOperation({ summary: 'List tax policies (tenant-scoped).' })
	async list(@Tenant() organizationId: string | null) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.taxPolicyService.list(orgId);
		return { success: true, data };
	}

	@Roles('HR')
	@Post()
	@ApiOperation({ summary: 'Create a new tax policy version.' })
	async create(@Tenant() organizationId: string | null, @Body() dto: CreateTaxPolicyDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.taxPolicyService.create(orgId, dto);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id')
	@ApiOperation({ summary: 'Update a tax policy (version++).' })
	async update(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Body() dto: UpdateTaxPolicyDto,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.taxPolicyService.update(orgId, id, dto);
		return { success: true, data };
	}

	/**
	 * GET /hr/policies/tax/effective?org=...&at=YYYY-MM-DD
	 * `org` is accepted for API symmetry with the spec but the tenant is
	 * actually read from the session (BR-TENANT-01). `at` (ISO date) selects
	 * the policy version in effect at that instant.
	 */
	@Roles('HR', 'DEPARTMENT_MANAGER')
	@Get('effective')
	@ApiOperation({ summary: 'Effective tax policy at a given date for the tenant.' })
	async effectiveAt(
		@Tenant() organizationId: string | null,
		@Query('at') at?: string,
		@Query('org') _org?: string,
	) {
		const orgId = requireOrganizationId(organizationId);
		const targetDate = at ?? new Date().toISOString();
		const data = await this.taxPolicyService.effectiveAt(orgId, targetDate);
		return { success: true, data };
	}

	@Roles('HR', 'DEPARTMENT_MANAGER')
	@Post('calculate')
	@HttpCode(200)
	@ApiOperation({ summary: 'Preview PIT calculation for the effective policy.' })
	async calculate(
		@Tenant() organizationId: string | null,
		@Body() dto: CalculatePitDto,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.taxPolicyService.calculate(orgId, dto);
		return { success: true, data };
	}
}