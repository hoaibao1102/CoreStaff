import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser, SessionUser, Tenant, requireOrganizationId } from '../../common/tenant-context';
import { ManagerScopeService } from './manager-scope.service';
import { ManagerAssignmentService } from './manager-assignment.service';
import { CreateManagerAssignmentDto, UpdateManagerAssignmentDto } from './dto/manager-assignment.dto';
import { CreateManagerRequestDto, DecideManagerRequestDto } from './dto/manager-request.dto';
import { ManagerRequestService } from './manager-request.service';

@ApiTags('Department Manager')
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class ManagerController {
  constructor(private readonly scope: ManagerScopeService, private readonly assignments: ManagerAssignmentService, private readonly requests: ManagerRequestService) {}
  private org(id: string | null) { return requireOrganizationId(id); }
  private uid(user: SessionUser) { return String(user._id ?? user.id); }

  @Roles('DEPARTMENT_MANAGER') @Get('manager/context')
  async context(@Tenant() org: string | null, @CurrentUser() user: SessionUser) {
    return { success: true, data: await this.scope.getContext(this.org(org), this.uid(user)) };
  }

  @Roles('DEPARTMENT_MANAGER') @Get('manager/employees')
  async employees(@Tenant() org: string | null, @CurrentUser() user: SessionUser, @Query('departmentId') departmentId?: string) {
    return { success: true, data: await this.scope.listEmployees(this.org(org), this.uid(user), departmentId) };
  }

  @Roles('EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR') @Post('requests')
  async createMine(@Tenant() org: string | null, @CurrentUser() user: SessionUser, @Body() dto: CreateManagerRequestDto) {
    return { success: true, data: await this.requests.createMine(this.org(org), this.uid(user), dto) };
  }

  @Roles('EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR') @Get('requests/mine')
  async mine(@Tenant() org: string | null, @CurrentUser() user: SessionUser) {
    return { success: true, data: await this.requests.listMine(this.org(org), this.uid(user)) };
  }

  @Roles('DEPARTMENT_MANAGER') @Get('manager/approvals')
  async approvals(@Tenant() org: string | null, @CurrentUser() user: SessionUser, @Query('type') type?: string, @Query('status') status?: string, @Query('departmentId') departmentId?: string) {
    return { success: true, data: await this.requests.listForManager(this.org(org), this.uid(user), { type, status, departmentId }) };
  }

  @Roles('DEPARTMENT_MANAGER') @Get('manager/approvals/:id')
  async approval(@Tenant() org: string | null, @CurrentUser() user: SessionUser, @Param('id') id: string) {
    return { success: true, data: await this.requests.detail(this.org(org), this.uid(user), id) };
  }

  @Roles('DEPARTMENT_MANAGER') @Post('manager/approvals/:id/approve')
  async approve(@Tenant() org: string | null, @CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: DecideManagerRequestDto) {
    return { success: true, data: await this.requests.decide(this.org(org), this.uid(user), id, 'APPROVED', dto.expectedVersion, dto.reason, dto.approvedStart, dto.approvedEnd) };
  }

  @Roles('DEPARTMENT_MANAGER') @Post('manager/approvals/:id/reject')
  async reject(@Tenant() org: string | null, @CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: DecideManagerRequestDto) {
    return { success: true, data: await this.requests.decide(this.org(org), this.uid(user), id, 'REJECTED', dto.expectedVersion, dto.reason) };
  }

  @Roles('DEPARTMENT_MANAGER') @Post('manager/approvals/:id/request-clarification')
  async clarify(@Tenant() org: string | null, @CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: DecideManagerRequestDto) {
    return { success: true, data: await this.requests.decide(this.org(org), this.uid(user), id, 'CLARIFICATION_REQUESTED', dto.expectedVersion, dto.reason) };
  }

  @Roles('HR') @Get('hr/manager-assignments')
  async list(@Tenant() org: string | null) { return { success: true, data: await this.assignments.list(this.org(org)) }; }

  @Roles('HR') @Get('hr/manager-assignment-candidates')
  async candidates(@Tenant() org: string | null) { return { success: true, data: await this.assignments.listCandidates(this.org(org)) }; }

  @Roles('HR') @Post('hr/manager-assignments')
  async create(@Tenant() org: string | null, @CurrentUser() user: SessionUser, @Body() dto: CreateManagerAssignmentDto) {
    return { success: true, data: await this.assignments.create(this.org(org), this.uid(user), dto) };
  }

  @Roles('HR') @Patch('hr/manager-assignments/:id')
  async update(@Tenant() org: string | null, @Param('id') id: string, @Body() dto: UpdateManagerAssignmentDto) {
    return { success: true, data: await this.assignments.update(this.org(org), id, dto) };
  }

  @Roles('HR') @Patch('hr/manager-assignments/:id/activate')
  async activate(@Tenant() org: string | null, @Param('id') id: string) { return { success: true, data: await this.assignments.setActive(this.org(org), id, true) }; }

  @Roles('HR') @Patch('hr/manager-assignments/:id/deactivate')
  async deactivate(@Tenant() org: string | null, @Param('id') id: string) { return { success: true, data: await this.assignments.setActive(this.org(org), id, false) }; }
}
