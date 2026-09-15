import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId } from '../../common/tenant-context';
import { ApiCreatedSuccess, ApiErrorExamples, ApiSuccess, positionExample } from '../../common/swagger-responses';
import { PositionService } from './position.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

@ApiTags('HR / Positions')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/positions')
export class PositionController {
	constructor(private readonly positions: PositionService) {}

	@Roles('HR')
	@Post()
	@ApiOperation({ summary: 'Create a position (TASK-022).' })
	@ApiCreatedSuccess('Position created.', positionExample)
	@ApiResponse({ status: 409, description: 'POSITION_CODE_TAKEN' })
	@ApiErrorExamples()
	async create(@Tenant() organizationId: string | null, @Body() dto: CreatePositionDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.positions.create(orgId, dto);
		return { success: true, data };
	}

	@Get()
	@ApiOperation({ summary: 'List positions in the current tenant.' })
	@ApiSuccess('Positions in the current tenant.', [positionExample])
	@ApiErrorExamples()
	async findAll(@Tenant() organizationId: string | null, @Query('active') active?: string) {
		const orgId = requireOrganizationId(organizationId);
		const filter = active === undefined ? undefined : active === 'true';
		const data = await this.positions.findAll(orgId, filter);
		return { success: true, data };
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get a position by id.' })
	@ApiSuccess('Position detail.', positionExample)
	@ApiResponse({ status: 404, description: 'POSITION_NOT_FOUND' })
	@ApiErrorExamples()
	async findOne(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.positions.findOne(orgId, id);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id')
	@ApiOperation({ summary: 'Update position code/name.' })
	@ApiSuccess('Position updated.', positionExample)
	@ApiResponse({ status: 409, description: 'POSITION_CODE_TAKEN' })
	@ApiErrorExamples()
	async update(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Body() dto: UpdatePositionDto,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.positions.update(orgId, id, dto);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id/activate')
	@ApiOperation({ summary: 'Reactivate a position (soft CRUD).' })
	@ApiSuccess('Position activated.', { ...positionExample, active: true })
	@ApiErrorExamples()
	async activate(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.positions.setActive(orgId, id, true);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id/deactivate')
	@ApiOperation({ summary: 'Deactivate a position without deleting it.' })
	@ApiSuccess('Position deactivated.', { ...positionExample, active: false })
	@ApiErrorExamples()
	async deactivate(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.positions.setActive(orgId, id, false);
		return { success: true, data };
	}
}
