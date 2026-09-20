import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser, SessionUser, Tenant, requireOrganizationId } from '../../common/tenant-context';
import { CompensationService } from './compensation.service';
import { CreateAllowanceDto, CreateBonusPolicyDto, CreateKpiInputDto, CreateKpiPolicyDto, CreateSalaryProfileDto, PreviewBonusDto, UpdateAllowanceDto, UpdateBonusPolicyDto, UpdateKpiInputDto, UpdateKpiPolicyDto, UpdateSalaryProfileDto } from './dto/compensation.dto';

@ApiTags('HR / Compensation')
@UseGuards(AuthGuard, RolesGuard)
@Roles('HR')
@Controller('hr')
export class CompensationController {
  constructor(private readonly service: CompensationService) {}
  private org(id: string | null) { return requireOrganizationId(id); }

  @Post('salary-profiles') @ApiOperation({ summary: 'Create an effective-dated salary profile (TASK-031/032).' })
  async createSalary(@Tenant() org: string | null, @Body() dto: CreateSalaryProfileDto) { return { success: true, data: await this.service.createSalary(this.org(org), dto) }; }
  @Get('salary-profiles') async listSalaries(@Tenant() org: string | null, @Query('employeeId') employeeId?: string) { return { success: true, data: await this.service.listSalaries(this.org(org), employeeId) }; }
  @Get('salary-profiles/effective') async effectiveSalary(@Tenant() org: string | null, @Query('employeeId') employeeId: string, @Query('date') at: string) { return { success: true, data: await this.service.effectiveSalary(this.org(org), employeeId, new Date(at)) }; }
  @Patch('salary-profiles/:id') async updateSalary(@Tenant() org: string | null, @Param('id') id: string, @Body() dto: UpdateSalaryProfileDto) { return { success: true, data: await this.service.updateSalary(this.org(org), id, dto) }; }

  @Get('allowance-catalog') async catalog() { return { success: true, data: await this.service.listCatalog() }; }
  @Get('organization-allowances') async allowances(@Tenant() org: string | null) { return { success: true, data: await this.service.listAllowances(this.org(org)) }; }
  @Post('organization-allowances') async createAllowance(@Tenant() org: string | null, @Body() dto: CreateAllowanceDto) { return { success: true, data: await this.service.createAllowance(this.org(org), dto) }; }
  @Patch('organization-allowances/:id') async updateAllowance(@Tenant() org: string | null, @Param('id') id: string, @Body() dto: UpdateAllowanceDto) { return { success: true, data: await this.service.updateAllowance(this.org(org), id, dto) }; }

  @Get('attendance-bonus-templates') async bonusTemplates() { return { success: true, data: await this.service.listBonusTemplates() }; }
  @Get('attendance-bonus-policies') async bonusPolicies(@Tenant() org: string | null) { return { success: true, data: await this.service.listBonusPolicies(this.org(org)) }; }
  @Post('attendance-bonus-policies') async createBonusPolicy(@Tenant() org: string | null, @Body() dto: CreateBonusPolicyDto) { return { success: true, data: await this.service.createBonusPolicy(this.org(org), dto) }; }
  @Post('attendance-bonus-policies/clone/:templateId') async cloneBonusPolicy(@Tenant() org: string | null, @Param('templateId') templateId: string, @Body() dto: Omit<CreateBonusPolicyDto, 'templateId' | 'tiers'>) { return { success: true, data: await this.service.cloneBonusPolicy(this.org(org), templateId, dto) }; }
  @Patch('attendance-bonus-policies/:id') async updateBonusPolicy(@Tenant() org: string | null, @Param('id') id: string, @Body() dto: UpdateBonusPolicyDto) { return { success: true, data: await this.service.updateBonusPolicy(this.org(org), id, dto) }; }
  @Post('attendance-bonus-policies/preview') async preview(@Tenant() org: string | null, @Body() dto: PreviewBonusDto) { return { success: true, data: await this.service.previewBonus(this.org(org), dto.policyId, dto.metrics) }; }

  // ── KPI Policies ────────────────────────────────────────────────────────
  @Get('kpi-policies')
  @Roles('HR', 'DEPARTMENT_MANAGER')
  async kpiPolicies(@Tenant() org: string | null) {
    return { success: true, data: await this.service.listKpiPolicies(this.org(org)) };
  }

  @Post('kpi-policies')
  async createKpiPolicy(@Tenant() org: string | null, @Body() dto: CreateKpiPolicyDto) {
    return { success: true, data: await this.service.createKpiPolicy(this.org(org), dto) };
  }

  @Patch('kpi-policies/:id')
  async updateKpiPolicy(@Tenant() org: string | null, @Param('id') id: string, @Body() dto: UpdateKpiPolicyDto) {
    return { success: true, data: await this.service.updateKpiPolicy(this.org(org), id, dto) };
  }

  @Get('kpi-policies/applicable')
  @Roles('HR', 'DEPARTMENT_MANAGER')
  async applicableKpiPolicy(@Tenant() org: string | null, @Query('departmentId') departmentId?: string) {
    return { success: true, data: await this.service.getApplicableKpiPolicy(this.org(org), departmentId) };
  }

  // ── KPI Inputs ──────────────────────────────────────────────────────────
  @Get('kpi-inputs')
  @Roles('HR', 'DEPARTMENT_MANAGER')
  async kpis(
    @Tenant() org: string | null,
    @Query('period') period?: string,
    @CurrentUser() user?: SessionUser,
  ) {
    return {
      success: true,
      data: await this.service.listKpis(this.org(org), period, user ? { role: user.role, id: String(user._id ?? user.id) } : undefined),
    };
  }

  @Post('kpi-inputs')
  @Roles('HR', 'DEPARTMENT_MANAGER')
  async createKpi(
    @Tenant() org: string | null,
    @Body() dto: CreateKpiInputDto,
    @CurrentUser() user?: SessionUser,
  ) {
    return {
      success: true,
      data: await this.service.createKpi(
        this.org(org),
        dto,
        user ? String(user._id ?? user.id) : undefined,
        user?.role,
      ),
    };
  }

  @Patch('kpi-inputs/:id')
  @Roles('HR', 'DEPARTMENT_MANAGER')
  async updateKpi(
    @Tenant() org: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateKpiInputDto,
    @CurrentUser() user?: SessionUser,
  ) {
    return {
      success: true,
      data: await this.service.updateKpi(
        this.org(org),
        id,
        dto,
        user ? String(user._id ?? user.id) : undefined,
        user?.role,
      ),
    };
  }

  @Post('kpi-inputs/:id/confirm')
  async confirmKpi(@Tenant() org: string | null, @Param('id') id: string, @CurrentUser() user: SessionUser) {
    return { success: true, data: await this.service.confirmKpi(this.org(org), id, String(user._id ?? user.id)) };
  }
}
