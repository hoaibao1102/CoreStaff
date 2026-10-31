import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { AttendanceDayDocument } from '../../database/schemas/attendance-day.schema';
import { CalendarExceptionDocument } from '../../database/schemas/calendar-exception.schema';
import { EmployeeDayOverrideDocument } from '../../database/schemas/employee-day-override.schema';
import { ManagerRequestDocument } from '../../database/schemas/manager-request.schema';
import { OvertimeResult, OvertimeResultDocument } from '../../database/schemas/overtime-result.schema';
import { CalendarExceptionType } from '../../database/schemas/enums';
import { dateOnly, enumerateDates } from '../../common/date-only';
import { parseWindowInstant, vnDayBounds } from '../../common/vietnam-time';
import { PoliciesService } from '../policies/policies.service';
import { evaluateLaborLimits, LaborUsage, laborLimitsFromPolicy, OvertimeType } from '../policies/policies-domain';
import { ShiftResolverService } from '../shift-template/shift-resolver.service';
import { PeriodVersionService } from '../timesheet/period-version.service';
import {
  computeOvertime,
  inputHashOf,
  intervalsOverlap,
  minutesInside,
  normalizeInterval,
  overtimeTypeOf,
  scheduledMinutesOf,
  subtractIntervals,
  sumMinutes,
  type Interval,
  type OtComputation,
} from './overtime-domain';

/** §17 — a client may never supply these as trusted data. */
export const CLIENT_TRUSTED_OT_FIELDS = ['overtimeType', 'actualMinutes', 'eligibleMinutes', 'status', 'managerId'] as const;

/**
 * FR-OT-01 retroactive rule. The team's real flow is reporting *after* the work
 * is done (the manager assigned it on site), so the rule that "a request should
 * precede the OT start" is expressed as a grace window instead of a hard order:
 * report by the end of the day after the work date and nothing extra is asked.
 */
export const RETROACTIVE_GRACE_DAYS = 1;

function inSession<T>(query: T, session?: ClientSession): T {
  return session ? (query as T & { session(value: ClientSession): T }).session(session) : query;
}

/**
 * D39 — the *ceiling* beyond which a late report is refused outright rather than
 * excused by a reason. Within the grace window a report is ordinary; between the
 * grace window and this cutoff it is retroactive and owes a reason; past it, no
 * reason is accepted. Per-organization via `LaborCompliancePolicy
 * .maxRetroactiveFilingDays`, seeded here so the number stays configuration
 * (§30B.1) rather than a constant smeared through the filing path.
 *
 * The reason a ceiling is needed at all: §30B caps are only ever measured
 * against *approved* overtime, so an unreported OT month is invisible to them.
 * A filing window that never closes lets that invisibility stretch back
 * indefinitely, which is the opposite of enforcing a limit.
 */
export const DEFAULT_MAX_RETROACTIVE_FILING_DAYS = 7;

interface ShiftLike {
  _id?: unknown;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
}

export interface EndpointProvenance { source: 'OBSERVED' | 'CONFIRMED_SCHEDULE' | 'MANUAL_ADJUSTMENT' | 'LEGACY_UNKNOWN'; eventId?: string; requestId?: string }

interface DayContext {
  workDate: string;
  calendarType?: CalendarExceptionType;
  calendarName?: string;
  overrideType?: string;
  shift: ShiftLike | null;
  attendanceDayId?: string;
  checkInAt?: Date;
  checkOutAt?: Date;
  checkInProvenance?: EndpointProvenance;
  checkOutProvenance?: EndpointProvenance;
  overallApprovalStatus?: string;
  workingMinutes: number;
  departmentId?: string;
}

/**
 * The subset of an OT request this service reads. Both lean and hydrated docs satisfy it —
 * `detail()`/`listForManager()` populate `employeeUserId`, so the id may arrive either bare
 * or nested. Passing the populated object through `String()` would yield "[object Object]"
 * and silently match no attendance.
 */
export interface OtRequestLike {
  _id?: unknown;
  metadata?: { calculationContract?: string; [key: string]: unknown };
  employeeUserId: string | { _id: unknown };
  departmentId?: string | { _id: unknown };
  workDate: string | Date;
  requestedStart?: string | Date;
  requestedEnd?: string | Date;
  approvedStart?: string | Date;
  approvedEnd?: string | Date;
}

export function otEmployeeUserId(request: OtRequestLike): string {
  const value = request.employeeUserId as string | { _id: unknown };
  return String(typeof value === 'object' && value !== null ? value._id : value);
}

function idOf(value: string | { _id: unknown } | undefined): string {
  if (!value) return '';
  return String(typeof value === 'object' ? value._id : value);
}

/**
 * TASK-068/069/070 — the backend's half of overtime: classify the day, derive
 * eligible minutes from real attendance, and hold the §30B limits.
 *
 * Which employee id, on every query: `ManagerRequest.employeeId` is an
 * **EmployeeProfile** id, `employeeUserId` is the **User** id, and
 * `AttendanceDay.employeeId` / `OvertimeResult.employeeId` are the **User** id.
 * Looking up punches with the profile id returns nothing, which would show up
 * as a silent `eligibleMinutes = 0` — so every method here names the id it takes.
 */
@Injectable()
export class OvertimeService {
  constructor(
    @InjectModel('ManagerRequest') private readonly requests: Model<ManagerRequestDocument>,
    @InjectModel('AttendanceDay') private readonly attendanceDays: Model<AttendanceDayDocument>,
    @InjectModel('CalendarException') private readonly calendar: Model<CalendarExceptionDocument>,
    @InjectModel('EmployeeDayOverride') private readonly overrides: Model<EmployeeDayOverrideDocument>,
    @InjectModel('OvertimeResult') private readonly results: Model<OvertimeResultDocument>,
    private readonly shifts: ShiftResolverService,
    private readonly policies: PoliciesService,
    private readonly periodVersion: PeriodVersionService,
    @Optional() @InjectModel('Organization') private readonly organizations?: Model<any>,
  ) {}

  /** BR-OT-01/AC-OT-01 — refuse a client that tried to choose its own OT type or minutes. */
  assertNoClientType(payload: Record<string, unknown> | undefined): void {
    if (payload && CLIENT_TRUSTED_OT_FIELDS.some((field) => payload[field] !== undefined)) {
      throw new BadRequestException('OVERTIME_SELF_TYPE_FORBIDDEN');
    }
  }

  /**
   * FR-OT-01 — beyond the grace window a report is retroactive and owes a
   * reason; inside it, the request is ordinary and nothing extra is demanded.
   *
   * D39 adds the far edge: past `maxFilingDays` after the work date, no reason
   * is accepted and the filing is refused. `submittedAt` stays a parameter for
   * the same reason it was one before — every other now-relative rule in this
   * file is tested by handing it an explicit instant.
   */
  deriveRetroactive(
    workDate: string,
    submittedAt: Date,
    retroactiveReason?: string,
    maxFilingDays: number = DEFAULT_MAX_RETROACTIVE_FILING_DAYS,
  ): { isRetroactive: boolean; retroactiveReason?: string } {
    const dayEnd = vnDayBounds(dateOnly(workDate)).to - 1;
    const hardCutoff = dayEnd + Math.max(0, maxFilingDays) * 86_400_000;
    if (submittedAt.getTime() > hardCutoff) {
      throw new ConflictException('OVERTIME_FILING_WINDOW_CLOSED');
    }
    const deadline = dayEnd + RETROACTIVE_GRACE_DAYS * 86_400_000;
    if (submittedAt.getTime() <= deadline) return { isRetroactive: false };
    if (!retroactiveReason || retroactiveReason.trim().length < 10) {
      throw new ConflictException('OVERTIME_RETROACTIVE_REASON_REQUIRED');
    }
    return { isRetroactive: true, retroactiveReason: retroactiveReason.trim() };
  }

  /**
   * D39 — the filing window is a policy number, not a constant (§30B.1). A
   * tenant with no labor policy configured keeps the default rather than being
   * refused: `LABOR_POLICY_NOT_FOUND` belongs at approval (D38), where the
   * figure actually matters, not at the moment an employee reports real hours.
   */
  async maxFilingDays(org: string, workDate: string, session?: ClientSession): Promise<number> {
    try {
      const policy = await this.laborPolicyFor(org, workDate, session);
      const days = (policy as { maxRetroactiveFilingDays?: number | null }).maxRetroactiveFilingDays;
      return typeof days === 'number' && Number.isFinite(days) ? days : DEFAULT_MAX_RETROACTIVE_FILING_DAYS;
    } catch (error) {
      if (error instanceof NotFoundException) return DEFAULT_MAX_RETROACTIVE_FILING_DAYS;
      throw error;
    }
  }

  /**
   * D39 — an OT window may not reach into the shift the employee is assigned
   * that day. Until now the encroachment was only *paid* nothing: BR-OT-03
   * subtracts the scheduled span, so a request sitting inside the normal shift
   * sailed through filing and approval and landed in the timesheet as a
   * zero-minute result (`FULLY_WITHIN_SCHEDULE`). That is a wasted round trip
   * for the employee, a wasted decision for the manager, and — worse — an
   * approved window that *hides* the real overtime beside it, because
   * §30B only ever measures approved minutes.
   *
   * It reads the shift through the same `scheduledIntervals()` the payable
   * calculation reads, which makes the two agree by construction: the guard
   * blocks a window *exactly* when that window would have produced zero
   * eligible minutes. A holiday or weekly-off day whose HR removed the shift
   * therefore opens up automatically (nothing to encroach), and a holiday that
   * still carries a shift blocks the same span the calculator would have
   * subtracted — no second notion of "the normal shift" exists to drift.
   * BR-SHIFT-01 forbids hard-coding 08:00–17:00, so no clock time appears here.
   */
  async assertOutsideSchedule(org: string, userId: string, window: Interval, workDate: string, session?: ClientSession): Promise<void> {
      const context = await this.dayContext(org, userId, workDate, session);
    const scheduled = this.scheduledIntervals(context);
    if (!scheduled.length) return;
    if (minutesInside(window, scheduled) > 0) {
      throw new ConflictException('OVERTIME_OVERLAPS_SCHEDULE');
    }
  }

  /**
   * Every guard a filing must clear, in one place so `POST /api/overtime` and
   * `POST /api/requests` cannot drift apart. Returns the retroactive fields the
   * caller stores.
   *
   * The window's own validity is judged before its timing: an employee who
   * reports a late *and* unpayable window is told the part they can act on
   * (fix the hours), not the part they cannot (yesterday is still yesterday).
   * This also keeps the pre-D39 order, which put the timing rule last.
   */
  async assertFilingAllowed(
    org: string,
    userId: string,
    window: Interval,
    workDate: string,
    submittedAt: Date,
    retroactiveReason?: string,
    options: { session?: ClientSession; previewHash?: string; v2Enabled?: boolean } = {},
  ): Promise<{ isRetroactive: boolean; retroactiveReason?: string; calculationContract?: 'OVERTIME_V2' }> {
    const v2 = options.v2Enabled ?? await this.isV2Enabled(org, options.session);
    if (v2) {
      const preview = await this.preview(org, userId, workDate, window, options.session, true);
      if (options.previewHash && options.previewHash !== preview.contextHash) throw new ConflictException('OVERTIME_PREVIEW_STALE');
      if (!preview.canFile) throw new ConflictException(preview.blockedReasons[0]);
    }
    if (v2) {
      if (!options.session?.inTransaction()) throw new ConflictException('OVERTIME_TRANSACTION_REQUIRED');
      await this.periodVersion.claimForWorkDate(org, workDate, options.session);
      const claimed = await this.attendanceDays.updateOne({ organizationId: org, employeeId: userId, workDate }, { $inc: { __v: 1 } }, { session: options.session });
      if (claimed.matchedCount !== 1) throw new ConflictException('OVERTIME_ATTENDANCE_INCOMPLETE');
    }
    await this.assertOutsideSchedule(org, userId, window, workDate, options.session);
    await this.assertNoOverlap(org, userId, window, workDate, undefined, options.session);
    const days = await this.maxFilingDays(org, workDate, options.session);
    const result = this.deriveRetroactive(workDate, submittedAt, retroactiveReason, days);
    return v2 ? { ...result, calculationContract: 'OVERTIME_V2' } : result;
  }

  /**
   * BR-OT-04 — "một phút chỉ thuộc một loại" holds *across* requests too: two
   * live requests covering the same minutes would each be paid for them. So a
   * new window may not overlap an existing PENDING/APPROVED one for the same
   * employee and date.
   */
  async assertNoOverlap(org: string, userId: string, window: Interval, workDate: string, exceptRequestId?: string, session?: ClientSession): Promise<void> {
      const existing = await inSession(this.requests.find({
      organizationId: org,
      employeeUserId: userId,
      type: 'OVERTIME',
      status: { $in: ['PENDING', 'APPROVED'] },
      // `manager_requests.workDate` is a Date (TASK-066) where every other
      // collection in this file uses a 'YYYY-MM-DD' string.
      workDate: dayAsDate(workDate),
    }), session).lean();
    for (const row of existing) {
      if (exceptRequestId && String(row._id) === String(exceptRequestId)) continue;
      const from = row.approvedStart ?? row.requestedStart;
      const to = row.approvedEnd ?? row.requestedEnd;
      if (!from || !to) continue;
      if (intervalsOverlap(window, { from: new Date(from).getTime(), to: new Date(to).getTime() })) {
        throw new ConflictException('OVERTIME_OVERLAP');
      }
    }
  }

  /** The four inputs classification and the interval math need for one day. */
  async dayContext(org: string, userId: string, workDateValue: string | Date, session?: ClientSession): Promise<DayContext> {
    const workDate = normalizeWorkDate(workDateValue);
    const [exception, override, shift, day] = await Promise.all([
      inSession(this.calendar.findOne({ organizationId: org, date: workDate }), session).lean(),
      inSession(this.overrides.findOne({ organizationId: org, employeeId: userId, date: workDate }), session).lean(),
      this.shifts.resolveForEmployeeDate(org, userId, workDate, session),
      inSession(this.attendanceDays.findOne({ organizationId: org, employeeId: userId, workDate }), session).lean(),
    ]);
    return {
      workDate,
      calendarType: exception?.type,
      calendarName: exception?.name,
      overrideType: override?.type,
      shift: shift ? { _id: shift._id, startTime: shift.startTime, endTime: shift.endTime, breakMinutes: shift.breakMinutes } : null,
      attendanceDayId: day?._id ? String(day._id) : undefined,
      checkInAt: day?.checkInAt,
      checkOutAt: day?.checkOutAt,
      checkInProvenance: (day as any)?.checkInProvenance,
      checkOutProvenance: (day as any)?.checkOutProvenance,
      overallApprovalStatus: day?.overallApprovalStatus,
      workingMinutes: day?.workingMinutes ?? 0,
      departmentId: day?.employeeSnapshot?.departmentId ? String(day.employeeSnapshot.departmentId) : undefined,
    };
  }

  /** TASK-068 — §7.7 precedence, read from the calendar and schedule, never the client. */
  classifyDay(context: DayContext): OvertimeType {
    return overtimeTypeOf({
      overrideType: context.overrideType,
      calendarType: context.calendarType,
      hasWorkObligation: Boolean(context.shift),
    });
  }

  /** TASK-069 — one approved request, reduced to the four §15.11 minute figures. */
  async computeForRequest(org: string, request: OtRequestLike, session?: ClientSession, allowUnverified = false): Promise<{
    context: DayContext;
    overtimeType: OvertimeType;
    computation: OtComputation;
    window: Interval;
  }> {
    const context = await this.dayContext(org, otEmployeeUserId(request), request.workDate, session);
    const requested = this.windowOf(request.requestedStart, request.requestedEnd, context.workDate, 'OVERTIME_REQUEST_WINDOW_INVALID');
    const approved = request.approvedStart && request.approvedEnd
      ? this.windowOf(request.approvedStart, request.approvedEnd, context.workDate, 'OVERTIME_WINDOW_INVALID')
      : undefined;
    const v2 = request.metadata?.calculationContract === 'OVERTIME_V2';
    let evidenceReason: string | undefined;
    if (v2) {
      try { this.assertVerifiedAttendance(context); }
      catch (error) { if (!allowUnverified) throw error; evidenceReason = (error as Error).message; }
    }
    const policy = v2 ? await this.v2Policy(org, context.workDate, session) : undefined;
    const computation = computeOvertime({
      calculationContract: v2 ? 'OVERTIME_V2' : undefined,
      policy,
      workDate: context.workDate,
      overtimeType: this.classifyDay(context),
      requested,
      approved,
      actual: evidenceReason ? undefined : this.actualInterval(context),
      scheduled: this.scheduledIntervals(context),
    });
    if (evidenceReason) {
      const span = this.actualInterval(context);
      computation.actualMinutes = span ? sumMinutes([span]) : 0;
      computation.reasons = [evidenceReason]; computation.calculationNote = evidenceReason;
    }
    if (v2) {
      computation.policySnapshot = policy;
      computation.provenanceSnapshot = { checkIn: context.checkInProvenance, checkOut: context.checkOutProvenance, approvalStatus: context.overallApprovalStatus };
    }
    return { context, overtimeType: computation.overtimeType, computation, window: approved ?? requested };
  }

  /**
   * TASK-070 — §30B.2 at the moment of approval: day, week, month and year
   * checked simultaneously, against the policy effective on the *work date*
   * (not today, or a mid-month policy edit would move a past decision).
   * A BLOCK throws; WARNINGs come back on the result for the caller to surface.
   */
  async claimApproval(org: string, request: OtRequestLike, session: ClientSession): Promise<void> {
    const workDate = normalizeWorkDate(request.workDate);
    const v2 = request.metadata?.calculationContract === 'OVERTIME_V2';
    try {
      await this.periodVersion.claimForWorkDate(org, workDate, session);
    } catch (error) {
      // Pre-cutover V1 requests may predate period setup. Only absence is
      // compatible: a covering closed/payroll-claimed period must still block.
      if (v2 || !(error instanceof ConflictException) || error.message !== 'PERIOD_REQUIRED') throw error;
    }
    const claimed = await this.attendanceDays.updateOne(
      { organizationId: org, employeeId: otEmployeeUserId(request), workDate },
      { $inc: { __v: 1 } }, { session },
    );
    if (v2 && claimed.matchedCount !== 1) throw new ConflictException('OVERTIME_ATTENDANCE_INCOMPLETE');
    await this.assertNoOverlap(org, otEmployeeUserId(request), this.windowOf(request.approvedStart ?? request.requestedStart, request.approvedEnd ?? request.requestedEnd, workDate, 'OVERTIME_WINDOW_INVALID'), workDate, String(request._id), session);
  }

  async precheckApproval(org: string, request: OtRequestLike, session?: ClientSession): Promise<{
    overtimeType: OvertimeType;
    computation: OtComputation;
    labor: ReturnType<typeof evaluateLaborLimits>;
  }> {
    const { context, overtimeType, computation, window } = await this.computeForRequest(org, request, session);
    // D39 — the filing guard checked the *requested* window. What gets paid is
    // the *approved* one, which the manager may rewrite, and the shift itself
    // may have moved under a request that sat in the queue. Same rule, re-read
    // here, so an approval can never create a window filing would have refused.
    const scheduled = this.scheduledIntervals(context);
    if (scheduled.length && minutesInside(window, scheduled) > 0) {
      throw new ConflictException('OVERTIME_OVERLAPS_SCHEDULE');
    }
    const laborPolicy = await this.laborPolicyFor(org, context.workDate, session);
    const usage = await this.usageFor(org, otEmployeeUserId(request), context.workDate, computation.rawEligibleMinutes ?? computation.eligibleMinutes, computation.calculationContract === 'OVERTIME_V2', session);
    const evaluation = evaluateLaborLimits(
      { version: laborPolicy.version, legalReference: laborPolicy.legalReference, ...laborLimitsFromPolicy(laborPolicy) },
      usage,
    );
    const blocker = evaluation.violations.find((violation) => violation.severity === 'BLOCK');
    // 422, not 409: §30H lists the limit codes as unprocessable business-rule
    // failures, and 409 is taken by REQUEST_STATE_CHANGED / OVERTIME_OVERLAP.
    if (blocker) throw new UnprocessableEntityException(blocker.code);
    return { overtimeType, computation, labor: evaluation };
  }

  /**
   * Submit-time sanity check. Eligible minutes are only *computed* at approval
   * (the day's attendance may not exist yet), so what a filing employee can be
   * warned about is the projection: "if every minute you asked for were granted,
   * would that breach a cap". Never blocks — §30B.2 puts the block at approval.
   */
  async previewLimits(org: string, userId: string, workDateValue: string | Date, requestedMinutes: number) {
    const context = await this.dayContext(org, userId, workDateValue);
    const laborPolicy = await this.laborPolicyFor(org, context.workDate);
    const usage = await this.usageFor(org, userId, context.workDate, requestedMinutes, await this.isV2Enabled(org));
    return evaluateLaborLimits(
      { version: laborPolicy.version, legalReference: laborPolicy.legalReference, ...laborLimitsFromPolicy(laborPolicy) },
      usage,
    );
  }

  /**
   * §30B.1 metrics for one employee, on the rule the law actually uses: overtime
   * is what sits *beyond* the normal hours, so a day's normal minutes are capped
   * at that day's scheduled length and OT is added on top of them. Feeding the
   * raw punch total in as `normalDailyMinutes` instead would make every worked
   * overtime day breach `normalDailyMinutes: 480` on its own — an approval could
   * never pass — and would count the same minutes twice in `combinedDaily`.
   *
   * Already-banked OT is read from stored results rather than recomputed, so a
   * reviewed period cannot drift under a later policy edit. The candidate is then
   * added to every bucket it belongs to, which is how one approval can trip the
   * daily and the monthly limit in the same pass (§30B.2 "kiểm tra đồng thời").
   */
  async usageFor(org: string, userId: string, workDate: string, candidateMinutes: number, v2 = false, session?: ClientSession): Promise<LaborUsage> {
    if (v2) return this.observedUsage(org, userId, workDate, session);
    const week = weekOf(workDate);
    // No date exclusion anywhere: the request being decided is still PENDING so
    // it has no stored result yet, and *other* requests' OT on this same day is
    // just as owed against the monthly and annual caps.
    const [monthBanked, yearBanked, weekDays, bankedRows, day] = await Promise.all([
      this.eligibleOn(org, userId, { periodKey: workDate.slice(0, 7) }, session),
      this.eligibleOn(org, userId, { yearKey: workDate.slice(0, 4) }, session),
      inSession(this.attendanceDays.find({ organizationId: org, employeeId: userId, workDate: { $gte: week[0], $lte: week[week.length - 1] } }), session)
        .select('workDate workingMinutes shiftSnapshot')
        .lean(),
      inSession(this.results.find({ organizationId: org, employeeId: userId, workDate: { $gte: week[0], $lte: week[week.length - 1] } }), session)
        .select('workDate eligibleMinutes')
        .lean(),
      inSession(this.attendanceDays.findOne({ organizationId: org, employeeId: userId, workDate }), session).select('workingMinutes shiftSnapshot').lean(),
    ]);
    const bankedByDate = new Map<string, number>();
    for (const row of bankedRows) {
      const date = normalizeWorkDate(row.workDate);
      bankedByDate.set(date, (bankedByDate.get(date) ?? 0) + (row.eligibleMinutes ?? 0));
    }
    const bankedToday = bankedByDate.get(workDate) ?? 0;
    // The punch cannot tell normal from OT, the schedule can.
    const normalOn = (row: { workingMinutes?: number; shiftSnapshot?: { startTime?: string; endTime?: string; breakMinutes?: number } }) => {
      const worked = row.workingMinutes ?? 0;
      const scheduled = row.shiftSnapshot?.startTime && row.shiftSnapshot.endTime
        ? scheduledMinutesOf({ startTime: row.shiftSnapshot.startTime, endTime: row.shiftSnapshot.endTime, breakMinutes: row.shiftSnapshot.breakMinutes })
        : 0;
      return scheduled ? Math.min(worked, scheduled) : worked;
    };
    const normalDailyMinutes = day ? normalOn(day) : 0;
    return {
      normalDailyMinutes,
      normalWeeklyMinutes: weekDays.reduce((total, row) => total + normalOn(row), 0),
      // `candidateMinutes` is the OT being decided now; the day's own banked OT is
      // the other requests', so both count — this request is not in there yet.
      combinedDailyMinutes: normalDailyMinutes + bankedToday + candidateMinutes,
      overtimeMonthlyMinutes: monthBanked + candidateMinutes,
      overtimeAnnualMinutes: yearBanked + candidateMinutes,
    };
  }

  /**
   * Approve hook — runs after the manager's decision is written (§7.7 creates a
   * PROVISIONAL result on approval). Attendance is only a snapshot at this
   * moment; a later check-out refreshes it through `recomputeForDay`.
   */
  async onApproved(org: string, request: OtRequestLike, session?: ClientSession): Promise<OvertimeResult> {
    const { context, overtimeType, computation } = await this.computeForRequest(org, request, session);
    const laborPolicy = await this.laborPolicyFor(org, context.workDate, session);
    return this.persistResult(org, request, context, overtimeType, computation, {
      policyVersion: laborPolicy.version,
      legalReference: laborPolicy.legalReference,
    }, 'PROVISIONAL', session);
  }

  /** §30B.2 — the result stores the policy version and legal reference it used. */
  async persistResult(
    org: string,
    request: OtRequestLike,
    context: DayContext,
    overtimeType: OvertimeType,
    computation: OtComputation,
    labor: { policyVersion: number; legalReference: string },
    status: 'PROVISIONAL' | 'FINAL' = 'PROVISIONAL',
    session?: ClientSession,
  ): Promise<OvertimeResult> {
    const overtimeRequestId = String(request._id);
    const existing = await inSession(this.results.findOne({ organizationId: org, overtimeRequestId }), session).lean();
    if (existing?.classificationStatus === 'FINAL' && await this.isFinalImmutable(org, existing.workDate, session)) return existing as OvertimeResult;
    const departmentId = idOf(request.departmentId) || (context.departmentId ?? '');
    if (!departmentId) throw new ConflictException('OVERTIME_DEPARTMENT_UNKNOWN');
    const document: Record<string, unknown> = {
      organizationId: org,
      overtimeRequestId,
      attendanceDayId: context.attendanceDayId,
      // `otEmployeeUserId`, never `String(request.employeeUserId)`: the approve
      // path hands over the request *after* `detail()` populated it, so the raw
      // value here can be `{ _id: ObjectId }` and stringifying it gives
      // "[object Object]", which Mongo then refuses to cast.
      employeeId: otEmployeeUserId(request),
      departmentId,
      workDate: context.workDate,
      periodKey: context.workDate.slice(0, 7),
      yearKey: context.workDate.slice(0, 4),
      overtimeType,
      classificationStatus: status,
      requestedMinutes: computation.requestedMinutes,
      approvedMinutes: computation.approvedMinutes,
      actualMinutes: computation.actualMinutes,
      calculationContract: computation.calculationContract ?? 'LEGACY_V1',
      rawEligibleMinutes: computation.rawEligibleMinutes,
      payableMinutes: computation.payableMinutes,
      roundingDroppedMinutes: computation.roundingDroppedMinutes,
      minimumThresholdApplied: computation.minimumThresholdApplied,
      reasons: computation.reasons,
      policySnapshot: computation.policySnapshot,
      provenanceSnapshot: computation.provenanceSnapshot,
      eligibleMinutes: computation.eligibleMinutes,
      eligibleIntervals: computation.eligibleIntervals.map((interval) => ({ from: new Date(interval.from), to: new Date(interval.to) })),
      scheduledMinutes: scheduledMinutesOf(context.shift),
      calendarSnapshot: {
        date: context.workDate,
        type: context.calendarType,
        name: context.calendarName,
        overrideType: context.overrideType,
      },
      scheduleSnapshot: context.shift
        ? {
            shiftTemplateId: context.shift._id ? String(context.shift._id) : undefined,
            startTime: context.shift.startTime,
            endTime: context.shift.endTime,
            breakMinutes: context.shift.breakMinutes,
          }
        : undefined,
      policyVersion: labor.policyVersion,
      legalReference: labor.legalReference,
      inputHash: computation.calculationContract === 'OVERTIME_V2' ? this.v2Hash(context, overtimeType, computation.policySnapshot) : this.hashOf(context, overtimeType, labor),
      calculationNote: computation.calculationNote.slice(0, 500),
      calculatedAt: new Date(),
    };
    // One document per request, upserted: idempotent, so a lost write is fixed
    // by `recalculate` rather than needing a multi-document transaction.
    await this.results.updateOne({ organizationId: org, overtimeRequestId }, { $set: document }, { upsert: true, session });
    const row = await inSession(this.results.findOne({ organizationId: org, overtimeRequestId }), session).lean();
    if (!row) throw new NotFoundException('OVERTIME_RESULT_NOT_FOUND');
    return row as OvertimeResult;
  }

  /** FINAL freezes a close, not the mutable source after an authorized reopen.
   * Missing/ambiguous ownership fails closed; historical summaries and payroll
   * snapshots are versioned artifacts and are deliberately never updated here.
   */
  private async isFinalImmutable(org: string, workDate: string | Date, session?: ClientSession): Promise<boolean> {
    const date = normalizeWorkDate(workDate);
    const periods = await inSession(this.results.db.model('TimesheetPeriod').find({
      organizationId: org,
      active: true,
      startDate: { $lte: date },
      endDate: { $gte: date },
    }), session).lean();
    if (periods.length !== 1) return true;
    const period = periods[0];
    return period.payrollRunId != null || !['OPEN', 'REVIEWING', 'READY_TO_CLOSE'].includes(period.status);
  }

  /** HR review list — each row carries its own staleness verdict (AC-OT-05). */
  async listResults(
    org: string,
    filter: { from?: string; to?: string; employeeId?: string; departmentId?: string; status?: string } = {},
  ): Promise<Array<Record<string, unknown> & { recalculationRequired: boolean }>> {
    const query: Record<string, unknown> = { organizationId: org };
    if (filter.from || filter.to) {
      query.workDate = {
        ...(filter.from ? { $gte: dateOnly(filter.from) } : {}),
        ...(filter.to ? { $lte: dateOnly(filter.to) } : {}),
      };
    }
    if (filter.employeeId) query.employeeId = filter.employeeId;
    if (filter.departmentId) query.departmentId = filter.departmentId;
    if (filter.status) query.classificationStatus = filter.status;
    const rows = await this.results.find(query).sort({ workDate: -1 }).lean();
    return Promise.all(rows.map(async (row) => ({ ...row, recalculationRequired: await this.isStale(org, row) })));
  }

  /**
   * BR-OT-05 without a document fan-out: the stored input fingerprint no longer
   * matching what the calendar/shift/policy say now *is* the staleness flag.
   * Only inputs are hashed, so this is a couple of reads, not a recompute.
   */
  async isStale(
    org: string,
    row: { employeeId: string; workDate: string; overtimeType: OvertimeType; inputHash: string; calculationContract?: string; classificationStatus?: string },
  ): Promise<boolean> {
    if (row.classificationStatus === 'FINAL' && await this.isFinalImmutable(org, row.workDate)) return false;
    try {
      const context = await this.dayContext(org, String(row.employeeId), row.workDate);
      if (row.calculationContract === 'OVERTIME_V2') return this.v2Hash(context, this.classifyDay(context), await this.v2Policy(org, row.workDate)) !== row.inputHash;
      const laborPolicy = await this.laborPolicyFor(org, row.workDate);
      return this.hashOf(context, this.classifyDay(context), { policyVersion: laborPolicy.version, legalReference: laborPolicy.legalReference }) !== row.inputHash;
    } catch {
      // An input that no longer resolves (calendar row deleted, shift withdrawn)
      // is stale by definition.
      return true;
    }
  }

  /**
   * Recompute a range, optionally promoting to FINAL. Idempotent: every input is
   * read fresh and the output is an upsert keyed on the request, so a second run
   * changes nothing. Sprint 6's close transaction calls this with
   * `targetStatus: 'FINAL'` — that is the seam, and nothing more is built here.
   */
  async recompute(
    org: string,
    from: string,
    to: string,
    options: { employeeId?: string; targetStatus?: 'PROVISIONAL' | 'FINAL' } = {},
    session?: ClientSession,
    behavior: { bumpPeriodVersion?: boolean } = {},
  ): Promise<{ scanned: number; changed: number }> {
    const dates = enumerateDates(dateOnly(from), dateOnly(to));
    if (!dates.length) throw new BadRequestException('OVERTIME_DATE_RANGE_INVALID');
    // Same 366-day ceiling as DayClassificationService.rebuild.
    if (dates.length > 366) throw new BadRequestException('OVERTIME_DATE_RANGE_TOO_LARGE');
    const query: Record<string, unknown> = {
      organizationId: org,
      type: 'OVERTIME',
      status: 'APPROVED',
      workDate: { $gte: dayAsDate(dates[0]), $lte: dayAsDate(dates[dates.length - 1]) },
    };
    if (options.employeeId) query.employeeUserId = options.employeeId;
    const rows = await inSession(this.requests.find(query), session).lean();
    let changed = 0;
    for (const request of rows) {
      const frozen = await inSession(this.results.findOne({ organizationId: org, overtimeRequestId: String(request._id) }), session).lean();
      if (frozen?.classificationStatus === 'FINAL' && await this.isFinalImmutable(org, frozen.workDate, session)) continue;
      const { context, overtimeType, computation } = await this.computeForRequest(org, request as OtRequestLike, session, true);
      const laborPolicy = await this.laborPolicyFor(org, context.workDate, session);
      const labor = { policyVersion: laborPolicy.version, legalReference: laborPolicy.legalReference };
      const before = await inSession(this.results.findOne({ organizationId: org, overtimeRequestId: String(request._id) }), session).lean();
      const targetStatus = options.targetStatus ?? 'PROVISIONAL';
      if (targetStatus === 'FINAL' && computation.calculationContract === 'OVERTIME_V2' && computation.reasons?.some(reason => reason.startsWith('OVERTIME_ATTENDANCE_'))) throw new ConflictException('OVERTIME_UNRESOLVED');
      const projectionChanged = !before
        || before.overtimeType !== overtimeType
        || before.approvedMinutes !== computation.approvedMinutes
        || before.actualMinutes !== computation.actualMinutes
        || before.eligibleMinutes !== computation.eligibleMinutes
        || (computation.calculationContract === 'OVERTIME_V2' ? this.v2Hash(context, overtimeType, computation.policySnapshot) : this.hashOf(context, overtimeType, labor)) !== before.inputHash;
      const moved = projectionChanged || before.classificationStatus !== targetStatus;
      if (!moved) continue;
      await this.persistResult(org, request as OtRequestLike, context, overtimeType, computation, labor, targetStatus, session);
      if (projectionChanged) changed += 1;
    }
    // A PROVISIONAL → FINAL promotion freezes the already-reviewed values but
    // does not change the employee projection. Only value changes invalidate
    // the current period version and its acknowledgements.
    if (changed > 0 && behavior.bumpPeriodVersion !== false) {
      if (session) await this.periodVersion.bumpForWorkDates(org, dates, session);
      else await this.periodVersion.bumpForWorkDates(org, dates);
    }
    return { scanned: rows.length, changed };
  }

  /** A calendar/schedule edit for one date: refresh whatever results depended on it. */
  async invalidate(org: string, dates: string[], session?: ClientSession, behavior: { bumpPeriodVersion?: boolean } = {}): Promise<{ scanned: number; changed: number }> {
    const sorted = [...dates].filter(Boolean).sort();
    if (!sorted.length) return { scanned: 0, changed: 0 };
    return this.recompute(org, sorted[0], sorted[sorted.length - 1], {}, session, behavior);
  }

  /** Check-out hook — keeps an already-approved day's figures current. */
  async recomputeForDay(org: string, userId: string, workDate: string): Promise<number> {
    const date = normalizeWorkDate(workDate);
    const rows = await this.requests.find({
      organizationId: org,
      employeeUserId: userId,
      type: 'OVERTIME',
      status: 'APPROVED',
      workDate: dayAsDate(date),
    }).lean();
    for (const request of rows) {
      const { context, overtimeType, computation } = await this.computeForRequest(org, request as OtRequestLike, undefined, true);
      const laborPolicy = await this.laborPolicyFor(org, context.workDate);
      await this.persistResult(org, request as OtRequestLike, context, overtimeType, computation, {
        policyVersion: laborPolicy.version,
        legalReference: laborPolicy.legalReference,
      });
    }
    return rows.length;
  }

  /**
   * D39 — the reason a filing cutoff exists. §30B caps are measured against
   * *approved* minutes, so hours worked outside the shift that nobody reported
   * never enter the cap at all: the employee can work six extra hours and the
   * monthly figure only ever moves by the two hours they chose to file. This
   * measures the gap from the one source that cannot lie — the punch — by
   * taking the day's worked span, subtracting the scheduled shift and any
   * already-approved window, and reporting what is left.
   *
   * Returns `null` when there is nothing to flag (no punches, no breach). Called
   * at check-out as a warning, never a block: the work already happened, and a
   * refusal at that point would punish the employee for the manager's assignment.
   */
  async unreportedOvertimeMinutes(
    org: string,
    userId: string,
    workDate: string,
  ): Promise<{ unreportedMinutes: number; workedTo: Date } | null> {
    const context = await this.dayContext(org, userId, workDate);
    if (await this.isV2Enabled(org)) {
      try { this.assertVerifiedAttendance(context); } catch { return null; }
    }
    const worked = this.actualInterval(context);
    if (!worked) return null;
    const approved = await this.requests.find({
      organizationId: org,
      employeeUserId: userId,
      type: 'OVERTIME',
      status: { $in: ['PENDING', 'APPROVED'] },
      workDate: dayAsDate(context.workDate),
    }).select('requestedStart requestedEnd approvedStart approvedEnd').lean();
    // Anything still in the queue counts as claimed: the point of the flag is
    // "hours nobody has asked about yet", not "hours not yet approved".
    const claimed = [this.scheduledIntervals(context)[0]].filter((i): i is Interval => Boolean(i));
    for (const row of approved) {
      const from = row.approvedStart ?? row.requestedStart;
      const to = row.approvedEnd ?? row.requestedEnd;
      if (!from || !to) continue;
      const window = normalizeInterval({ from: new Date(from).getTime(), to: new Date(to).getTime() });
      if (window) claimed.push(window);
    }
    const leftover = subtractIntervals([worked], claimed);
    const minutes = sumMinutes(leftover);
    return minutes > 0 ? { unreportedMinutes: minutes, workedTo: new Date(worked.to) } : null;
  }

  /**
   * FR-OT-03 per-type totals for a period — exactly the buckets Sprint 6's
   * TimesheetSummary aggregates, and AC-OT-06's reconciliation target.
   */
  async totalsByType(org: string, periodKey: string, employeeId?: string) {
    const match: Record<string, unknown> = { organizationId: org, periodKey };
    if (employeeId) match.employeeId = employeeId;
    const rows = await this.results.aggregate<{ _id: OvertimeType; minutes: number }>([
      { $match: match },
      { $group: { _id: '$overtimeType', minutes: { $sum: '$eligibleMinutes' } } },
    ]);
    const totals = { otWorkingDayMinutes: 0, otWeeklyOffMinutes: 0, otPublicHolidayMinutes: 0, totalEligibleOvertimeMinutes: 0 };
    for (const row of rows) {
      if (row._id === OvertimeType.WORKING_DAY) totals.otWorkingDayMinutes = row.minutes;
      else if (row._id === OvertimeType.WEEKLY_OFF) totals.otWeeklyOffMinutes = row.minutes;
      else if (row._id === OvertimeType.PUBLIC_HOLIDAY) totals.otPublicHolidayMinutes = row.minutes;
    }
    totals.totalEligibleOvertimeMinutes = totals.otWorkingDayMinutes + totals.otWeeklyOffMinutes + totals.otPublicHolidayMinutes;
    return totals;
  }

  /**
   * Banked results over a date range, for the attendance history tiles. Takes
   * 'YYYY-MM-DD' strings and compares them as stored — no `dateOnly` validation,
   * so a caller may pass an exclusive upper sentinel like `YYYY-MM-31`.
   */
  async resultsForRange(org: string, userId: string, from: string, to: string): Promise<OvertimeResult[]> {
    return this.results
      .find({ organizationId: org, employeeId: userId, workDate: { $gte: from, $lte: to } })
      .lean() as unknown as Promise<OvertimeResult[]>;
  }

  /** Attaches the system's verdict to the employee's own request list. */
  async withResults(org: string, requests: Array<Record<string, unknown>>) {
    const ids = requests.map((row) => String(row._id));
    const results = ids.length
      ? await this.results.find({ organizationId: org, overtimeRequestId: { $in: ids } }).lean()
      : [];
    const byRequest = new Map(results.map((row) => [String(row.overtimeRequestId), row]));
    return requests.map((row) => {
      const result = byRequest.get(String(row._id));
      return {
        ...row,
        overtimeType: result?.overtimeType ?? null,
        actualMinutes: result?.actualMinutes ?? 0,
        eligibleMinutes: result?.eligibleMinutes ?? 0,
        classificationStatus: result?.classificationStatus ?? null,
        calculationNote: result?.calculationNote ?? null,
      };
    });
  }

  /** Fingerprint of the *inputs* only — see `isStale`. Only the version enters the hash. */
  private hashOf(
    context: DayContext,
    overtimeType: OvertimeType,
    labor: { policyVersion: number; legalReference?: string },
  ): string {
    return inputHashOf({
      workDate: context.workDate,
      calendarType: context.calendarType ?? null,
      overrideType: context.overrideType ?? null,
      shift: context.shift ? { id: context.shift._id ?? null, start: context.shift.startTime, end: context.shift.endTime } : null,
      punches: context.checkInAt && context.checkOutAt
        ? { from: new Date(context.checkInAt).getTime(), to: new Date(context.checkOutAt).getTime() }
        : null,
      overtimeType,
      laborPolicyVersion: labor.policyVersion,
    });
  }

  /**
   * The policy in force *on the work date* (§30B.2). The instant has to be midday
   * **Vietnam** time, not midday UTC: `vnDayBounds` returns the UTC span of the VN
   * day, whose last instant is 17:00 UTC, so a UTC-noon probe would read a policy
   * dated the following morning.
   */
  private async laborPolicyFor(org: string, workDate: string, session?: ClientSession) {
    return this.policies.laborAt(org, new Date(vnDayBounds(workDate).from + 12 * 3600_000), session);
  }

  private windowOf(start: string | Date | undefined, end: string | Date | undefined, workDate: string, code: string): Interval {
    if (!start || !end) throw new ConflictException(code);
    const window = { from: parseWindowInstant(start, workDate), to: parseWindowInstant(end, workDate) };
    if (!(window.to > window.from)) throw new ConflictException(code);
    return window;
  }

  private v2Hash(context: DayContext, overtimeType: OvertimeType, policy: unknown): string {
    return inputHashOf({ contract: 'OVERTIME_V2', base: this.hashOf(context, overtimeType, { policyVersion: 0 }), policy,
      provenance: { checkIn: context.checkInProvenance, checkOut: context.checkOutProvenance, approvalStatus: context.overallApprovalStatus } });
  }

  private async observedUsage(org: string, userId: string, workDate: string, session?: ClientSession): Promise<LaborUsage> {
    const week = weekOf(workDate);
    const from = [workDate.slice(0, 4) + '-01-01', week[0]].sort()[0];
    const to = [workDate.slice(0, 4) + '-12-31', week[6]].sort()[1];
    const days = await inSession(this.attendanceDays.find({ organizationId: org, employeeId: userId, workDate: { $gte: from, $lte: to } }), session).lean();
    const usage = { normalDailyMinutes: 0, normalWeeklyMinutes: 0, combinedDailyMinutes: 0, overtimeMonthlyMinutes: 0, overtimeAnnualMinutes: 0 };
    for (const day of days) {
      const context = await this.dayContext(org, userId, normalizeWorkDate(day.workDate), session);
      try { this.assertVerifiedAttendance(context); } catch { continue; }
      const actual = this.actualInterval(context)!;
      const overtime = sumMinutes(subtractIntervals([actual], this.scheduledIntervals(context)));
      const normal = Math.min(context.workingMinutes, scheduledMinutesOf(context.shift));
      if (context.workDate === workDate) { usage.normalDailyMinutes = normal; usage.combinedDailyMinutes = normal + overtime; }
      if (week.includes(context.workDate)) usage.normalWeeklyMinutes += normal;
      if (context.workDate.slice(0, 7) === workDate.slice(0, 7)) usage.overtimeMonthlyMinutes += overtime;
      if (context.workDate.slice(0, 4) === workDate.slice(0, 4)) usage.overtimeAnnualMinutes += overtime;
    }
    return usage;
  }

  async scheduleSuggestions(org: string, userId: string, workDate: string) {
    const context = await this.dayContext(org, userId, workDate);
    try { this.assertVerifiedAttendance(context); }
    catch (error) { return { canFile: false, blockedReasons: [(error as Error).message], provenance: { checkIn: context.checkInProvenance, checkOut: context.checkOutProvenance }, suggestedOvertimeIntervals: [] }; }
    const claims = await this.requests.find({ organizationId: org, employeeUserId: userId, type: 'OVERTIME', status: { $in: ['PENDING', 'APPROVED'] }, workDate: dayAsDate(workDate) }).lean();
    const cuts = [...this.scheduledIntervals(context)];
    for (const claim of claims) {
      if (!(claim.approvedStart ?? claim.requestedStart) || !(claim.approvedEnd ?? claim.requestedEnd)) continue;
      cuts.push(this.windowOf(claim.approvedStart ?? claim.requestedStart, claim.approvedEnd ?? claim.requestedEnd, workDate, 'OVERTIME_WINDOW_INVALID'));
    }
    const suggestions = [];
    for (const span of subtractIntervals([this.actualInterval(context)!], cuts)) {
      const result = await this.preview(org, userId, workDate, span, undefined, true);
      suggestions.push({ from: new Date(span.from).toISOString(), to: new Date(span.to).toISOString(), ...result });
    }
    const blockedReasons = [...new Set(suggestions.flatMap(s => s.blockedReasons))];
    return { canFile: suggestions.some(s => s.canFile), blockedReasons, policy: suggestions[0]?.policy,
      provenance: { checkIn: context.checkInProvenance, checkOut: context.checkOutProvenance }, suggestedOvertimeIntervals: suggestions };
  }

  async isV2Enabled(org: string, session?: ClientSession): Promise<boolean> {
    if (!this.organizations) return false;
    const tenant = await inSession(this.organizations.findOne({ _id: org }), session).lean();
    return (tenant as { attendanceOvertimeV2Enabled?: boolean } | null)?.attendanceOvertimeV2Enabled === true;
  }

  async preview(org: string, userId: string, workDate: string, window: Interval, session?: ClientSession, forceV2 = false) {
    if (!forceV2 && !await this.isV2Enabled(org, session)) {
      const context = await this.dayContext(org, userId, workDate, session);
      const computation = computeOvertime({ workDate, overtimeType: this.classifyDay(context), requested: window, actual: this.actualInterval(context), scheduled: this.scheduledIntervals(context) });
      const blockedReasons = minutesInside(window, this.scheduledIntervals(context)) > 0 ? ['OVERTIME_OVERLAPS_SCHEDULE'] : [];
      return { ...computation, workDate, calculationContract: 'LEGACY_V1' as const, canFile: blockedReasons.length === 0, blockedReasons,
        contextHash: inputHashOf({ workDate, window, computation }), policy: undefined };
    }
    const context = await this.dayContext(org, userId, workDate, session);
    const blockedReasons: string[] = [];
    let computation: OtComputation | undefined;
    let policy: Awaited<ReturnType<OvertimeService['v2Policy']>> | undefined;
    try {
      this.assertVerifiedAttendance(context);
      policy = await this.v2Policy(org, workDate, session);
      computation = computeOvertime({ workDate, overtimeType: this.classifyDay(context), requested: window,
        actual: this.actualInterval(context), scheduled: this.scheduledIntervals(context), calculationContract: 'OVERTIME_V2', policy });
      if (computation.minimumThresholdApplied) blockedReasons.push('OVERTIME_BELOW_MINIMUM');
      if (minutesInside(window, this.scheduledIntervals(context)) > 0) blockedReasons.push('OVERTIME_OVERLAPS_SCHEDULE');
    } catch (error) {
      if (error instanceof ConflictException || (error instanceof Error && ['UNSUPPORTED_OVERNIGHT_SHIFT', 'POLICY_CONFIGURATION_REQUIRED'].includes(error.message))) blockedReasons.push((error as Error).message);
      else throw error;
    }
    const provenance = { checkIn: context.checkInProvenance, checkOut: context.checkOutProvenance, approvalStatus: context.overallApprovalStatus };
    const contextHash = inputHashOf({ workDate, window, shift: context.shift, calendarType: context.calendarType, overrideType: context.overrideType,
      checkInAt: context.checkInAt?.toISOString(), checkOutAt: context.checkOutAt?.toISOString(), provenance, policy });
    return { workDate, calculationContract: 'OVERTIME_V2' as const, ...computation, policy, provenance, contextHash,
      canFile: blockedReasons.length === 0, blockedReasons };
  }

  assertVerifiedAttendance(context: DayContext): void {
    if (!this.actualInterval(context)) throw new ConflictException('OVERTIME_ATTENDANCE_INCOMPLETE');
    if (!['APPROVED', 'NOT_REQUIRED'].includes(context.overallApprovalStatus ?? '')) throw new ConflictException('OVERTIME_ATTENDANCE_NOT_VERIFIED');
    if (context.checkInProvenance?.source !== 'OBSERVED' || context.checkOutProvenance?.source !== 'OBSERVED') throw new ConflictException('OVERTIME_ATTENDANCE_SOURCE_UNSUPPORTED');
  }

  private async v2Policy(org: string, workDate: string, session?: ClientSession) {
    let p: any;
    try { p = await this.laborPolicyFor(org, workDate, session); }
    catch (error) { if (error instanceof NotFoundException) throw new ConflictException('POLICY_CONFIGURATION_REQUIRED'); throw error; }
    const minimum = p.minimumOvertimeMinutes;
    const step = p.overtimeRoundingMinutes;
    if (!Number.isInteger(minimum) || minimum < 0 || minimum > 1440 || ![0, 15, 30, 60].includes(step)
      || (minimum > 0 && step > 0 && (minimum < step || minimum % step !== 0))) throw new ConflictException('POLICY_CONFIGURATION_REQUIRED');
    return { id: String(p._id), version: p.version, effectiveFrom: p.effectiveFrom, effectiveTo: p.effectiveTo,
      minimumOvertimeMinutes: minimum, overtimeRoundingMinutes: step };
  }

  private actualInterval(context: DayContext): Interval | undefined {
    if (!context.checkInAt || !context.checkOutAt) return undefined;
    const from = new Date(context.checkInAt).getTime();
    const to = new Date(context.checkOutAt).getTime();
    return to > from ? { from, to } : undefined;
  }

  /**
   * The assigned shift for the day as an interval, or `[]` when none applies.
   * Public: `GET /api/overtime/schedule` reports the same span the filing guard
   * enforces, so the form and the rule cannot disagree.
   */
  scheduledIntervals(context: DayContext): Interval[] {
    // Organization calendar overrides the recurring shift. On a public holiday
    // every actually worked minute is holiday work; subtracting the ordinary
    // weekday shift would incorrectly reduce holiday OT to zero.
    if (context.calendarType === CalendarExceptionType.PUBLIC_HOLIDAY || context.calendarType === CalendarExceptionType.WEEKLY_OFF) return [];
    if (!context.shift) return [];
    const from = parseWindowInstant(context.shift.startTime, context.workDate);
    const to = parseWindowInstant(context.shift.endTime, context.workDate);
    if (!(to > from)) return [];
    return [{ from, to }];
  }

  private async eligibleOn(
    org: string,
    userId: string,
    filter: Record<string, unknown>,
    session?: ClientSession,
  ): Promise<number> {
    const query: Record<string, unknown> = { organizationId: org, employeeId: userId, ...filter };
    const rows = await inSession(this.results.find(query), session).select('eligibleMinutes').lean();
    return rows.reduce((total, row) => total + (row.eligibleMinutes ?? 0), 0);
  }
}

/**
 * `manager_requests.workDate` is a Date (TASK-066) while `attendance_days` and
 * `overtime_results` store a 'YYYY-MM-DD' string. The two meet constantly in
 * this service, so the conversion lives in one pair of functions: noon UTC keeps
 * the same civil date on any server, and `dateOnly` does the actual parsing.
 */
/**
 * `manager_requests.workDate` is a Date, written as `new Date('YYYY-MM-DD')`
 * (TASK-066) — i.e. exactly UTC midnight. Every equality/range query against it
 * must use the same instant: noon would silently match nothing, which reads as
 * "no overlap" and lets a duplicate overtime window through (BR-OT-04).
 */
function dayAsDate(workDate: string): Date {
  return new Date(`${workDate}T00:00:00.000Z`);
}

function normalizeWorkDate(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return dateOnly(value);
}

/** ISO Monday-to-Sunday week containing `workDate`, as 'YYYY-MM-DD' strings. */
function weekOf(workDate: string): string[] {
  const day = new Date(`${workDate}T00:00:00Z`);
  const weekday = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
  const monday = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - (weekday - 1)));
  return enumerateDates(monday.toISOString().slice(0, 10), new Date(monday.getTime() + 6 * 86_400_000).toISOString().slice(0, 10));
}
