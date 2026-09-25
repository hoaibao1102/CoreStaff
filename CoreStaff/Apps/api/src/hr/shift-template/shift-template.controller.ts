import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId } from '../../common/tenant-context';
import { ShiftTemplateService } from './shift-template.service';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';
import { ShiftScope } from '../../database/schemas/enums';

@ApiTags('HR / Shift Templates')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/shift-templates')
export class ShiftTemplateController {
	constructor(private readonly shiftTemplates: ShiftTemplateService) {}

	@Roles('HR')
	@Post()
	@ApiOperation({ summary: 'Create a company-wide or department shift with its recurring weekdays.' })
	async create(
		@Tenant() organizationId: string | null,
		@Body() dto: CreateShiftTemplateDto,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.shiftTemplates.create(orgId, dto);
		return { success: true, data };
	}

	@Get()
	@ApiOperation({ summary: 'List shift templates in the current tenant.' })
	async findAll(
		@Tenant() organizationId: string | null,
		@Query('scope') scope?: ShiftScope,
		@Query('departmentId') departmentId?: string,
		@Query('active') active?: string,
	) {
		const orgId = requireOrganizationId(organizationId);
		const filter = active === undefined ? undefined : active === 'true';
		const data = await this.shiftTemplates.findAll(orgId, scope, departmentId, filter);
		return { success: true, data };
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get a shift template by id.' })
	@ApiResponse({ status: 404, description: 'SHIFT_TEMPLATE_NOT_FOUND' })
	async findOne(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.shiftTemplates.findOne(orgId, id);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id')
	@ApiOperation({ summary: 'Update shift template and recurring schedule.' })
	async update(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Body() dto: UpdateShiftTemplateDto,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.shiftTemplates.update(orgId, id, dto);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id/activate')
	@ApiOperation({ summary: 'Reactivate a shift template (soft CRUD).' })
	async activate(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.shiftTemplates.setActive(orgId, id, true);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id/deactivate')
	@ApiOperation({ summary: 'Deactivate a shift template without deleting it (FR-SCH-01).' })
	@ApiResponse({ status: 409, description: 'CANNOT_DEACTIVATE_SHIFT_IN_USE_BY_ACTIVE_ASSIGNMENTS' })
	async deactivate(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.shiftTemplates.setActive(orgId, id, false);
		return { success: true, data };
	}

	@Roles('HR')
	@Delete(':id')
	@ApiOperation({ summary: 'Permanently delete an unused shift template.' })
	@ApiResponse({ status: 409, description: 'SHIFT_TEMPLATE_IN_USE' })
	async remove(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		await this.shiftTemplates.remove(orgId, id);
		return { success: true, data: { id } };
	}
}
