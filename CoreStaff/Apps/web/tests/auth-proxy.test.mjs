import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer } from 'vite';

test('dev proxy retains the session for password changes and logout', async () => {
  const upstream = createHttpServer((req, res) => {
    if (req.url === '/api/auth/login') {
      res.setHeader('Set-Cookie', 'sid=test-session; Domain=api.example.test; Path=/; HttpOnly; Secure; SameSite=None');
    } else if (req.headers.cookie !== 'sid=test-session') {
      res.statusCode = 401;
    } else if (req.url === '/api/auth/logout') {
      res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0');
    } else if (!['/api/auth/me', '/api/auth/change-password'].includes(req.url)) {
      res.statusCode = 404;
    }
    res.end(JSON.stringify({ success: res.statusCode === 200 }));
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const previous = [process.env.VITE_API_URL, process.env.VITE_API_FALLBACK_URL];
  const target = `http://127.0.0.1:${upstream.address().port}`;
  process.env.VITE_API_URL = target;
  process.env.VITE_API_FALLBACK_URL = target;
  let vite;
  try {
    vite = await createServer({
      root: fileURLToPath(new URL('../', import.meta.url)),
      server: { port: 0, host: '127.0.0.1' },
      logLevel: 'silent',
    });
    await vite.listen();
    const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    for (const prefix of ['', '/local-api']) {
      const url = `${origin}${prefix}/api/auth`;
      const login = await fetch(`${url}/login`, { method: 'POST' });
      const cookie = login.headers.get('set-cookie');
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=Lax/i);
      assert.match(cookie, new RegExp(`Path=${prefix || '/api'}(?:;|$)`));
      assert.doesNotMatch(cookie, /;\s*(Domain=|Secure\b)/i);
      const headers = { Cookie: cookie.split(';')[0] };
      assert.equal((await fetch(`${url}/me`, { headers })).status, 200);
      assert.equal((await fetch(`${url}/change-password`, { method: 'POST', headers })).status, 200);
      assert.equal((await fetch(`${url}/change-password`, { method: 'POST' })).status, 401);
      const logout = await fetch(`${url}/logout`, { method: 'POST', headers });
      assert.match(logout.headers.get('set-cookie'), /Max-Age=0/i);
      assert.match(logout.headers.get('set-cookie'), new RegExp(`Path=${prefix || '/api'}(?:;|$)`));
    }
  } finally {
    await vite?.close();
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
    for (const [i, key] of ['VITE_API_URL', 'VITE_API_FALLBACK_URL'].entries()) {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    }
  }
});
