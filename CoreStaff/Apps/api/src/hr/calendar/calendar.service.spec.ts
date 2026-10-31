import { NotFoundException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarExceptionType } from '../../database/schemas/enums';

const dto = { date: '2026-09-02', type: CalendarExceptionType.PUBLIC_HOLIDAY, name: 'Quốc khánh' };

type Row = Record<string, any>;

function setup(current: Row = { ...dto, _id: 'c1' }) {
  const state: { row: Row | null } = { row: { ...current } };
  const session = {
    withTransaction: jest.fn(async (work: () => Promise<void>) => work()),
    endSession: jest.fn(async () => undefined),
  };
  const query = (value: () => unknown) => ({
    session: jest.fn(() => ({ lean: jest.fn(async () => value()) })),
    lean: jest.fn(async () => value()),
  });
  const calendar = {
    db: { startSession: jest.fn(async () => session) },
    create: jest.fn(async (rows: Row[]) => {
      state.row = { ...rows[0], _id: 'created' };
      return [{ ...state.row, toObject: () => ({ ...state.row }) }];
    }),
    findOne: jest.fn(() => query(() => state.row && { ...state.row })),
    findOneAndUpdate: jest.fn((_filter: Row, update: Row) => ({
      lean: jest.fn(async () => {
        if (!state.row) return null;
        state.row = { ...state.row, ...update.$set };
        return { ...state.row };
      }),
    })),
    deleteOne: jest.fn(async () => {
      const deletedCount = state.row ? 1 : 0;
      state.row = null;
      return { deletedCount };
    }),
  };
  const policies = { overtimeAt: jest.fn(async () => ({ publicHolidayRate: 3 })) };
  const overtime = { invalidate: jest.fn(async () => ({ scanned: 0, changed: 0 })) };
  const periodVersion = { bumpForWorkDates: jest.fn(async () => 1) };
  const service = new CalendarService(calendar as never, policies as never, overtime as never, periodVersion as never);
  return { service, calendar, policies, overtime, periodVersion, session, state };
}

describe('Calendar overtime policy enforcement', () => {
  it('resolves the policy for the tenant and calendar date in the transaction before creating', async () => {
    const { service, policies, session } = setup();
    await service.create('org', 'hr', dto);
    expect(policies.overtimeAt).toHaveBeenCalledWith('org', new Date(dto.date), session);
  });

  it('does not write a calendar day without an effective overtime policy', async () => {
    const { service, policies, calendar } = setup();
    policies.overtimeAt.mockRejectedValueOnce(new NotFoundException('OVERTIME_POLICY_NOT_FOUND'));
    await expect(service.create('org', 'hr', dto)).rejects.toThrow('OVERTIME_POLICY_NOT_FOUND');
    expect(calendar.create).not.toHaveBeenCalled();
  });

  it('rechecks the policy on the changed date and blocks the update when absent', async () => {
    const { service, policies, calendar } = setup();
    policies.overtimeAt.mockRejectedValueOnce(new NotFoundException('OVERTIME_POLICY_NOT_FOUND'));
    await expect(service.update('org', 'hr', 'c1', { date: '2027-01-01' })).rejects.toThrow('OVERTIME_POLICY_NOT_FOUND');
    expect(calendar.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('calendar projection invalidation', () => {
  it('couples create, OT invalidation, and one batch period bump in one session', async () => {
    const ctx = setup();
    await ctx.service.create('org', 'hr', dto);

    expect(ctx.calendar.create).toHaveBeenCalledWith([expect.objectContaining({ date: dto.date })], { session: ctx.session });
    expect(ctx.overtime.invalidate).toHaveBeenCalledWith('org', [dto.date], ctx.session, { bumpPeriodVersion: false });
    expect(ctx.periodVersion.bumpForWorkDates).toHaveBeenCalledTimes(1);
    expect(ctx.periodVersion.bumpForWorkDates).toHaveBeenCalledWith('org', [dto.date], ctx.session);
    expect(ctx.session.endSession).toHaveBeenCalled();
  });

  it('invalidates old and new dates in one batch when a calendar exception moves', async () => {
    const ctx = setup({ ...dto, date: '2026-09-01', _id: 'c1' });
    await ctx.service.update('org', 'hr', 'c1', { date: '2026-09-02' });

    expect(ctx.overtime.invalidate).toHaveBeenCalledTimes(1);
    expect(ctx.overtime.invalidate).toHaveBeenCalledWith('org', ['2026-09-01', '2026-09-02'], ctx.session, { bumpPeriodVersion: false });
    expect(ctx.periodVersion.bumpForWorkDates).toHaveBeenCalledTimes(1);
    expect(ctx.periodVersion.bumpForWorkDates).toHaveBeenCalledWith('org', ['2026-09-01', '2026-09-02'], ctx.session);
  });

  it('fails closed and propagates invalidation errors from the transaction', async () => {
    const ctx = setup();
    ctx.overtime.invalidate.mockRejectedValueOnce(new Error('OT projection unavailable'));

    await expect(ctx.service.create('org', 'hr', dto)).rejects.toThrow('OT projection unavailable');
    expect(ctx.session.withTransaction).toHaveBeenCalledTimes(1);
    expect(ctx.periodVersion.bumpForWorkDates).not.toHaveBeenCalled();
    expect(ctx.session.endSession).toHaveBeenCalled();
  });

  it('fails closed and propagates period bump errors', async () => {
    const ctx = setup();
    ctx.periodVersion.bumpForWorkDates.mockRejectedValueOnce(new Error('period version unavailable'));

    await expect(ctx.service.create('org', 'hr', dto)).rejects.toThrow('period version unavailable');
    expect(ctx.overtime.invalidate).toHaveBeenCalledTimes(1);
    expect(ctx.session.endSession).toHaveBeenCalled();
  });

  it('does not invalidate or bump when delete is a no-op', async () => {
    const ctx = setup();
    ctx.calendar.deleteOne.mockResolvedValueOnce({ deletedCount: 0 });

    await expect(ctx.service.remove('org', 'c1')).rejects.toThrow('CALENDAR_EXCEPTION_NOT_FOUND');
    expect(ctx.overtime.invalidate).not.toHaveBeenCalled();
    expect(ctx.periodVersion.bumpForWorkDates).not.toHaveBeenCalled();
  });

  it('invalidates and bumps once after a successful delete', async () => {
    const ctx = setup();
    await expect(ctx.service.remove('org', 'c1')).resolves.toEqual({ id: 'c1', deleted: true });

    expect(ctx.calendar.deleteOne).toHaveBeenCalledWith({ _id: 'c1', organizationId: 'org' }, { session: ctx.session });
    expect(ctx.overtime.invalidate).toHaveBeenCalledWith('org', [dto.date], ctx.session, { bumpPeriodVersion: false });
    expect(ctx.periodVersion.bumpForWorkDates).toHaveBeenCalledWith('org', [dto.date], ctx.session);
  });
});
