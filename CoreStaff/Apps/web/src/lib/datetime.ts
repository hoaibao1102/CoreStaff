export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

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
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone,
  }).format(date);
}

/**
 * Format an ISO instant or Date into Vietnamese HH:mm dd/mm/yyyy according to business timezone.
 */
export function formatInstantDateTimeVN(value?: string | Date | null, timeZone: string = BUSINESS_TIME_ZONE): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
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

