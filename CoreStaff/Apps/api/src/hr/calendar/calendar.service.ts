import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { CalendarExceptionDocument } from '../../database/schemas/calendar-exception.schema';
import { CreateCalendarExceptionDto, UpdateCalendarExceptionDto } from './dto/calendar.dto';
import { dateOnly } from '../../common/date-only';
import { PoliciesService } from '../policies/policies.service';
import { OvertimeService } from '../overtime/overtime.service';
import { PeriodVersionService } from '../timesheet/period-version.service';

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
