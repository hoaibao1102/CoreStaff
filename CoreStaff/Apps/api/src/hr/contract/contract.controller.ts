import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser, SessionUser, Tenant, requireOrganizationId } from '../../common/tenant-context';
import { ApiCreatedSuccess, ApiErrorExamples, ApiSuccess, contractExample } from '../../common/swagger-responses';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';

/** TASK-028, route per SRS §30G ("/hr/contracts"). HR only — §3.2 "Quản lý hồ sơ/hợp đồng". */
@ApiTags('HR / Contracts')
@UseGuards(AuthGuard, RolesGuard)
@Roles('HR')
@Controller('hr/contracts')
export class ContractController {
	constructor(private readonly contracts: ContractService) {}

	@Post()
	@ApiOperation({ summary: 'Create an employment contract period (TASK-028). Never updated in place; renewals are a new row.' })
	@ApiCreatedSuccess('Contract created.', contractExample)
	@ApiResponse({ status: 404, description: 'EMPLOYEE_PROFILE_NOT_FOUND' })
	@ApiResponse({ status: 409, description: 'CONTRACT_DATE_RANGE_INVALID | CONTRACT_PERIOD_OVERLAPS' })
	@ApiErrorExamples()
	async create(@Tenant() organizationId: string | null, @CurrentUser() user: SessionUser, @Body() dto: CreateContractDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.contracts.create(orgId, String(user._id ?? user.id), dto);
		return { success: true, data };
	}

	@Get()
	@ApiOperation({ summary: 'List contracts in the tenant, optionally filtered by employeeId.' })
	@ApiSuccess('Contracts.', [contractExample])
	@ApiErrorExamples()
	async findAll(@Tenant() organizationId: string | null, @Query('employeeId') employeeId?: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.contracts.findAll(orgId, employeeId);
		return { success: true, data };
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get a contract by id.' })
	@ApiSuccess('Contract detail.', contractExample)
	@ApiResponse({ status: 404, description: 'CONTRACT_NOT_FOUND' })
	@ApiErrorExamples()
	async findOne(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.contracts.findOne(orgId, id);
		return { success: true, data };
	}
}
