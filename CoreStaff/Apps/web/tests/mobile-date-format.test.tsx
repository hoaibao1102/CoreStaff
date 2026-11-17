import { formatDate, isoDatesToVN, maskDateInput, parseDateVN } from '../../mobile/src/date';

describe('mobile date formatting is always dd/mm/yyyy', () => {
  it('formats date-only strings without touching the timezone', () => {
    expect(formatDate('2027-02-05')).toBe('05/02/2027');
    expect(formatDate('2027-02-05T00:00:00')).toBe('05/02/2027');
    expect(formatDate(null)).toBe('-');
    expect(formatDate('')).toBe('-');
  });

  it('converts an instant to its date in Vietnam time', () => {
    expect(formatDate('2027-03-04T20:00:00.000Z')).toBe('05/03/2027');
    expect(formatDate('2027-03-04T16:59:59Z')).toBe('04/03/2027');
    expect(formatDate('2027-03-05T00:30:00+07:00')).toBe('05/03/2027');
  });

  it('rewrites ISO dates inside messages', () => {
    expect(isoDatesToVN('Ngày bắt đầu (2020-01-01) đã qua; hạn 2027-12-31.')).toBe('Ngày bắt đầu (01/01/2020) đã qua; hạn 31/12/2027.');
    expect(isoDatesToVN('Không có ngày nào')).toBe('Không có ngày nào');
  });

  it('masks and parses typed dates', () => {
    expect(maskDateInput('0502')).toBe('05/02');
    expect(maskDateInput('05/02/2027')).toBe('05/02/2027');
    expect(parseDateVN('05/02/2027')).toBe('2027-02-05');
    expect(parseDateVN('31/02/2027')).toBeNull();
    expect(parseDateVN('05/02')).toBeNull();
  });
});
