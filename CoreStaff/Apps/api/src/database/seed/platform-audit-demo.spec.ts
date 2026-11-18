import { buildPlatformAuditDemo, seedPlatformAuditDemo } from './platform-audit-demo';
import { PLATFORM_AUDIT_ACTIONS } from '../../platform/platform-audit.constants';

const NOW = new Date('2026-11-18T03:00:00.000Z');
const admin = { id: '64b7f0f4f0f4f0f4f0f4f0f4', fullName: 'Platform System Administrator', email: 'sysadmin@corestaff.local' };
const orgs = [
  { id: 'o1', code: 'TVS', name: 'TVS Corporation', hrEmail: 'hr-a@tvs.local' },
  { id: 'o2', code: 'ABC', name: 'ABC JSC', hrEmail: 'hr-b@abc.local' },
];

describe('platform audit demo data', () => {
  const events = buildPlatformAuditDemo({ orgs, admin, now: NOW, includeAdminActivity: true });

  it('uses only recorded actions and a fixed id per event', () => {
    expect(events.every(event => PLATFORM_AUDIT_ACTIONS.includes(event.action as never))).toBe(true);
    expect(new Set(events.map(event => event.eventId)).size).toBe(events.length);
    expect(events.every(event => event.eventId!.startsWith('seed-platform-audit:') && event.source === 'SEED')).toBe(true);
  });

  it('tells the whole story: tenants, first HRs, a lockout burst, a suspension and its reversal', () => {
    const count = (action: string) => events.filter(event => event.action === action).length;
    expect(count('ORGANIZATION_CREATED')).toBe(2);
    expect(count('INITIAL_HR_CREATED')).toBe(2);
    expect(count('ADMIN_LOGIN_FAILED')).toBe(5);
    expect(count('ADMIN_ACCOUNT_LOCKED')).toBe(1);
    expect(count('ORGANIZATION_SUSPENDED')).toBe(1);
    expect(count('ORGANIZATION_ACTIVATED')).toBe(1);
    expect(count('ADMIN_LOGIN_SUCCEEDED')).toBeGreaterThanOrEqual(5);
    const suspended = events.find(event => event.action === 'ORGANIZATION_SUSPENDED')!;
    const activated = events.find(event => event.action === 'ORGANIZATION_ACTIVATED')!;
    expect(suspended.targetOrganizationId).toBe('o1'); // orgs are ordered by code: ABC, then TVS
    expect(activated.occurredAt!.getTime()).toBeGreaterThan(suspended.occurredAt!.getTime());
  });

  it('puts the failed attempts before the lock and the lock before the next sign-in', () => {
    const at = (action: string) => events.filter(event => event.action === action).map(event => event.occurredAt!.getTime());
    const lastFail = Math.max(...at('ADMIN_LOGIN_FAILED'));
    const [locked] = at('ADMIN_ACCOUNT_LOCKED');
    expect(locked).toBeGreaterThan(lastFail);
    expect(at('ADMIN_LOGIN_SUCCEEDED').some(time => time > locked)).toBe(true);
    expect(events.filter(event => event.action === 'ADMIN_LOGIN_FAILED').every(event => event.outcome === 'FAILED')).toBe(true);
  });

  it('never places a secret or a future date in the log', () => {
    expect(JSON.stringify(events)).not.toMatch(/"[a-zA-Z]*(pass|token|secret|hash)[a-zA-Z]*":/i);
    expect(events.every(event => event.occurredAt!.getTime() <= NOW.getTime())).toBe(true);
  });

  it('seeding only one tenant yields just its lifecycle events', () => {
    const only = buildPlatformAuditDemo({ orgs: [orgs[0]], admin, now: NOW, includeAdminActivity: false });
    expect(only.map(event => event.action)).toEqual(['ORGANIZATION_CREATED', 'INITIAL_HR_CREATED']);
  });

  it('is idempotent: a second run inserts nothing', async () => {
    const store = new Map<string, unknown>();
    const model = {
      updateOne: jest.fn(async (filter: any, update: any) => {
        if (store.has(filter.eventId)) return { upsertedCount: 0 };
        store.set(filter.eventId, update.$setOnInsert);
        return { upsertedCount: 1 };
      }),
    };
    const input = { orgs, admin, now: NOW, includeAdminActivity: true };
    const first = await seedPlatformAuditDemo(model, input);
    const second = await seedPlatformAuditDemo(model, input);
    expect(first.created).toBe(events.length);
    expect(second).toEqual({ created: 0, skipped: events.length });
  });
});
