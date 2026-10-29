import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { LeaveDurationType, LeaveRequestStatus } from '../../database/schemas/enums';
import { calculateLeaveDay, leaveIntervalsOverlap, LeaveService } from './leave.service';

type Row = Record<string, any>;

function build(initial: Row, managedDepartments = ['department-1']) {
  const row = { ...initial };
  const session = {
    withTransaction: jest.fn(async (work: () => Promise<void>) => work()),
    endSession: jest.fn(async () => undefined),
  };
  const requests = {
    findOne: jest.fn(() => ({ session: () => ({ lean: async () => ({ ...row }) }) })),
    findOneAndUpdate: jest.fn((filter: Row, update: Row) => ({
      lean: async () => {
        if (row.status !== filter.status) return null;
        Object.assign(row, update.$set);
        return { ...row };
      },
    })),
  };
  const actions = { create: jest.fn(async () => undefined) };
  const scope = {
    requireDepartment: jest.fn(async (_org: string, _manager: string, departmentId: string) => {
      if (!managedDepartments.includes(departmentId)) throw new ForbiddenException('DEPARTMENT_SCOPE_VIOLATION');
    }),
  };
  const connection = { startSession: jest.fn(async () => session) };
  const events = { notifyLeaveChanged: jest.fn() };
  const service = new LeaveService(
    requests as any, {} as any, actions as any, {} as any, {} as any, {} as any, {} as any,
    connection as any, scope as any, {} as any, {} as any, events as any,
  );
  return { service, row, requests, actions, scope, session, events };
}

const pending = (changes: Row = {}) => ({
  _id: 'leave-1', organizationId: 'org-1', employeeId: 'employee-1',
  departmentId: 'department-1', status: LeaveRequestStatus.PENDING_MANAGER, ...changes,
});

describe('LeaveService manager authorization', () => {
  it('allows the assigned department manager to approve and preserves audit identity and timestamp', async () => {
    const ctx = build(pending());

    await expect(ctx.service.managerDecision('org-1', 'manager-1', 'leave-1', true))
      .resolves.toMatchObject({ status: LeaveRequestStatus.APPROVED, reviewedBy: 'manager-1' });

    expect(ctx.requests.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: LeaveRequestStatus.PENDING_MANAGER }),
      { $set: expect.objectContaining({ status: LeaveRequestStatus.APPROVED, reviewedBy: 'manager-1', reviewedAt: expect.any(Date) }) },
      expect.objectContaining({ session: ctx.session }),
    );
    expect(ctx.actions.create).toHaveBeenCalledWith([
      expect.objectContaining({ actorId: 'manager-1', action: 'APPROVE', previousStatus: LeaveRequestStatus.PENDING_MANAGER, newStatus: LeaveRequestStatus.APPROVED }),
    ], { session: ctx.session });
  });

  it('preserves a trimmed rejection reason in the request and approval history', async () => {
    const ctx = build(pending());
    await ctx.service.managerDecision('org-1', 'manager-1', 'leave-1', false, '  Không đủ nhân sự  ');
    expect(ctx.row).toMatchObject({ status: LeaveRequestStatus.REJECTED, reviewComment: 'Không đủ nhân sự' });
    expect(ctx.actions.create).toHaveBeenCalledWith([
      expect.objectContaining({ actorId: 'manager-1', action: 'REJECT', comment: 'Không đủ nhân sự' }),
    ], { session: ctx.session });
  });

  it('rejects a manager outside the employee department without changing status or history', async () => {
    const ctx = build(pending({ departmentId: 'department-2' }));
    await expect(ctx.service.managerDecision('org-1', 'manager-1', 'leave-1', true))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(ctx.requests.findOneAndUpdate).not.toHaveBeenCalled();
    expect(ctx.actions.create).not.toHaveBeenCalled();
  });

  it('rejects employee self-approval', async () => {
    const ctx = build(pending({ employeeId: 'manager-1' }));
    await expect(ctx.service.managerDecision('org-1', 'manager-1', 'leave-1', true))
      .rejects.toThrow('LEAVE_SELF_APPROVAL_FORBIDDEN');
    expect(ctx.requests.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('requires a rejection reason and only decides pending requests', async () => {
    const missingReason = build(pending());
    await expect(missingReason.service.managerDecision('org-1', 'manager-1', 'leave-1', false, ' '))
      .rejects.toBeInstanceOf(BadRequestException);
    const decided = build(pending({ status: LeaveRequestStatus.APPROVED }));
    await expect(decided.service.managerDecision('org-1', 'manager-1', 'leave-1', true))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('does not emit a result event when the audit transaction fails', async () => {
    const ctx = build(pending());
    ctx.actions.create.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(ctx.service.managerDecision('org-1', 'manager-1', 'leave-1', true)).rejects.toThrow('audit unavailable');
    expect(ctx.events.notifyLeaveChanged).not.toHaveBeenCalled();
    expect(ctx.session.endSession).toHaveBeenCalled();
  });
});

describe('employee leave cancellation', () => {
  it('allows an employee to cancel only their own pending request and audits it', async () => {
    const ctx = build(pending());
    await expect(ctx.service.cancelMine('org-1', 'employee-1', 'leave-1')).resolves.toMatchObject({ status: LeaveRequestStatus.CANCELLED });
    expect(ctx.actions.create).toHaveBeenCalledWith([
      expect.objectContaining({ actorId: 'employee-1', action: 'CANCEL', newStatus: LeaveRequestStatus.CANCELLED }),
    ], { session: ctx.session });
  });

  it('does not cancel an already approved request', async () => {
    const ctx = build(pending({ status: LeaveRequestStatus.APPROVED }));
    await expect(ctx.service.cancelMine('org-1', 'employee-1', 'leave-1')).rejects.toThrow('LEAVE_REQUEST_CANNOT_CANCEL');
  });
});

describe('partial-day leave calculation', () => {
  it('derives a morning half-day from the scheduled shift and unpaid break', () => {
    expect(calculateLeaveDay('2026-10-28', '08:00', '17:00', 60, LeaveDurationType.MORNING_HALF)).toMatchObject({
      requestedStart: '08:00', requestedEnd: '12:00', calculatedMinutes: 240, leaveEquivalent: 0.5,
    });
  });

  it('derives an afternoon half-day from the scheduled shift and unpaid break', () => {
    expect(calculateLeaveDay('2026-10-28', '08:00', '17:00', 60, LeaveDurationType.AFTERNOON_HALF)).toMatchObject({
      requestedStart: '13:00', requestedEnd: '17:00', calculatedMinutes: 240, leaveEquivalent: 0.5,
    });
  });

  it('uses nonstandard scheduled hours instead of hardcoded noon boundaries', () => {
    expect(calculateLeaveDay('2026-10-28', '06:30', '15:30', 60, LeaveDurationType.MORNING_HALF)).toMatchObject({
      requestedStart: '06:30', requestedEnd: '10:30', calculatedMinutes: 240,
    });
    expect(calculateLeaveDay('2026-10-28', '06:30', '15:30', 60, LeaveDurationType.AFTERNOON_HALF)).toMatchObject({
      requestedStart: '11:30', requestedEnd: '15:30', calculatedMinutes: 240,
    });
  });

  it('keeps full-day calculation backward compatible while excluding the break', () => {
    expect(calculateLeaveDay('2026-10-28', '08:00', '17:00', 60, LeaveDurationType.FULL_DAY)).toMatchObject({
      requestedStart: '08:00', requestedEnd: '17:00', calculatedMinutes: 480, leaveEquivalent: 1,
    });
  });

  it('allows morning and afternoon requests on the same date but detects real overlap', () => {
    expect(leaveIntervalsOverlap('08:00', '12:00', '13:00', '17:00')).toBe(false);
    expect(leaveIntervalsOverlap('08:00', '12:00', '11:00', '15:00')).toBe(true);
  });

  it('excludes an explicit lunch break from a custom hourly request', () => {
    expect(calculateLeaveDay('2026-10-28', '08:00', '17:00', 60, LeaveDurationType.CUSTOM_HOURS, '10:00', '15:00', '12:00', '13:00')).toMatchObject({
      requestedStart: '10:00', requestedEnd: '15:00', calculatedMinutes: 240, leaveEquivalent: 0.5,
      approvedLeaveIntervals: [{ from: '10:00', to: '12:00' }, { from: '13:00', to: '15:00' }],
      requiredWorkingIntervals: [{ from: '08:00', to: '10:00' }, { from: '15:00', to: '17:00' }],
    });
  });

  it('rejects a custom request entirely inside the unpaid break', () => {
    expect(() => calculateLeaveDay('2026-10-28', '08:00', '17:00', 60, LeaveDurationType.CUSTOM_HOURS, '12:10', '12:50', '12:00', '13:00'))
      .toThrow('LEAVE_INTERVAL_OUTSIDE_WORKING_TIME');
  });

  it('uses configured unequal morning and afternoon boundaries', () => {
    expect(calculateLeaveDay('2026-10-28', '07:00', '17:00', 60, LeaveDurationType.MORNING_HALF, undefined, undefined, '11:00', '12:00')).toMatchObject({
      requestedStart: '07:00', requestedEnd: '11:00', calculatedMinutes: 240, leaveEquivalent: 0.5,
    });
    expect(calculateLeaveDay('2026-10-28', '07:00', '17:00', 60, LeaveDurationType.AFTERNOON_HALF, undefined, undefined, '11:00', '12:00')).toMatchObject({
      requestedStart: '12:00', requestedEnd: '17:00', calculatedMinutes: 300, leaveEquivalent: 0.5,
    });
  });
});
