/**
 * Every date the app shows is dd/mm/yyyy. Built by hand: Hermes' Intl output for
 * vi-VN is not the same on every device, so it cannot be trusted for this.
 * Vietnam has no daylight saving, so a fixed +07:00 offset is exact.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/;

/** "2027-02-05" -> "05/02/2027"; an ISO instant -> its date in Vietnam time; empty -> "-". */
export function formatDate(value?: string | null): string {
  if (!value) return '-';
  if (value.length > 10 && HAS_ZONE.test(value)) {
    const instant = new Date(value);
    if (!Number.isNaN(instant.getTime())) {
      const vn = new Date(instant.getTime() + VN_OFFSET_MS);
      return `${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`;
    }
  }
  const parts = value.slice(0, 10).split('-');
  return parts.length === 3 && parts[0].length === 4 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

/** Rewrites every YYYY-MM-DD inside a message (e.g. an API error) as dd/mm/yyyy. */
export function isoDatesToVN(text: string): string {
  return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3/$2/$1');
}

/** Progressive mask while typing: "0502" -> "05/02", "05022027" -> "05/02/2027". */
export function maskDateInput(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "05/02/2027" -> "2027-02-05"; null when it is not a real calendar date. */
export function parseDateVN(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}
