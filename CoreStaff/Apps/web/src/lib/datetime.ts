export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * Every date the UI shows is dd/mm/yyyy (and "HH:mm dd/mm/yyyy" with a time).
 * The pieces are assembled by hand instead of trusting `toLocaleDateString('vi-VN')`,
 * whose output ("5/3/2027" vs "05/03/2027") differs between browsers, Node and
 * React Native engines.
 */
const WEEKDAYS_VN = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

interface ZonedParts { dd: string; mm: string; yyyy: string; hh: string; mi: string }

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone,
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return { dd: get('day'), mm: get('month'), yyyy: get('year'), hh: get('hour'), mi: get('minute') };
}

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format a calendar date-only string (YYYY-MM-DD) into Vietnamese dd/mm/yyyy.
 * Keeps the calendar date intact regardless of client machine timezone.
 */
export function formatDateOnlyVN(value?: string | null): string {
  if (!value || typeof value !== 'string') return '—';
  const clean = value.trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '—';
  const [, yyyy, mm, dd] = match;
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Format an ISO instant or Date into Vietnamese dd/mm/yyyy according to business timezone.
 */
export function formatInstantDateVN(value?: string | Date | null, timeZone: string = BUSINESS_TIME_ZONE): string {
  const date = toDate(value);
  if (!date) return '—';
  const { dd, mm, yyyy } = zonedParts(date, timeZone);
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Format an ISO instant or Date into Vietnamese HH:mm dd/mm/yyyy according to business timezone.
 */
export function formatInstantDateTimeVN(value?: string | Date | null, timeZone: string = BUSINESS_TIME_ZONE): string {
  const date = toDate(value);
  if (!date) return '—';
  const { dd, mm, yyyy, hh, mi } = zonedParts(date, timeZone);
  return `${hh}:${mi} ${dd}/${mm}/${yyyy}`;
}

/**
 * General helper: formats date-only (YYYY-MM-DD) or instant safely into dd/mm/yyyy.
 */
export function formatVN(value?: string | Date | null): string {
  if (!value) return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return formatDateOnlyVN(value);
  }
  return formatInstantDateVN(value);
}

/** Rewrites every YYYY-MM-DD inside a message (e.g. from the API) as dd/mm/yyyy. */
export function isoDatesToVN(text: string): string {
  return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3/$2/$1');
}

/** "Thứ sáu, 05/02/2027" — weekday plus the standard dd/mm/yyyy. */
export function formatWeekdayDateVN(value?: string | Date | null): string {
  if (!value) return '—';
  let weekday: number;
  let text: string;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    const [y, m, d] = value.trim().slice(0, 10).split('-').map(Number);
    weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    text = formatDateOnlyVN(value);
  } else {
    const date = toDate(value);
    if (!date) return '—';
    const { dd, mm, yyyy } = zonedParts(date, BUSINESS_TIME_ZONE);
    weekday = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd))).getUTCDay();
    text = `${dd}/${mm}/${yyyy}`;
  }
  return `${WEEKDAYS_VN[weekday]}, ${text}`;
}

/** Parses what a user typed as dd/mm/yyyy into YYYY-MM-DD, or null when it is not a real date. */
export function parseDateVN(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const day = Number(d), month = Number(m), year = Number(y);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
