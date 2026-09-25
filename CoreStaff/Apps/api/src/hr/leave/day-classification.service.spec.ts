import { CalendarExceptionType, DayResult, WorkdayType } from '../../database/schemas/enums';
import { resolveClassification } from './day-classification.service';

describe('resolveClassification', () => {
  it.each([
    [{ calendarType: CalendarExceptionType.WEEKLY_OFF, hasWorkObligation: true }, { workdayType: WorkdayType.WEEKLY_OFF }],
    [{ overrideType: WorkdayType.PAID_LEAVE, calendarType: CalendarExceptionType.PUBLIC_HOLIDAY, hasWorkObligation: true }, { workdayType: WorkdayType.PAID_LEAVE }],
    [{ overrideType: WorkdayType.UNPAID_LEAVE, hasWorkObligation: true }, { workdayType: WorkdayType.UNPAID_LEAVE }],
    [{ calendarType: CalendarExceptionType.PUBLIC_HOLIDAY, hasWorkObligation: true }, { workdayType: WorkdayType.PUBLIC_HOLIDAY }],
    [{ hasWorkObligation: false }, { workdayType: WorkdayType.WEEKLY_OFF }],
    [{ calendarType: CalendarExceptionType.SPECIAL_WORKING_DAY, hasWorkObligation: false }, { workdayType: WorkdayType.WORKING_DAY, dayResult: DayResult.ABSENT }],
    [{ hasWorkObligation: true }, { workdayType: WorkdayType.WORKING_DAY, dayResult: DayResult.ABSENT }],
    [{ hasWorkObligation: true, checkInAt: new Date() }, { workdayType: WorkdayType.WORKING_DAY, dayResult: DayResult.INCOMPLETE }],
    [{ hasWorkObligation: true, checkOutAt: new Date() }, { workdayType: WorkdayType.WORKING_DAY, dayResult: DayResult.INCOMPLETE }],
    [{ hasWorkObligation: true, checkInAt: new Date(), checkOutAt: new Date() }, { workdayType: WorkdayType.WORKING_DAY, dayResult: DayResult.PRESENT }],
  ])('resolves precedence and attendance state %#', (input, expected) => {
    expect(resolveClassification(input)).toEqual(expected);
  });
});
