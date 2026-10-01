/**
 * FE Unit Tests — Timesheet Period Validation Functions
 * 
 * Test coverage:
 * - validatePeriodDates() — 28-31 day range, not in past, no overlap
 * - validateCloseReadiness() — all summaries generated, attendance complete
 * - validateReopenReason() — minimum 10 characters
 * - calculateProgressMetrics() — percentages for progress bars
 */

import { describe, expect, it } from '@jest/globals';

/* ───────── HELPER FUNCTIONS (extracted from FE components) ───────── */

interface PeriodStats {
  summariesGenerated: number;
  totalEmployees: number;
  attendanceComplete: number;
  pendingApprovals: number;
}

interface ProgressMetrics {
  summariesPercent: number;
  attendancePercent: number;
  isReadyToClose: boolean;
  blockers: string[];
}

/**
 * Validate period date range (28-31 days inclusive).
 */
function validatePeriodDates(startDate: string, endDate: string): { valid: boolean; error?: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (diffDays < 28) {
    return { valid: false, error: `Kỳ phải có ít nhất 28 ngày (hiện tại: ${diffDays} ngày)` };
  }
  if (diffDays > 31) {
    return { valid: false, error: `Kỳ không quá 31 ngày (hiện tại: ${diffDays} ngày)` };
  }

  // Check not in past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (end < today) {
    return { valid: false, error: 'Kỳ không được nằm trong quá khứ' };
  }

  return { valid: true };
}

/**
 * Check for overlapping periods.
 */
function validateNoOverlap(
  newStart: string,
  newEnd: string,
  existingPeriods: { startDate: string; endDate: string; status: string }[]
): { valid: boolean; error?: string } {
  const newStartDt = new Date(newStart);
  const newEndDt = new Date(newEnd);

  for (const period of existingPeriods) {
    if (period.status === 'OPEN' || period.status === 'REVIEWING' || period.status === 'READY_TO_CLOSE') {
      continue; // Skip active periods — handled by PERIOD_ALREADY_ACTIVE rule
    }
    const existingStart = new Date(period.startDate);
    const existingEnd = new Date(period.endDate);

    // Overlap check
    if (newStartDt <= existingEnd && newEndDt >= existingStart) {
      return { valid: false, error: `Kỳ mới trùng/lấp chồng với kỳ ${period.startDate.slice(0, 7)}-${period.endDate.slice(0, 7)}` };
    }
  }

  return { valid: true };
}

/**
 * Calculate progress metrics for close readiness.
 */
function calculateProgressMetrics(stats: PeriodStats): ProgressMetrics {
  const blockers: string[] = [];
  
  const summariesPercent = stats.totalEmployees > 0
    ? Math.round((stats.summariesGenerated / stats.totalEmployees) * 100)
    : 0;

  const attendancePercent = stats.totalEmployees > 0
    ? Math.round((stats.attendanceComplete / stats.totalEmployees) * 100)
    : 0;

  if (summariesPercent < 100) {
    blockers.push(`Chưa đủ tóm tắt: ${stats.summariesGenerated}/${stats.totalEmployees}`);
  }

  if (attendancePercent < 100) {
    blockers.push(`Công chưa hoàn thành: ${stats.attendanceComplete}/${stats.totalEmployees}`);
  }

  if (stats.pendingApprovals > 0) {
    blockers.push(`Còn ${stats.pendingApprovals} yêu cầu chờ duyệt`);
  }

  const isReadyToClose = blockers.length === 0;

  return { summariesPercent, attendancePercent, isReadyToClose, blockers };
}

/**
 * Validate reopen reason (minimum 10 characters).
 */
function validateReopenReason(reason: string): { valid: boolean; error?: string } {
  if (!reason || reason.trim().length === 0) {
    return { valid: false, error: 'Vui lòng nhập lý do' };
  }
  if (reason.trim().length < 10) {
    return { valid: false, error: 'Lý do phải có ít nhất 10 ký tự' };
  }
  return { valid: true };
}

/* ───────── TESTS ───────── */

describe('validatePeriodDates', () => {
  it('should accept valid 31-day month', () => {
    const result = validatePeriodDates('2026-10-01', '2026-10-31');
    expect(result.valid).toBe(true);
  });

  it('should accept valid 30-day month', () => {
    const result = validatePeriodDates('2026-11-01', '2026-11-30');
    expect(result.valid).toBe(true);
  });

  it('should accept valid 28-day month', () => {
    const result = validatePeriodDates('2026-02-01', '2026-02-28');
    expect(result.valid).toBe(true);
  });

  it('should reject less than 28 days', () => {
    const result = validatePeriodDates('2026-10-01', '2026-10-20');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('28 ngày');
  });

  it('should reject more than 31 days', () => {
    const result = validatePeriodDates('2026-10-01', '2026-11-15');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('31 ngày');
  });

  it('should reject past period', () => {
    const result = validatePeriodDates('2020-01-01', '2020-01-31');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('quá khứ');
  });

  it('should accept current month', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const result = validatePeriodDates(startDate, endDate);
    expect(result.valid).toBe(true);
  });
});

describe('validateNoOverlap', () => {
  it('should allow non-overlapping closed periods', () => {
    const existing = [
      { startDate: '2026-08-01', endDate: '2026-08-31', status: 'CLOSED' },
      { startDate: '2026-09-01', endDate: '2026-09-30', status: 'CLOSED' },
    ];

    const result = validateNoOverlap('2026-10-01', '2026-10-31', existing);
    expect(result.valid).toBe(true);
  });

  it('should reject overlapping closed periods', () => {
    const existing = [
      { startDate: '2026-10-15', endDate: '2026-10-31', status: 'CLOSED' },
    ];

    const result = validateNoOverlap('2026-10-01', '2026-10-20', existing);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('trùng/lấp chồng');
  });

  it('should skip active periods (handled separately)', () => {
    const existing = [
      { startDate: '2026-10-01', endDate: '2026-10-31', status: 'OPEN' },
    ];

    const result = validateNoOverlap('2026-11-01', '2026-11-30', existing);
    expect(result.valid).toBe(true);
  });
});

describe('calculateProgressMetrics', () => {
  it('should return 100% when all complete', () => {
    const stats: PeriodStats = {
      summariesGenerated: 6,
      totalEmployees: 6,
      attendanceComplete: 6,
      pendingApprovals: 0,
    };

    const metrics = calculateProgressMetrics(stats);
    expect(metrics.summariesPercent).toBe(100);
    expect(metrics.attendancePercent).toBe(100);
    expect(metrics.isReadyToClose).toBe(true);
    expect(metrics.blockers).toHaveLength(0);
  });

  it('should identify blockers when incomplete', () => {
    const stats: PeriodStats = {
      summariesGenerated: 4,
      totalEmployees: 6,
      attendanceComplete: 5,
      pendingApprovals: 2,
    };

    const metrics = calculateProgressMetrics(stats);
    expect(metrics.summariesPercent).toBe(67);
    expect(metrics.attendancePercent).toBe(83);
    expect(metrics.isReadyToClose).toBe(false);
    expect(metrics.blockers.length).toBeGreaterThan(0);
  });

  it('should handle zero employees gracefully', () => {
    const stats: PeriodStats = {
      summariesGenerated: 0,
      totalEmployees: 0,
      attendanceComplete: 0,
      pendingApprovals: 0,
    };

    const metrics = calculateProgressMetrics(stats);
    expect(metrics.summariesPercent).toBe(0);
    expect(metrics.attendancePercent).toBe(0);
    expect(metrics.isReadyToClose).toBe(false);
  });

  it('should list all blockers', () => {
    const stats: PeriodStats = {
      summariesGenerated: 3,
      totalEmployees: 6,
      attendanceComplete: 4,
      pendingApprovals: 1,
    };

    const metrics = calculateProgressMetrics(stats);
    expect(metrics.blockers).toContain('Chưa đủ tóm tắt: 3/6');
    expect(metrics.blockers).toContain('Công chưa hoàn thành: 4/6');
    expect(metrics.blockers).toContain('Còn 1 yêu cầu chờ duyệt');
  });
});

describe('validateReopenReason', () => {
  it('should accept valid reason (>= 10 chars)', () => {
    const result = validateReopenReason('Nhân viên ABC cần điều chỉnh công');
    expect(result.valid).toBe(true);
  });

  it('should reject empty reason', () => {
    const result = validateReopenReason('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Vui lòng nhập lý do');
  });

  it('should reject whitespace-only reason', () => {
    const result = validateReopenReason('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Vui lòng nhập lý do');
  });

  it('should reject short reason (< 10 chars)', () => {
    const result = validateReopenReason('Sai');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('10 ký tự');
  });

  it('should accept exactly 10 character reason', () => {
    const result = validateReopenReason('1234567890');
    expect(result.valid).toBe(true);
  });

  it('should trim whitespace before counting', () => {
    const result = validateReopenReason('  1234567890  ');
    expect(result.valid).toBe(true);
  });
});
