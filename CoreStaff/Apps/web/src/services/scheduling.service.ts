import { hrRequest } from './hrService';

export interface CalendarException { _id: string; date: string; type: 'PUBLIC_HOLIDAY'|'SPECIAL_WORKING_DAY'|'WEEKLY_OFF'; name: string; }

const query = (values: Record<string, string | undefined>) => { const q = new URLSearchParams(); Object.entries(values).forEach(([k,v]) => { if (v) q.set(k,v); }); return q.size ? `?${q}` : ''; };
export const listCalendarExceptions = (base:string,from?:string,to?:string) => hrRequest<CalendarException[]>(base, `/api/hr/calendar-exceptions${query({from,to})}`);
export const createCalendarException = (base:string,payload:Omit<CalendarException,'_id'>) => hrRequest<CalendarException>(base,'/api/hr/calendar-exceptions',{method:'POST',body:JSON.stringify(payload)});
export const updateCalendarException = (base:string,id:string,payload:Partial<Omit<CalendarException,'_id'>>) => hrRequest<CalendarException>(base,`/api/hr/calendar-exceptions/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)});
export const deleteCalendarException = (base:string,id:string) => hrRequest<{deleted:boolean}>(base,`/api/hr/calendar-exceptions/${encodeURIComponent(id)}`,{method:'DELETE'});

/** Several adjacent days (a multi-day holiday) saved in one request. */
export interface CalendarRangePayload { startDate: string; endDate: string; type: CalendarException['type']; name: string }
export const createCalendarRange = (base: string, payload: CalendarRangePayload) => hrRequest<CalendarException[]>(base, '/api/hr/calendar-exceptions/range', { method: 'POST', body: JSON.stringify(payload) });
export const updateCalendarRange = (base: string, payload: CalendarRangePayload & { originalFrom: string; originalTo: string }) => hrRequest<CalendarException[]>(base, '/api/hr/calendar-exceptions/range', { method: 'PUT', body: JSON.stringify(payload) });
export const deleteCalendarRange = (base: string, from: string, to: string) => hrRequest<{ deleted: number }>(base, `/api/hr/calendar-exceptions/range${query({ from, to })}`, { method: 'DELETE' });

/** Longest run of adjacent days the API accepts in one request. */
export const MAX_CALENDAR_RANGE_DAYS = 31;

/** A run of adjacent days sharing the same type and name — shown and edited as one holiday. */
export interface CalendarRun extends CalendarException { endDate: string; days: number }

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function calendarRangeDays(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || endDate < startDate) return [];
  const days: string[] = [];
  for (let cursor = startDate; cursor <= endDate && days.length <= 400; cursor = nextDay(cursor)) days.push(cursor);
  return days;
}

/** Folds consecutive days with the same type and name into one entry (first day keeps its id). */
export function groupCalendarRuns(rows: CalendarException[]): CalendarRun[] {
  const runs: CalendarRun[] = [];
  for (const row of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
    const last = runs[runs.length - 1];
    if (last && last.type === row.type && last.name === row.name && nextDay(last.endDate) === row.date) {
      last.endDate = row.date;
      last.days += 1;
    } else {
      runs.push({ ...row, endDate: row.date, days: 1 });
    }
  }
  return runs;
}
