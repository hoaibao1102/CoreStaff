import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TimesheetPeriodService } from './timesheet-period.service';

const ORG = '64f1a2b3c4d5e6f7a8b9c0d1';
const PERIOD = '64f1a2b3c4d5e6f7a8b9c0d2';
const DAY = '64f1a2b3c4d5e6f7a8b9c0d3';
const EMP = '64f1a2b3c4d5e6f7a8b9c0d4';
const DEPT = '64f1a2b3c4d5e6f7a8b9c0d5';

function build(opts: {
  day?: any;
  openExplanation?: any;
  created?: any[];
} = {}) {
  const created: any[] = opts.created ?? [];
  const day = opts.day ?? {
    _id: new Types.ObjectId(DAY),
    organizationId: new Types.ObjectId(ORG),
    periodId: new Types.ObjectId(PERIOD),
    employeeId: EMP,
    workDate: '2026-10-21',
    checkInAt: null,
    checkOutAt: null,
  };

  const periodModel: any = {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: PERIOD, organizationId: ORG, status: 'REVIEWING', version: 2,
        startDate: new Date('2026-10-01'), endDate: new Date('2026-10-31'),
      }),
    }),
  };

  const attendanceDayModel: any = {
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(day) }),
    findOneAndUpdate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ ...day, overallApprovalStatus: 'CLARIFICATION_REQUESTED' }) }),
    db: { startSession: async () => ({ withTransaction: async (fn: any) => fn(), endSession: jest.fn() }) },
  };

  const managerRequestModel: any = {
    // Guard lookup: returns the open explanation when the test wants one.
    findOne: jest.fn().mockReturnValue({ select: () => ({ lean: async () => opts.openExplanation ?? null }) }),
    create: jest.fn(async (rows: any[]) => { created.push(...rows); return rows; }),
    updateMany: jest.fn(async () => ({ modifiedCount: 0 })),
  };

  const employeeProfileModel: any = {
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: EMP, userId: EMP, departmentId: DEPT }) }),
  };
  const departmentModel: any = {
    findOne: jest.fn().mockReturnValue({ select: () => ({ lean: async () => ({ _id: 'd1' }) }) }),
  };
  const periodVersionService: any = { bump: jest.fn(async () => 2), bumpForWorkDates: jest.fn() };
  const audit: any = { recordForActor: jest.fn(async () => undefined) };

  const service = new TimesheetPeriodService(
    periodModel, departmentModel, employeeProfileModel, {} as any, {} as any, {} as any,
    {} as any, {} as any, {} as any, attendanceDayModel, {} as any, managerRequestModel,
    {} as any, periodVersionService, {} as any, undefined, undefined, undefined, audit,
  );
  return { service, managerRequestModel, attendanceDayModel, periodVersionService, created };
}

describe('TimesheetPeriodService.requestExplanationForMissingPunch (QC 2.1)', () => {
  it('creates one explanation request and bumps the period version', async () => {
    const { service, managerRequestModel, periodVersionService, created } = build();
    await service.requestExplanationForMissingPunch(ORG, PERIOD, DAY, { userId: 'hr1', role: 'HR' }, 'Nhân viên quên chấm ra ca');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ source: 'HR_MISSING_PUNCH_EXPLANATION', status: 'CLARIFICATION_REQUESTED' });
    expect(periodVersionService.bump).toHaveBeenCalledTimes(1);
    // The old upsert must be gone — creating is now the only write path.
    expect(managerRequestModel.findOne).toHaveBeenCalledTimes(1);
  });

  it('rejects a second request for the same day without writing or bumping', async () => {
    const { service, periodVersionService, created } = build({ openExplanation: { _id: 'r1' } });
    await expect(
      service.requestExplanationForMissingPunch(ORG, PERIOD, DAY, { userId: 'hr1', role: 'HR' }, 'Nhân viên quên chấm ra ca'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.requestExplanationForMissingPunch(ORG, PERIOD, DAY, { userId: 'hr1', role: 'HR' }, 'Nhân viên quên chấm ra ca'),
    ).rejects.toThrow('EXPLANATION_ALREADY_REQUESTED');
    expect(created).toHaveLength(0);
    expect(periodVersionService.bump).not.toHaveBeenCalled();
  });
});
