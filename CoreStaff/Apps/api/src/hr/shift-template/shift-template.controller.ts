import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId } from '../../common/tenant-context';
import { ShiftTemplateService } from './shift-template.service';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';

@ApiTags('HR / Shift Templates')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/shift-templates')
export class ShiftTemplateController {
	constructor(private readonly shiftTemplates: ShiftTemplateService) {}

	@Roles('HR')
	@Post()
	@ApiOperation({ summary: 'Create a shift template for a workplace (FR-SCH-01). One per workplace.' })
	@ApiResponse({ status: 409, description: 'SHIFT_START_TIME_MUST_BE_BEFORE_END or SHIFT_TEMPLATE_ALREADY_EXISTS_FOR_WORKPLACE or CANNOT_CREATE_SHIFT_FOR_INACTIVE_WORKPLACE' })
	@ApiResponse({ status: 404, description: 'WORKPLACE_NOT_FOUND_OR_NOT_IN_TENANT' })
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
		@Query('workplaceId') workplaceId?: string,
		@Query('active') active?: string,
	) {
		const orgId = requireOrganizationId(organizationId);
		const filter = active === undefined ? undefined : active === 'true';
		const data = await this.shiftTemplates.findAll(orgId, workplaceId, filter);
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
	@ApiOperation({ summary: 'Update shift template times/workplace.' })
	@ApiResponse({ status: 409, description: 'SHIFT_START_TIME_MUST_BE_BEFORE_END or SHIFT_TEMPLATE_ALREADY_EXISTS_FOR_WORKPLACE' })
	@ApiResponse({ status: 404, description: 'WORKPLACE_NOT_FOUND_OR_NOT_IN_TENANT' })
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
}
