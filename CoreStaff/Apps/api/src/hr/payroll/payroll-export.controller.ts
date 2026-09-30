import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser } from '../../common/tenant-context';
import { PayrollExportService } from './payroll-export.service';

@ApiTags('Payroll')
@Controller('payroll-runs')
@UseGuards(AuthGuard, RolesGuard)
export class PayrollExportController {
  constructor(private readonly exportService: PayrollExportService) {}

  @Get(':id/export/csv')
  @Roles('HR')
  @ApiOperation({ summary: 'Export payslips as CSV' })
  async exportCSV(@Param('id') id: string) {
    const csv = await this.exportService.exportCSV(id);
    return {
      success: true,
      data: csv,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=payslips-${id}.csv`,
      },
    };
  }

  @Get(':id/export/summary/csv')
  @Roles('HR')
  @ApiOperation({ summary: 'Export payroll summary as CSV' })
  async exportSummaryCSV(@Param('id') id: string) {
    const csv = await this.exportService.exportSummaryCSV(id);
    return {
      success: true,
      data: csv,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=payroll-summary-${id}.csv`,
      },
    };
  }
}
