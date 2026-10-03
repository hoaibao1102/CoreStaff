import { Types } from 'mongoose';
import { AttendanceStatus, DayResult, WorkdayType } from '../../database/schemas/enums';
import { TimesheetSummaryService } from './timesheet-summary.service';

describe('TimesheetSummaryService work count aggregation', () => {
  it('excludes HR accounts from the attendance and payroll population', async () => {
    const employeeId = new Types.ObjectId();
    const hrId = new Types.ObjectId();
    const userModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: employeeId }]),
      }),
    };
    const service = new TimesheetSummaryService(
      {} as any, {} as any, {} as any, {} as any, userModel as any, {} as any,
    );

    await expect((service as any).excludeHrUsers([String(employeeId), String(hrId)]))
      .resolves.toEqual([String(employeeId)]);
    expect(userModel.find).toHaveBeenCalledWith(
      { _id: { $in: [employeeId, hrId] }, role: { $ne: 'HR' } },
      { _id: 1 },
    );
  });

  it('keeps public holidays out of standard days while counting worked holidays as actual work', () => {
    const service = new TimesheetSummaryService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    const aggregate = (service as any).aggregateWorkCounts([
      {
        workdayType: WorkdayType.WORKING_DAY,
        dayResult: DayResult.PRESENT,
        attendanceStatus: AttendanceStatus.COMPLETED,
        checkInAt: new Date('2026-09-03T01:00:00.000Z'),
        checkOutAt: new Date('2026-09-03T10:00:00.000Z'),
        workingMinutes: 480,
      },
      {
        workdayType: WorkdayType.PUBLIC_HOLIDAY,
        dayResult: DayResult.PRESENT,
        attendanceStatus: AttendanceStatus.COMPLETED,
        checkInAt: new Date('2026-09-02T01:00:00.000Z'),
        checkOutAt: new Date('2026-09-02T10:00:00.000Z'),
        workingMinutes: 480,
      },
      {
        workdayType: WorkdayType.PUBLIC_HOLIDAY,
        attendanceStatus: AttendanceStatus.DAY_OFF,
        workingMinutes: 0,
      },
    ]);

    expect(aggregate.workingDays).toBe(1);
    expect(aggregate.presentDays).toBe(2);
    expect(aggregate.holidayDays).toBe(2);
    expect(aggregate.incompleteDays).toBe(0);
    expect(aggregate.totalWorkingMinutes).toBe(960);
  });

  it('does not count an incomplete checked-in day as actual work', () => {
    const service = new TimesheetSummaryService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    const aggregate = (service as any).aggregateWorkCounts([
      {
        workdayType: WorkdayType.WORKING_DAY,
        dayResult: DayResult.INCOMPLETE,
        attendanceStatus: AttendanceStatus.CHECKED_IN,
        checkInAt: new Date('2026-09-15T01:00:00.000Z'),
        workingMinutes: 0,
      },
    ]);

    expect(aggregate.workingDays).toBe(1);
    expect(aggregate.presentDays).toBe(0);
    expect(aggregate.incompleteDays).toBe(1);
  });

  it('treats both punches as present even when a legacy adjustment left dayResult incomplete', () => {
    const service = new TimesheetSummaryService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    const aggregate = (service as any).aggregateWorkCounts([
      {
        workdayType: WorkdayType.WORKING_DAY,
        dayResult: DayResult.INCOMPLETE,
        attendanceStatus: AttendanceStatus.COMPLETED,
        checkInAt: new Date('2026-09-15T01:00:00.000Z'),
        checkOutAt: new Date('2026-09-15T10:00:00.000Z'),
        workingMinutes: 480,
      },
    ]);

    expect(aggregate.presentDays).toBe(1);
    expect(aggregate.incompleteDays).toBe(0);
  });

  it('keeps paid and unpaid leave days in the organization standard-day count', () => {
    const service = new TimesheetSummaryService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    const aggregate = (service as any).aggregateWorkCounts([
      { workdayType: WorkdayType.WORKING_DAY, dayResult: DayResult.PRESENT, attendanceStatus: AttendanceStatus.COMPLETED, checkInAt: new Date(), checkOutAt: new Date(), workingMinutes: 480 },
      { workdayType: WorkdayType.PAID_LEAVE, attendanceStatus: AttendanceStatus.DAY_OFF, workingMinutes: 0 },
      { workdayType: WorkdayType.UNPAID_LEAVE, attendanceStatus: AttendanceStatus.DAY_OFF, workingMinutes: 0 },
    ]);

    expect(aggregate.workingDays).toBe(3);
    expect(aggregate.paidLeaveDays).toBe(1);
    expect(aggregate.unpaidLeaveDays).toBe(1);
    expect(aggregate.incompleteDays).toBe(0);
  });

  it('counts a manager-forfeited missing-punch day as absent and non-payable', () => {
    const service = new TimesheetSummaryService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    const aggregate = (service as any).aggregateWorkCounts([{
      workdayType: WorkdayType.WORKING_DAY,
      dayResult: DayResult.ABSENT,
      attendanceStatus: AttendanceStatus.LOCKED,
      workingMinutes: 0,
      resolution: { type: 'FORFEITED_MISSING_PUNCH' },
    }]);

    expect(aggregate.workingDays).toBe(1);
    expect(aggregate.absentDays).toBe(1);
    expect(aggregate.presentDays).toBe(0);
    expect(aggregate.incompleteDays).toBe(0);
  });
});
