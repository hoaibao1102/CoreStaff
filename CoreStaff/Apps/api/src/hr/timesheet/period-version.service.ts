import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { TimesheetPeriodDocument, TimesheetPeriodStatus } from '../../database/schemas/timesheet-period.schema';

/**
 * TASK-073 — BR-VERSION-01 / AC-HR-03.
 *
 * Every mutation of attendance data inside a period bumps `TimesheetPeriod.version`.
 * TASK-076 hangs department-confirmation invalidation off `bump()`.
 *
 * Kept in its own module rather than TimesheetPeriodModule: that module already
 * imports ManagerModule, so exporting this from there would make
 * `ManagerModule -> TimesheetPeriodModule -> ManagerModule` a cycle.
 */
@Injectable()
export class PeriodVersionService {
  constructor(
    @InjectModel('TimesheetPeriod') private readonly periods: Model<TimesheetPeriodDocument>,
  ) {}

  /**
   * Bump the version of one period. No-op when no period is resolved.
   * A CLOSED period is skipped — data cannot change until HR reopens it (FR-HR-05).
   */
  async bump(
    organizationId: string,
    periodId?: string | Types.ObjectId | null,
    session?: ClientSession,
  ): Promise<boolean> {
    if (!periodId) return false;
    if (!Types.ObjectId.isValid(String(periodId))) return false;

    const res = await this.periods.updateOne(
      {
        _id: new Types.ObjectId(String(periodId)),
        organizationId: new Types.ObjectId(organizationId),
        active: true,
        status: { $ne: TimesheetPeriodStatus.CLOSED },
      },
      {
        $inc: { version: 1 },
        $set: {
          status: TimesheetPeriodStatus.REVIEWING,
          managerSnapshotClosed: false,
          departmentSnapshots: [],
        },
        $unset: {
          managerSnapshotClosedBy: 1,
          managerSnapshotClosedAt: 1,
        },
      },
      { session },
    );
    return res.modifiedCount > 0;
  }

  /**
   * Resolve the period covering each work date and bump each distinct one.
   * Resolving by date range (not by AttendanceDay.periodId) matters because a
   * leave applied for a future date has no AttendanceDay row yet.
   */
  async bumpForWorkDates(
    organizationId: string,
    workDates: string[],
    session?: ClientSession,
  ): Promise<number> {
    const dates = [...new Set(workDates.map((d) => String(d).slice(0, 10)))];
    if (!dates.length) return 0;

    const orgObjectId = new Types.ObjectId(organizationId);
    const periodIds = new Set<string>();
    for (const date of dates) {
      const period = await this.periods
        .findOne({
          organizationId: orgObjectId,
          active: true,
          status: { $ne: TimesheetPeriodStatus.CLOSED },
          startDate: { $lte: date },
          endDate: { $gte: date },
        })
        .select('_id')
        .session(session ?? null)
        .lean();
      if (period) periodIds.add(String(period._id));
    }

    let bumped = 0;
    for (const periodId of periodIds) {
      if (await this.bump(organizationId, periodId, session)) bumped++;
    }
    return bumped;
  }
}
