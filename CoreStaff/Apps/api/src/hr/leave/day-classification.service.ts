import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AttendanceDayDocument } from '../../database/schemas/attendance-day.schema';
import { CalendarExceptionDocument } from '../../database/schemas/calendar-exception.schema';
import { EmployeeDayOverrideDocument } from '../../database/schemas/employee-day-override.schema';
import { CalendarExceptionType, DayResult, WorkdayType } from '../../database/schemas/enums';
import { dateOnly, enumerateDates } from '../../common/date-only';
import { ShiftResolverService } from '../shift-template/shift-resolver.service';

@Injectable()
export class DayClassificationService {
  constructor(
    @InjectModel('EmployeeDayOverride') private readonly overrides: Model<EmployeeDayOverrideDocument>,
    @InjectModel('CalendarException') private readonly calendar: Model<CalendarExceptionDocument>,
    @InjectModel('AttendanceDay') private readonly attendance: Model<AttendanceDayDocument>,
    private readonly shiftResolver: ShiftResolverService,
  ) {}

  async classify(org: string, employeeId: string, dateValue: string) {
    const date = dateOnly(dateValue);
    const [override, exception, shift, day] = await Promise.all([
      this.overrides.findOne({ organizationId: org, employeeId, date }).lean(),
      this.calendar.findOne({ organizationId: org, date }).lean(),
      this.shiftResolver.resolveForEmployeeDate(org, employeeId, date),
      this.attendance.findOne({ organizationId: org, employeeId, workDate: date }).lean(),
    ]);
    return resolveClassification({ overrideType: override?.type, calendarType: exception?.type, hasWorkObligation: Boolean(shift), checkInAt: day?.checkInAt, checkOutAt: day?.checkOutAt });
  }

  async rebuild(org: string, fromValue: string, toValue: string, employeeId?: string) {
    const dates = enumerateDates(dateOnly(fromValue), dateOnly(toValue));
    if (!dates.length) throw new BadRequestException('CLASSIFICATION_DATE_RANGE_INVALID');
    if (dates.length > 366) throw new BadRequestException('CLASSIFICATION_RANGE_TOO_LARGE');
    const filter: Record<string, unknown> = { organizationId: org, workDate: { $gte: dates[0], $lte: dates[dates.length - 1] } };
    if (employeeId) filter.employeeId = employeeId;
    const days = await this.attendance.find(filter).select('employeeId workDate').lean();
    let updatedCount = 0;
    for (const day of days) {
      const classification = await this.classify(org, String(day.employeeId), day.workDate);
      const update: Record<string, unknown> = { $set: { workdayType: classification.workdayType } };
      if (classification.dayResult) (update.$set as Record<string, unknown>).dayResult = classification.dayResult;
      else update.$unset = { dayResult: 1 };
      await this.attendance.updateOne({ _id: day._id, organizationId: org }, update);
      updatedCount += 1;
    }
    return { scannedCount: days.length, updatedCount };
  }
}

export function resolveClassification(input: {
  overrideType?: string;
  calendarType?: string;
  hasWorkObligation: boolean;
  checkInAt?: Date;
  checkOutAt?: Date;
}): { workdayType: WorkdayType; dayResult?: DayResult } {
  if (input.overrideType === WorkdayType.PAID_LEAVE || input.overrideType === WorkdayType.UNPAID_LEAVE) return { workdayType: input.overrideType };
  if (input.calendarType === CalendarExceptionType.PUBLIC_HOLIDAY) return { workdayType: WorkdayType.PUBLIC_HOLIDAY };
  if (input.calendarType === CalendarExceptionType.WEEKLY_OFF) return { workdayType: WorkdayType.WEEKLY_OFF };
  const working = input.calendarType === CalendarExceptionType.SPECIAL_WORKING_DAY || input.hasWorkObligation;
  if (!working) return { workdayType: WorkdayType.WEEKLY_OFF };
  if (input.checkInAt && input.checkOutAt) return { workdayType: WorkdayType.WORKING_DAY, dayResult: DayResult.PRESENT };
  if (input.checkInAt || input.checkOutAt) return { workdayType: WorkdayType.WORKING_DAY, dayResult: DayResult.INCOMPLETE };
  return { workdayType: WorkdayType.WORKING_DAY, dayResult: DayResult.ABSENT };
}
