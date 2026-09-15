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
