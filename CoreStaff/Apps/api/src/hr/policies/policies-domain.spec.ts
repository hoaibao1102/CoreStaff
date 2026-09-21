import {
  evaluateLaborLimits,
  resolveOvertimeRates,
  OvertimeType,
} from './policies-domain';

const vnLabor = {
  version: 1,
  legalReference: 'BLLĐ 45/2019/QH14',
  normalDailyMinutes: 480,
  normalWeeklyMinutes: 2880,
  maxCombinedDailyMinutes: 720,
  maxMonthlyOvertimeMinutes: 2400,
  maxAnnualOvertimeMinutes: 20000,
  exceptionalAnnualOvertimeMinutes: 24000,
  warningThresholdPercent: 80,
};

describe('policies domain (TASK-036/037)', () => {
  describe('evaluateLaborLimits (AC-LABOR-01)', () => {
    it('approves when every usage is under the warning threshold', () => {
      const result = evaluateLaborLimits(vnLabor, {
        normalDailyMinutes: 360,
        normalWeeklyMinutes: 2000,
        combinedDailyMinutes: 420,
        overtimeMonthlyMinutes: 1000,
        overtimeAnnualMinutes: 8000,
      });
      expect(result.approvable).toBe(true);
      expect(result.policyVersion).toBe(1);
      expect(result.legalReference).toBe('BLLĐ 45/2019/QH14');
      expect(result.violations).toHaveLength(0);
    });

    it('warns (not blocks) at/above 80% but below the limit', () => {
      const result = evaluateLaborLimits(vnLabor, { combinedDailyMinutes: 700 });
      expect(result.approvable).toBe(true);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'maxCombinedDaily', severity: 'WARNING', code: 'OVERTIME_DAILY_LIMIT_EXCEEDED' }),
        ]),
      );
    });

    it('blocks with the daily/hour codes when a limit is exceeded', () => {
      const result = evaluateLaborLimits(vnLabor, {
        normalDailyMinutes: 500,
        combinedDailyMinutes: 800,
      });
      expect(result.approvable).toBe(false);
      const codes = result.violations.map((v) => v.code);
      expect(codes).toContain('NORMAL_HOURS_LIMIT_EXCEEDED');
      expect(codes).toContain('OVERTIME_DAILY_LIMIT_EXCEEDED');
      expect(result.violations.filter((v) => v.severity === 'BLOCK').length).toBe(2);
    });

    it('checks weekly and monthly OT caps independently', () => {
      const result = evaluateLaborLimits(vnLabor, {
        normalWeeklyMinutes: 3000,
        overtimeMonthlyMinutes: 2500,
      });
      expect(result.violations.map((v) => v.code)).toEqual(
        expect.arrayContaining(['NORMAL_HOURS_LIMIT_EXCEEDED', 'OVERTIME_MONTHLY_LIMIT_EXCEEDED']),
      );
      expect(result.approvable).toBe(false);
    });

    it('allows annual OT beyond the limit when exceptional headroom is configured', () => {
      const result = evaluateLaborLimits(vnLabor, { overtimeAnnualMinutes: 21000 });
      expect(result.approvable).toBe(true);
      // Warnings still fire ≥ threshold; only the annual cap constrains approvable.
      const blocks = result.violations.filter((v) => v.severity === 'BLOCK');
      expect(blocks).toHaveLength(0);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'maxAnnualOvertime', severity: 'WARNING' }),
        ]),
      );
    });

    it('blocks annual OT beyond the exceptional headroom too', () => {
      const result = evaluateLaborLimits(vnLabor, { overtimeAnnualMinutes: 25000 });
      expect(result.approvable).toBe(false);
      expect(result.violations.map((v) => v.code)).toContain('OVERTIME_ANNUAL_LIMIT_EXCEEDED');
    });

    it('throws on a non-finite negative usage metric', () => {
      expect(() => evaluateLaborLimits(vnLabor, { combinedDailyMinutes: -1 })).toThrow('INVALID_LABOR_USAGE');
    });
  });

  describe('resolveOvertimeRates (AC-OT-PAY-01)', () => {
    const policy = {
      version: 3,
      legalReference: 'BLLĐ 45/2019/QH14',
      workingDayRate: 1.5,
      weeklyOffRate: 2,
      publicHolidayRate: 3,
    };

    it('classifies working day / weekly off / public holiday', () => {
      const { rates } = resolveOvertimeRates(policy, [
        { date: '2026-01-05' },
        { date: '2026-01-04', isWeeklyOff: true },
        { date: '2026-01-01', isPublicHoliday: true },
      ]);
      expect(rates).toEqual([
        { date: '2026-01-05', type: OvertimeType.WORKING_DAY, rate: 1.5 },
        { date: '2026-01-04', type: OvertimeType.WEEKLY_OFF, rate: 2 },
        { date: '2026-01-01', type: OvertimeType.PUBLIC_HOLIDAY, rate: 3 },
      ]);
    });

    it('never double counts a public holiday that is also a weekly off', () => {
      const { rates } = resolveOvertimeRates(policy, [
        { date: '2026-09-06', isWeeklyOff: true, isPublicHoliday: true },
      ]);
      expect(rates[0]).toEqual({ date: '2026-09-06', type: OvertimeType.PUBLIC_HOLIDAY, rate: 3 });
    });

    it('surfaces policyVersion and legalReference for audit', () => {
      const result = resolveOvertimeRates(policy, [{ date: '2026-01-05' }]);
      expect(result.policyVersion).toBe(3);
      expect(result.legalReference).toBe('BLLĐ 45/2019/QH14');
    });

    it('throws on a negative configured rate', () => {
      expect(() => resolveOvertimeRates({ ...policy, workingDayRate: -0.5 }, [{}])).toThrow('INVALID_OVERTIME_RATE');
    });
  });
});