import { hasCompoundIndex } from '../indexes';
import { CalendarExceptionSchema } from './calendar-exception.schema';
import { EmployeeDayOverrideSchema } from './employee-day-override.schema';

describe('Sprint 4 scheduling schema invariants', () => {
  it('enforces one calendar exception per tenant date', () => {
    expect(hasCompoundIndex(CalendarExceptionSchema, ['organizationId', 'date'], true)).toBe(true);
  });

  it('enforces one employee override per date', () => {
    expect(hasCompoundIndex(EmployeeDayOverrideSchema, ['organizationId', 'employeeId', 'date'], true)).toBe(true);
  });
});
