import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmploymentContractDocument } from '../../database/schemas/employment-contract.schema';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { UserDocument } from '../../database/schemas/user.schema';
import {
  CONTRACT_EXPIRY_WARNING_DAYS,
  CONTRACT_STATUS_TRANSITIONS,
  ContractStatus,
  ContractType,
} from '../../database/schemas/enums';
import { CreateEmploymentContractDto } from './dto/create-employment-contract.dto';
import { UpdateEmploymentContractDto } from './dto/update-employment-contract.dto';
import { UpdateContractStatusDto } from './dto/update-contract-status.dto';

const DUPLICATE_KEY_ERROR = 11000;

export interface ExpiryWarning {
  isExpiringSoon: boolean;
  /** Days until expiry, 0 when already at/over the end date — null when not applicable. */
  expiryWarningDays: number | null;
}

/**
 * TASK-030 — derive the "expiring soon" flag on read; never stored.
 * ACTIVE contract within CONTRACT_EXPIRY_WARNING_DAYS of its expiryDate.
 * `now` is injectable so tests can pin server time; date-only UTC granularity
 * keeps the day count stable across timezones (seeded dates are UTC midnight).
 */
export function computeExpiryWarning(
  status: ContractStatus,
  expiryDate: Date | undefined,
  now: Date = new Date(),
): ExpiryWarning {
  if (status !== ContractStatus.ACTIVE || !expiryDate) {
    return { isExpiringSoon: false, expiryWarningDays: null };
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = Date.UTC(expiryDate.getUTCFullYear(), expiryDate.getUTCMonth(), expiryDate.getUTCDate());
  const days = Math.round((end - today) / 86_400_000);
  // Negative = ACTIVE past its expiry (data drift HR must fix) — not flagged.
  return {
    isExpiringSoon: days >= 0 && days <= CONTRACT_EXPIRY_WARNING_DAYS,
    expiryWarningDays: Math.max(0, days),
  };
}

@Injectable()
export class EmploymentContractService {
  constructor(
    @InjectModel('EmploymentContract') private readonly contractModel: Model<EmploymentContractDocument>,
    @InjectModel('EmployeeProfile') private readonly profileModel: Model<EmployeeProfileDocument>,
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
  ) {}

  async create(organizationId: string, dto: CreateEmploymentContractDto): Promise<Record<string, unknown>> {
    const employeeProfileId = dto.employeeId;
    await this.assertEmployeeInTenant(organizationId, employeeProfileId);
    this.assertDateRules({
      contractType: dto.contractType,
      effectiveDate: new Date(dto.effectiveDate),
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
    });
    try {
      const doc = await this.contractModel.create({
        organizationId,
        employeeProfileId,
        contractType: dto.contractType,
        status: ContractStatus.DRAFT,
        effectiveDate: new Date(dto.effectiveDate),
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        note: dto.note,
      });
      return (await this.enrich(organizationId, [doc.toObject() as unknown as Record<string, unknown>]))[0];
    } catch (err) {
      throw mapDuplicateKey(err);
    }
  }

  async findAll(organizationId: string, filter: { employeeId?: string; status?: string } = {}) {
    const query: Record<string, unknown> = { organizationId };
    if (filter.employeeId) query.employeeProfileId = filter.employeeId;
    if (filter.status) query.status = filter.status;
    const rows = await this.contractModel.find(query).sort({ effectiveDate: -1 }).lean();
    return this.enrich(organizationId, rows as unknown as Record<string, unknown>[]);
  }

  async findOne(organizationId: string, id: string) {
    const doc = await this.contractModel.findOne({ _id: id, organizationId }).lean();
    if (!doc) throw new NotFoundException('EMPLOYMENT_CONTRACT_NOT_FOUND');
    return (await this.enrich(organizationId, [doc as unknown as Record<string, unknown>]))[0];
  }

  async update(organizationId: string, id: string, dto: UpdateEmploymentContractDto) {
    const existing = await this.contractModel.findOne({ _id: id, organizationId }).lean();
    if (!existing) throw new NotFoundException('EMPLOYMENT_CONTRACT_NOT_FOUND');

    // Re-run date rules against the merged result when any date changes.
    const merged: { contractType: ContractType; effectiveDate: Date; expiryDate?: Date } = {
      contractType: existing.contractType as ContractType,
      effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : existing.effectiveDate,
      expiryDate: dto.expiryDate === undefined ? (existing.expiryDate as Date | undefined) : dto.expiryDate ? new Date(dto.expiryDate) : undefined,
    };
    this.assertDateRules(merged);

    try {
      const doc = await this.contractModel
        .findOneAndUpdate(
          { _id: id, organizationId },
          {
            $set: {
              ...(dto.effectiveDate !== undefined && { effectiveDate: new Date(dto.effectiveDate) }),
              ...(dto.expiryDate !== undefined && { expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined }),
              ...(dto.note !== undefined && { note: dto.note }),
            },
          },
          { new: true, runValidators: true },
        )
        .lean();
      if (!doc) throw new NotFoundException('EMPLOYMENT_CONTRACT_NOT_FOUND');
      return (await this.enrich(organizationId, [doc as unknown as Record<string, unknown>]))[0];
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw mapDuplicateKey(err);
    }
  }

  /**
   * TASK-030 — status moves through CONTRACT_STATUS_TRANSITIONS only. Renewal
   * (EXPIRED → ACTIVE) must restate dates; termination stamps `endDate`.
   */
  async changeStatus(organizationId: string, id: string, dto: UpdateContractStatusDto) {
    const doc = await this.contractModel.findOne({ _id: id, organizationId }).lean();
    if (!doc) throw new NotFoundException('EMPLOYMENT_CONTRACT_NOT_FOUND');

    const from = doc.status as ContractStatus;
    const to = dto.newStatus;
    if (!CONTRACT_STATUS_TRANSITIONS[from].includes(to)) {
      throw new ConflictException('EMPLOYMENT_CONTRACT_STATUS_TRANSITION_INVALID');
    }

    const patch: Record<string, unknown> = { status: to };
    if (to === ContractStatus.TERMINATED) {
      if (!dto.effectiveDate) throw new BadRequestException('CONTRACT_TERMINATION_DATE_REQUIRED');
      patch.endDate = new Date(dto.effectiveDate);
    }
    if (from === ContractStatus.EXPIRED && to === ContractStatus.ACTIVE) {
      // Renewal — new dates are the point of the transition.
      if (!dto.effectiveDate || !dto.expiryDate) {
        throw new BadRequestException('CONTRACT_RENEWAL_DATES_REQUIRED');
      }
      patch.effectiveDate = new Date(dto.effectiveDate);
      patch.expiryDate = new Date(dto.expiryDate);
    }

    const updated = await this.contractModel
      .findOneAndUpdate({ _id: id, organizationId }, { $set: patch }, { new: true, runValidators: true })
      .lean();
    if (!updated) throw new NotFoundException('EMPLOYMENT_CONTRACT_NOT_FOUND');
    return (await this.enrich(organizationId, [updated as unknown as Record<string, unknown>]))[0];
  }

  /** Display names + derived expiry warning without replacing reference IDs. */
  private async enrich(organizationId: string, rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    if (!rows.length) return [];
    const profileIds = [...new Set(rows.map((r) => String(r.employeeProfileId)).filter(Boolean))];
    const profiles = await this.profileModel
      .find({ organizationId, _id: { $in: profileIds } })
      .select('_id employeeCode userId')
      .lean();
    const profileByProfileId = new Map(profiles.map((p) => [String(p._id), p]));
    const userIds = [...new Set(profiles.map((p) => String(p.userId)).filter(Boolean))];
    const users = await this.userModel.find({ organizationId, _id: { $in: userIds } }).select('_id fullName').lean();
    const nameByUserId = new Map(users.map((u) => [String(u._id), u.fullName]));

    return rows.map((row) => {
      const profile = profileByProfileId.get(String(row.employeeProfileId));
      const warning = computeExpiryWarning(row.status as ContractStatus, row.expiryDate as Date | undefined);
      return {
        ...row,
        employeeCode: profile?.employeeCode ?? null,
        employeeFullName: (profile && nameByUserId.get(String(profile.userId))) ?? null,
        ...warning,
      };
    });
  }

  private async assertEmployeeInTenant(organizationId: string, employeeProfileId: string): Promise<void> {
    const exists = await this.profileModel.exists({ _id: employeeProfileId, organizationId });
    if (!exists) throw new NotFoundException('EMPLOYEE_PROFILE_NOT_FOUND');
  }

  /** SRS §30A.2: expiry after effective; INDEFINITE_TERM has no expiry. */
  private assertDateRules(c: { contractType: ContractType; effectiveDate: Date; expiryDate?: Date }): void {
    if (c.contractType === ContractType.INDEFINITE_TERM) {
      if (c.expiryDate) throw new BadRequestException('CONTRACT_INDEFINITE_TERM_NO_EXPIRY');
      return;
    }
    if (!c.expiryDate) throw new BadRequestException('CONTRACT_EXPIRY_REQUIRED');
    if (c.expiryDate.getTime() <= c.effectiveDate.getTime()) {
      throw new BadRequestException('CONTRACT_EXPIRY_BEFORE_EFFECTIVE');
    }
  }
}

function mapDuplicateKey(err: unknown): unknown {
  if (err && typeof err === 'object' && (err as { code?: number }).code === DUPLICATE_KEY_ERROR) {
    return new ConflictException('EMPLOYMENT_CONTRACT_ALREADY_EXISTS');
  }
  return err;
}