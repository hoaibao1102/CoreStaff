import { createHash } from 'node:crypto';
import { OvertimeType } from '../policies/policies-domain';
import { CalendarExceptionType, WorkdayType } from '../../database/schemas/enums';
import { resolveClassification } from '../leave/day-classification.service';
import { vnDayBounds } from '../../common/vietnam-time';

/**
 * TASK-068/069 — pure overtime domain. No Nest, no database, no HTTP: the same
 * shape as `hr/policies/policies-domain.ts`, so every rule below is testable
 * with plain objects (SRS §22.1 "Overtime classification precedence và interval
 * intersection/subtraction").
 *
 * Intervals are half-open `[from, to)` in epoch milliseconds, so adjacent spans
 * share no minute and a zero-length span is simply `from === to`.
 */

export interface Interval {
  from: number;
  to: number;
}

const MINUTE_MS = 60_000;

/** `null` for an inverted or empty span — callers treat that as "no interval". */
export function normalizeInterval(interval: Interval): Interval | null {
  if (!Number.isFinite(interval.from) || !Number.isFinite(interval.to)) return null;
  return interval.to > interval.from ? { from: interval.from, to: interval.to } : null;
}

export function intersectIntervals(a: Interval, b: Interval): Interval | null {
  return normalizeInterval({ from: Math.max(a.from, b.from), to: Math.min(a.to, b.to) });
}

/**
 * `base − cuts`, order-preserving. A cut that only partly covers a span splits
 * it into two, which is why this returns a list rather than one interval: an OT
 * window straddling the shift leaves a pre-shift and a post-shift fragment.
 */
export function subtractIntervals(base: Interval[], cuts: Interval[]): Interval[] {
  let result = base.map(normalizeInterval).filter((i): i is Interval => i !== null);
  for (const cut of cuts) {
    const trimmed = normalizeInterval(cut);
    if (!trimmed) continue;
    const next: Interval[] = [];
    for (const span of result) {
      if (trimmed.to <= span.from || trimmed.from >= span.to) {
        next.push(span);
        continue;
      }
      if (trimmed.from > span.from) next.push({ from: span.from, to: trimmed.from });
      if (trimmed.to < span.to) next.push({ from: trimmed.to, to: span.to });
    }
    result = next;
  }
  return result;
}

/**
 * Whole minutes only, floored per span: a 90-second fragment is 1 minute, a
 * 59-second fragment is none. Never rounded up — `attendance.service.getHistory`
 * used `Math.round` and that is the inflation this replaces.
 */
export function sumMinutes(intervals: Interval[]): number {
  return intervals.reduce((total, span) => {
    const trimmed = normalizeInterval(span);
    return total + (trimmed ? Math.floor((trimmed.to - trimmed.from) / MINUTE_MS) : 0);
  }, 0);
}

/** Minutes of `target` not covered by `allowed` — the amount a clamp discards. */
export function minutesOutside(target: Interval, allowed: Interval[]): number {
  return sumMinutes(subtractIntervals([target], allowed));
}

/**
 * Minutes of `target` covered by `allowed` — the mirror of `minutesOutside`, so
 * `inside + outside` is always the whole of `target`. D39 uses it to measure how
 * far a requested OT window reaches *into* the scheduled shift: any non-zero
 * answer is an encroachment, which the filing guard refuses rather than paying.
 */
export function minutesInside(target: Interval, allowed: Interval[]): number {
  return sumMinutes(
    allowed
      .map((span) => intersectIntervals(target, span))
      .filter((span): span is Interval => span !== null),
  );
}

export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.from < b.to && b.from < a.to;
}

/** Stable SHA-256 over the calculation inputs — the staleness check (AC-OT-05). */
export function inputHashOf(parts: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(parts)).digest('hex');
}

/** Key-sorted stringify so two structurally equal inputs hash the same. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
  return `{${entries.join(',')}}`;
}

/**
 * §7.7/FR-OT-02 precedence — PUBLIC_HOLIDAY → WEEKLY_OFF/no schedule →
 * WORKING_DAY — delegated to `resolveClassification`, the same function that
 * labels the day on the timesheet, so the two can never disagree.
 *
 * Two readings the SRS leaves implicit (logged in DOCS_DECISION_LOG D38):
 * - A leave day that was actually worked classifies as WORKING_DAY. Premium
 *   holiday/weekly-off pay for a day the employee took as paid leave is not a
 *   rule anyone wrote down, and ordinary-day is the conservative choice.
 * - `hasWorkObligation: false` with no calendar exception is "no schedule",
 *   which `resolveClassification` already returns as WEEKLY_OFF — exactly the
 *   `WEEKLY_OFF/no schedule` arm of FR-OT-02.
 * - `SPECIAL_WORKING_DAY` on a weekly-off weekday is a working day, which is
 *   what that exception exists to mean.
 */
export function overtimeTypeOf(input: {
  overrideType?: string;
  calendarType?: CalendarExceptionType | string;
  hasWorkObligation: boolean;
}): OvertimeType {
  const { workdayType } = resolveClassification({
    overrideType: input.overrideType,
    calendarType: input.calendarType,
    hasWorkObligation: input.hasWorkObligation,
    // The OT question is about the day's character, not its attendance outcome,
    // so `dayResult` is deliberately not consulted here.
  });
  switch (workdayType) {
    case WorkdayType.PUBLIC_HOLIDAY:
      return OvertimeType.PUBLIC_HOLIDAY;
    case WorkdayType.WEEKLY_OFF:
      return OvertimeType.WEEKLY_OFF;
    default:
      return OvertimeType.WORKING_DAY;
  }
}

export interface OtComputationInput {
  /** 'YYYY-MM-DD' — the civil VN date every span is clamped into. */
  workDate: string;
  overtimeType: OvertimeType;
  requested: Interval;
  /** Omitted until a manager approves a window; then the requested one is used (FR-OT-02). */
  approved?: Interval;
  /** checkIn..checkOut. Absent ⇒ nothing was actually worked. */
  actual?: Interval;
  /** The scheduled span(s); empty on a weekly off or holiday, so nothing is subtracted. */
  scheduled: Interval[];
}

export interface OtComputation {
  overtimeType: OvertimeType;
  requestedMinutes: number;
  approvedMinutes: number;
  actualMinutes: number;
  eligibleMinutes: number;
  eligibleIntervals: Interval[];
  /** Minutes lost to the VN-day clamp, surfaced in `calculationNote` rather than hidden. */
  droppedAfterClampMinutes: number;
  calculationNote: string;
}

/**
 * `eligible interval = approved ∩ actual attendance − scheduled` (FR-OT-02,
 * BR-OT-03, AC-OT-04), with the invariants that make it safe to feed into a
 * timesheet:
 * - every span is clamped to the civil day of `workDate` first, so a
 *   past-midnight OT tail cannot leak into the next period;
 * - no punches ⇒ zero eligible, whatever the approval said (BR-OT-02, AC-OT-03:
 *   "check-out muộn không tự thành OT");
 * - eligible is hard-capped at approvedMinutes (FR-OT-02).
 *
 * Break minutes are NOT subtracted from OT separately: the break sits inside the
 * scheduled interval that step 3 removes, so no break minute can survive into
 * the eligible set. Subtracting them again would double-charge the employee.
 *
 * `ponytail:` one day resolves to exactly one `overtimeType`, and cross-request
 * "một phút chỉ thuộc một loại" (BR-OT-04) is enforced by `assertNoOverlap` at
 * write time rather than by splitting intervals per type here. The upgrade path
 * is per-minute attribution, and it is only needed once mid-day type changes
 * exist — i.e. night shifts, which §30J explicitly cuts from MVP.
 */
export function computeOvertime(input: OtComputationInput): OtComputation {
  const day = vnDayBounds(input.workDate);
  const daySpans = [day];

  const clamp = (span: Interval | undefined): Interval | undefined => {
    if (!span) return undefined;
    const trimmed = daySpans.map((allowed) => intersectIntervals(span, allowed)).filter((i): i is Interval => i !== null);
    return trimmed.length ? { from: Math.min(...trimmed.map((i) => i.from)), to: Math.max(...trimmed.map((i) => i.to)) } : undefined;
  };

  let dropped = minutesOutside(input.approved ?? input.requested, daySpans);
  const requestedClamped = clamp(input.requested);
  const approvedClamped = clamp(input.approved);
  const actualClamped = clamp(input.actual);
  const scheduledClamped = input.scheduled
    .map((span) => clamp(span))
    .filter((span): span is Interval => span !== undefined);

  const effectiveApproved = approvedClamped ?? requestedClamped;
  const requestedMinutes = requestedClamped ? sumMinutes([requestedClamped]) : 0;
  const approvedMinutes = effectiveApproved ? sumMinutes([effectiveApproved]) : 0;
  const actualMinutes = actualClamped ? sumMinutes([actualClamped]) : 0;

  const notes: string[] = [];
  let eligibleIntervals: Interval[] = [];

  if (!actualClamped || !effectiveApproved) {
    // AC-OT-03 / BR-OT-02: no attendance, or no window at all, is zero OT.
    notes.push('NO_ACTUAL_ATTENDANCE');
  } else {
    const overlap = intersectIntervals(effectiveApproved, actualClamped);
    eligibleIntervals = overlap ? subtractIntervals([overlap], scheduledClamped) : [];
    if (!overlap) notes.push('APPROVED_WINDOW_OUTSIDE_ATTENDANCE');
    else if (!eligibleIntervals.length) notes.push('FULLY_WITHIN_SCHEDULE');
  }

  let eligibleMinutes = sumMinutes(eligibleIntervals);
  if (eligibleMinutes > approvedMinutes) {
    // Cannot happen with the clamp above, but FR-OT-02 states it as an
    // invariant, so enforce it rather than trust the derivation.
    eligibleMinutes = approvedMinutes;
    notes.push('CAP_APPLIED');
  }
  if (dropped > 0) notes.push('CROSS_MIDNIGHT_CLAMPED');

  return {
    overtimeType: input.overtimeType,
    requestedMinutes,
    approvedMinutes,
    actualMinutes,
    eligibleMinutes,
    eligibleIntervals,
    droppedAfterClampMinutes: dropped,
    calculationNote: notes.length ? notes.join(';') : 'OK',
  };
}

/** Minutes of the scheduled day, from a shift's `HH:mm` pair minus its break. */
export function scheduledMinutesOf(shift: { startTime: string; endTime: string; breakMinutes?: number } | null): number {
  if (!shift) return 0;
  const [startHour, startMinute] = shift.startTime.split(':').map(Number);
  const [endHour, endMinute] = shift.endTime.split(':').map(Number);
  const span = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  const gross = span > 0 ? span : span + 24 * 60;
  return Math.max(0, gross - (shift.breakMinutes ?? 0));
}
