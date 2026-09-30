import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser, SessionUser, Tenant, requireOrganizationId } from '../../common/tenant-context';
import { TaxPolicyService } from './tax-policy.service';
import { CreateTaxPolicyDto } from '../policies/dto/create-tax-policy.dto';
import { UpdateTaxPolicyDto } from '../policies/dto/update-tax-policy.dto';

/**
 * TASK-041 — TaxPolicy REST controller.
 * 
 * Endpoints:
 * - GET /hr/policies/tax — List all tax policies
 * - POST /hr/policies/tax — Create new tax policy version
 * - PATCH /hr/policies/tax/:id — Update (creates new version)
 * - GET /hr/policies/tax/effective — Get effective policy at date
 */
@ApiTags('HR — Tax Policy')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/policies/tax')
export class TaxPolicyController {
	constructor(private readonly taxPolicyService: TaxPolicyService) {}

	@Roles('HR', 'DEPARTMENT_MANAGER')
	@Get()
	async list(@Tenant() organizationId: string | null) {
		const orgId = requireOrganizationId(organizationId);
		return this.taxPolicyService.list(orgId);
	}

	@Roles('HR')
	@Post()
	async create(@Tenant() organizationId: string | null, @Body() dto: CreateTaxPolicyDto) {
		const orgId = requireOrganizationId(organizationId);
		return this.taxPolicyService.create(orgId, dto);
	}

	@Roles('HR')
	@Patch(':id')
	async update(@Tenant() organizationId: string | null, @Param('id') id: string, @Body() dto: UpdateTaxPolicyDto) {
		const orgId = requireOrganizationId(organizationId);
		return this.taxPolicyService.update(orgId, id, dto);
	}

	@Roles('HR', 'DEPARTMENT_MANAGER')
	@Get('effective')
	async effectiveAt(@Tenant() organizationId: string | null, @Query('date') date?: string) {
		const orgId = requireOrganizationId(organizationId);
		const targetDate = date ?? new Date().toISOString();
		return this.taxPolicyService.effectiveAt(orgId, targetDate);
	}
}
