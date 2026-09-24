import assert from 'node:assert/strict';
import { getCurrentUser, login, logout, setSignedOutHandler } from '../Apps/mobile/src/auth';

const user = { email: 'hr@x.test', fullName: 'HR', role: 'HR', status: 'ACTIVE' };
const json = (status: number, body: unknown) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
const expired = () => json(401, { success: false, error: { code: 'AUTH_SESSION_EXPIRED' } });

let calls: string[] = [];
let sidAlive = false;
let rtAlive = true;

function route(loginSucceeds = true) {
  globalThis.fetch = (async (url: string) => {
    const path = new URL(url).pathname;
    calls.push(path);
    if (path === '/api/auth/refresh') {
      if (!rtAlive) return expired();
      sidAlive = true;
      return json(200, { success: true, data: { user } });
    }
    if (path === '/api/auth/login') {
      return loginSucceeds
        ? json(200, { success: true, data: { user, mustChangePassword: false } })
        : json(401, { success: false, error: { code: 'AUTH_INVALID_CREDENTIALS' } });
    }
    if (path === '/api/auth/me') return sidAlive ? json(200, { success: true, data: user }) : expired();
    return json(200, { success: true });
  }) as unknown as typeof fetch;
}

async function scenario(fn: () => Promise<void>) {
  calls = [];
  sidAlive = false;
  rtAlive = true;
  setSignedOutHandler(null);
  await fn();
  setSignedOutHandler(null);
}

async function main() {
  await scenario(async () => {
    // Expired `sid` + live `rt`: refresh once, replay the original call once.
    route();
    assert.deepEqual(await getCurrentUser('https://api.test'), user);
    assert.deepEqual(calls, ['/api/auth/me', '/api/auth/refresh', '/api/auth/me']);
    console.log('ok  401 renews and replays once');
  });

  await scenario(async () => {
    // Both tokens dead: sign-out handler fires, refresh attempted exactly once.
    let signedOut = false;
    setSignedOutHandler(() => { signedOut = true; });
    route();
    rtAlive = false;
    await assert.rejects(() => getCurrentUser('https://api.test'));
    assert.equal(signedOut, true);
    assert.equal(calls.filter((c) => c === '/api/auth/refresh').length, 1);
    console.log('ok  dead refresh token signs out, no loop');
  });

  await scenario(async () => {
    // Five concurrent expired calls share ONE refresh (single-flight).
    route();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const real = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      if (new URL(url).pathname === '/api/auth/me') {
        await gate;
        calls.push('/api/auth/me');
        return sidAlive ? json(200, { success: true, data: user }) : expired();
      }
      return real(url as never, undefined as never);
    }) as unknown as typeof fetch;
    const five = Promise.allSettled(Array.from({ length: 5 }, () => getCurrentUser('https://api.test')));
    release();
    await five;
    assert.equal(calls.filter((c) => c === '/api/auth/refresh').length, 1);
    console.log('ok  concurrent 401s collapse into one refresh');
  });

  await scenario(async () => {
    // Credential endpoints never trigger a refresh.
    route(false);
    await assert.rejects(() => login('https://api.test', 'hr@x.test', 'wrong'));
    assert.deepEqual(calls, ['/api/auth/login']);
    console.log('ok  login 401 never fires a refresh');
  });

  await scenario(async () => {
    // logout goes through request(); with sid dead it renews then logs out —
    // and must not leave a "resurrected" session behind (server revokes it).
    route();
    await logout('https://api.test');
    assert.deepEqual(calls, ['/api/auth/logout']);
    console.log('ok  logout passes through');
  });

  console.log('\nAll 5 mobile silent-refresh checks passed.');
}

main().catch((err) => { console.error(err); process.exit(1); });
