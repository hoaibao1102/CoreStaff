import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LaborCompliancePolicy,
  OvertimePayPolicy,
} from '../../database/schemas/compensation.schema';
import { assertNoEffectiveOverlap } from '../compensation/compensation-domain';
import {
  evaluateLaborLimits,
  LaborUsage,
  resolveOvertimeRates,
} from './policies-domain';
import {
  CreateLaborPolicyDto,
  CreateOvertimePolicyDto,
  UpdateLaborPolicyDto,
  UpdateOvertimePolicyDto,
} from './dto/policies.dto';

const date = (v: string | Date) => (v instanceof Date ? v : new Date(v));

/** Base shape both effective-dated policies share for overlap checks. */
interface EffectiveWindow {
  effectiveFrom: Date;
  effectiveTo?: Date;
}

/**
 * TASK-036/037 — effective-dated, versioned tenant policies (SRS §30B, §30D.2).
 * Mirrors CompensationService: tenant scope from the session, no effective
 * windows overlapping, version auto-increment, and an effective-at lookup used
 * by payroll/enforcement. Enforcement preview endpoints are read-only and reuse
 * the pure domain functions (policies-domain.ts).
 */
@Injectable()
export class PoliciesService {
  constructor(
    @InjectModel('LaborCompliancePolicy') private readonly laborPolicies: Model<LaborCompliancePolicy>,
    @InjectModel('OvertimePayPolicy') private readonly overtimePolicies: Model<OvertimePayPolicy>,
  ) { }

  // ── effective window helpers ──────────────────────────────────────────────

  private async assertNoOverlap<T extends EffectiveWindow>(
    existing: T[],
    effectiveFrom: Date,
    effectiveTo: Date | undefined,
  ): Promise<void> {
    assertNoEffectiveOverlap(
      existing.map((x) => ({ effectiveFrom: x.effectiveFrom, effectiveTo: x.effectiveTo })),
      effectiveFrom,
      effectiveTo,
    );
  }

  private async effectiveLabor(org: string, at: Date) {
    const row = await this.laborPolicies
      .findOne({
        organizationId: org,
        active: true,
        effectiveFrom: { $lte: at },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }],
      })
      .sort({ effectiveFrom: -1 })
      .lean();
    if (!row) throw new NotFoundException('LABOR_POLICY_NOT_FOUND');
    return row;
  }

  private async effectiveOvertime(org: string, at: Date) {
    const row = await this.overtimePolicies
      .findOne({
        organizationId: org,
        active: true,
        effectiveFrom: { $lte: at },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }],
      })
      .sort({ effectiveFrom: -1 })
      .lean();
    if (!row) throw new NotFoundException('OVERTIME_POLICY_NOT_FOUND');
    return row;
  }

  // ── Labor compliance policy ───────────────────────────────────────────────

  listLabor(org: string) {
    return this.laborPolicies.find({ organizationId: org }).sort({ effectiveFrom: -1 }).lean();
  }

  async createLabor(org: string, dto: CreateLaborPolicyDto) {
    const effectiveFrom = date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? date(dto.effectiveTo) : undefined;
    const existing = await this.laborPolicies.find({ organizationId: org }).lean();
    await this.assertNoOverlap(existing, effectiveFrom, effectiveTo);
    const latest = await this.laborPolicies.findOne({ organizationId: org }).sort({ version: -1 }).lean();
    const row = await this.laborPolicies.create({
      ...dto,
      organizationId: org,
      effectiveFrom,
      effectiveTo,
      version: (latest?.version ?? 0) + 1,
      active: dto.active ?? true,
    });
    return row.toObject();
  }

  laborAt(org: string, at: Date) {
    return this.effectiveLabor(org, at);
  }

  async updateLabor(org: string, id: string, dto: UpdateLaborPolicyDto) {
    const old = await this.laborPolicies.findOne({ _id: id, organizationId: org }).lean();
    if (!old) throw new NotFoundException('LABOR_POLICY_NOT_FOUND');
    const effectiveFrom = dto.effectiveFrom ? date(dto.effectiveFrom) : old.effectiveFrom;
    const effectiveTo = dto.effectiveTo !== undefined
      ? dto.effectiveTo ? date(dto.effectiveTo) : undefined
      : old.effectiveTo;
    const others = await this.laborPolicies.find({ organizationId: org, _id: { $ne: id } }).lean();
    await this.assertNoOverlap(others, effectiveFrom, effectiveTo);
    const update: Record<string, unknown> = {
      $set: { ...dto, effectiveFrom },
      $inc: { version: 1 },
    };
    if (effectiveTo) update.$set = { ...update.$set as Record<string, unknown>, effectiveTo };
    else update.$unset = { effectiveTo: 1 };
    const row = await this.laborPolicies
      .findOneAndUpdate({ _id: id, organizationId: org }, update, { new: true, runValidators: true })
      .lean();
    if (!row) throw new NotFoundException('LABOR_POLICY_NOT_FOUND');
    return row;
  }

  /** AC-LABOR-01 enforcement preview against the effective policy at `at`. */
  async previewLabor(org: string, at: Date, usage: LaborUsage) {
    const policy = await this.effectiveLabor(org, at);
    return evaluateLaborLimits(
      {
        version: policy.version,
        legalReference: policy.legalReference,
        normalDailyMinutes: policy.normalDailyMinutes!,
        normalWeeklyMinutes: policy.normalWeeklyMinutes!,
        maxCombinedDailyMinutes: policy.maxCombinedDailyMinutes!,
        maxMonthlyOvertimeMinutes: policy.maxMonthlyOvertimeMinutes!,
        maxAnnualOvertimeMinutes: policy.maxAnnualOvertimeMinutes!,
        exceptionalAnnualOvertimeMinutes: policy.exceptionalAnnualOvertimeMinutes!,
        warningThresholdPercent: policy.warningThresholdPercent!,
      },
      usage,
    );
  }

  // ── Overtime pay policy ───────────────────────────────────────────────────

  listOvertime(org: string) {
    return this.overtimePolicies.find({ organizationId: org }).sort({ effectiveFrom: -1 }).lean();
  }

  async createOvertime(org: string, dto: CreateOvertimePolicyDto) {
    const effectiveFrom = date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? date(dto.effectiveTo) : undefined;
    const existing = await this.overtimePolicies.find({ organizationId: org }).lean();
    await this.assertNoOverlap(existing, effectiveFrom, effectiveTo);
    const latest = await this.overtimePolicies.findOne({ organizationId: org }).sort({ version: -1 }).lean();
    const row = await this.overtimePolicies.create({
      ...dto,
      organizationId: org,
      effectiveFrom,
      effectiveTo,
      version: (latest?.version ?? 0) + 1,
      active: dto.active ?? true,
    });
    return row.toObject();
  }

  overtimeAt(org: string, at: Date) {
    return this.effectiveOvertime(org, at);
  }

  async updateOvertime(org: string, id: string, dto: UpdateOvertimePolicyDto) {
    const old = await this.overtimePolicies.findOne({ _id: id, organizationId: org }).lean();
    if (!old) throw new NotFoundException('OVERTIME_POLICY_NOT_FOUND');
    const effectiveFrom = dto.effectiveFrom ? date(dto.effectiveFrom) : old.effectiveFrom;
    const effectiveTo = dto.effectiveTo !== undefined
      ? dto.effectiveTo ? date(dto.effectiveTo) : undefined
      : old.effectiveTo;
    const others = await this.overtimePolicies.find({ organizationId: org, _id: { $ne: id } }).lean();
    await this.assertNoOverlap(others, effectiveFrom, effectiveTo);
    const update: Record<string, unknown> = {
      $set: { ...dto, effectiveFrom },
      $inc: { version: 1 },
    };
    if (effectiveTo) update.$set = { ...update.$set as Record<string, unknown>, effectiveTo };
    else update.$unset = { effectiveTo: 1 };
    const row = await this.overtimePolicies
      .findOneAndUpdate({ _id: id, organizationId: org }, update, { new: true, runValidators: true })
      .lean();
    if (!row) throw new NotFoundException('OVERTIME_POLICY_NOT_FOUND');
    return row;
  }

  /** AC-OT-PAY-01 rate resolution preview for a single date. */
  async previewOvertime(org: string, at: Date, flags: { weeklyOff?: boolean; publicHoliday?: boolean }) {
    const policy = await this.effectiveOvertime(org, at);
    return resolveOvertimeRates(
      {
        version: policy.version,
        legalReference: policy.legalReference,
        workingDayRate: policy.workingDayRate,
        weeklyOffRate: policy.weeklyOffRate,
        publicHolidayRate: policy.publicHolidayRate,
      },
      [{ date: at.toISOString().slice(0, 10), isWeeklyOff: flags.weeklyOff, isPublicHoliday: flags.publicHoliday }],
    );
  }
}

