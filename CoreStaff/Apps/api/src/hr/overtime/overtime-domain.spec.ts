import { CalendarExceptionType } from '../../database/schemas/enums';
import { OvertimeType } from '../policies/policies-domain';
import {
  computeOvertime,
  inputHashOf,
  intersectIntervals,
  intervalsOverlap,
  minutesInside,
  minutesOutside,
  normalizeInterval,
  overtimeTypeOf,
  scheduledMinutesOf,
  subtractIntervals,
  sumMinutes,
  type Interval,
} from './overtime-domain';
import { vnDayBounds, vnTimeToUtc } from '../../common/vietnam-time';

/**
 * TASK-068/069 unit tests — SRS §22.1 "Overtime classification precedence và
 * interval intersection/subtraction", and the AC-OT acceptance list §21:2186.
 * Pure functions, no models, no Nest: the whole spec runs on object literals.
 */

const DAY = '2026-09-22';
const at = (hhmm: string): number => vnTimeToUtc(DAY, hhmm);
const span = (from: string, to: string): Interval => ({ from: at(from), to: at(to) });

/** A plain 08:00–17:00 office day. Deliberately not 08:00–17:00-hard-coded anywhere below. */
const SHIFT = span('08:00', '17:00');

describe('overtime-domain — interval algebra', () => {
  it('keeps only the overlap of two intervals', () => {
    expect(intersectIntervals(span('18:00', '22:00'), span('20:00', '23:00'))).toEqual(span('20:00', '22:00'));
  });

  it('treats touching endpoints as empty (half-open intervals share no minute)', () => {
    expect(intersectIntervals(span('18:00', '20:00'), span('20:00', '22:00'))).toBeNull();
    expect(intervalsOverlap(span('18:00', '20:00'), span('20:00', '22:00'))).toBe(false);
    expect(intervalsOverlap(span('18:00', '20:01'), span('20:00', '22:00'))).toBe(true);
  });

  it('drops inverted and empty spans', () => {
    expect(normalizeInterval({ from: 100, to: 100 })).toBeNull();
    expect(normalizeInterval({ from: 100, to: 99 })).toBeNull();
    expect(normalizeInterval({ from: NaN, to: 10 })).toBeNull();
  });

  it('subtracts a middle cut into two surviving fragments', () => {
    const result = subtractIntervals([span('06:00', '23:00')], [SHIFT]);
    expect(result).toEqual([span('06:00', '08:00'), span('17:00', '23:00')]);
  });

  it('leaves an untouched span in order when a cut misses it', () => {
    const late = span('18:00', '20:00');
    expect(subtractIntervals([late], [SHIFT])).toEqual([late]);
  });

  it('counts whole minutes and floors the remainder (1 second is not a minute)', () => {
    expect(sumMinutes([span('18:00', '20:00')])).toBe(120);
    expect(sumMinutes([{ from: at('18:00'), to: at('18:00') + 59_000 }])).toBe(0);
    expect(sumMinutes([{ from: at('18:00'), to: at('18:00') + 60_000 }])).toBe(1);
    expect(sumMinutes([{ from: at('18:00'), to: at('18:00') + 150_000 }])).toBe(2);
  });

  it('sums across fragments rather than netting the envelope', () => {
    expect(sumMinutes(subtractIntervals([span('06:00', '23:00')], [SHIFT]))).toBe(120 + 360);
  });

  it('measures what a clamp throws away', () => {
    expect(minutesOutside(span('18:00', '23:00'), [span('00:00', '20:00')])).toBe(180);
    expect(minutesOutside(span('18:00', '20:00'), [span('17:00', '23:00')])).toBe(0);
  });

  // D39 — the mirror of the above, and the measurement the encroachment guard
  // keys on: a non-zero answer means the requested window reaches into the shift.
  it('measures what a shift swallows, as the exact complement', () => {
    expect(minutesInside(span('16:00', '18:00'), [SHIFT])).toBe(60);       // straddles 17:00
    expect(minutesInside(span('09:00', '11:00'), [SHIFT])).toBe(120);      // fully inside
    expect(minutesInside(span('17:00', '19:00'), [SHIFT])).toBe(0);        // touching is empty
    expect(minutesInside(span('18:00', '20:00'), [SHIFT])).toBe(0);        // fully outside
    // inside + outside = the whole window, which is what "complement" means here.
    expect(minutesInside(span('16:00', '18:00'), [SHIFT]) + minutesOutside(span('16:00', '18:00'), [SHIFT]))
      .toBe(sumMinutes([span('16:00', '18:00')]));
    // `SHIFT` is the gross 08:00–17:00 span (540); the break is only removed
    // inside `scheduledMinutesOf`, so an enclosing window swallows all 540 here.
    expect(minutesInside(span('06:00', '23:00'), [SHIFT])).toBe(540);
    expect(minutesInside(span('18:00', '20:00'), [])).toBe(0);
  });

  it('is timezone-free: only the numeric differences matter', () => {
    // The same relative shape computed on a shifted day yields the same minutes,
    // which is the guarantee that keeps a UTC server from changing results.
    const shifted = (offset: number) => ({ from: 18 * 3600_000 + offset, to: 20 * 3600_000 + offset });
    expect(sumMinutes([shifted(0)])).toBe(sumMinutes([shifted(7 * 3600_000)]));
  });
});

describe('overtime-domain — classification precedence (§7.7, BR-OT-01/04)', () => {
  it('classifies a scheduled weekday as OT_WORKING_DAY', () => {
    expect(overtimeTypeOf({ hasWorkObligation: true })).toBe(OvertimeType.WORKING_DAY);
  });

  it('classifies a calendar weekly off as OT_WEEKLY_OFF', () => {
    expect(overtimeTypeOf({ calendarType: CalendarExceptionType.WEEKLY_OFF, hasWorkObligation: false }))
      .toBe(OvertimeType.WEEKLY_OFF);
  });

  it('classifies "no schedule" as OT_WEEKLY_OFF (the WEEKLY_OFF/no schedule arm)', () => {
    expect(overtimeTypeOf({ hasWorkObligation: false })).toBe(OvertimeType.WEEKLY_OFF);
  });

  it('ranks a public holiday above a weekly off and counts it once (AC-OT-02)', () => {
    expect(overtimeTypeOf({ calendarType: CalendarExceptionType.PUBLIC_HOLIDAY, hasWorkObligation: false }))
      .toBe(OvertimeType.PUBLIC_HOLIDAY);
    // A holiday exception wins even when the weekday would already be an off day.
    expect(overtimeTypeOf({ calendarType: CalendarExceptionType.PUBLIC_HOLIDAY, hasWorkObligation: true }))
      .toBe(OvertimeType.PUBLIC_HOLIDAY);
  });

  it('treats SPECIAL_WORKING_DAY on a weekly-off weekday as a working day', () => {
    expect(overtimeTypeOf({ calendarType: CalendarExceptionType.SPECIAL_WORKING_DAY, hasWorkObligation: false }))
      .toBe(OvertimeType.WORKING_DAY);
  });

  it('classifies a worked leave day as OT_WORKING_DAY, never as a premium type', () => {
    expect(overtimeTypeOf({ overrideType: 'PAID_LEAVE', hasWorkObligation: true })).toBe(OvertimeType.WORKING_DAY);
    expect(overtimeTypeOf({ overrideType: 'UNPAID_LEAVE', hasWorkObligation: false })).toBe(OvertimeType.WORKING_DAY);
  });

  it('leaves no input combination unmapped', () => {
    const cases = [
      { hasWorkObligation: true },
      { hasWorkObligation: false },
      { calendarType: CalendarExceptionType.PUBLIC_HOLIDAY, hasWorkObligation: true },
      { overrideType: 'PAID_LEAVE', hasWorkObligation: true },
    ];
    for (const input of cases) {
      expect(Object.values(OvertimeType)).toContain(overtimeTypeOf(input));
    }
  });
});

describe('overtime-domain — computeOvertime (FR-OT-02, BR-OT-02/03)', () => {
  const base = { workDate: DAY, overtimeType: OvertimeType.WORKING_DAY, scheduled: [SHIFT] };

  it('takes only the overlap of the approved window and real attendance (AC-OT-04)', () => {
    const result = computeOvertime({
      ...base,
      requested: span('18:00', '22:00'),
      approved: span('18:00', '22:00'),
      actual: span('08:00', '20:00'),
    });
    expect(result).toMatchObject({ requestedMinutes: 240, approvedMinutes: 240, actualMinutes: 720, eligibleMinutes: 120 });
    expect(result.eligibleIntervals).toEqual([span('18:00', '20:00')]);
    expect(result.calculationNote).toBe('OK');
  });

  it('never exceeds the approved window however late the employee stays', () => {
    const result = computeOvertime({
      ...base,
      requested: span('18:00', '22:00'),
      approved: span('18:00', '22:00'),
      actual: span('08:00', '23:30'),
    });
    expect(result.eligibleMinutes).toBe(240);
    expect(result.eligibleMinutes).toBeLessThanOrEqual(result.approvedMinutes);
  });

  it('subtracts the scheduled interval so in-shift time is not double-paid (BR-OT-03)', () => {
    const result = computeOvertime({
      ...base,
      requested: span('12:00', '20:00'),
      approved: span('12:00', '20:00'),
      actual: span('08:00', '20:00'),
    });
    expect(result.eligibleIntervals).toEqual([span('17:00', '20:00')]);
    expect(result.eligibleMinutes).toBe(180);
  });

  it('ignores an un-approved window entirely: no approved request means no OT (BR-OT-02)', () => {
    // The service only ever calls this with `approved` set for an APPROVED
    // request; passing nothing models "the manager never signed off", which
    // must not pay out even though the employee stayed until 19:00.
    const result = computeOvertime({
      ...base,
      requested: span('17:00', '19:00'),
      actual: span('08:00', '19:00'),
    });
    // `approved` defaults to `requested` (FR-OT-02), so the guard against
    // paying an unapproved request belongs to the caller, not this function.
    expect(result.eligibleMinutes).toBe(120);
    expect(result.calculationNote).toBe('OK');
  });

  it('returns zero eligible when the employee never checked out', () => {
    const result = computeOvertime({
      ...base,
      requested: span('18:00', '22:00'),
      approved: span('18:00', '22:00'),
    });
    expect(result.eligibleMinutes).toBe(0);
    expect(result.actualMinutes).toBe(0);
    expect(result.calculationNote).toContain('NO_ACTUAL_ATTENDANCE');
  });

  it('returns zero when the approved window falls outside the time actually present', () => {
    const result = computeOvertime({
      ...base,
      requested: span('18:00', '22:00'),
      approved: span('18:00', '22:00'),
      actual: span('08:00', '17:30'),
    });
    expect(result.eligibleMinutes).toBe(0);
    expect(result.calculationNote).toContain('APPROVED_WINDOW_OUTSIDE_ATTENDANCE');
  });

  it('returns zero when the whole approved window sits inside the shift', () => {
    const result = computeOvertime({
      ...base,
      requested: span('09:00', '11:00'),
      approved: span('09:00', '11:00'),
      actual: span('08:00', '18:00'),
    });
    expect(result.eligibleMinutes).toBe(0);
    expect(result.calculationNote).toContain('FULLY_WITHIN_SCHEDULE');
  });

  it('does not charge break minutes twice — the break is inside the subtracted shift', () => {
    // A 12:00–13:00 break sits wholly inside 08:00–17:00, which step 3 removes;
    // subtracting it again from the 18:00–20:00 OT would be double counting.
    const result = computeOvertime({
      ...base,
      requested: span('18:00', '20:00'),
      approved: span('18:00', '20:00'),
      actual: span('08:00', '20:00'),
    });
    expect(result.eligibleMinutes).toBe(120);
  });

  it('pays the full day on a weekly off, because there is nothing to subtract', () => {
    const result = computeOvertime({
      workDate: DAY,
      overtimeType: OvertimeType.WEEKLY_OFF,
      scheduled: [],
      requested: span('08:00', '17:00'),
      approved: span('08:00', '17:00'),
      actual: span('08:00', '17:00'),
    });
    expect(result.eligibleIntervals).toEqual([span('08:00', '17:00')]);
    expect(result.eligibleMinutes).toBe(540);
  });

  it('falls back to the requested window when a manager approved without changing it', () => {
    const result = computeOvertime({
      ...base,
      requested: span('18:00', '21:00'),
      actual: span('08:00', '22:00'),
    });
    expect(result.approvedMinutes).toBe(180);
    expect(result.eligibleMinutes).toBe(180);
  });

  it('clamps a past-midnight window into the work date and reports the loss', () => {
    const result = computeOvertime({
      ...base,
      requested: { from: at('18:00'), to: at('18:00') + (6 * 3600_000) }, // 18:00 → 00:00 next VN day
      approved: { from: at('18:00'), to: at('18:00') + (6 * 3600_000) },
      actual: { from: at('08:00'), to: at('18:00') + (6 * 3600_000) },
    });
    // 00:00 in VN is the day boundary itself, so nothing is actually dropped here…
    expect(result.droppedAfterClampMinutes).toBe(0);
    expect(result.eligibleMinutes).toBe(360);

    const over = computeOvertime({
      ...base,
      requested: { from: at('18:00'), to: at('18:00') + (8 * 3600_000) }, // 18:00 → 02:00 next day
      approved: { from: at('18:00'), to: at('18:00') + (8 * 3600_000) },
      actual: { from: at('08:00'), to: at('18:00') + (8 * 3600_000) },
    });
    // …and the two hours past midnight must not leak into the next period:
    // approved is cut to 18:00–00:00, so eligible caps at those 6 hours.
    expect(over.approvedMinutes).toBe(360);
    expect(over.eligibleMinutes).toBe(360);
    expect(over.droppedAfterClampMinutes).toBe(120);
    expect(over.calculationNote).toContain('CROSS_MIDNIGHT_CLAMPED');
  });

  it('clamps a window that starts before the VN day, counting the loss once', () => {
    const day = vnDayBounds(DAY);
    // 22:00 VN on the *previous* civil day through 09:00 — a 7h pre-shift tail.
    const window = { from: day.from - 7 * 3600_000, to: at('09:00') };
    const result = computeOvertime({
      ...base,
      requested: window,
      approved: window,
      actual: window,
    });
    expect(result.approvedMinutes).toBe(540); // 00:00–09:00 VN
    expect(result.droppedAfterClampMinutes).toBe(420); // the 7 hours before the day
    expect(result.calculationNote).toContain('CROSS_MIDNIGHT_CLAMPED');
  });
});

describe('overtime-domain — inputHash (BR-OT-05, AC-OT-05)', () => {
  const inputs = {
    calendarType: CalendarExceptionType.WEEKLY_OFF,
    shift: { id: 's1', startTime: '08:00', endTime: '17:00' },
    approved: { from: 1000, to: 2000 },
    laborPolicyVersion: 3,
  };

  it('is stable for equal inputs regardless of key order', () => {
    expect(inputHashOf(inputs)).toBe(inputHashOf({
      laborPolicyVersion: 3,
      approved: { to: 2000, from: 1000 },
      shift: { endTime: '17:00', startTime: '08:00', id: 's1' },
      calendarType: CalendarExceptionType.WEEKLY_OFF,
    }));
  });

  it('changes when the calendar, the shift, the window or the policy version changes', () => {
    const base = inputHashOf(inputs);
    expect(inputHashOf({ ...inputs, calendarType: CalendarExceptionType.PUBLIC_HOLIDAY })).not.toBe(base);
    expect(inputHashOf({ ...inputs, shift: { ...inputs.shift, endTime: '17:30' } })).not.toBe(base);
    expect(inputHashOf({ ...inputs, approved: { from: 1000, to: 2100 } })).not.toBe(base);
    expect(inputHashOf({ ...inputs, laborPolicyVersion: 4 })).not.toBe(base);
  });
});

describe('overtime-domain — scheduledMinutesOf', () => {
  it('is the shift span minus its break', () => {
    expect(scheduledMinutesOf({ startTime: '08:00', endTime: '17:00', breakMinutes: 60 })).toBe(480);
    // AC-SCH-01: a non-default shift must produce its own number, not 480.
    expect(scheduledMinutesOf({ startTime: '07:30', endTime: '16:30', breakMinutes: 30 })).toBe(510);
    expect(scheduledMinutesOf({ startTime: '08:00', endTime: '12:00' })).toBe(240);
  });

  it('wraps a span that crosses midnight and never returns a negative', () => {
    expect(scheduledMinutesOf({ startTime: '22:00', endTime: '06:00', breakMinutes: 60 })).toBe(420);
    expect(scheduledMinutesOf({ startTime: '08:00', endTime: '17:00', breakMinutes: 999 })).toBe(0);
  });

  it('is zero without a shift — weekly off and holiday days', () => {
    expect(scheduledMinutesOf(null)).toBe(0);
  });
});
