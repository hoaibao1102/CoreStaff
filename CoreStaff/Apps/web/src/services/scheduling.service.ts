import { hrRequest } from './hrService';

export interface CalendarException { _id: string; date: string; type: 'PUBLIC_HOLIDAY'|'SPECIAL_WORKING_DAY'|'WEEKLY_OFF'; name: string; }

const query = (values: Record<string, string | undefined>) => { const q = new URLSearchParams(); Object.entries(values).forEach(([k,v]) => { if (v) q.set(k,v); }); return q.size ? `?${q}` : ''; };
export const listCalendarExceptions = (base:string,from?:string,to?:string) => hrRequest<CalendarException[]>(base, `/api/hr/calendar-exceptions${query({from,to})}`);
export const createCalendarException = (base:string,payload:Omit<CalendarException,'_id'>) => hrRequest<CalendarException>(base,'/api/hr/calendar-exceptions',{method:'POST',body:JSON.stringify(payload)});
export const updateCalendarException = (base:string,id:string,payload:Partial<Omit<CalendarException,'_id'>>) => hrRequest<CalendarException>(base,`/api/hr/calendar-exceptions/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)});
export const deleteCalendarException = (base:string,id:string) => hrRequest<{deleted:boolean}>(base,`/api/hr/calendar-exceptions/${encodeURIComponent(id)}`,{method:'DELETE'});
