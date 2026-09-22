import { Body, BadRequestException, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId } from '../../common/tenant-context';
import { AssignmentService } from './assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@ApiTags('HR / Assignments')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/assignments')
export class AssignmentController {
	constructor(private readonly assignments: AssignmentService) {}

	@Roles('HR')
	@Post()
	@ApiOperation({ summary: 'Assign one or more users to a department/workplace (FR-HRCFG-04). Supports both employee and manager roles.' })
	@ApiResponse({ status: 201, description: 'Assignment(s) created successfully.' })
	@ApiResponse({ status: 409, description: 'OVERLAPPING_ASSIGNMENT_EXISTS' })
	@ApiResponse({ status: 404, description: 'WORKPLACE_NOT_FOUND_OR_NOT_IN_TENANT or USER_NOT_FOUND_IN_TENANT' })
	async create(
		@Tenant() organizationId: string | null,
		@Body() dto: CreateAssignmentDto,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.assignments.create(orgId, null, dto);
		return { success: true, data, count: data.length };
	}

	@Get()
	@ApiOperation({ summary: 'List assignments in the current tenant.' })
	async findAll(
		@Tenant() organizationId: string | null,
		@Query('workplaceId') workplaceId?: string,
		@Query('active') active?: string,
	) {
		const orgId = requireOrganizationId(organizationId);

		// workplaceId or active is required
		if (!workplaceId && active === undefined) {
			throw new BadRequestException('AT_LEAST_ONE_FILTER_REQUIRED — Provide workplaceId or active.');
		}

		const filter = active === undefined ? undefined : active === 'true';
		const data = await this.assignments.findAll(orgId, undefined, undefined, workplaceId, filter);
		return { success: true, data };
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get an assignment by id.' })
	@ApiResponse({ status: 404, description: 'ASSIGNMENT_NOT_FOUND' })
	async findOne(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.assignments.findOne(orgId, id);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id')
	@ApiOperation({ summary: 'Update assignment details.' })
	@ApiBody({
		schema: {
			example: {
				userId: '6aaaf2ca90ecc13ff3ac8c18',
				departmentId: '6aaaf2cb90ecc13ff3ac8c30',
				workplaceId: '6aab7089d5eee41a9108945e',
				effectiveFrom: '2026-01-01',
				effectiveTo: '2027-01-01',
			},
		},
	})
	@ApiResponse({ status: 409, description: 'OVERLAPPING_ASSIGNMENT_EXISTS' })
	@ApiResponse({ status: 404, description: 'ASSIGNMENT_NOT_FOUND or referenced entity not found' })
	async update(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Body() dto: UpdateAssignmentDto,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.assignments.update(orgId, id, dto);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id/activate')
	@ApiOperation({ summary: 'Reactivate an assignment (soft CRUD).' })
	async activate(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.assignments.setActive(orgId, id, true);
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id/deactivate')
	@ApiOperation({ summary: 'Deactivate an assignment without deleting it (FR-HRCFG-04).' })
	async deactivate(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.assignments.setActive(orgId, id, false);
		return { success: true, data };
	}
}
