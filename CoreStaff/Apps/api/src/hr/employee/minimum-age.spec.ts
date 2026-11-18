import { BadRequestException } from '@nestjs/common';
import { assertWorkingAge, isWorkingAge, MINIMUM_WORKING_AGE } from './minimum-age';

const isoYearsAgo = (years: number, days = 0) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate() + days));
};

describe('minimum working age (QC 3.1)', () => {
  it('uses 15 as the legal minimum', () => {
    expect(MINIMUM_WORKING_AGE).toBe(15);
  });

  it('accepts exactly 15 years old and older', () => {
    expect(isWorkingAge(isoYearsAgo(15))).toBe(true);
    expect(isWorkingAge(isoYearsAgo(40))).toBe(true);
  });

  it('rejects one day short of the 15th birthday', () => {
    expect(isWorkingAge(isoYearsAgo(15, 1))).toBe(false);
  });

  it('treats an absent date of birth as acceptable (optional field)', () => {
    expect(isWorkingAge(undefined)).toBe(true);
    expect(isWorkingAge(null)).toBe(true);
  });

  it('throws DOB_MINIMUM_AGE for an under-age date of birth', () => {
    expect(() => assertWorkingAge(isoYearsAgo(10))).toThrow(BadRequestException);
    expect(() => assertWorkingAge(isoYearsAgo(10))).toThrow('DOB_MINIMUM_AGE');
    expect(() => assertWorkingAge(isoYearsAgo(20))).not.toThrow();
  });
});
