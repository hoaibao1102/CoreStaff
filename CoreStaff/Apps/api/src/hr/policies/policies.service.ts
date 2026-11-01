import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import {
  LaborCompliancePolicy,
  OvertimePayPolicy,
} from '../../database/schemas/compensation.schema';
import { WorkCreditPolicy } from '../../database/schemas/work-credit-policy.schema';
import { PeriodVersionService } from '../timesheet/period-version.service';
import { assertNoEffectiveOverlap } from '../compensation/compensation-domain';
import { validateWorkCreditPolicyRules } from './work-credit-domain';
import {
  evaluateLaborLimits,
  laborLimitsFromPolicy,
  LaborUsage,
  resolveOvertimeRates,
} from './policies-domain';
import {
  CreateLaborPolicyDto,
  CreateOvertimePolicyDto,
  CreateWorkCreditPolicyDto,
  UpdateLaborPolicyDto,
  UpdateOvertimePolicyDto,
  UpdateWorkCreditPolicyDto,
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
    @InjectModel('WorkCreditPolicy') private readonly workCreditPolicies: Model<WorkCreditPolicy>,
    private readonly periodVersion: PeriodVersionService,
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

  private async effectiveLabor(org: string, at: Date, session?: ClientSession) {
    let query: any = this.laborPolicies.findOne({
      organizationId: org,
      active: true,
      effectiveFrom: { $lte: at },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }],
    }).sort({ effectiveFrom: -1 });
    if (session) query = query.session(session);
    const row = await query.lean();
    if (!row) throw new NotFoundException('LABOR_POLICY_NOT_FOUND');
    return row;
  }

  private async effectiveOvertime(org: string, at: Date, session?: ClientSession) {
    let query: any = this.overtimePolicies.findOne({
        organizationId: org,
        active: true,
        effectiveFrom: { $lte: at },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }],
      }).sort({ effectiveFrom: -1 });
    if (session) query = query.session(session);
    const row = await query.lean();
    if (!row) throw new NotFoundException('OVERTIME_POLICY_NOT_FOUND');
    return row;
  }

  // ── Labor compliance policy ───────────────────────────────────────────────

  listLabor(org: string) {
    return this.laborPolicies.find({ organizationId: org }).sort({ effectiveFrom: -1 }).lean();
  }

  async createLabor(org: string, dto: CreateLaborPolicyDto) {
    this.assertLaborV2Rules(dto);
    const effectiveFrom = date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? date(dto.effectiveTo) : undefined;
    const session = await this.laborPolicies.db.startSession();
    try {
      let result: any;
      await session.withTransaction(async () => {
        const existing = await this.laborPolicies.find({ organizationId: org }).session(session).lean();
        await this.assertNoOverlap(existing, effectiveFrom, effectiveTo);
        const latest = await this.laborPolicies.findOne({ organizationId: org }).sort({ version: -1 }).session(session).lean();
        const [row] = await this.laborPolicies.create([{
          ...dto, organizationId: org, effectiveFrom, effectiveTo,
          version: (latest?.version ?? 0) + 1, active: dto.active ?? true,
        }], { session });
        await this.periodVersion.bumpForEffectiveWindow(org, effectiveFrom, effectiveTo, session);
        result = row.toObject();
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  laborAt(org: string, at: Date, session?: ClientSession) {
    return this.effectiveLabor(org, at, session);
  }

  /** V2 callers opt in explicitly; legacy laborAt remains unchanged. */
  async overtimeRulesForWorkDate(org: string, workDate: string, session?: ClientSession) {
    const policy = await this.explicitLaborForWorkDate(org, workDate, false, session);
    if (policy.minimumOvertimeMinutes === undefined || policy.overtimeRoundingMinutes === undefined) {
      throw new ConflictException('POLICY_CONFIGURATION_REQUIRED');
    }
    return policy;
  }

  async attendanceConfirmationRulesForWorkDate(org: string, workDate: string, session?: ClientSession) {
    const policy = await this.explicitLaborForWorkDate(org, workDate, true, session);
    if (policy.maxMonthlyAttendanceConfirmations === undefined) throw new ConflictException('POLICY_CONFIGURATION_REQUIRED');
    return policy;
  }

  private async explicitLaborForWorkDate(org: string, workDate: string, monthStart: boolean, session?: ClientSession) {
    const day = new Date(`${workDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== workDate) {
      throw new BadRequestException('WORK_DATE_INVALID');
    }
    const key = monthStart ? `${workDate.slice(0, 7)}-01` : workDate;
    try {
      const policy = await this.effectiveLabor(org, new Date(`${key}T00:00:00+07:00`), session);
      this.assertLaborV2Rules(policy);
      return policy;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw new ConflictException('POLICY_CONFIGURATION_REQUIRED');
      throw error;
    }
  }

  async updateLabor(org: string, id: string, dto: UpdateLaborPolicyDto) {
    const old = await this.laborPolicies.findOne({ _id: id, organizationId: org }).lean();
    if (!old) throw new NotFoundException('LABOR_POLICY_NOT_FOUND');
    this.assertLaborV2Rules({ ...old, ...dto });
    const effectiveFrom = dto.effectiveFrom ? date(dto.effectiveFrom) : old.effectiveFrom;
    const effectiveTo = dto.effectiveTo !== undefined
      ? dto.effectiveTo ? date(dto.effectiveTo) : undefined
      : old.effectiveTo;
    const unionFrom = old.effectiveFrom < effectiveFrom ? old.effectiveFrom : effectiveFrom;
    const unionTo = !old.effectiveTo || !effectiveTo ? undefined : old.effectiveTo > effectiveTo ? old.effectiveTo : effectiveTo;
    const session = await this.laborPolicies.db.startSession();
    try {
      let result: any;
      await session.withTransaction(async () => {
        const others = await this.laborPolicies.find({ organizationId: org, _id: { $ne: id } }).session(session).lean();
        await this.assertNoOverlap(others, effectiveFrom, effectiveTo);
        const update: Record<string, unknown> = { $set: { ...dto, effectiveFrom }, $inc: { version: 1 } };
        if (effectiveTo) update.$set = { ...update.$set as Record<string, unknown>, effectiveTo };
        else update.$unset = { effectiveTo: 1 };
        const row = await this.laborPolicies.findOneAndUpdate(
          { _id: id, organizationId: org }, update, { new: true, runValidators: true, session },
        ).lean();
        if (!row) throw new NotFoundException('LABOR_POLICY_NOT_FOUND');
        await this.periodVersion.bumpForEffectiveWindow(org, unionFrom, unionTo, session);
        result = row;
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  private assertLaborV2Rules(rules: Partial<Pick<LaborCompliancePolicy, 'minimumOvertimeMinutes' | 'overtimeRoundingMinutes' | 'maxMonthlyAttendanceConfirmations'>>): void {
    const { minimumOvertimeMinutes: min, overtimeRoundingMinutes: step, maxMonthlyAttendanceConfirmations: quota } = rules;
    const integerInRange = (v: unknown, max: number) => v === undefined || (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max);
    if (!integerInRange(min, 1440) || !integerInRange(quota, 31)
      || (step !== undefined && ![0, 15, 30, 60].includes(step))
      || (min !== undefined && step !== undefined && min > 0 && step > 0 && (min < step || min % step !== 0))) {
      throw new BadRequestException('LABOR_POLICY_V2_RULES_INVALID');
    }
  }

  /** AC-LABOR-01 enforcement preview against the effective policy at `at`. */
  async previewLabor(org: string, at: Date, usage: LaborUsage) {
    const policy = await this.effectiveLabor(org, at);
    return evaluateLaborLimits(
      {
        version: policy.version,
        legalReference: policy.legalReference,
        ...laborLimitsFromPolicy(policy),
      },
      usage,
    );
  }

  // ── Work credit policy ────────────────────────────────────────────────────

  listWorkCredit(org: string) {
    return this.workCreditPolicies.find({ organizationId: org }).sort({ effectiveFrom: -1 }).lean();
  }

  async workCreditAt(org: string, at: Date, session?: ClientSession) {
    this.assertValidWorkCreditDate(at);
    let query: any = this.workCreditPolicies.findOne({
      organizationId: org,
      active: true,
      effectiveFrom: { $lte: at },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }],
    }).sort({ effectiveFrom: -1 });
    if (session) query = query.session(session);
    const row = await query.lean();
    if (!row) throw new NotFoundException('WORK_CREDIT_POLICY_NOT_FOUND');
    return row;
  }

  /**
   * Guarantee a work-credit policy covers [from, to] before a period is sent
   * for review. An organization that has never configured one gets the default
   * policy; an organization whose policies leave a gap gets an explicit error
   * instead of employees/managers hitting a 404 when they open the timesheet.
   */
  async ensureWorkCreditCoverage(org: string, from: Date, to: Date) {
    if (!(await this.workCreditPolicies.exists({ organizationId: org }))) {
      await this.workCreditPolicies.create({
        organizationId: org,
        effectiveFrom: new Date(Date.UTC(from.getUTCFullYear(), 0, 1)),
        halfDayMinimumRatio: 0.5,
        fullDayMinimumRatio: 1,
        paidLeaveCreditEnabled: true,
        incompleteDayRule: 'BLOCK',
        businessReference: 'Chính sách quy đổi ngày công mặc định',
        version: 1,
        active: true,
      });
      return;
    }
    for (const at of [from, to]) {
      try {
        await this.workCreditAt(org, at);
      } catch (error) {
        if (error instanceof NotFoundException) throw new ConflictException('WORK_CREDIT_POLICY_MISSING');
        throw error;
      }
    }
  }

  async createWorkCredit(org: string, dto: CreateWorkCreditPolicyDto) {
    const effectiveFrom = date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? date(dto.effectiveTo) : undefined;
    this.assertValidWorkCreditDate(effectiveFrom);
    if (effectiveTo) this.assertValidWorkCreditDate(effectiveTo);
    this.assertValidWorkCreditRules(dto);
    const session = await this.workCreditPolicies.db.startSession();
    try {
      let result: any;
      await session.withTransaction(async () => {
        const existing = await this.workCreditPolicies.find({ organizationId: org }).session(session).lean();
        this.assertNoWorkCreditOverlap(existing, effectiveFrom, effectiveTo);
        const latest = await this.workCreditPolicies.findOne({ organizationId: org }).sort({ version: -1 }).session(session).lean();
        const [row] = await this.workCreditPolicies.create([{
          ...dto,
          organizationId: org,
          effectiveFrom,
          effectiveTo,
          version: (latest?.version ?? 0) + 1,
          active: dto.active ?? true,
        }], { session });
        await this.periodVersion.bumpForEffectiveWindow(org, effectiveFrom, effectiveTo, session);
        result = row.toObject();
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async updateWorkCredit(org: string, id: string, dto: UpdateWorkCreditPolicyDto) {
    const old = await this.workCreditPolicies.findOne({ _id: id, organizationId: org }).lean();
    if (!old) throw new NotFoundException('WORK_CREDIT_POLICY_NOT_FOUND');
    const effectiveFrom = dto.effectiveFrom ? date(dto.effectiveFrom) : old.effectiveFrom;
    const effectiveTo = dto.effectiveTo !== undefined
      ? dto.effectiveTo ? date(dto.effectiveTo) : undefined
      : old.effectiveTo;
    this.assertValidWorkCreditDate(effectiveFrom);
    if (effectiveTo) this.assertValidWorkCreditDate(effectiveTo);
    this.assertValidWorkCreditRules({ ...old, ...dto });
    const unionFrom = old.effectiveFrom < effectiveFrom ? old.effectiveFrom : effectiveFrom;
    const unionTo = !old.effectiveTo || !effectiveTo
      ? undefined
      : old.effectiveTo > effectiveTo ? old.effectiveTo : effectiveTo;
    const session = await this.workCreditPolicies.db.startSession();
    try {
      let result: any;
      await session.withTransaction(async () => {
        const others = await this.workCreditPolicies.find({ organizationId: org, _id: { $ne: id } }).session(session).lean();
        this.assertNoWorkCreditOverlap(others, effectiveFrom, effectiveTo);
        const update: Record<string, unknown> = { $set: { ...dto, effectiveFrom }, $inc: { version: 1 } };
        if (effectiveTo) update.$set = { ...update.$set as object, effectiveTo };
        else update.$unset = { effectiveTo: 1 };
        const row = await this.workCreditPolicies
          .findOneAndUpdate({ _id: id, organizationId: org }, update, { new: true, runValidators: true, session })
          .lean();
        if (!row) throw new NotFoundException('WORK_CREDIT_POLICY_NOT_FOUND');
        await this.periodVersion.bumpForEffectiveWindow(org, unionFrom, unionTo, session);
        result = row;
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  private assertValidWorkCreditDate(value: Date): void {
    if (!Number.isFinite(value.getTime())) throw new BadRequestException('WORK_CREDIT_POLICY_DATE_INVALID');
  }

  private assertValidWorkCreditRules(rules: Pick<WorkCreditPolicy, 'halfDayMinimumRatio' | 'fullDayMinimumRatio' | 'paidLeaveCreditEnabled' | 'incompleteDayRule'>): void {
    try {
      validateWorkCreditPolicyRules(rules);
    } catch {
      throw new BadRequestException('WORK_CREDIT_POLICY_THRESHOLDS_INVALID');
    }
  }

  private assertNoWorkCreditOverlap(existing: EffectiveWindow[], effectiveFrom: Date, effectiveTo?: Date): void {
    try {
      assertNoEffectiveOverlap(existing, effectiveFrom, effectiveTo);
    } catch (error) {
      if (error instanceof ConflictException) throw new ConflictException('WORK_CREDIT_POLICY_EFFECTIVE_DATE_OVERLAP');
      throw new BadRequestException('WORK_CREDIT_POLICY_DATE_RANGE_INVALID');
    }
  }

  // ── Overtime pay policy ───────────────────────────────────────────────────

  listOvertime(org: string) {
    return this.overtimePolicies.find({ organizationId: org }).sort({ effectiveFrom: -1 }).lean();
  }

  async createOvertime(org: string, dto: CreateOvertimePolicyDto) {
    const effectiveFrom = date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? date(dto.effectiveTo) : undefined;
    const session = await this.overtimePolicies.db.startSession();
    try {
      let result: any;
      await session.withTransaction(async () => {
        const existing = await this.overtimePolicies.find({ organizationId: org }).session(session).lean();
        await this.assertNoOverlap(existing, effectiveFrom, effectiveTo);
        const latest = await this.overtimePolicies.findOne({ organizationId: org }).sort({ version: -1 }).session(session).lean();
        const [row] = await this.overtimePolicies.create([{
          ...dto, organizationId: org, effectiveFrom, effectiveTo,
          version: (latest?.version ?? 0) + 1, active: dto.active ?? true,
        }], { session });
        await this.periodVersion.bumpForEffectiveWindow(org, effectiveFrom, effectiveTo, session);
        result = row.toObject();
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  overtimeAt(org: string, at: Date, session?: ClientSession) {
    return this.effectiveOvertime(org, at, session);
  }

  async updateOvertime(org: string, id: string, dto: UpdateOvertimePolicyDto) {
    const old = await this.overtimePolicies.findOne({ _id: id, organizationId: org }).lean();
    if (!old) throw new NotFoundException('OVERTIME_POLICY_NOT_FOUND');
    const effectiveFrom = dto.effectiveFrom ? date(dto.effectiveFrom) : old.effectiveFrom;
    const effectiveTo = dto.effectiveTo !== undefined
      ? dto.effectiveTo ? date(dto.effectiveTo) : undefined
      : old.effectiveTo;
    const unionFrom = old.effectiveFrom < effectiveFrom ? old.effectiveFrom : effectiveFrom;
    const unionTo = !old.effectiveTo || !effectiveTo ? undefined : old.effectiveTo > effectiveTo ? old.effectiveTo : effectiveTo;
    const session = await this.overtimePolicies.db.startSession();
    try {
      let result: any;
      await session.withTransaction(async () => {
        const others = await this.overtimePolicies.find({ organizationId: org, _id: { $ne: id } }).session(session).lean();
        await this.assertNoOverlap(others, effectiveFrom, effectiveTo);
        const update: Record<string, unknown> = { $set: { ...dto, effectiveFrom }, $inc: { version: 1 } };
        if (effectiveTo) update.$set = { ...update.$set as Record<string, unknown>, effectiveTo };
        else update.$unset = { effectiveTo: 1 };
        const row = await this.overtimePolicies.findOneAndUpdate(
          { _id: id, organizationId: org }, update, { new: true, runValidators: true, session },
        ).lean();
        if (!row) throw new NotFoundException('OVERTIME_POLICY_NOT_FOUND');
        await this.periodVersion.bumpForEffectiveWindow(org, unionFrom, unionTo, session);
        result = row;
      });
      return result;
    } finally {
      await session.endSession();
    }
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

