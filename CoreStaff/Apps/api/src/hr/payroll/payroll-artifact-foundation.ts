import { createHash } from 'node:crypto';
import { PayrollRunStatus } from '../../database/schemas/payroll-run.schema';

function canonicalize(value: unknown, seen: Set<object>): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('NON_FINITE_NUMBER');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === 'undefined') return undefined;
  if (typeof value !== 'object') throw new Error('UNSUPPORTED_CANONICAL_VALUE');
  if (value instanceof Date) return value.toISOString();

  const candidate = value as { _bsontype?: string; toHexString?: () => string };
  if (candidate._bsontype === 'ObjectId' && typeof candidate.toHexString === 'function') {
    return candidate.toHexString();
  }
  if (seen.has(value)) throw new Error('CYCLIC_CANONICAL_PAYLOAD');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => canonicalize(item, seen) ?? null);
    }
    const record = value as Record<string, unknown>;
    return Object.keys(record).sort().reduce<Record<string, unknown>>((result, key) => {
      const normalized = canonicalize(record[key], seen);
      if (normalized !== undefined) result[key] = normalized;
      return result;
    }, {});
  } finally {
    seen.delete(value);
  }
}

export function canonicalPayloadJson(payload: unknown): string {
  const normalized = canonicalize(payload, new Set());
  if (normalized === undefined) throw new Error('UNSUPPORTED_CANONICAL_VALUE');
  return JSON.stringify(normalized);
}

export function canonicalPayloadHash(payload: unknown): string {
  return createHash('sha256').update(canonicalPayloadJson(payload)).digest('hex');
}

const ALLOWED_TRANSITIONS: Record<PayrollRunStatus, PayrollRunStatus[]> = {
  [PayrollRunStatus.DRAFT]: [PayrollRunStatus.CALCULATED, PayrollRunStatus.CANCELLED],
  [PayrollRunStatus.CALCULATED]: [PayrollRunStatus.DRAFT, PayrollRunStatus.LOCKED, PayrollRunStatus.DISCARDED],
  [PayrollRunStatus.LOCKED]: [PayrollRunStatus.RELEASED],
  [PayrollRunStatus.RELEASED]: [],
  [PayrollRunStatus.STALE]: [],
  [PayrollRunStatus.CANCELLED]: [],
  [PayrollRunStatus.DISCARDED]: [],
};

export class PayrollLifecycleConflict extends Error {
  constructor(code: string) {
    super(code);
    this.name = 'PayrollLifecycleConflict';
  }
}

export interface PayrollRunTransitionInput {
  runId: string;
  organizationId: string;
  expectedStatus: PayrollRunStatus;
  expectedVersion: number;
  nextStatus: PayrollRunStatus;
  actorId?: string;
  reason?: string;
  at: Date;
}

export interface PayrollRunTransitionCas {
  filter: Record<string, unknown>;
  update: { $set: Record<string, unknown>; $inc: { version: 1 } };
}

export interface PeriodPayrollClaimInput {
  periodId: string;
  organizationId: string;
  expectedPeriodVersion: number;
  runId: string;
}

/** Pure initial claim builder; no match means stale input or a competing operation won. */
export function buildPeriodPayrollClaimCas(input: PeriodPayrollClaimInput) {
  return {
    filter: {
      _id: input.periodId,
      organizationId: input.organizationId,
      status: 'CLOSED',
      version: input.expectedPeriodVersion,
      payrollRunId: { $exists: false },
    },
    update: {
      $set: {
        payrollRunId: input.runId,
        payrollState: PayrollRunStatus.DRAFT,
        payrollSourceVersion: input.expectedPeriodVersion,
      },
    },
  };
}

/** Pure builder: callers must execute this as one findOneAndUpdate and treat no match as CAS conflict. */
export function buildPayrollRunTransitionCas(input: PayrollRunTransitionInput): PayrollRunTransitionCas {
  if (!ALLOWED_TRANSITIONS[input.expectedStatus]?.includes(input.nextStatus)) {
    throw new PayrollLifecycleConflict('INVALID_PAYROLL_RUN_TRANSITION');
  }
  const set: Record<string, unknown> = { status: input.nextStatus };
  if (input.nextStatus === PayrollRunStatus.CANCELLED || input.nextStatus === PayrollRunStatus.DISCARDED) {
    if (!input.actorId || !input.reason || input.reason.trim().length < 10) {
      throw new PayrollLifecycleConflict('PAYROLL_RUN_TERMINATION_AUDIT_REQUIRED');
    }
    set.active = false;
    if (input.nextStatus === PayrollRunStatus.CANCELLED) {
      set.cancelledBy = input.actorId;
      set.cancelledAt = input.at;
      set.cancellationReason = input.reason.trim();
    } else {
      set.discardedBy = input.actorId;
      set.discardedAt = input.at;
      set.discardReason = input.reason.trim();
    }
  }
  return {
    filter: {
      _id: input.runId,
      organizationId: input.organizationId,
      status: input.expectedStatus,
      version: input.expectedVersion,
    },
    update: { $set: set, $inc: { version: 1 } },
  };
}