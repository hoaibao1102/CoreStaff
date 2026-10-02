import { describe, expect, it } from '@jest/globals';
import { classifyDayBlockers, summarizeBlockers } from './period-blockers';

const day = (overrides: Record<string, unknown> = {}) => ({
  _id: 'day-1',
  employeeId: 'emp-1',
  workDate: '2026-10-06',
  workdayType: 'WORKING_DAY',
  employeeSnapshot: { employeeCode: 'EMP001', fullName: 'Nguyễn Văn An', departmentId: 'dept-1', departmentName: 'Kỹ thuật' },
  ...overrides,
});

describe('TASK-074 — classifyDayBlockers', () => {
  it('flags a working day with no punches as MISSING_CHECK_IN only', () => {
    const rows = classifyDayBlockers(day() as any);
    expect(rows.map((r) => r.type)).toEqual(['MISSING_CHECK_IN']);
  });

  it('flags a checked-in day with no check-out as MISSING_CHECK_OUT', () => {
    const rows = classifyDayBlockers(day({ checkInAt: new Date('2026-10-06T01:00:00Z') }) as any);
    expect(rows.map((r) => r.type)).toEqual(['MISSING_CHECK_OUT']);
  });

  it('does not flag a complete working day', () => {
    const rows = classifyDayBlockers(day({
      checkInAt: new Date('2026-10-06T01:00:00Z'),
      checkOutAt: new Date('2026-10-06T10:00:00Z'),
    }) as any);
    expect(rows).toEqual([]);
  });

  it.each([
    ['PUBLIC_HOLIDAY'],
    ['WEEKLY_OFF'],
    ['PAID_LEAVE'],
    ['UNPAID_LEAVE'],
  ])('exempts %s days with no punches', (workdayType) => {
    expect(classifyDayBlockers(day({ workdayType }) as any)).toEqual([]);
  });

  it.each([
    ['PENDING', 'PENDING_APPROVAL'],
    ['CLARIFICATION_REQUESTED', 'PENDING_CLARIFICATION'],
    ['REJECTED', 'REJECTED'],
    ['APPROVED', null],
    ['NOT_REQUIRED', null],
  ])('maps overallApprovalStatus %s to %s', (status, expected) => {
    const rows = classifyDayBlockers(day({
      checkInAt: new Date('2026-10-06T01:00:00Z'),
      checkOutAt: new Date('2026-10-06T10:00:00Z'),
      overallApprovalStatus: status,
    }) as any);
    expect(rows.map((r) => r.type)).toEqual(expected ? [expected] : []);
  });

  it('emits both rows when a day is incomplete and pending approval', () => {
    const rows = classifyDayBlockers(day({
      checkInAt: new Date('2026-10-06T01:00:00Z'),
      overallApprovalStatus: 'PENDING',
    }) as any);
    expect(rows.map((r) => r.type).sort()).toEqual(['MISSING_CHECK_OUT', 'PENDING_APPROVAL']);
  });

  it('carries employee identity, date and a stable id', () => {
    const [row] = classifyDayBlockers(day() as any);
    expect(row.id).toBe('day-1:MISSING_CHECK_IN');
    expect(row.attendanceDayId).toBe('day-1');
    expect(row.employeeId).toBe('emp-1');
    expect(row.employee).toEqual({ code: 'EMP001', name: 'Nguyễn Văn An', departmentId: 'dept-1', department: 'Kỹ thuật' });
    expect(row.date).toBe('2026-10-06');
    expect(row.note).toBe('Thiếu check-in');
  });
});

describe('TASK-074 — summarizeBlockers', () => {
  it('counts by type in canonical order and omits empty types', () => {
    const rows = [
      ...classifyDayBlockers(day() as any),
      ...classifyDayBlockers(day({ _id: 'day-2', checkInAt: new Date('2026-10-07T01:00:00Z') }) as any),
      ...classifyDayBlockers(day({ _id: 'day-3', overallApprovalStatus: 'REJECTED' }) as any),
    ];
    expect(summarizeBlockers(rows)).toEqual([
      { type: 'MISSING_CHECK_IN', message: 'Thiếu check-in', count: 2 },
      { type: 'MISSING_CHECK_OUT', message: 'Thiếu check-out', count: 1 },
      { type: 'REJECTED', message: 'Ngày công bị REJECTED', count: 1 },
    ]);
  });

  it('returns nothing for a clean period', () => {
    expect(summarizeBlockers([])).toEqual([]);
  });
});
