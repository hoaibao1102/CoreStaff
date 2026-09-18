import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId } from '../../common/tenant-context';
import { WorkplaceService } from './workplace.service';
import { CreateWorkplaceDto } from './dto/create-workplace.dto';
import { UpdateWorkplaceDto } from './dto/update-workplace.dto';

@ApiTags('HR / Workplaces')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/workplaces')
export class WorkplaceController {
	constructor(private readonly workplaces: WorkplaceService) {}

	@Roles('HR')
	@Post()
	@ApiOperation({ summary: 'Create a workplace (FR-HRCFG-03).' })
	@ApiResponse({ status: 409, description: 'WORKPLACE_CODE_TAKEN' })
	async create(@Tenant() organizationId: string | null, @Body() dto: CreateWorkplaceDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.workplaces.create(orgId, dto);
		return { success: true, data };
	}

	@Get()
	@ApiOperation({ summary: 'List workplaces in the current tenant.' })
	@ApiQuery({ required: false, name: 'active', example: 'true', description: 'Filter by active status' })
	@ApiQuery({ required: false, name: 'search', example: 'HQ', description: 'Search by code, name or address' })
	async findAll(
		@Tenant() organizationId: string | null,
		@Query('active') active?: string,
		@Query('search') search?: string,
	) {
		const orgId = requireOrganizationId(organizationId);
		const filter = active === undefined ? undefined : active === 'true';
		const data = await this.workplaces.findAll(orgId, filter, search);
		return { success: true, data };
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get a workplace by id.' })
	@ApiResponse({ status: 404, description: 'WORKPLACE_NOT_FOUND' })
	async findOne(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.workplaces.findOne(orgId, id);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id')
	@ApiOperation({ summary: 'Update workplace code/name/address.' })
	@ApiResponse({ status: 409, description: 'WORKPLACE_CODE_TAKEN' })
	async update(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Body() dto: UpdateWorkplaceDto,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.workplaces.update(orgId, id, dto);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id/activate')
	@ApiOperation({ summary: 'Reactivate a workplace (soft CRUD).' })
	async activate(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.workplaces.setActive(orgId, id, true);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id/deactivate')
	@ApiOperation({ summary: 'Deactivate a workplace without deleting it (FR-HRCFG-03).' })
	@ApiResponse({ status: 409, description: 'CANNOT_DEACTIVATE_WORKPLACE_IN_USE_BY_ACTIVE_ASSIGNMENTS' })
	async deactivate(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.workplaces.setActive(orgId, id, false);
		return { success: true, data };
	}
}
