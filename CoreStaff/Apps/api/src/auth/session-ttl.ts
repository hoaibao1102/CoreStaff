/**
 * Session lifetimes, shared by the guard (which renews the access cookie),
 * the service (which writes the DB expiry) and the cookie helpers. Their own
 * module so none of them has to import another to agree on a number.
 */

/** SRS §4.4: access/session cookie lifetime. Sliding — see AuthGuard.slidingExpiry. */
export const SESSION_TTL_MS = 30 * 60 * 1000;

/** How long a login stays refreshable, however often the access cookie renews. */
export const REFRESH_TTL_MS = 14 * 24 * 60 * 60 * 1000;
