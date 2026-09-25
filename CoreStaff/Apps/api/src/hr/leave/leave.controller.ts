import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId } from '../../common/tenant-context';
import { DayClassificationService } from './day-classification.service';
import { CreateLeaveRequestDto, LeaveRequestQueryDto, RebuildClassificationDto, RejectLeaveRequestDto } from './dto/leave.dto';
import { LeaveService } from './leave.service';

@UseGuards(AuthGuard, RolesGuard)
@Controller('leave-requests')
export class EmployeeLeaveController {
  constructor(private readonly leave: LeaveService) {}
  @Roles('EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR') @Post()
  async create(@Tenant() org: string | null, @Req() req: any, @Body() dto: CreateLeaveRequestDto) { return { success: true, data: await this.leave.create(requireOrganizationId(org), String(req.user._id), dto) }; }
  @Roles('EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR') @Get('mine')
  async mine(@Tenant() org: string | null, @Req() req: any) { return { success: true, data: await this.leave.mine(requireOrganizationId(org), String(req.user._id)) }; }
  @Roles('EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR') @Get('mine/:id')
  async one(@Tenant() org: string | null, @Req() req: any, @Param('id') id: string) { return { success: true, data: await this.leave.getMine(requireOrganizationId(org), String(req.user._id), id) }; }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('DEPARTMENT_MANAGER')
@Controller('manager/leave-requests')
export class ManagerLeaveController {
  constructor(private readonly leave: LeaveService) {}
  @Get() async list(@Tenant() org: string | null, @Req() req: any, @Query() query: LeaveRequestQueryDto) { return { success: true, data: await this.leave.managerQueue(requireOrganizationId(org), String(req.user._id), query) }; }
  @Post(':id/approve') async approve(@Tenant() org: string | null, @Req() req: any, @Param('id') id: string) { return { success: true, data: await this.leave.managerDecision(requireOrganizationId(org), String(req.user._id), id, true) }; }
  @Post(':id/reject') async reject(@Tenant() org: string | null, @Req() req: any, @Param('id') id: string, @Body() dto: RejectLeaveRequestDto) { return { success: true, data: await this.leave.managerDecision(requireOrganizationId(org), String(req.user._id), id, false, dto.reason) }; }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('HR')
@Controller('hr')
export class HrLeaveController {
  constructor(private readonly leave: LeaveService, private readonly classification: DayClassificationService) {}
  @Get('leave-requests') async list(@Tenant() org: string | null, @Query() query: LeaveRequestQueryDto) { return { success: true, data: await this.leave.hrQueue(requireOrganizationId(org), query) }; }
  @Post('leave-requests/:id/apply') async apply(@Tenant() org: string | null, @Req() req: any, @Param('id') id: string) { return { success: true, data: await this.leave.apply(requireOrganizationId(org), String(req.user._id), id) }; }
  @Get('employee-day-overrides') async overrides(@Tenant() org: string | null, @Query('employeeId') employeeId?: string, @Query('from') from?: string, @Query('to') to?: string) { return { success: true, data: await this.leave.listOverrides(requireOrganizationId(org), employeeId, from, to) }; }
  @Post('day-classifications/rebuild') async rebuild(@Tenant() org: string | null, @Body() dto: RebuildClassificationDto) { return { success: true, data: await this.classification.rebuild(requireOrganizationId(org), dto.from, dto.to, dto.employeeId) }; }
}

