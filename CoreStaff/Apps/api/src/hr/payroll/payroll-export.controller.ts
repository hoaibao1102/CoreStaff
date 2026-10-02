import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
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

  @Get(':id/export/excel')
  @Roles('HR')
  @ApiOperation({ summary: 'Export payslips as Excel' })
  async exportExcel(@Param('id') id: string, @Res() res: Response) {
    const { buffer, periodLabel } = await this.exportService.exportExcel(id);
    const safePeriodLabel = periodLabel.replace(/[^a-zA-Z0-9\-_]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=payroll-${safePeriodLabel}.xlsx`);
    res.send(buffer);
  }
}
