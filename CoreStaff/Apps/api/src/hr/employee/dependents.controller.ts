import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId } from '../../common/tenant-context';
import { ApiErrorExamples, ApiSuccess } from '../../common/swagger-responses';
import { EmployeeService } from './employee.service';
import { UpdateDependentDto } from './dto/update-dependent.dto';

@ApiTags('HR / Dependents')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/dependents')
export class DependentsController {
	constructor(private readonly employees: EmployeeService) {}

	@Roles('HR')
	@Get(':id')
	@ApiOperation({ summary: 'Get a dependent by id (tenant-scoped).' })
	@ApiSuccess('Dependent detail.', [])
	@ApiResponse({ status: 404, description: 'DEPENDENT_NOT_FOUND' })
	@ApiErrorExamples()
	async getOne(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const data = await this.employees.getDependentById(requireOrganizationId(organizationId), id);
		return { success: true, data };
	}

	@Roles('HR')
	@Put(':id')
	@ApiOperation({ summary: 'Update a dependent (version++).' })
	@ApiSuccess('Dependent updated.', [])
	@ApiResponse({ status: 400, description: 'DOB_FUTURE_DATE | VALIDATION_ERROR' })
	@ApiResponse({ status: 404, description: 'DEPENDENT_NOT_FOUND' })
	@ApiErrorExamples()
	async update(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Body() dto: UpdateDependentDto,
	) {
		const data = await this.employees.updateDependentById(requireOrganizationId(organizationId), id, dto);
		return { success: true, data };
	}

	@Roles('HR')
	@Delete(':id')
	@ApiOperation({ summary: 'Deactivate a dependent (soft-delete).' })
	@ApiSuccess('Dependent deactivated.', [])
	@ApiResponse({ status: 404, description: 'DEPENDENT_NOT_FOUND' })
	@ApiErrorExamples()
	async deactivate(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const data = await this.employees.deactivateDependentById(requireOrganizationId(organizationId), id);
		return { success: true, data };
	}
}
