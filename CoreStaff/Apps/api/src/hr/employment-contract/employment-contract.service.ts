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
  EmploymentStatus,
  WORKING_EMPLOYMENT_STATUSES,
} from '../../database/schemas/enums';
import { CreateEmploymentContractDto } from './dto/create-employment-contract.dto';
import { UpdateEmploymentContractDto } from './dto/update-employment-contract.dto';
import { UpdateContractStatusDto } from './dto/update-contract-status.dto';

const DUPLICATE_KEY_ERROR = 11000;

export interface ExpiryWarning {
  isExpiringSoon: boolean;
  /** Stored status is still ACTIVE but `expiryDate` has passed (HR drift). */
  isExpired: boolean;
  /** Days until expiry, 0 when already at/over the end date — null when not applicable. */
  expiryWarningDays: number | null;
}

/**
 * TASK-030 — derive the "expiring soon" flag on read; never stored.
 * ACTIVE contract within CONTRACT_EXPIRY_WARNING_DAYS of its expiryDate.
 * `now` is injectable so tests can pin server time; date-only UTC granularity
 * keeps the day count stable across timezones (seeded dates are UTC midnight).
 */
/** Whole-day difference between two dates at UTC midnight (`to` − `from`). */
function utcDayDiff(from: Date, to: Date): number {
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((day(to) - day(from)) / 86_400_000);
}

export function computeExpiryWarning(
  status: ContractStatus,
  expiryDate: Date | undefined,
  now: Date = new Date(),
): ExpiryWarning {
  if (status !== ContractStatus.ACTIVE || !expiryDate) {
    return { isExpiringSoon: false, isExpired: false, expiryWarningDays: null };
  }
  const days = utcDayDiff(now, expiryDate);
  // Negative = ACTIVE past its expiry (data drift HR must fix). `isExpired`
  // surfaces it instead of hiding it; the amber "expiring soon" flag stays forward-only.
  return {
    isExpiringSoon: days >= 0 && days <= CONTRACT_EXPIRY_WARNING_DAYS,
    isExpired: days < 0,
    expiryWarningDays: Math.max(0, days),
  };
}

/** One compliance finding: what is wrong, and which employee/contract it is about. */
export type ContractFindingCode = 'NO_CONTRACT' | 'EXPIRED_NOT_RENEWED' | 'ACTIVE_PAST_EXPIRY' | 'PROBATION_OVERDUE';

export interface ContractFinding {
  code: ContractFindingCode;
  employeeProfileId: string;
  employeeCode?: string | null;
  employeeFullName?: string | null;
  employmentStatus?: EmploymentStatus;
  contractId?: string;
  contractType?: ContractType;
  /** Latest expiry date involved, when the finding is date-driven. */
  lastExpiryDate?: Date;
  /** Only on ACTIVE_PAST_EXPIRY — how long HR has been running uncovered. */
  daysPastExpiry?: number;
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
   * TASK-030 — status moves through CONTRACT_STATUS_TRANSITIONS only. Termination
   * stamps `endDate` in place. Renewal (EXPIRED → ACTIVE) is NOT an in-place edit:
   * it appends a fresh ACTIVE row and freezes the old one at EXPIRED, so every
   * past term stays queryable (§46 severance, payroll re-audit of a closed period).
   */
  async changeStatus(organizationId: string, id: string, dto: UpdateContractStatusDto) {
    const doc = await this.contractModel.findOne({ _id: id, organizationId }).lean();
    if (!doc) throw new NotFoundException('EMPLOYMENT_CONTRACT_NOT_FOUND');

    const from = doc.status as ContractStatus;
    const to = dto.newStatus;
    if (!CONTRACT_STATUS_TRANSITIONS[from].includes(to)) {
      throw new ConflictException('EMPLOYMENT_CONTRACT_STATUS_TRANSITION_INVALID');
    }

    const employeeProfileId = String(doc.employeeProfileId);

    // Renewal → append a new row. The expired row is left untouched (frozen term).
    if (from === ContractStatus.EXPIRED && to === ContractStatus.ACTIVE) {
      if (!dto.effectiveDate || !dto.expiryDate) {
        throw new BadRequestException('CONTRACT_RENEWAL_DATES_REQUIRED');
      }
      const effectiveDate = new Date(dto.effectiveDate);
      const expiryDate = new Date(dto.expiryDate);
      this.assertDateRules({ contractType: doc.contractType as ContractType, effectiveDate, expiryDate });
      await this.assertNoActiveOverlap(organizationId, employeeProfileId, effectiveDate, expiryDate, id);
      const created = await this.contractModel.create({
        organizationId,
        employeeProfileId: doc.employeeProfileId,
        contractType: doc.contractType,
        status: ContractStatus.ACTIVE,
        effectiveDate,
        expiryDate,
        statusReason: dto.reason?.trim() || undefined,
        statusChangedAt: new Date(),
      });
      return (await this.enrich(organizationId, [created.toObject() as unknown as Record<string, unknown>]))[0];
    }

    const patch: Record<string, unknown> = {
      status: to,
      statusChangedAt: new Date(),
      // HR typed a reason for this transition — keep the latest one. Full
      // per-transition history is a separate backlog item (§30A.2:2480).
      statusReason: dto.reason?.trim() || undefined,
    };
    if (to === ContractStatus.TERMINATED) {
      if (!dto.effectiveDate) throw new BadRequestException('CONTRACT_TERMINATION_DATE_REQUIRED');
      patch.endDate = new Date(dto.effectiveDate);
    }
    if (to === ContractStatus.ACTIVE) {
      // DRAFT → ACTIVE: refuse to open a second window overlapping a live one.
      await this.assertNoActiveOverlap(
        organizationId,
        employeeProfileId,
        doc.effectiveDate as Date,
        doc.expiryDate as Date | undefined,
        id,
      );
    }

    const updated = await this.contractModel
      .findOneAndUpdate({ _id: id, organizationId }, { $set: patch }, { new: true, runValidators: true })
      .lean();
    if (!updated) throw new NotFoundException('EMPLOYMENT_CONTRACT_NOT_FOUND');
    return (await this.enrich(organizationId, [updated as unknown as Record<string, unknown>]))[0];
  }

  /**
   * The contract that governed `asOf` (date-window match, not "latest row") —
   * the correct reference for a payroll period, incl. a now-EXPIRED term. Returns
   * null when no ACTIVE/EXPIRED contract covers that day. DRAFT/TERMINATED never
   * governed a work window this way.
   */
  async findContractAt(organizationId: string, employeeProfileId: string, asOf: Date) {
    const t = asOf.getTime();
    const rows = await this.contractModel
      .find({
        organizationId,
        employeeProfileId,
        status: { $in: [ContractStatus.ACTIVE, ContractStatus.EXPIRED] },
      })
      .sort({ effectiveDate: -1 })
      .lean();
    const match = (rows as unknown as Record<string, unknown>[]).find(
      (r) => (r.effectiveDate as Date).getTime() <= t && (!r.expiryDate || (r.expiryDate as Date).getTime() > t),
    );
    if (!match) return null;
    return (await this.enrich(organizationId, [match]))[0];
  }

  /**
   * Guard: one employee may hold at most one ACTIVE contract whose date window
   * overlaps the one being activated. Back-to-back terms (one ends exactly when
   * the next starts) are allowed — strict `<` on both ends. `excludeId` skips the
   * row being activated (it is still EXPIRED/ACTIVE on its own doc).
   */
  private async assertNoActiveOverlap(
    organizationId: string,
    employeeProfileId: string,
    effectiveDate: Date,
    expiryDate: Date | undefined,
    excludeId: string,
  ): Promise<void> {
    const OPEN_END = Number.POSITIVE_INFINITY;
    const others = await this.contractModel
      .find({ organizationId, employeeProfileId, status: ContractStatus.ACTIVE })
      .lean();
    const clash = (others as unknown as Record<string, unknown>[]).some((o) => {
      if (String(o._id) === String(excludeId)) return false;
      const oStart = (o.effectiveDate as Date).getTime();
      const oEnd = o.expiryDate ? (o.expiryDate as Date).getTime() : OPEN_END;
      const nStart = effectiveDate.getTime();
      const nEnd = expiryDate ? expiryDate.getTime() : OPEN_END;
      return nStart < oEnd && oStart < nEnd;
    });
    if (clash) throw new ConflictException('EMPLOYMENT_CONTRACT_OVERLAPS_ACTIVE');
  }

  /**
   * Compliance findings for the HR badge + `GET /hr/contracts/compliance`.
   * Read-only by design: an expired contract plus a still-working employee is a
   * *legal* state (BLLĐ 2019 §20.2 turns it into an indefinite-term relationship),
   * so nothing here mutates `EmployeeProfile.employmentStatus` or contract status.
   * HR acts on the finding; the system never silently rewrites either record.
   */
  async findCompliance(organizationId: string, now: Date = new Date()) {
    const [profiles, contracts] = await Promise.all([
      this.profileModel
        .find({ organizationId, employmentStatus: { $in: WORKING_EMPLOYMENT_STATUSES } })
        .select('_id employeeCode userId employmentStatus')
        .lean(),
      // Only contracts that ever governed a work period can answer "is this
      // employee covered?"; DRAFT is unsigned and TERMINATED is closed.
      this.contractModel
        .find({ organizationId, status: { $in: [ContractStatus.ACTIVE, ContractStatus.EXPIRED] } })
        .sort({ effectiveDate: 1 })
        .lean(),
    ]);

    const byProfile = new Map<string, Record<string, unknown>[]>();
    for (const row of contracts as unknown as Record<string, unknown>[]) {
      const key = String(row.employeeProfileId);
      const bucket = byProfile.get(key);
      if (bucket) bucket.push(row);
      else byProfile.set(key, [row]);
    }

    const userIds = [...new Set(profiles.map((p) => String(p.userId)).filter(Boolean))];
    const users = await this.userModel.find({ organizationId, _id: { $in: userIds } }).select('_id fullName').lean();
    const nameByUserId = new Map(users.map((u) => [String(u._id), u.fullName]));

    const findings: ContractFinding[] = [];
    for (const profile of profiles) {
      const own = byProfile.get(String(profile._id)) ?? [];
      const active = own.filter((c) => c.status === ContractStatus.ACTIVE);
      const identity = {
        employeeProfileId: String(profile._id),
        employeeCode: profile.employeeCode ?? null,
        employeeFullName: nameByUserId.get(String(profile.userId)) ?? null,
        employmentStatus: profile.employmentStatus,
      };

      if (!active.length) {
        findings.push({
          code: own.length ? 'EXPIRED_NOT_RENEWED' : 'NO_CONTRACT',
          ...identity,
          contractId: own.length ? String(own[own.length - 1]._id) : undefined,
          lastExpiryDate: own.length ? (own[own.length - 1].expiryDate as Date | undefined) : undefined,
        });
        continue;
      }

      for (const contract of active) {
        const { isExpired } = computeExpiryWarning(ContractStatus.ACTIVE, contract.expiryDate as Date | undefined, now);
        if (!isExpired) continue;
        findings.push({
          code: 'ACTIVE_PAST_EXPIRY',
          ...identity,
          contractId: String(contract._id),
          contractType: contract.contractType as ContractType,
          lastExpiryDate: contract.expiryDate as Date,
          daysPastExpiry: -utcDayDiff(now, contract.expiryDate as Date),
        });
        // §26/§27 — probation that ran out without a signed contract: HR must
        // either confirm and sign, or notify the employee they didn't pass.
        if (profile.employmentStatus === EmploymentStatus.PROBATION && contract.contractType === ContractType.PROBATION) {
          findings.push({ code: 'PROBATION_OVERDUE', ...identity, contractId: String(contract._id), contractType: ContractType.PROBATION, lastExpiryDate: contract.expiryDate as Date });
        }
      }
    }

    return {
      findings,
      counts: findings.reduce<Record<string, number>>((acc, f) => {
        acc[f.code] = (acc[f.code] ?? 0) + 1;
        return acc;
      }, {}),
    };
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