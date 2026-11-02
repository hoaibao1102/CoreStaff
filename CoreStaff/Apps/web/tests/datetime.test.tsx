import { formatDateOnlyVN, formatInstantDateVN, formatInstantDateTimeVN, formatVN } from '../src/lib/datetime';

describe('datetime utility', () => {
  it('formats calendar date-only strings without timezone drift', () => {
    expect(formatDateOnlyVN('2026-10-30')).toBe('30/10/2026');
    expect(formatDateOnlyVN('2026-09-01')).toBe('01/09/2026');
    expect(formatDateOnlyVN('')).toBe('—');
    expect(formatDateOnlyVN(null)).toBe('—');
    expect(formatDateOnlyVN(undefined)).toBe('—');
    expect(formatDateOnlyVN('invalid')).toBe('—');
  });

  it('formats ISO instant according to Vietnam timezone', () => {
    // 2026-10-30T17:30:00Z is 2026-10-31 00:30 in Vietnam (+7)
    const result = formatInstantDateVN('2026-10-30T17:30:00.000Z');
    expect(result).toBe('31/10/2026');
  });

  it('formatVN handles both date-only and ISO strings', () => {
    expect(formatVN('2026-10-30')).toBe('30/10/2026');
    expect(formatVN(null)).toBe('—');
  });
});
