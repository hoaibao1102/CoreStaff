import { randomInt } from 'node:crypto';

/**
 * SRS §4.3/§4.4 — the one password rule and the temporary-password generator.
 *
 * Every entry point that accepts or mints a password goes through this so the
 * DTOs, the reset path and provisioning cannot drift apart on what "strong
 * enough" means. Behaviour is identical to the three inline copies it replaces,
 * which auth.service.spec's policy tests assert.
 */

/** §4.4:314 — minimum length. */
export const PASSWORD_MIN_LENGTH = 8;
/** §4.4:315 — at least one letter and one digit. Not global, so `.test` stays stateless. */
export const PASSWORD_POLICY_PATTERN = /(?=.*[a-zA-Z])(?=.*\d)/;
/** The message every entry point shows, so a client never sees two wordings for one rule. */
export const PASSWORD_POLICY_MESSAGE = 'At least 8 characters, one letter and one number required.';

/**
 * True when a password fails §4.4. Callers that also reject reuse of the current
 * hash do that comparison separately (it needs the stored hash).
 */
export function isWeakPassword(password: string): boolean {
  return password.length < PASSWORD_MIN_LENGTH || !PASSWORD_POLICY_PATTERN.test(password);
}

/**
 * Relay-friendly alphabet for generated temp passwords: letters without the
 * I/O/l shapes a human misreads when reading a code aloud, digits without 0.
 * A temp password is spoken or pasted once, so clarity beats charset size.
 */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITS = '123456789';
const POOL = LETTERS + DIGITS;

/**
 * Generate a password that satisfies §4.4 *by composition*, not by rejection
 * sampling: one guaranteed letter, one guaranteed digit, the rest from the full
 * pool, then Fisher–Yates so the guaranteed pair is not always at the front.
 * Uniform over the pool via crypto.randomInt.
 */
export function generateTempPassword(length = 12): string {
  if (length < 2) throw new Error('generateTempPassword requires length >= 2 (need a letter and a digit)');
  const pick = (chars: string) => chars[randomInt(chars.length)];
  const chars = [pick(LETTERS), pick(DIGITS), ...Array.from({ length: length - 2 }, () => pick(POOL))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
