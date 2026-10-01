export type ScenarioKey =
  | 'FULL'
  | 'LATE'
  | 'EARLY'
  | 'LATE_EARLY'
  | 'PAID_LEAVE'
  | 'UNPAID_LEAVE'
  | 'ABSENT'
  | 'INCOMPLETE'
  | 'OT_WORKING_DAY'
  | 'OT_WEEKLY_OFF'
  | 'OT_PUBLIC_HOLIDAY';

export interface WorkforceScenario {
  key: ScenarioKey;
  exceptionDate?: string;
  lateMinutes?: number;
  earlyMinutes?: number;
  overtime?: { date: string; type: 'OT_WORKING_DAY' | 'OT_WEEKLY_OFF' | 'OT_PUBLIC_HOLIDAY'; minutes: number };
}

const scenarios: WorkforceScenario[] = [
  { key: 'FULL' },
  { key: 'LATE', exceptionDate: '2026-09-07', lateMinutes: 45 },
  { key: 'EARLY', exceptionDate: '2026-09-08', earlyMinutes: 60 },
  { key: 'LATE_EARLY', exceptionDate: '2026-09-09', lateMinutes: 30, earlyMinutes: 30 },
  { key: 'PAID_LEAVE', exceptionDate: '2026-09-10' },
  { key: 'UNPAID_LEAVE', exceptionDate: '2026-09-11' },
  { key: 'ABSENT', exceptionDate: '2026-09-14' },
  { key: 'INCOMPLETE', exceptionDate: '2026-09-15' },
  { key: 'OT_WORKING_DAY', overtime: { date: '2026-09-16', type: 'OT_WORKING_DAY', minutes: 120 } },
  { key: 'OT_WEEKLY_OFF', overtime: { date: '2026-09-19', type: 'OT_WEEKLY_OFF', minutes: 240 } },
  { key: 'OT_PUBLIC_HOLIDAY', overtime: { date: '2026-09-02', type: 'OT_PUBLIC_HOLIDAY', minutes: 480 } },
];

export function scenarioForIndex(index: number): WorkforceScenario {
  const scenario = scenarios[index];
  if (!scenario) throw new Error(`WORKFORCE_SCENARIO_OUT_OF_RANGE:${index}`);
  return scenario;
}

export function standardWorkdays(period: string): string[] {
  const [year, month] = period.split('-').map(Number);
  const holidays = new Set([`${period}-01`, `${period}-02`]);
  const days: string[] = [];
  const cursor = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    const weekday = cursor.getUTCDay();
    if (weekday >= 1 && weekday <= 5 && !holidays.has(date)) days.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
