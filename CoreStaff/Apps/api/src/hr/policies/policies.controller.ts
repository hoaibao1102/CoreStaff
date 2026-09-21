import { Controller, Get, Patch, Post, Query, Param, Body, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId } from '../../common/tenant-context';
import { PoliciesService } from './policies.service';
import {
  CreateLaborPolicyDto,
  CreateOvertimePolicyDto,
  UpdateLaborPolicyDto,
  UpdateOvertimePolicyDto,
} from './dto/policies.dto';

@ApiTags('HR / Policies')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/policies')
export class PoliciesController {
  constructor(private readonly service: PoliciesService) {}
  private org(id: string | null) { return requireOrganizationId(id); }

  // ── Labor Compliance Policy (TASK-036, SRS §30B, §30G) ────────────────────

  @Get('labor') @Roles('HR') @ApiOperation({ summary: 'List labor compliance policies (tenant-scoped).' })
  async listLabor(@Tenant() org: string | null) { return { success: true, data: await this.service.listLabor(this.org(org)) }; }

  @Get('labor/effective') @Roles('HR') @ApiOperation({ summary: 'Effective labor compliance policy at a date.' })
  async laborAt(@Tenant() org: string | null, @Query('date') at: string) { return { success: true, data: await this.service.laborAt(this.org(org), new Date(at)) }; }

  @Post('labor') @Roles('HR') @ApiOperation({ summary: 'Create an effective-dated labor compliance policy.' })
  async createLabor(@Tenant() org: string | null, @Body() dto: CreateLaborPolicyDto) { return { success: true, data: await this.service.createLabor(this.org(org), dto) }; }

  @Patch('labor/:id') @Roles('HR') @ApiOperation({ summary: 'Update a labor compliance policy (version++).' })
  async updateLabor(@Tenant() org: string | null, @Param('id') id: string, @Body() dto: UpdateLaborPolicyDto) { return { success: true, data: await this.service.updateLabor(this.org(org), id, dto) }; }

  @Get('labor/preview') @Roles('HR') @ApiOperation({ summary: 'Enforcement preview against the effective labor policy (AC-LABOR-01).' })
  async previewLabor(@Tenant() org: string | null, @Query('date') at: string, @Query() usage: Record<string, unknown>) {
    return { success: true, data: await this.service.previewLabor(this.org(org), new Date(at), usage) };
  }

  // ── Overtime Pay Policy (TASK-037, SRS §30D.2, §30G) ──────────────────────

  @Get('overtime') @Roles('HR') @ApiOperation({ summary: 'List overtime pay policies (tenant-scoped).' })
  async listOvertime(@Tenant() org: string | null) { return { success: true, data: await this.service.listOvertime(this.org(org)) }; }

  @Get('overtime/effective') @Roles('HR') @ApiOperation({ summary: 'Effective overtime pay policy at a date.' })
  async overtimeAt(@Tenant() org: string | null, @Query('date') at: string) { return { success: true, data: await this.service.overtimeAt(this.org(org), new Date(at)) }; }

  @Post('overtime') @Roles('HR') @ApiOperation({ summary: 'Create an effective-dated overtime pay policy.' })
  async createOvertime(@Tenant() org: string | null, @Body() dto: CreateOvertimePolicyDto) { return { success: true, data: await this.service.createOvertime(this.org(org), dto) }; }

  @Patch('overtime/:id') @Roles('HR') @ApiOperation({ summary: 'Update an overtime pay policy (version++).' })
  async updateOvertime(@Tenant() org: string | null, @Param('id') id: string, @Body() dto: UpdateOvertimePolicyDto) { return { success: true, data: await this.service.updateOvertime(this.org(org), id, dto) }; }

  @Get('overtime/rates') @Roles('HR') @ApiOperation({ summary: 'OT rate resolution for a date (AC-OT-PAY-01, no double count).' })
  async previewOvertime(
    @Tenant() org: string | null,
    @Query('date') at: string,
    @Query('weeklyOff') weeklyOff?: string,
    @Query('publicHoliday') publicHoliday?: string,
  ) {
    return {
      success: true,
      data: await this.service.previewOvertime(this.org(org), new Date(at), {
        weeklyOff: weeklyOff === 'true',
        publicHoliday: publicHoliday === 'true',
      }),
    };
  }
}