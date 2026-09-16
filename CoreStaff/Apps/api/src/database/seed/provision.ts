import type { ClientSession } from 'mongoose';

/**
 * The one implementation of "an account and its HR record agree" (SRS
 * §4.1:263-270, §15.2A). Seed, `EmployeeService` and HR self-provisioning all go
 * through here, so `email`/`phone` can never be written to one document and
 * forgotten in the other, and so `employeeCode` is only ever stored on the
 * profile (TASK-120).
 *
 * Callers own the duplicate policy — seed skips what exists, the service throws
 * `EMAIL_TAKEN`. This module only guarantees that what it writes is consistent.
 */

/**
 * Anything with a `create(docs, options?)` — a real Model, or the seed/test fakes.
 *
 * `create` is typed loosely and callers index `[0]`: Mongoose requires the ARRAY
 * form whenever a `session` is passed (`Model.create(doc, {session})` ignores the
 * session and warns), so every transactional write here must be array-form. The
 * seed and test fakes return a single doc; the `[0]` normalization covers both.
 */
interface Creatable {
  create(
    docs: Record<string, unknown> | Record<string, unknown>[],
    options?: { session?: ClientSession },
  ): Promise<unknown>;
}

/** The HR-record half. Everything here lands on EmployeeProfile. */
export interface ProfileInput {
  organizationId: unknown;
  /** Sole owner of the identifier (TASK-120) — never written to the User. */
  employeeCode: string;
  email: string;
  fullName?: string;
  phone?: string;
  joinDate?: string | Date;
  employmentStatus?: string;
  departmentId?: unknown;
  positionId?: unknown;
  directManagerId?: unknown;
  dateOfBirth?: string | Date;
  gender?: string;
  /**
   * EmployeeProfile columns the named fields above don't cover (address,
   * citizenId, taxCode, bankAccount, workplaceId…). Spread *before* the named
   * fields, so an extras bag can never overwrite a field this module owns.
   */
  profileExtras?: Record<string, unknown>;
}

/** The User (login-identity) half — every account has one, profile or not. */
export interface AccountFields {
  organizationId: unknown;
  email: string;
  fullName?: string;
  phone?: string;
  /** Hashed by the caller — this module never sees or returns a plaintext password. */
  passwordHash: string;
  role: string;
}

/** An account that does not exist yet *and* its HR record: both halves. */
export interface AccountInput extends ProfileInput, AccountFields {}

export interface Provisioned {
  userId: unknown;
  employeeProfileId: unknown;
  /**
   * The created profile, so a caller that must return the row to the client
   * (provisioning, self-service) doesn't re-read it. The raw `create()` document
   * with schema defaults applied and password fields absent by construction.
   */
  profile: Record<string, unknown>;
}

/**
 * The User (login-identity) half of an account. No `employeeCode` by design: the
 * profile owns it (TASK-120), so a stale copy here could only ever drift.
 */
export function userFields(input: AccountFields): Record<string, unknown> {
  return {
    organizationId: input.organizationId,
    email: input.email,
    fullName: input.fullName,
    phone: input.phone,
    passwordHash: input.passwordHash,
    role: input.role,
    status: 'ACTIVE',
    // Every provisioned account sets its own password on first login (§4.3).
    mustChangePassword: true,
    failedLoginCount: 0,
  };
}

/** The EmployeeProfile half, for a login that already exists. */
export function profileFields(input: ProfileInput, userId: unknown): Record<string, unknown> {
  return {
    ...input.profileExtras,
    organizationId: input.organizationId,
    userId,
    employeeCode: input.employeeCode,
    email: input.email,
    phone: input.phone,
    joinDate: input.joinDate,
    employmentStatus: input.employmentStatus,
    departmentId: input.departmentId,
    positionId: input.positionId,
    directManagerId: input.directManagerId,
    dateOfBirth: input.dateOfBirth,
    gender: input.gender,
  };
}

/**
 * Create the EmployeeProfile for a login that already exists. One document, so no
 * transaction is needed — this is the whole of HR self-provisioning (Phase C).
 */
export async function attachProfile(
  profileModel: Creatable,
  input: ProfileInput,
  userId: unknown,
  session?: ClientSession,
): Promise<Provisioned> {
  const profile = await createOne(profileModel, profileFields(input, userId), session);
  return { userId, employeeProfileId: profile._id, profile: profile.toObject?.() ?? { ...profile } };
}

/**
 * Create the User and its EmployeeProfile as a unit. Pass `session` to pin both
 * writes to one transaction: SRS §4.1 makes the account and the record one event,
 * since a half-created employee can log in but cannot be found in the directory.
 */
export async function provisionAccount(
  userModel: Creatable,
  profileModel: Creatable,
  input: AccountInput,
  session?: ClientSession,
): Promise<Provisioned> {
  const user = await createOne(userModel, userFields(input), session);
  return attachProfile(profileModel, input, user._id, session);
}

/**
 * A real Model only honours a `session` in the array form (see `Creatable`), and
 * returns an array; the seed/test fakes take and return a single doc. Normalise
 * both so callers never see the difference — and never accidentally write a
 * transaction member outside the transaction.
 */
async function createOne(
  model: Creatable,
  doc: Record<string, unknown>,
  session?: ClientSession,
): Promise<{ _id: unknown; toObject?: () => Record<string, unknown> }> {
  const created = session ? await model.create([doc], { session }) : await model.create(doc);
  return (Array.isArray(created) ? created[0] : created) as {
    _id: unknown;
    toObject?: () => Record<string, unknown>;
  };
}
