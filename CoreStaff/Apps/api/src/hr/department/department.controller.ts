import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId } from '../../common/tenant-context';
import { ApiCreatedSuccess, ApiErrorExamples, ApiSuccess, departmentExample } from '../../common/swagger-responses';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('HR / Departments')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/departments')
export class DepartmentController {
	constructor(private readonly departments: DepartmentService) {}

	@Roles('HR')
	@Post()
	@ApiOperation({ summary: 'Create a department (FR-HRCFG-01).' })
	@ApiCreatedSuccess('Department created.', departmentExample)
	@ApiResponse({ status: 409, description: 'DEPARTMENT_CODE_TAKEN' })
	@ApiErrorExamples()
	async create(@Tenant() organizationId: string | null, @Body() dto: CreateDepartmentDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.departments.create(orgId, dto);
		return { success: true, data };
	}

	@Get()
	@ApiOperation({ summary: 'List departments in the current tenant.' })
	@ApiSuccess('Departments in the current tenant.', [departmentExample])
	@ApiErrorExamples()
	async findAll(@Tenant() organizationId: string | null, @Query('active') active?: string) {
		const orgId = requireOrganizationId(organizationId);
		const filter = active === undefined ? undefined : active === 'true';
		const data = await this.departments.findAll(orgId, filter);
		return { success: true, data };
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get a department by id.' })
	@ApiSuccess('Department detail.', departmentExample)
	@ApiResponse({ status: 404, description: 'DEPARTMENT_NOT_FOUND' })
	@ApiErrorExamples()
	async findOne(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.departments.findOne(orgId, id);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id')
	@ApiOperation({ summary: 'Update department code/name.' })
	@ApiSuccess('Department updated.', departmentExample)
	@ApiResponse({ status: 409, description: 'DEPARTMENT_CODE_TAKEN' })
	@ApiErrorExamples()
	async update(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Body() dto: UpdateDepartmentDto,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.departments.update(orgId, id, dto);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id/activate')
	@ApiOperation({ summary: 'Reactivate a department (soft CRUD).' })
	@ApiSuccess('Department activated.', { ...departmentExample, active: true })
	@ApiErrorExamples()
	async activate(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.departments.setActive(orgId, id, true);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id/deactivate')
	@ApiOperation({ summary: 'Deactivate a department without deleting it (FR-HRCFG-03).' })
	@ApiSuccess('Department deactivated.', { ...departmentExample, active: false })
	@ApiErrorExamples()
	async deactivate(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.departments.setActive(orgId, id, false);
		return { success: true, data };
	}
}
