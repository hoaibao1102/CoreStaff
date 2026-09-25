import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CalendarExceptionDocument } from '../../database/schemas/calendar-exception.schema';
import { CreateCalendarExceptionDto, UpdateCalendarExceptionDto } from './dto/calendar.dto';
import { dateOnly } from '../../common/date-only';
import { PoliciesService } from '../policies/policies.service';

@Injectable()
export class CalendarService {
  constructor(@InjectModel('CalendarException') private readonly calendar: Model<CalendarExceptionDocument>, private readonly policies: PoliciesService) {}

  async create(org: string, actorId: string, dto: CreateCalendarExceptionDto) {
    await this.policies.overtimeAt(org, new Date(dateOnly(dto.date)));
    try {
      const row = await this.calendar.create({ ...dto, date: dateOnly(dto.date), name: dto.name.trim(), organizationId: org, createdBy: actorId });
      return row.toObject();
    } catch (error) { throw duplicateCalendar(error); }
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
    const current = await this.get(org, id);
    await this.policies.overtimeAt(org, new Date(dateOnly(dto.date ?? current.date)));
    const patch = { ...dto, ...(dto.date ? { date: dateOnly(dto.date) } : {}), ...(dto.name ? { name: dto.name.trim() } : {}), updatedBy: actorId };
    try {
      const row = await this.calendar.findOneAndUpdate({ _id: id, organizationId: org }, { $set: patch }, { new: true, runValidators: true }).lean();
      if (!row) throw new NotFoundException('CALENDAR_EXCEPTION_NOT_FOUND');
      return row;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw duplicateCalendar(error);
    }
  }

  async remove(org: string, id: string) {
    const result = await this.calendar.deleteOne({ _id: id, organizationId: org });
    if (!result.deletedCount) throw new NotFoundException('CALENDAR_EXCEPTION_NOT_FOUND');
    return { id, deleted: true };
  }
}

function duplicateCalendar(error: unknown): unknown {
  if (error && typeof error === 'object' && (error as { code?: number }).code === 11000) return new ConflictException('CALENDAR_DATE_ALREADY_CONFIGURED');
  return error;
}
