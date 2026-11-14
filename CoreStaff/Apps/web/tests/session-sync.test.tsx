/** @jest-environment jsdom */
/** AUD-M08 — sign-out / sign-in in one tab is seen by the others. */
import { forgetSession, rememberSession, subscribeToSessionChanges } from '../src/lib/session';

const fire = (key: string | null, newValue: string | null) =>
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));

describe('subscribeToSessionChanges', () => {
  afterEach(() => window.localStorage.clear());

  it('reports a sign-out when the marker is removed in another tab', () => {
    const onSignedOut = jest.fn();
    const onSignedIn = jest.fn();
    const stop = subscribeToSessionChanges({ onSignedOut, onSignedIn });
    fire('corestaff:has-session', null);
    expect(onSignedOut).toHaveBeenCalledTimes(1);
    expect(onSignedIn).not.toHaveBeenCalled();
    stop();
  });

  it('reports a sign-in when the marker is set in another tab', () => {
    const onSignedOut = jest.fn();
    const onSignedIn = jest.fn();
    const stop = subscribeToSessionChanges({ onSignedOut, onSignedIn });
    fire('corestaff:has-session', '1');
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(onSignedOut).not.toHaveBeenCalled();
    stop();
  });

  it('treats localStorage.clear() as a sign-out and ignores unrelated keys', () => {
    const onSignedOut = jest.fn();
    const stop = subscribeToSessionChanges({ onSignedOut, onSignedIn: jest.fn() });
    fire('some-other-key', null);
    expect(onSignedOut).not.toHaveBeenCalled();
    fire(null, null);
    expect(onSignedOut).toHaveBeenCalledTimes(1);
    stop();
  });

  it('stops listening after unsubscribe', () => {
    const onSignedOut = jest.fn();
    subscribeToSessionChanges({ onSignedOut, onSignedIn: jest.fn() })();
    fire('corestaff:has-session', null);
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it('local helpers still round-trip the marker', () => {
    rememberSession();
    forgetSession();
    expect(window.localStorage.getItem('corestaff:has-session')).toBeNull();
  });
});
