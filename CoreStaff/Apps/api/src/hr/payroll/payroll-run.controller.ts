import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser } from '../../common/tenant-context';
import { PayrollRunService } from './payroll-run.service';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';

@ApiTags('Payroll')
@Controller('payroll-runs')
@UseGuards(AuthGuard, RolesGuard)
export class PayrollRunController {
  constructor(private readonly payrollRunService: PayrollRunService) {}

  @Post()
  @Roles('HR')
  @ApiOperation({ summary: 'Create a new payroll run DRAFT' })
  async create(@CurrentUser() user: any, @Body() dto: CreatePayrollRunDto) {
    const result = await this.payrollRunService.create({
      organizationId: user.organizationId,
      timesheetPeriodId: dto.timesheetPeriodId,
      notes: dto.notes,
      userId: user.id,
    });
    return { success: true, data: result };
  }

  @Get()
  @Roles('HR')
  @ApiOperation({ summary: 'List all payroll runs for organization' })
  async findAll(@CurrentUser() user: any) {
    const runs = await this.payrollRunService.findAll(user.organizationId);
    return { success: true, data: runs };
  }

  @Get(':id')
  @Roles('HR')
  @ApiOperation({ summary: 'Get payroll run detail' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    const run = await this.payrollRunService.findOne(user.organizationId, id);
    return { success: true, data: run };
  }

  @Put(':id/calculate')
  @Roles('HR')
  @ApiOperation({ summary: 'Calculate payroll for all employees' })
  async calculate(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.payrollRunService.calculate(id, user.id);
    return { success: true, data: result };
  }

  @Put(':id/recalculate')
  @Roles('HR')
  @ApiOperation({ summary: 'Recalculate an unpublished calculated payroll run' })
  async recalculate(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.payrollRunService.recalculate(id, user.id);
    return { success: true, data: result };
  }

  @Put(':id/lock')
  @Roles('HR')
  @ApiOperation({ summary: 'Lock a calculated payroll run' })
  async lock(@CurrentUser() user: any, @Param('id') id: string) {
    const run = await this.payrollRunService.lock(id, user.id);
    return { success: true, data: run };
  }

  @Put(':id/release')
  @Roles('HR')
  @ApiOperation({ summary: 'Release locked payroll run to employees' })
  async release(@CurrentUser() user: any, @Param('id') id: string) {
    const run = await this.payrollRunService.release(id, user.id);
    return { success: true, data: run };
  }
}
