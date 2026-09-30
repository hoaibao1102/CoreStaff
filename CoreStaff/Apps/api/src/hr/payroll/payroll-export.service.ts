import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payslip, PayslipDocument } from '../../database/schemas/payslip.schema';

/**
 * TASK-100 — Payroll export service for CSV/PDF generation.
 */
@Injectable()
export class PayrollExportService {
  constructor(
    @InjectModel('Payslip') private readonly payslipModel: Model<PayslipDocument>,
  ) {}

  /**
   * Export payslips as CSV for a payroll run.
   */
  async exportCSV(payrollRunId: string): Promise<string> {
    const payslips = await this.payslipModel
      .find({ payrollRunId: new Types.ObjectId(payrollRunId) })
      .sort({ employeeName: 1 })
      .lean();

    // CSV header
    const headers = [
      'Mã NV',
      'Họ tên',
      'Lương Gross',
      'BHXH',
      'BHYT',
      'BHTN',
      'Giảm trừ bản thân',
      'Giảm trừ phụ thuộc',
      'PIT',
      'Khấu trừ khác',
      'Lương Net',
      'Trạng thái',
    ];

    const rows = payslips.map((slip) => [
      slip.employeeCode || '',
      `"${slip.employeeName}"`,
      slip.grossEarnings.toFixed(0),
      slip.socialInsurance.toFixed(0),
      slip.healthInsurance.toFixed(0),
      slip.unemploymentInsurance.toFixed(0),
      slip.personalDeduction.toFixed(0),
      slip.dependentDeduction.toFixed(0),
      slip.pitAmount.toFixed(0),
      slip.otherDeductions.toFixed(0),
      slip.netSalary.toFixed(0),
      slip.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return csvContent;
  }

  /**
   * Export summary totals for a payroll run.
   */
  async exportSummaryCSV(payrollRunId: string): Promise<string> {
    const aggregation = await this.payslipModel.aggregate([
      { $match: { payrollRunId: new Types.ObjectId(payrollRunId) } },
      {
        $group: {
          _id: null,
          totalEmployees: { $sum: 1 },
          totalGross: { $sum: '$grossEarnings' },
          totalNet: { $sum: '$netSalary' },
          totalSocialInsurance: { $sum: '$socialInsurance' },
          totalHealthInsurance: { $sum: '$healthInsurance' },
          totalUnemploymentInsurance: { $sum: '$unemploymentInsurance' },
          totalPIT: { $sum: '$pitAmount' },
        },
      },
    ]);

    const summary = aggregation[0] || {
      totalEmployees: 0,
      totalGross: 0,
      totalNet: 0,
      totalSocialInsurance: 0,
      totalHealthInsurance: 0,
      totalUnemploymentInsurance: 0,
      totalPIT: 0,
    };

    const headers = ['Chỉ số', 'Giá trị'];
    const rows = [
      ['Tổng nhân viên', summary.totalEmployees],
      ['Tổng Gross', summary.totalGross.toFixed(0)],
      ['Tổng BHXH', summary.totalSocialInsurance.toFixed(0)],
      ['Tổng BHYT', summary.totalHealthInsurance.toFixed(0)],
      ['Tổng BHTN', summary.totalUnemploymentInsurance.toFixed(0)],
      ['Tổng PIT', summary.totalPIT.toFixed(0)],
      ['Tổng Net', summary.totalNet.toFixed(0)],
    ];

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return csvContent;
  }
}
