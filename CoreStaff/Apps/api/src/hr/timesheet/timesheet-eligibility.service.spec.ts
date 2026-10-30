import {
  determineTimesheetEligibility,
  TimesheetEligibilityService,
  type EligibilityCandidate,
} from './timesheet-eligibility.service';

const period = { startDate: '2026-09-01', endDate: '2026-09-30' };
const base: EligibilityCandidate = {
  employeeProfileId: 'p1',
  userId: 'u1',
  organizationId: 'org-1',
  employmentStatus: 'ACTIVE',
  employmentType: 'FULL_TIME',
  joinDate: '2026-01-01',
  assignments: [{ id: 'a1', departmentId: 'd1', effectiveFrom: '2026-01-01', active: true }],
  scheduledObligationDates: ['2026-09-01'],
};

describe('canonical timesheet eligibility', () => {
  it('includes a zero-attendance employee when an effective assignment has a scheduled obligation', () => {
    expect(determineTimesheetEligibility(base, period)).toMatchObject({ eligible: true, departmentIds: ['d1'] });
  });

  it('includes both effective departments for a mid-period transfer', () => {
    const result = determineTimesheetEligibility({
      ...base,
      assignments: [
        { id: 'a1', departmentId: 'd1', effectiveFrom: '2026-01-01', effectiveTo: '2026-09-15', active: true },
        { id: 'a2', departmentId: 'd2', effectiveFrom: '2026-09-16', active: true },
      ],
      scheduledObligationDates: ['2026-09-15', '2026-09-16'],
    }, period);
    expect(result).toMatchObject({ eligible: true, departmentIds: ['d1', 'd2'] });
  });

  it.each([
    ['joins after period', { joinDate: '2026-10-01' }],
    ['ended before period', { endDate: '2026-08-31' }],
    ['unsupported pay basis', { employmentType: 'HOURLY' }],
    ['has no effective assignment', { assignments: [] }],
    ['has no scheduled obligation', { scheduledObligationDates: [] }],
  ])('excludes an employee who %s', (_label, patch) => {
    expect(determineTimesheetEligibility({ ...base, ...patch }, period).eligible).toBe(false);
  });

  it('includes a terminated employee through their in-period end date', () => {
    expect(determineTimesheetEligibility({
      ...base,
      employmentStatus: 'TERMINATED',
      endDate: '2026-09-10',
      scheduledObligationDates: ['2026-09-10'],
    }, period).eligible).toBe(true);
  });

  it('rejects a terminal employment status without an in-period end date', () => {
    expect(determineTimesheetEligibility({
      ...base,
      employmentStatus: 'TERMINATED',
      endDate: undefined,
    }, period)).toMatchObject({ eligible: false, reason: 'OUTSIDE_EMPLOYMENT' });
  });

  it('rejects an unknown non-working employment status', () => {
    expect(determineTimesheetEligibility({
      ...base,
      employmentStatus: 'SUSPENDED',
    }, period)).toMatchObject({ eligible: false, reason: 'INELIGIBLE_EMPLOYMENT_STATUS' });
  });

  it('includes full-period paid leave when the underlying schedule has an obligation', () => {
    expect(determineTimesheetEligibility({
      ...base,
      scheduledObligationDates: ['2026-09-01'],
      fullPeriodLeave: true,
    }, period)).toMatchObject({ eligible: true });
  });

  it('does not special-case manager or HR identities out of their employee eligibility', () => {
    expect(determineTimesheetEligibility({ ...base, identityRoles: ['HR', 'DEPARTMENT_MANAGER'] }, period).eligible).toBe(true);
  });

  it('returns a stable versioned set ordered by employee and denies cross-tenant candidates', async () => {
    const source = {
      loadCandidates: jest.fn(async () => [{ ...base, employeeProfileId: 'p2', userId: 'u2' }, base, { ...base, organizationId: 'org-2' }]),
    };
    const service = new TimesheetEligibilityService(source as any);
    const result = await service.resolvePeriod('org-1', period);
    expect(result.version).toBe('TIMESHEET_ELIGIBILITY_V1');
    expect(result.employees.map(employee => employee.employeeProfileId)).toEqual(['p1', 'p2']);
  });
});
