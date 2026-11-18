import { PlatformAuditAction, PlatformAuditTarget } from '../../platform/platform-audit.constants';
import type { PlatformAuditEvent } from '../../platform/platform-audit.service';

/**
 * Demo data for the platform audit screen: the lifecycle of the demo tenants and
 * a believable month of admin activity, including one brute-force burst that
 * locks the account. Every event has a fixed id, so re-running the seed never
 * duplicates a row. Nothing here is a real secret; no password is ever logged.
 */
export interface PlatformAuditDemoOrg {
  id: string;
  code: string;
  name: string;
  hrEmail?: string;
  /** When the tenant was created; the audit row uses the same instant. */
  createdAt?: Date;
}

export interface PlatformAuditDemoAdmin {
  id: string;
  fullName: string;
  email: string;
}

export interface PlatformAuditDemoInput {
  orgs: PlatformAuditDemoOrg[];
  admin: PlatformAuditDemoAdmin;
  now?: Date;
  /** Logins, a lockout, a password change and a suspend/activate pair. Off when only one tenant is being (re)seeded. */
  includeAdminActivity?: boolean;
}

const OFFICE_IP = '113.161.22.41';
const HOME_IP = '27.72.100.8';
const ATTACKER_IP = '45.227.254.8';
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const SCRIPT = 'python-requests/2.31.0';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function buildPlatformAuditDemo(input: PlatformAuditDemoInput): PlatformAuditEvent[] {
  const now = (input.now ?? new Date()).getTime();
  const ago = (days: number, hours = 0, minutes = 0) => new Date(now - days * DAY - hours * HOUR - minutes * MINUTE);
  const actor = {
    actorId: input.admin.id,
    actorNameSnapshot: input.admin.fullName,
    actorEmailSnapshot: input.admin.email,
    actorRoleSnapshot: 'SYSTEM_ADMIN',
    source: 'SEED',
  };
  const events: PlatformAuditEvent[] = [];
  const add = (key: string, occurredAt: Date, event: Omit<PlatformAuditEvent, 'eventId' | 'occurredAt'>) =>
    events.push({ ...event, eventId: `seed-platform-audit:${key}`, occurredAt });

  const orgs = [...input.orgs].sort((a, b) => a.code.localeCompare(b.code));
  orgs.forEach((org, index) => {
    const created = org.createdAt ?? ago(60 - index * 9, 3);
    add(`org-created:${org.code}`, created, {
      ...actor,
      action: PlatformAuditAction.ORGANIZATION_CREATED,
      targetType: PlatformAuditTarget.ORGANIZATION,
      targetId: org.id,
      targetOrganizationId: org.id,
      targetSummary: `${org.code} — ${org.name}`,
      ip: OFFICE_IP,
      userAgent: BROWSER,
    });
    if (org.hrEmail) {
      add(`initial-hr:${org.code}`, new Date(created.getTime() + 4 * MINUTE), {
        ...actor,
        action: PlatformAuditAction.INITIAL_HR_CREATED,
        targetType: PlatformAuditTarget.USER,
        targetOrganizationId: org.id,
        targetSummary: `${org.hrEmail} (HR)`,
        details: { role: 'HR', mustChangeOnFirstLogin: true },
        ip: OFFICE_IP,
        userAgent: BROWSER,
      });
    }
  });

  if (!input.includeAdminActivity) return events;

  const admin = {
    ...actor,
    targetType: PlatformAuditTarget.ADMIN_ACCOUNT,
    targetId: input.admin.id,
    targetSummary: input.admin.email,
  };
  const login = (key: string, at: Date, ip: string, userAgent: string) =>
    add(key, at, { ...admin, action: PlatformAuditAction.ADMIN_LOGIN_SUCCEEDED, ip, userAgent, details: { firstLoginSetup: false } });

  add('password-changed', ago(41, 2), {
    ...admin, action: PlatformAuditAction.ADMIN_PASSWORD_CHANGED, ip: OFFICE_IP, userAgent: BROWSER, details: { otherSessionsRevoked: true },
  });
  login('login-1', ago(29, 6), OFFICE_IP, BROWSER);
  login('login-2', ago(24, 2), OFFICE_IP, BROWSER);

  // Brute-force burst from an unknown address: five misses, then the account locks.
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    add(`login-failed-${attempt}`, ago(17, 5, 25 - attempt), {
      ...admin, action: PlatformAuditAction.ADMIN_LOGIN_FAILED, outcome: 'FAILED', ip: ATTACKER_IP, userAgent: SCRIPT,
      details: { failedLoginCount: attempt, reason: 'WRONG_PASSWORD' },
    });
  }
  add('account-locked', ago(17, 5, 19), {
    ...admin, action: PlatformAuditAction.ADMIN_ACCOUNT_LOCKED, ip: ATTACKER_IP, userAgent: SCRIPT,
    details: { failedLoginCount: 5, lockedMinutes: 15 },
  });
  login('login-3', ago(17, 4), OFFICE_IP, BROWSER);

  const target = orgs[1] ?? orgs[0];
  if (target) {
    add('org-suspended', ago(12, 3), {
      ...actor,
      action: PlatformAuditAction.ORGANIZATION_SUSPENDED,
      targetType: PlatformAuditTarget.ORGANIZATION,
      targetId: target.id,
      targetOrganizationId: target.id,
      targetSummary: `${target.code} — ${target.name}`,
      reason: 'Tạm khóa theo yêu cầu của khách hàng để rà soát phân quyền',
      details: { previousStatus: 'ACTIVE', newStatus: 'SUSPENDED', revokedSessions: 7 },
      ip: OFFICE_IP,
      userAgent: BROWSER,
    });
    add('org-activated', ago(11, 1), {
      ...actor,
      action: PlatformAuditAction.ORGANIZATION_ACTIVATED,
      targetType: PlatformAuditTarget.ORGANIZATION,
      targetId: target.id,
      targetOrganizationId: target.id,
      targetSummary: `${target.code} — ${target.name}`,
      details: { previousStatus: 'SUSPENDED', newStatus: 'ACTIVE' },
      ip: OFFICE_IP,
      userAgent: BROWSER,
    });
  }

  login('login-4', ago(9, 7), HOME_IP, BROWSER);
  login('login-5', ago(6, 1), OFFICE_IP, BROWSER);
  login('login-6', ago(3, 5), HOME_IP, PHONE);
  login('login-7', ago(1, 2), OFFICE_IP, BROWSER);
  return events;
}

interface UpsertModel {
  /** A mongoose Query is awaitable, so it satisfies this as well as a plain promise. */
  updateOne(filter: Record<string, unknown>, update: Record<string, unknown>, options: Record<string, unknown>): PromiseLike<{ upsertedCount?: number }>;
}

/** Inserts the demo events that are not already there. Returns how many were created. */
export async function seedPlatformAuditDemo(model: UpsertModel, input: PlatformAuditDemoInput): Promise<{ created: number; skipped: number }> {
  let created = 0;
  const events = buildPlatformAuditDemo(input);
  for (const event of events) {
    const result = await model.updateOne({ eventId: event.eventId }, { $setOnInsert: { outcome: 'SUCCEEDED', ...event } }, { upsert: true });
    if (result?.upsertedCount) created += 1;
  }
  return { created, skipped: events.length - created };
}
