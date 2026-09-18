import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId } from '../../common/tenant-context';
import {
  ApiCreatedSuccess,
  ApiErrorExamples,
  ApiSuccess,
  contractExample,
  contractReadExample,
} from '../../common/swagger-responses';
import { EmploymentContractService } from './employment-contract.service';
import { CreateEmploymentContractDto } from './dto/create-employment-contract.dto';
import { UpdateEmploymentContractDto } from './dto/update-employment-contract.dto';
import { UpdateContractStatusDto } from './dto/update-contract-status.dto';

@ApiTags('HR / Contracts')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/contracts')
export class EmploymentContractController {
	constructor(private readonly contracts: EmploymentContractService) {}

	@Roles('HR')
	@Post()
	@ApiOperation({ summary: 'Create an employment contract (starts DRAFT). (TASK-028)' })
	@ApiCreatedSuccess('Employment contract created.', contractReadExample)
	@ApiResponse({ status: 400, description: 'CONTRACT_EXPIRY_REQUIRED | CONTRACT_INDEFINITE_TERM_NO_EXPIRY | CONTRACT_EXPIRY_BEFORE_EFFECTIVE' })
	@ApiResponse({ status: 404, description: 'EMPLOYEE_PROFILE_NOT_FOUND' })
	@ApiErrorExamples()
	async create(@Tenant() organizationId: string | null, @Body() dto: CreateEmploymentContractDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.contracts.create(orgId, dto);
		return { success: true, data };
	}

	@Roles('HR')
	@Get()
	@ApiOperation({ summary: 'List contracts in the current tenant.' })
	@ApiSuccess('Employment contracts in the current tenant.', [contractReadExample])
	@ApiErrorExamples()
	async findAll(
		@Tenant() organizationId: string | null,
		@Query('employeeId') employeeId?: string,
		@Query('status') status?: string,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.contracts.findAll(orgId, { employeeId, status });
		return { success: true, data };
	}

	@Roles('HR')
	@Get('compliance')
	@ApiOperation({
		summary: 'Contract-compliance findings for working employees.',
		description:
			'Read-only: NO_CONTRACT / EXPIRED_NOT_RENEWED / ACTIVE_PAST_EXPIRY / PROBATION_OVERDUE. Never mutates employee or contract status — an expired contract plus a still-working employee is a legal state under BLLĐ 2019 §20.2 that HR must resolve deliberately.',
	})
	@ApiSuccess('Compliance findings.', [])
	@ApiErrorExamples()
	async compliance(@Tenant() organizationId: string | null) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.contracts.findCompliance(orgId);
		return { success: true, data };
	}

	@Roles('HR')
	@Get('at')
	@ApiOperation({
		summary: 'Contract in effect for an employee on a given date (date-window match).',
		description:
			'Reference for payroll/severance: returns the ACTIVE or EXPIRED contract whose effectiveDate <= asOf < expiryDate, not the newest row. 204 when none covers that day.',
	})
	@ApiResponse({ status: 200, description: 'The governing contract.', schema: { example: contractReadExample } })
	@ApiResponse({ status: 204, description: 'No contract governs that date.' })
	@ApiErrorExamples()
	async contractAt(
		@Tenant() organizationId: string | null,
		@Query('employeeId') employeeId: string,
		@Query('asOf') asOf: string,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.contracts.findContractAt(orgId, employeeId, new Date(asOf));
		if (!data) return null;
		return { success: true, data };
	}

	@Roles('HR')
	@Get(':id')
	@ApiOperation({ summary: 'Get an employment contract by id.' })
	@ApiSuccess('Employment contract detail.', contractReadExample)
	@ApiResponse({ status: 404, description: 'EMPLOYMENT_CONTRACT_NOT_FOUND' })
	@ApiErrorExamples()
	async findOne(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.contracts.findOne(orgId, id);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id')
	@ApiOperation({ summary: 'Update mutable contract dates/note. employeeId, contractType and status are immutable here.' })
	@ApiSuccess('Employment contract updated.', contractReadExample)
	@ApiResponse({ status: 400, description: 'CONTRACT_EXPIRY_BEFORE_EFFECTIVE | CONTRACT_INDEFINITE_TERM_NO_EXPIRY | CONTRACT_EXPIRY_REQUIRED' })
	@ApiResponse({ status: 404, description: 'EMPLOYMENT_CONTRACT_NOT_FOUND' })
	@ApiErrorExamples()
	async update(@Tenant() organizationId: string | null, @Param('id') id: string, @Body() dto: UpdateEmploymentContractDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.contracts.update(orgId, id, dto);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id/status')
	@ApiOperation({
		summary: 'Transition contract status (TASK-030).',
		description:
			'DRAFT→ACTIVE|TERMINATED, ACTIVE→TERMINATED|EXPIRED, EXPIRED→ACTIVE (renewal — requires new dates), TERMINATED is terminal.',
	})
	@ApiSuccess('Employment contract status changed.', contractReadExample)
	@ApiResponse({ status: 400, description: 'CONTRACT_TERMINATION_DATE_REQUIRED | CONTRACT_RENEWAL_DATES_REQUIRED' })
	@ApiResponse({ status: 404, description: 'EMPLOYMENT_CONTRACT_NOT_FOUND' })
	@ApiResponse({ status: 409, description: 'EMPLOYMENT_CONTRACT_STATUS_TRANSITION_INVALID' })
	@ApiErrorExamples()
	async changeStatus(@Tenant() organizationId: string | null, @Param('id') id: string, @Body() dto: UpdateContractStatusDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.contracts.changeStatus(orgId, id, dto);
		return { success: true, data };
	}
}