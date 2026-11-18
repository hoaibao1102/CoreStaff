/**
 * What the platform audit records — and, just as deliberately, what it does not.
 *
 * Recorded (each is a privileged, hard-to-undo or security-relevant act):
 *  - Tenant lifecycle: an Organization is created, suspended (all its sessions are
 *    revoked) or re-activated.
 *  - Credential minting: the first HR account of a tenant is created. The
 *    temporary password is NEVER written to the log.
 *  - Admin account security: login success, failed login, lockout, password change
 *    and password reset. A platform admin can reach every tenant, so this is the
 *    most valuable account to watch.
 *
 * Not recorded, on purpose:
 *  - Reads (listing organizations, opening this screen): no state changes, and it
 *    would bury the events that matter.
 *  - Anything a tenant's own HR/managers/employees do (attendance, leave, payroll,
 *    contracts...): that is the tenant's `audit_logs`; the platform admin has no
 *    business reason to read it, and keeping it out limits what an admin can see.
 *  - Token refresh, logout, validation failures such as ORGANIZATION_CODE_TAKEN or
 *    EMAIL_TAKEN: high volume, no security value.
 *  - Failed logins for an identifier that is not an admin account: they belong to
 *    the tenant's lockout handling and would let anyone fill the platform log.
 */
export const PlatformAuditAction = {
  ORGANIZATION_CREATED: 'ORGANIZATION_CREATED',
  ORGANIZATION_SUSPENDED: 'ORGANIZATION_SUSPENDED',
  ORGANIZATION_ACTIVATED: 'ORGANIZATION_ACTIVATED',
  INITIAL_HR_CREATED: 'INITIAL_HR_CREATED',
  ADMIN_LOGIN_SUCCEEDED: 'ADMIN_LOGIN_SUCCEEDED',
  ADMIN_LOGIN_FAILED: 'ADMIN_LOGIN_FAILED',
  ADMIN_ACCOUNT_LOCKED: 'ADMIN_ACCOUNT_LOCKED',
  ADMIN_PASSWORD_CHANGED: 'ADMIN_PASSWORD_CHANGED',
  ADMIN_PASSWORD_RESET: 'ADMIN_PASSWORD_RESET',
} as const;
export type PlatformAuditAction = (typeof PlatformAuditAction)[keyof typeof PlatformAuditAction];

export const PlatformAuditTarget = {
  ORGANIZATION: 'ORGANIZATION',
  USER: 'USER',
  ADMIN_ACCOUNT: 'ADMIN_ACCOUNT',
} as const;

export const PLATFORM_AUDIT_ACTIONS: PlatformAuditAction[] = Object.values(PlatformAuditAction);
