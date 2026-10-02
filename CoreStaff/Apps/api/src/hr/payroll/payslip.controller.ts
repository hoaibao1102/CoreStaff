import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser } from '../../common/tenant-context';
import { AllowTempPassword } from '../../auth/guards/auth.guard';
import { PayslipService } from './payslip.service';

@ApiTags('Payslip')
@Controller('payslips')
@UseGuards(AuthGuard, RolesGuard)
export class PayslipController {
  constructor(private readonly payslipService: PayslipService) {}

  // ── Employee self-service endpoints (MUST come before generic routes) ──

  /**
   * GET /api/payslips/me
   * Employee view own payslips list
   */
  @Get('me')
  @Roles('EMPLOYEE')
  @AllowTempPassword()
  @ApiOperation({ summary: 'Employee view own payslips' })
  async getMyPayslips(
    @CurrentUser() user: any,
    @Query('periodLabel') periodLabel?: string
  ) {
    if (!user?._id) {
      return { success: true, data: [] };
    }
    
    // Lookup employeeProfileId from userId (not from AuthGuard)
    const profile = await this.payslipService.findEmployeeProfileByUserId(String(user._id));
    
    if (!profile) {
      console.warn('[WARN] No active profile for user:', user._id);
      return { success: true, data: [] };
    }
    
    const slips = await this.payslipService.getMyPayslips(profile._id.toString(), user.organizationId, {
      periodLabel,
    });
    return { success: true, data: slips };
  }

  /**
   * GET /api/payslips/me/:id
   * Employee view own single payslip detail
   */
  @Get('me/:id')
  @Roles('EMPLOYEE')
  @AllowTempPassword()
  @ApiOperation({ summary: 'Employee view own payslip detail' })
  async getMyPayslipDetail(@CurrentUser() user: any, @Param('id') id: string) {
    // Lookup employeeProfileId from userId
    const profile = await this.payslipService.findEmployeeProfileByUserId(user._id);
    if (!profile) {
      throw new NotFoundException('EMPLOYEE_PROFILE_NOT_FOUND');
    }
    
    const slip = await this.payslipService.getMyPayslip(id, profile._id.toString());
    return { success: true, data: slip };
  }

  /**
   * POST /api/payslips/me/:id/viewed
   * Mark payslip as viewed by employee
   */
  @Post('me/:id/viewed')
  @Roles('EMPLOYEE')
  @AllowTempPassword()
  @ApiOperation({ summary: 'Mark payslip as viewed by employee' })
  async markViewed(@CurrentUser() user: any, @Param('id') id: string) {
    // Lookup employeeProfileId from userId
    const profile = await this.payslipService.findEmployeeProfileByUserId(user._id);
    if (!profile) {
      throw new NotFoundException('EMPLOYEE_PROFILE_NOT_FOUND');
    }
    
    await this.payslipService.markAsViewed(id, profile._id.toString());
    return { success: true, message: 'PAYSLIP_VIEWED' };
  }

  // ── HR endpoints ───────────────────────────────────────────────────────

  @Get('run/:payrollRunId')
  @Roles('HR')
  @ApiOperation({ summary: 'List all payslips for a payroll run' })
  async findByPayrollRun(@Param('payrollRunId') payrollRunId: string) {
    const slips = await this.payslipService.findByPayrollRun(payrollRunId);
    return { success: true, data: slips };
  }

  @Get('run/:payrollRunId/summary')
  @Roles('HR')
  @ApiOperation({ summary: 'Get payslips summary for payroll run dashboard' })
  async getSummary(@Param('payrollRunId') payrollRunId: string) {
    const summary = await this.payslipService.getSummary(payrollRunId);
    return { success: true, data: summary };
  }

  /**
   * GET /api/payslips/:id
   * HR preview payslip detail (generic ID)
   */
  @Get(':id')
  @Roles('HR')
  @ApiOperation({ summary: 'Get payslip detail (HR preview)' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    const slip = await this.payslipService.findOne(id, user.organizationId);
    return { success: true, data: slip };
  }

  @Post('release/:payrollRunId')
  @Roles('HR')
  @ApiOperation({ summary: 'Release payslips for a payroll run' })
  async release(@CurrentUser() user: any, @Param('payrollRunId') payrollRunId: string) {
    await this.payslipService.releaseForPayrollRun(payrollRunId, user.id);
    return { success: true, message: 'PAYSLIPS_RELEASED' };
  }
}
