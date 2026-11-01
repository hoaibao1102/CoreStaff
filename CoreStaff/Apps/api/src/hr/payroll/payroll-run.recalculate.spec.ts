import { BadRequestException } from '@nestjs/common';
import { PayrollRunStatus } from '../../database/schemas/payroll-run.schema';
import { PayrollRunService } from './payroll-run.service';

describe('PayrollRunService.recalculate', () => {
  const runId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';

  function createService(status: PayrollRunStatus) {
    const payrollRunModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: runId,
          status,
          version: 3,
        }),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const periodModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };
    const payslipService = {
      deleteGeneratedForRecalculation: jest.fn().mockResolvedValue(6),
    };
    const service = new PayrollRunService(
      payrollRunModel as any,
      {} as any,
      periodModel as any,
      {} as any,
      {} as any,
      {} as any,
      payslipService as any,
    );
    jest.spyOn(service, 'calculate').mockResolvedValue({
      payrollRun: { _id: runId, status: PayrollRunStatus.CALCULATED },
      employeesProcessed: 6,
      totalGross: 120_000_000,
      totalNet: 110_000_000,
    });
    return { service, payrollRunModel, payslipService };
  }

  it('deletes generated payslips, resets the calculated run, and calculates it again', async () => {
    const { service, payrollRunModel, payslipService } = createService(PayrollRunStatus.CALCULATED);

    const result = await service.recalculate(runId, userId);

    expect(payslipService.deleteGeneratedForRecalculation).toHaveBeenCalledWith(runId);
    expect(payrollRunModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: runId, status: PayrollRunStatus.CALCULATED, version: 3 }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: PayrollRunStatus.DRAFT,
          totalGross: 0,
          totalNet: 0,
          totalEmployerCost: 0,
          processedEmployeeCount: 0,
        }),
        $inc: { version: 1 },
      }),
      { new: true },
    );
    expect(service.calculate).toHaveBeenCalledWith(runId, userId);
    expect(result.employeesProcessed).toBe(6);
  });

  it.each([PayrollRunStatus.DRAFT, PayrollRunStatus.LOCKED, PayrollRunStatus.RELEASED])(
    'rejects recalculation when the run is %s',
    async (status) => {
      const { service, payslipService } = createService(status);

      await expect(service.recalculate(runId, userId)).rejects.toEqual(
        new BadRequestException('CANNOT_RECALCULATE_NON_CALCULATED'),
      );
      expect(payslipService.deleteGeneratedForRecalculation).not.toHaveBeenCalled();
    },
  );
});
