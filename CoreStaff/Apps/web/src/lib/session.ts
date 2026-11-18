const SESSION_MARKER_KEY = 'corestaff:has-session';

export function rememberSession(): void {
  window.localStorage.setItem(SESSION_MARKER_KEY, '1');
}

export function forgetSession(): void {
  window.localStorage.removeItem(SESSION_MARKER_KEY);
}

export function hasRememberedSession(): boolean {
  return window.localStorage.getItem(SESSION_MARKER_KEY) === '1';
}

/**
 * Other tabs of this browser share the marker through localStorage, and the
 * `storage` event only fires in the tabs that did NOT make the change. Removing
 * the marker means another tab signed out (or the session expired); setting it
 * means another tab signed in, possibly as a different account.
 * Returns the unsubscribe function.
 */
export function subscribeToSessionChanges(handlers: { onSignedOut: () => void; onSignedIn: () => void }): () => void {
  const listener = (event: StorageEvent) => {
    // `key === null` is localStorage.clear().
    if (event.key !== null && event.key !== SESSION_MARKER_KEY) return;
    if (event.newValue === '1') handlers.onSignedIn();
    else handlers.onSignedOut();
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}
