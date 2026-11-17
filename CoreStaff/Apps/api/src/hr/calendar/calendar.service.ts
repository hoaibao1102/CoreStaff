import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { CalendarExceptionDocument } from '../../database/schemas/calendar-exception.schema';
import { CreateCalendarExceptionDto, CreateCalendarRangeDto, UpdateCalendarExceptionDto, UpdateCalendarRangeDto } from './dto/calendar.dto';
import { dateOnly, dateVN, enumerateDates } from '../../common/date-only';
import { PoliciesService } from '../policies/policies.service';
import { OvertimeService } from '../overtime/overtime.service';
import { PeriodVersionService } from '../timesheet/period-version.service';

/** A multi-day holiday (Tết, Quốc khánh...) is never longer than a month. */
export const MAX_CALENDAR_RANGE_DAYS = 31;
const MAX_EXISTING_RANGE_DAYS = 366;

@Injectable()
export class CalendarService {
  constructor(
    @InjectModel('CalendarException') private readonly calendar: Model<CalendarExceptionDocument>,
    private readonly policies: PoliciesService,
    private readonly overtime: OvertimeService,
    private readonly periodVersion: PeriodVersionService,
  ) {}

  private async invalidateProjection(org: string, dates: string[], session: ClientSession) {
    const uniqueDates = [...new Set(dates.map(dateOnly))].sort();
    await this.overtime.invalidate(org, uniqueDates, session, { bumpPeriodVersion: false });
    await this.periodVersion.bumpForWorkDates(org, uniqueDates, session);
  }

  async create(org: string, actorId: string, dto: CreateCalendarExceptionDto) {
    const session = await this.calendar.db.startSession();
    try {
      let created: unknown;
      await session.withTransaction(async () => {
        const date = dateOnly(dto.date);
        await this.policies.overtimeAt(org, new Date(date), session);
        const [row] = await this.calendar.create([{ ...dto, date, name: dto.name.trim(), organizationId: org, createdBy: actorId }], { session });
        await this.invalidateProjection(org, [date], session);
        created = row.toObject();
      });
      return created;
    } catch (error) {
      throw duplicateCalendar(error);
    } finally {
      await session.endSession();
    }
  }

  async list(org: string, from?: string, to?: string) {
    const filter: Record<string, unknown> = { organizationId: org };
    if (from || to) filter.date = { ...(from ? { $gte: dateOnly(from) } : {}), ...(to ? { $lte: dateOnly(to) } : {}) };
    return this.calendar.find(filter).sort({ date: 1 }).lean();
  }

  async get(org: string, id: string) {
    const row = await this.calendar.findOne({ _id: id, organizationId: org }).lean();
    if (!row) throw new NotFoundException('CALENDAR_EXCEPTION_NOT_FOUND');
    return row;
  }

  async update(org: string, actorId: string, id: string, dto: UpdateCalendarExceptionDto) {
    const session = await this.calendar.db.startSession();
    try {
      let updated: Record<string, unknown> | undefined;
      await session.withTransaction(async () => {
        const current = await this.calendar.findOne({ _id: id, organizationId: org }).session(session).lean();
        if (!current) throw new NotFoundException('CALENDAR_EXCEPTION_NOT_FOUND');
        const newDate = dateOnly(dto.date ?? current.date);
        await this.policies.overtimeAt(org, new Date(newDate), session);
        const patch = { ...dto, ...(dto.date ? { date: newDate } : {}), ...(dto.name ? { name: dto.name.trim() } : {}), updatedBy: actorId };
        const row = await this.calendar.findOneAndUpdate(
          { _id: id, organizationId: org },
          { $set: patch },
          { new: true, runValidators: true, session },
        ).lean();
        if (!row) throw new NotFoundException('CALENDAR_EXCEPTION_NOT_FOUND');
        await this.invalidateProjection(org, [dateOnly(current.date), newDate], session);
        updated = row;
      });
      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw duplicateCalendar(error);
    } finally {
      await session.endSession();
    }
  }

  /** Validates a start/end pair and returns every day in it (inclusive). */
  private expandRange(startDate: string, endDate: string, max = MAX_CALENDAR_RANGE_DAYS): string[] {
    const start = dateOnly(startDate);
    const end = dateOnly(endDate);
    if (end < start) throw new BadRequestException(`CALENDAR_RANGE_INVALID: Ngày kết thúc (${dateVN(end)}) không được trước ngày bắt đầu (${dateVN(start)}).`);
    const dates = enumerateDates(start, end);
    if (dates.length > max) throw new BadRequestException(`CALENDAR_RANGE_TOO_LONG: Một lần chỉ tạo tối đa ${max} ngày liền kề (bạn đã chọn ${dates.length} ngày, từ ${dateVN(start)} đến ${dateVN(end)}).`);
    return dates;
  }

  /** Every day needs an effective overtime policy; report all missing days at once. */
  private async assertPoliciesFor(org: string, dates: string[], session: ClientSession) {
    const missing: string[] = [];
    for (const day of dates) {
      try {
        await this.policies.overtimeAt(org, new Date(day), session);
      } catch (error) {
        if (error instanceof NotFoundException) missing.push(day);
        else throw error;
      }
    }
    if (missing.length) throw new NotFoundException(`OVERTIME_POLICY_NOT_FOUND: Chưa có Chính sách lương tăng ca có hiệu lực cho ${missing.length} ngày: ${missing.map(dateVN).join(', ')}. Hãy cấu hình chính sách trước khi lưu lịch.`);
  }

  private conflictError(rows: Array<{ date: string; name?: string }>) {
    const list = rows.map(row => `${dateVN(row.date)}${row.name ? ` (${row.name})` : ''}`).join(', ');
    return new ConflictException(`CALENDAR_DATE_ALREADY_CONFIGURED: ${rows.length} ngày đã được cấu hình trong lịch Organization: ${list}. Hãy chỉnh sửa hoặc xóa các ngày đó trước.`);
  }

  /** Creates the same exception for every day from startDate to endDate, all or nothing. */
  async createRange(org: string, actorId: string, dto: CreateCalendarRangeDto) {
    const dates = this.expandRange(dto.startDate, dto.endDate);
    const session = await this.calendar.db.startSession();
    try {
      let created: Array<Record<string, unknown>> = [];
      await session.withTransaction(async () => {
        await this.assertPoliciesFor(org, dates, session);
        const existing = await this.calendar.find({ organizationId: org, date: { $in: dates } }).session(session).lean();
        if (existing.length) throw this.conflictError((existing as Array<{ date: string; name?: string }>).sort((a, b) => a.date.localeCompare(b.date)));
        const rows = await this.calendar.create(
          dates.map(date => ({ date, type: dto.type, name: dto.name.trim(), organizationId: org, createdBy: actorId })),
          { session, ordered: true },
        );
        await this.invalidateProjection(org, dates, session);
        created = rows.map(row => row.toObject() as unknown as Record<string, unknown>);
      });
      return created;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) throw error;
      throw duplicateCalendar(error);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Edits a run of adjacent days in one step: days kept in the new range get the
   * new type/name, days added are created, days dropped are deleted.
   */
  async updateRange(org: string, actorId: string, dto: UpdateCalendarRangeDto) {
    const originalFrom = dateOnly(dto.originalFrom);
    const originalTo = dateOnly(dto.originalTo);
    this.expandRange(originalFrom, originalTo, MAX_EXISTING_RANGE_DAYS);
    const newDates = this.expandRange(dto.startDate, dto.endDate);
    const name = dto.name.trim();
    const session = await this.calendar.db.startSession();
    try {
      let result: Array<Record<string, unknown>> = [];
      await session.withTransaction(async () => {
        const existing = (await this.calendar.find({ organizationId: org, date: { $gte: originalFrom, $lte: originalTo } }).session(session).lean()) as Array<{ _id: unknown; date: string; type: string; name: string }>;
        if (!existing.length) throw new NotFoundException(`CALENDAR_EXCEPTION_NOT_FOUND: Không tìm thấy ngày nào trong lịch từ ${dateVN(originalFrom)} đến ${dateVN(originalTo)} (có thể đã bị xóa).`);
        const byDate = new Map(existing.map(row => [row.date, row]));
        const added = newDates.filter(day => !byDate.has(day));
        const removed = existing.filter(row => !newDates.includes(row.date));
        const changed = existing.filter(row => newDates.includes(row.date) && (row.type !== dto.type || row.name !== name));

        if (added.length) {
          const clash = (await this.calendar.find({ organizationId: org, date: { $in: added } }).session(session).lean()) as Array<{ date: string; name?: string }>;
          if (clash.length) throw this.conflictError(clash.sort((a, b) => a.date.localeCompare(b.date)));
        }
        await this.assertPoliciesFor(org, [...added, ...changed.filter(row => row.type !== dto.type).map(row => row.date)], session);

        if (removed.length) await this.calendar.deleteMany({ organizationId: org, _id: { $in: removed.map(row => row._id) } }, { session });
        for (const row of changed) {
          await this.calendar.updateOne({ _id: row._id, organizationId: org }, { $set: { type: dto.type, name, updatedBy: actorId } }, { session, runValidators: true });
        }
        if (added.length) {
          await this.calendar.create(added.map(date => ({ date, type: dto.type, name, organizationId: org, createdBy: actorId })), { session, ordered: true });
        }
        const touched = [...added, ...removed.map(row => row.date), ...changed.map(row => row.date)];
        if (touched.length) await this.invalidateProjection(org, touched, session);
        result = (await this.calendar.find({ organizationId: org, date: { $in: newDates } }).session(session).lean()) as Array<Record<string, unknown>>;
        result.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      });
      return result;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) throw error;
      throw duplicateCalendar(error);
    } finally {
      await session.endSession();
    }
  }

  /** Deletes every configured day in [from, to]. */
  async removeRange(org: string, from: string, to: string) {
    if (!from || !to) throw new BadRequestException('CALENDAR_RANGE_INVALID: Cần truyền đủ ngày bắt đầu (from) và ngày kết thúc (to) của kỳ nghỉ cần xóa.');
    const start = dateOnly(from);
    const end = dateOnly(to);
    this.expandRange(start, end, MAX_EXISTING_RANGE_DAYS);
    const session = await this.calendar.db.startSession();
    try {
      let deletedDates: string[] = [];
      await session.withTransaction(async () => {
        const rows = (await this.calendar.find({ organizationId: org, date: { $gte: start, $lte: end } }).session(session).lean()) as Array<{ _id: unknown; date: string }>;
        if (!rows.length) throw new NotFoundException(`CALENDAR_EXCEPTION_NOT_FOUND: Không có ngày nào trong lịch từ ${dateVN(start)} đến ${dateVN(end)} để xóa (có thể đã bị xóa).`);
        await this.calendar.deleteMany({ organizationId: org, _id: { $in: rows.map(row => row._id) } }, { session });
        deletedDates = rows.map(row => row.date);
        await this.invalidateProjection(org, deletedDates, session);
      });
      return { from: start, to: end, deleted: deletedDates.length, dates: deletedDates.sort() };
    } finally {
      await session.endSession();
    }
  }

  async remove(org: string, id: string) {
    const session = await this.calendar.db.startSession();
    try {
      await session.withTransaction(async () => {
        const current = await this.calendar.findOne({ _id: id, organizationId: org }).session(session).lean();
        if (!current) throw new NotFoundException('CALENDAR_EXCEPTION_NOT_FOUND');
        const result = await this.calendar.deleteOne({ _id: id, organizationId: org }, { session });
        if (!result.deletedCount) throw new NotFoundException('CALENDAR_EXCEPTION_NOT_FOUND');
        await this.invalidateProjection(org, [current.date], session);
      });
      return { id, deleted: true };
    } finally {
      await session.endSession();
    }
  }
}

function duplicateCalendar(error: unknown): unknown {
  if (error && typeof error === 'object' && (error as { code?: number }).code === 11000) return new ConflictException('CALENDAR_DATE_ALREADY_CONFIGURED');
  return error;
}
