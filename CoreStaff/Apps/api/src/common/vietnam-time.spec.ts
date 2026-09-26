import { AttendanceCalculatorService } from '../attendance/services/attendance-calculator.service';
import { parseWindowInstant, vnDateOf, vnDayBounds, vnTimeToUtc, VN_OFFSET_MS } from './vietnam-time';

describe('vietnam-time (TASK-068 foundation)', () => {
  it('bounds a work date to the VN civil day, expressed in UTC ms', () => {
    const { from, to } = vnDayBounds('2026-09-22');
    expect(new Date(from).toISOString()).toBe('2026-09-21T17:00:00.000Z');
    expect(new Date(to).toISOString()).toBe('2026-09-22T17:00:00.000Z');
    expect(to - from).toBe(24 * 3600_000);
  });

  it('matches AttendanceCalculatorService.parseDateTime for every shift boundary', () => {
    // Parity guard for the extraction: the calculator delegates here, so any
    // drift would silently move late/early minutes for the whole tenant.
    const calculator = new AttendanceCalculatorService() as unknown as {
      parseDateTime(workDate: string, time: string): Date;
    };
    for (const workDate of ['2026-01-01', '2026-09-22', '2026-12-31', '2027-02-28']) {
      for (const time of ['00:00', '07:30', '08:30', '12:00', '17:00', '17:30', '23:59']) {
        expect(vnTimeToUtc(workDate, time)).toBe(calculator.parseDateTime(workDate, time).getTime());
      }
    }
  });

  it('reads seconds, not just HH:mm', () => {
    expect(vnTimeToUtc('2026-09-22', '08:30:30') - vnTimeToUtc('2026-09-22', '08:30')).toBe(30_000);
  });

  it('parses a naive ISO datetime as VN wall clock (the web form shape)', () => {
    // `${workDate}T18:00:00` with no offset: must land on 11:00 UTC, not 18:00 UTC.
    expect(new Date(parseWindowInstant('2026-09-22T18:00:00', '2026-09-22')).toISOString())
      .toBe('2026-09-22T11:00:00.000Z');
  });

  it('honours an explicit offset — that is an absolute instant, not wall clock', () => {
    expect(parseWindowInstant('2026-09-22T18:00:00Z', '2026-09-22')).toBe(Date.UTC(2026, 8, 22, 18));
    expect(parseWindowInstant('2026-09-22T18:00:00+07:00', '2026-09-22'))
      .toBe(parseWindowInstant('2026-09-22T18:00:00', '2026-09-22'));
  });

  it('accepts a bare HH:mm on the work date, and a Date through untouched', () => {
    expect(parseWindowInstant('18:00', '2026-09-22')).toBe(parseWindowInstant('2026-09-22T18:00:00', '2026-09-22'));
    const date = new Date('2026-09-22T11:00:00Z');
    expect(parseWindowInstant(date, '2026-09-22')).toBe(date.getTime());
  });

  it('rejects garbage instead of returning NaN', () => {
    expect(() => parseWindowInstant('not-a-time', '2026-09-22')).toThrow(/INVALID_WINDOW/);
    expect(() => vnTimeToUtc('2026-09-22', '25am')).toThrow(/INVALID_TIME/);
    expect(() => vnDayBounds('22-09-2026')).toThrow(/INVALID_WORK_DATE/);
  });

  it('maps an instant back to its VN civil date across the UTC midnight seam', () => {
    expect(vnDateOf(Date.UTC(2026, 8, 21, 17, 0))).toBe('2026-09-22');
    expect(vnDateOf(Date.UTC(2026, 8, 22, 16, 59))).toBe('2026-09-22');
    expect(vnDateOf(Date.UTC(2026, 8, 22, 17, 0))).toBe('2026-09-23');
  });

  it('uses the fixed +7 offset with no DST', () => {
    expect(VN_OFFSET_MS).toBe(25200_000);
    // January and July bound identically — Vietnam has no DST.
    expect(vnDayBounds('2026-01-15').from % (24 * 3600_000)).toBe(vnDayBounds('2026-07-15').from % (24 * 3600_000));
  });
});
