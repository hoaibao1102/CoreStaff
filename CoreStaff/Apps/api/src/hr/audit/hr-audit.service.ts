import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { AuditLogDocument } from '../../database/schemas/audit-log.schema';

export interface RecordAuditEventDto {
  eventId?: string;
  organizationId: string;
  actorId?: string;
  actorNameSnapshot?: string;
  actorRoleSnapshot?: string;
  action: string;
  targetType: string;
  targetId?: string;
  targetSummary?: string;
  correlationId?: string;
  source?: string;
  reason?: string;
  isSelfApproved?: boolean;
  details?: any;
}

@Injectable()
export class HrAuditService {
  constructor(
    @InjectModel('AuditLog') private readonly auditLogs: Model<AuditLogDocument>,
  ) {}

  async record(dto: RecordAuditEventDto, session?: ClientSession): Promise<any> {
    const eventId = dto.eventId || new Types.ObjectId().toString();
    const doc = {
      ...dto,
      eventId,
      occurredAt: new Date(),
    };
    if (session) {
      const created = await this.auditLogs.create([doc], { session });
      return created[0].toObject();
    }
    const created = await this.auditLogs.create(doc);
    return created.toObject();
  }

  async list(
    org: string,
    query: {
      action?: string;
      actorId?: string;
      targetType?: string;
      isSelfApproved?: boolean | string;
      limit?: number;
      page?: number;
    } = {},
  ): Promise<{ items: any[]; total: number }> {
    const filter: any = { organizationId: new Types.ObjectId(org) };
    if (query.action) filter.action = query.action;
    if (query.actorId) filter.actorId = new Types.ObjectId(query.actorId);
    if (query.targetType) filter.targetType = query.targetType;
    if (query.isSelfApproved !== undefined) {
      filter.isSelfApproved = String(query.isSelfApproved) === 'true';
    }

    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const page = Math.max(1, Number(query.page) || 1);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.auditLogs
        .find(filter)
        .sort({ occurredAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.auditLogs.countDocuments(filter),
    ]);

    return { items, total };
  }
}

