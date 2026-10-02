import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payslip, PayslipDocument } from '../../database/schemas/payslip.schema';
import { PayrollRun, PayrollRunDocument, PayrollRunStatus } from '../../database/schemas/payroll-run.schema';
import { EmployeeProfile, EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { Department, DepartmentDocument } from '../../database/schemas/department.schema';
import { Position, PositionDocument } from '../../database/schemas/position.schema';
import * as ExcelJS from 'exceljs';

/**
 * TASK-100 — Payroll export service for CSV/Excel generation.
 */
@Injectable()
export class PayrollExportService {
  constructor(
    @InjectModel('Payslip') private readonly payslipModel: Model<PayslipDocument>,
    @InjectModel('PayrollRun') private readonly payrollRunModel: Model<PayrollRunDocument>,
    @InjectModel('EmployeeProfile') private readonly employeeProfileModel: Model<EmployeeProfileDocument>,
    @InjectModel('Department') private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel('Position') private readonly positionModel: Model<PositionDocument>,
  ) {}

  /**
   * Verify the payroll run exists and is in an exportable state.
   */
  private async assertExportable(payrollRunId: string): Promise<void> {
    const payrollRun = await this.payrollRunModel.findById(payrollRunId).lean();

    if (!payrollRun) {
      throw new NotFoundException('PAYROLL_RUN_NOT_FOUND');
    }

    if (payrollRun.status !== PayrollRunStatus.LOCKED && payrollRun.status !== PayrollRunStatus.RELEASED) {
      throw new BadRequestException('PAYROLL_RUN_NOT_EXPORTABLE');
    }
  }

  /**
   * Export payslips as Excel (.xlsx) for a payroll run.
   */
  async exportExcel(payrollRunId: string): Promise<{ buffer: Buffer; periodLabel: string }> {
    const payrollRun = await this.payrollRunModel.findById(payrollRunId).lean();

    if (!payrollRun) {
      throw new NotFoundException('PAYROLL_RUN_NOT_FOUND');
    }

    if (payrollRun.status !== PayrollRunStatus.LOCKED && payrollRun.status !== PayrollRunStatus.RELEASED) {
      throw new BadRequestException('PAYROLL_RUN_NOT_EXPORTABLE');
    }

    const payslips = await this.payslipModel
      .find({ payrollRunId: new Types.ObjectId(payrollRunId) })
      .sort({ employeeName: 1 })
      .lean();

    const employeeProfileIds = payslips.map((slip) => slip.employeeProfileId).filter(Boolean);
    const profiles = await this.employeeProfileModel
      .find({ _id: { $in: employeeProfileIds } })
      .lean();

    const departmentIds = profiles.map((profile) => profile.departmentId).filter(Boolean);
    const positionIds = profiles.map((profile) => profile.positionId).filter(Boolean);

    const [departments, positions] = await Promise.all([
      this.departmentModel.find({ _id: { $in: departmentIds } }).lean(),
      this.positionModel.find({ _id: { $in: positionIds } }).lean(),
    ]);

    const profileMap = new Map(profiles.map((profile) => [profile._id.toString(), profile]));
    const departmentMap = new Map(departments.map((department) => [department._id.toString(), department]));
    const positionMap = new Map(positions.map((position) => [position._id.toString(), position]));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bảng lương');

    const headers = [
      'Mã NV',
      'Họ tên',
      'Phòng ban',
      'Chức danh',
      'Lương Gross',
      'Thu nhập tính thuế',
      'Base đóng bảo hiểm',
      'BHXH',
      'BHYT',
      'BHTN',
      'Giảm trừ bản thân',
      'Giảm trừ phụ thuộc',
      'PIT',
      'Khấu trừ khác',
      'Lương Net',
      'Trạng thái payslip',
      'Kỳ công',
      'Ngày tạo',
    ];

    worksheet.addRow(headers);

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };

    const currencyFormat = '#,##0';
    const currencyColumnIndices = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

    for (const payslip of payslips) {
      const profile = profileMap.get(payslip.employeeProfileId?.toString());
      const department = profile?.departmentId
        ? departmentMap.get(profile.departmentId.toString())
        : undefined;
      const position = profile?.positionId
        ? positionMap.get(profile.positionId.toString())
        : undefined;

      worksheet.addRow([
        payslip.employeeCode || '',
        payslip.employeeName,
        department?.name || '',
        position?.name || '',
        payslip.grossEarnings,
        payslip.taxableEarnings,
        payslip.contributionBase,
        payslip.socialInsurance,
        payslip.healthInsurance,
        payslip.unemploymentInsurance,
        payslip.personalDeduction,
        payslip.dependentDeduction,
        payslip.pitAmount,
        payslip.otherDeductions,
        payslip.netSalary,
        payslip.status,
        payslip.periodLabel,
        payslip.generatedAt ? new Date(payslip.generatedAt).toLocaleDateString('vi-VN') : '',
      ]);
    }

    worksheet.eachRow((row) => {
      row.eachCell((cell, colNumber) => {
        if (currencyColumnIndices.includes(colNumber)) {
          cell.numFmt = currencyFormat;
        }
      });
    });

    worksheet.columns.forEach((column) => {
      let maxLength = 10;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const value = cell.value?.toString() || '';
        maxLength = Math.max(maxLength, value.length);
      });
      column.width = maxLength + 2;
    });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { buffer, periodLabel: payrollRun.periodLabel || 'unknown' };
  }

  /**
   * Export payslips as CSV for a payroll run.
   */
  async exportCSV(payrollRunId: string): Promise<string> {
    await this.assertExportable(payrollRunId);

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
    await this.assertExportable(payrollRunId);

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
