/**
 * TASK-068 — Vietnam (UTC+7) wall-clock helpers, shared by the overtime engine
 * and the attendance calculator.
 *
 * The org timezone is Asia/Ho_Chi_Minh for MVP (SRS §6.4:468) and there is no
 * DST, so a fixed offset is exact rather than an approximation. Extracted from
 * `AttendanceCalculatorService.parseDateTime`, which had the same arithmetic
 * locked in a private method.
 *
 * All instants here are epoch milliseconds (UTC). "Wall clock" means what a
 * person in Vietnam reads off a clock.
 */

export const VN_OFFSET_MS = 7 * 3600_000;
const DAY_MS = 24 * 3600_000;

/** Half-open `[from, to)` in epoch ms. `to === from` means empty. */
export type Instant = number;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;
const TIME_ONLY = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
/** ISO datetime, optionally carrying a date, an explicit offset, and seconds. */
const ISO = /^\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/;
/** Anything that pins the instant absolutely rather than as VN wall clock. */
const ABSOLUTE = /(Z|[+-]\d{2}:?\d{2})$/;

/**
 * `[VN 00:00, next VN 00:00)` for a `YYYY-MM-DD` work date, as UTC ms.
 * '2026-09-22' → from 2026-09-21T17:00:00Z, to 2026-09-22T17:00:00Z.
 */
export function vnDayBounds(workDate: string): { from: Instant; to: Instant } {
  const match = DATE_ONLY.exec(workDate);
  if (!match) throw new Error(`INVALID_WORK_DATE:${workDate}`);
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const from = Date.UTC(y, m - 1, d) - VN_OFFSET_MS;
  return { from, to: from + DAY_MS };
}

/**
 * VN wall-clock `HH:mm` on `workDate` → UTC ms. Exact twin of the calculator's
 * old `parseDateTime` (`Date.UTC(y, m-1, d, hour - 7, minute)`), so existing
 * late/early numbers are unchanged.
 */
export function vnTimeToUtc(workDate: string, hhmm: string): Instant {
  const time = TIME_ONLY.exec(hhmm.trim());
  if (!time) throw new Error(`INVALID_TIME:${hhmm}`);
  const bounds = vnDayBounds(workDate);
  return bounds.from + Number(time[1]) * 3600_000 + Number(time[2]) * 60_000 + Number(time[3] ?? 0) * 1000;
}

/**
 * Resolve a submitted OT window bound to a UTC instant.
 *
 * Why this exists: the web form sends naive `${workDate}T${start}:00` with no
 * offset (`EmployeeWorkScreens.tsx:75`), and `new Date()` reads a naive string
 * in the *server's* zone — correct on a +07 dev box, 7 hours off on a UTC
 * server. Rule: naive input is VN wall clock; input carrying `Z` or `±hh:mm`
 * is the absolute instant.
 *
 * Accepts `Date`, `HH:mm[:ss]` (uses `workDate`'s day) or ISO datetime.
 */
export function parseWindowInstant(value: string | Date, workDate: string): Instant {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error(`INVALID_WINDOW:${value}`);
    return value.getTime();
  }
  const raw = String(value).trim();
  if (TIME_ONLY.test(raw)) return vnTimeToUtc(workDate, raw);
  if (!ISO.test(raw)) throw new Error(`INVALID_WINDOW:${value}`);
  // Offset-bearing ISO is absolute; a naive one is VN wall clock for its own
  // date part, which keeps a past-midnight OT end on the right instant.
  if (ABSOLUTE.test(raw)) return new Date(raw).getTime();
  const [datePart, timePart] = raw.split(/[T ]/);
  return vnTimeToUtc(datePart, timePart);
}

/** The `YYYY-MM-DD` that a UTC instant falls on in Vietnam. */
export function vnDateOf(instant: Instant): string {
  return new Date(instant + VN_OFFSET_MS).toISOString().slice(0, 10);
}
