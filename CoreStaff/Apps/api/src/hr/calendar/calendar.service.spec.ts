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

function setupRange(seed: Row[] = []) {
  const rows: Row[] = seed.map((row, index) => ({ _id: `seed${index}`, organizationId: 'org', ...row }));
  const session = {
    withTransaction: jest.fn(async (work: () => Promise<void>) => work()),
    endSession: jest.fn(async () => undefined),
  };
  const matchDate = (row: Row, cond: any) => {
    if (cond === undefined) return true;
    if (cond.$in) return cond.$in.includes(row.date);
    return (cond.$gte === undefined || row.date >= cond.$gte) && (cond.$lte === undefined || row.date <= cond.$lte);
  };
  const calendar = {
    db: { startSession: jest.fn(async () => session) },
    find: jest.fn((filter: Row) => ({
      session: jest.fn(() => ({ lean: jest.fn(async () => rows.filter(row => matchDate(row, filter.date)).map(row => ({ ...row }))) })),
    })),
    create: jest.fn(async (docs: Row[]) => docs.map((doc, index) => {
      const row = { _id: `new${rows.length + index}`, ...doc };
      rows.push(row);
      return { ...row, toObject: () => ({ ...row }) };
    })),
    deleteMany: jest.fn(async (filter: Row) => {
      const ids: unknown[] = filter._id.$in;
      for (let i = rows.length - 1; i >= 0; i -= 1) if (ids.includes(rows[i]._id)) rows.splice(i, 1);
      return { deletedCount: ids.length };
    }),
    updateOne: jest.fn(async (filter: Row, update: Row) => {
      const row = rows.find(item => item._id === filter._id);
      if (row) Object.assign(row, update.$set);
      return { modifiedCount: row ? 1 : 0 };
    }),
  };
  const policies = { overtimeAt: jest.fn(async (_org: string, _at: Date, _session?: unknown) => ({ publicHolidayRate: 3 })) };
  const overtime = { invalidate: jest.fn(async () => ({ scanned: 0, changed: 0 })) };
  const periodVersion = { bumpForWorkDates: jest.fn(async () => 1) };
  const service = new CalendarService(calendar as never, policies as never, overtime as never, periodVersion as never);
  return { service, calendar, policies, overtime, periodVersion, session, rows };
}

const tet = { startDate: '2027-02-05', endDate: '2027-02-09', type: CalendarExceptionType.PUBLIC_HOLIDAY, name: 'Tết Nguyên đán' };
const tetRows = ['2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09'].map(date => ({ date, type: 'PUBLIC_HOLIDAY', name: 'Tết Nguyên đán' }));

describe('multi-day holidays (range)', () => {
  it('creates every adjacent day in one transaction and invalidates them together', async () => {
    const ctx = setupRange();
    const created = await ctx.service.createRange('org', 'hr', tet);
    expect(created.map(row => row.date)).toEqual(['2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09']);
    expect(ctx.policies.overtimeAt).toHaveBeenCalledTimes(5);
    expect(ctx.overtime.invalidate).toHaveBeenCalledTimes(1);
    expect(ctx.periodVersion.bumpForWorkDates).toHaveBeenCalledWith('org', created.map(row => row.date), ctx.session);
  });

  it('a one-day range behaves like a single day', async () => {
    const ctx = setupRange();
    const created = await ctx.service.createRange('org', 'hr', { ...tet, endDate: tet.startDate });
    expect(created).toHaveLength(1);
  });

  it('rejects an end date before the start date with both dates in the message', async () => {
    const ctx = setupRange();
    await expect(ctx.service.createRange('org', 'hr', { ...tet, endDate: '2027-02-01' })).rejects.toThrow(/CALENDAR_RANGE_INVALID.*01\/02\/2027.*05\/02\/2027/);
    expect(ctx.calendar.create).not.toHaveBeenCalled();
  });

  it('rejects a range longer than the limit and says how many days were chosen', async () => {
    const ctx = setupRange();
    await expect(ctx.service.createRange('org', 'hr', { ...tet, endDate: '2027-04-30' })).rejects.toThrow(/CALENDAR_RANGE_TOO_LONG.*31/);
    expect(ctx.calendar.create).not.toHaveBeenCalled();
  });

  it('creates nothing and lists the days that are already configured', async () => {
    const ctx = setupRange([{ date: '2027-02-07', type: 'SPECIAL_WORKING_DAY', name: 'Làm bù' }]);
    await expect(ctx.service.createRange('org', 'hr', tet)).rejects.toThrow(/CALENDAR_DATE_ALREADY_CONFIGURED.*07\/02\/2027 \(Làm bù\)/);
    expect(ctx.calendar.create).not.toHaveBeenCalled();
    expect(ctx.overtime.invalidate).not.toHaveBeenCalled();
  });

  it('creates nothing and lists every day without an overtime policy', async () => {
    const ctx = setupRange();
    ctx.policies.overtimeAt.mockImplementation(async (_org: string, at: Date) => {
      if (at.toISOString().slice(0, 10) >= '2027-02-08') throw new NotFoundException('OVERTIME_POLICY_NOT_FOUND');
      return { publicHolidayRate: 3 };
    });
    await expect(ctx.service.createRange('org', 'hr', tet)).rejects.toThrow(/OVERTIME_POLICY_NOT_FOUND.*2 ngày: 08\/02\/2027, 09\/02\/2027/);
    expect(ctx.calendar.create).not.toHaveBeenCalled();
  });

  it('extends a run: keeps existing days and adds the new ones', async () => {
    const ctx = setupRange(tetRows);
    const result = await ctx.service.updateRange('org', 'hr', { ...tet, originalFrom: '2027-02-05', originalTo: '2027-02-09', endDate: '2027-02-11' });
    expect(result.map(row => row.date)).toEqual(['2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-02-10', '2027-02-11']);
    expect(ctx.calendar.create).toHaveBeenCalledWith([expect.objectContaining({ date: '2027-02-10' }), expect.objectContaining({ date: '2027-02-11' })], expect.anything());
    expect(ctx.calendar.deleteMany).not.toHaveBeenCalled();
    expect(ctx.periodVersion.bumpForWorkDates).toHaveBeenCalledWith('org', ['2027-02-10', '2027-02-11'], ctx.session);
  });

  it('shortens a run: deletes the dropped days', async () => {
    const ctx = setupRange(tetRows);
    const result = await ctx.service.updateRange('org', 'hr', { ...tet, originalFrom: '2027-02-05', originalTo: '2027-02-09', startDate: '2027-02-06', endDate: '2027-02-08' });
    expect(result.map(row => row.date)).toEqual(['2027-02-06', '2027-02-07', '2027-02-08']);
    expect(ctx.rows.map(row => row.date)).toEqual(['2027-02-06', '2027-02-07', '2027-02-08']);
    expect(ctx.periodVersion.bumpForWorkDates).toHaveBeenCalledWith('org', ['2027-02-05', '2027-02-09'], ctx.session);
  });

  it('renames the whole run in one step', async () => {
    const ctx = setupRange(tetRows);
    const result = await ctx.service.updateRange('org', 'hr', { ...tet, originalFrom: '2027-02-05', originalTo: '2027-02-09', name: 'Nghỉ Tết' });
    expect(result.every(row => row.name === 'Nghỉ Tết')).toBe(true);
    expect(ctx.calendar.updateOne).toHaveBeenCalledTimes(5);
    expect(ctx.calendar.create).not.toHaveBeenCalled();
  });

  it('does not touch anything when nothing changed', async () => {
    const ctx = setupRange(tetRows);
    await ctx.service.updateRange('org', 'hr', { ...tet, originalFrom: '2027-02-05', originalTo: '2027-02-09' });
    expect(ctx.calendar.updateOne).not.toHaveBeenCalled();
    expect(ctx.overtime.invalidate).not.toHaveBeenCalled();
  });

  it('refuses to extend into a day that belongs to another configuration', async () => {
    const ctx = setupRange([...tetRows, { date: '2027-02-10', type: 'SPECIAL_WORKING_DAY', name: 'Làm bù' }]);
    await expect(ctx.service.updateRange('org', 'hr', { ...tet, originalFrom: '2027-02-05', originalTo: '2027-02-09', endDate: '2027-02-10' })).rejects.toThrow(/10\/02\/2027 \(Làm bù\)/);
    expect(ctx.calendar.create).not.toHaveBeenCalled();
    expect(ctx.calendar.deleteMany).not.toHaveBeenCalled();
  });

  it('reports a missing original range as not found', async () => {
    const ctx = setupRange();
    await expect(ctx.service.updateRange('org', 'hr', { ...tet, originalFrom: '2027-02-05', originalTo: '2027-02-09' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes a whole run and invalidates its days', async () => {
    const ctx = setupRange(tetRows);
    const result = await ctx.service.removeRange('org', '2027-02-05', '2027-02-09');
    expect(result).toMatchObject({ deleted: 5, from: '2027-02-05', to: '2027-02-09' });
    expect(ctx.rows).toHaveLength(0);
    expect(ctx.periodVersion.bumpForWorkDates).toHaveBeenCalledWith('org', result.dates, ctx.session);
  });
});
