import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PayrollRunService } from './payroll-run.service';

const ORG = new Types.ObjectId().toHexString();
const PERIOD = new Types.ObjectId().toHexString();
const ids = [0, 1, 2].map(() => new Types.ObjectId());

function build(summaryEmployees: Types.ObjectId[] | null) {
  const summaryModel = summaryEmployees && {
    find: jest.fn(() => ({
      select: () => ({ lean: async () => summaryEmployees.map((employeeProfileId) => ({ employeeProfileId })) }),
    })),
  };
  const service = new PayrollRunService(
    {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, summaryModel as any,
  );
  const check = (snapshotEmployees: Types.ObjectId[]) =>
    (service as any).assertSnapshotsCoverPopulation(
      ORG, PERIOD, snapshotEmployees.map((employeeProfileId) => ({ employeeProfileId })),
    );
  return { check, summaryModel };
}

describe('PayrollRunService snapshot population (AUD-H05)', () => {
  it('accepts a snapshot set that matches the period population exactly', async () => {
    await expect(build(ids).check([...ids].reverse())).resolves.toBeUndefined();
  });

  it('rejects a set that omits an employee', async () => {
    await expect(build(ids).check(ids.slice(0, 2))).rejects.toThrow('PAYROLL_SNAPSHOT_INCOMPLETE_POPULATION');
  });

  it('rejects a duplicated employee', async () => {
    await expect(build(ids).check([ids[0], ids[0], ids[1]])).rejects.toThrow('PAYROLL_SNAPSHOT_DUPLICATE_EMPLOYEE');
  });

  it('rejects a foreign employee not in the period summaries', async () => {
    await expect(build(ids.slice(0, 2)).check([ids[0], ids[1], ids[2]])).rejects.toThrow('PAYROLL_SNAPSHOT_FOREIGN_EMPLOYEE');
  });

  it('queries summaries scoped to the tenant and period', async () => {
    const { check, summaryModel } = build(ids);
    await check(ids);
    expect(summaryModel!.find).toHaveBeenCalledWith({
      organizationId: new Types.ObjectId(ORG),
      periodId: new Types.ObjectId(PERIOD),
    });
  });

  it('is a no-op when no summary model is wired (seed scripts)', async () => {
    await expect(build(null).check(ids)).resolves.toBeUndefined();
  });

  it('uses BadRequestException', async () => {
    await expect(build(ids).check([])).rejects.toBeInstanceOf(BadRequestException);
  });
});
