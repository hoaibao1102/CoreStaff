import { validateMinimumWorkingAge, validateOptionalDateOfBirth } from '../src/screens/EmployeeDirectory/validation';
import { validateEditDateOfBirth } from '../src/screens/EmployeeDetail/validation';

/** Local `YYYY-MM-DD` for `years` before today, offset by `days`. */
function isoYearsAgo(years: number, days = 0): string {
  const now = new Date();
  const d = new Date(now.getFullYear() - years, now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('minimum working age (QC 3.1)', () => {
  it('accepts exactly 15 years old and older', () => {
    expect(validateMinimumWorkingAge(isoYearsAgo(15))).toBeNull();
    expect(validateMinimumWorkingAge(isoYearsAgo(30))).toBeNull();
  });

  it('rejects one day short of the 15th birthday', () => {
    expect(validateMinimumWorkingAge(isoYearsAgo(15, 1))).toContain('đủ 15 tuổi');
  });

  it('is optional and ignores unparseable input', () => {
    expect(validateMinimumWorkingAge('')).toBeNull();
    expect(validateMinimumWorkingAge('not-a-date')).toBeNull();
  });

  it('is wired into both create and edit date-of-birth validators', () => {
    expect(validateOptionalDateOfBirth(isoYearsAgo(10))).toContain('đủ 15 tuổi');
    expect(validateOptionalDateOfBirth(isoYearsAgo(20))).toBeNull();
    expect(validateEditDateOfBirth(isoYearsAgo(10))).toContain('đủ 15 tuổi');
    expect(validateEditDateOfBirth(isoYearsAgo(20))).toBeNull();
  });
});
