import { BadRequestException } from '@nestjs/common';
import { dateOnly, enumerateDates, isoWeekday } from '../../common/date-only';

describe('schedule date domain', () => {
  it('normalizes ISO date-time values to workDate', () => {
    expect(dateOnly('2026-09-28T10:00:00.000Z')).toBe('2026-09-28');
  });

  it('rejects values without an ISO date prefix', () => {
    expect(() => dateOnly('28/09/2026')).toThrow(BadRequestException);
    expect(() => dateOnly('2026-02-30')).toThrow(BadRequestException);
  });

  it('enumerates inclusive date boundaries', () => {
    expect(enumerateDates('2026-09-28', '2026-09-30')).toEqual(['2026-09-28', '2026-09-29', '2026-09-30']);
    expect(enumerateDates('2026-09-30', '2026-09-28')).toEqual([]);
  });

  it('uses ISO weekdays where Monday=1 and Sunday=7', () => {
    expect(isoWeekday('2026-09-28')).toBe(1);
    expect(isoWeekday('2026-10-04')).toBe(7);
  });
});
