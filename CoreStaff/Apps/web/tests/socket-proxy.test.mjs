import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { Server } from 'socket.io';
import { io } from 'socket.io-client';
import ts from 'typescript';

const TEST_COOKIE = 'test_only_session=local-fixture';
const compiled = ts.transpileModule(readFileSync(new URL('../src/services/socket.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function service(origin, cookie) {
  const exports = {};
  runInNewContext(compiled, {
    exports, window: { location: new URL(origin) }, URL,
    console: { log() {}, warn() {} },
    require(name) {
      assert.equal(name, 'socket.io-client');
      return { io: (url, options) => io(url, {
        ...options, reconnection: false, timeout: 1500, forceNew: true,
        // Node has no browser cookie jar. Supply only this local fixture cookie
        // in the test adapter, never in the production service or gateway.
        extraHeaders: cookie ? { Cookie: cookie } : {},
      }) };
    },
  });
  return exports;
}

async function listen(server, host = '127.0.0.1') {
  server.listen(0, host);
  await once(server, 'listening');
  return server.address().port;
}

function connect(socket) {
  return new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

test('real /events polling authenticates a fixture cookie through an HTTP GET/POST reverse proxy', { timeout: 10000 }, async () => {
  const backend = createServer();
  const server = new Server(backend, { addTrailingSlash: false });
  const namespaceCookies = [];
  server.of('/events').use((socket, next) => {
    namespaceCookies.push(socket.handshake.headers.cookie);
    next(socket.handshake.headers.cookie === TEST_COOKIE ? undefined : new Error('fixture unauthorized'));
  }).on('connection', socket => {
    socket.on('fixture:ping', (payload, ack) => ack({ echoed: payload, namespace: socket.nsp.name }));
  });
  const backendPort = await listen(backend);
  const requests = [];
  const proxy = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, cookie: req.headers.cookie });
    // Match the deployed exact rewrite: /socket.io/ falls through to SPA HTML.
    if (new URL(req.url, 'http://fixture').pathname !== '/socket.io') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><title>SPA fallback</title>');
      return;
    }
    const upstream = request({ hostname: '127.0.0.1', port: backendPort, path: req.url, method: req.method, headers: req.headers }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    upstream.on('error', error => { res.destroy(error); });
    req.pipe(upstream);
  });
  // A non-localhost loopback host exercises production same-origin routing.
  const proxyPort = await listen(proxy, '127.0.0.2');
  const origin = `http://127.0.0.2:${proxyPort}`;
  const unauthorized = service(origin);
  const authorized = service(origin, TEST_COOKIE);
  try {
    await assert.rejects(connect(unauthorized.getSocket(origin)), /fixture unauthorized/);
    const socket = authorized.getSocket(origin);
    await connect(socket);
    assert.equal(socket.io.engine.transport.name, 'polling');
    assert.equal(socket.io.opts.upgrade, false);
    const reply = await socket.timeout(2000).emitWithAck('fixture:ping', 'roundtrip');
    assert.deepEqual(reply, { echoed: 'roundtrip', namespace: '/events' });
    assert.deepEqual(namespaceCookies, [undefined, TEST_COOKIE]);
    for (const method of ['GET', 'POST']) {
      assert.ok(requests.some(r => r.method === method && r.cookie === TEST_COOKIE), `${method} forwards fixture cookie`);
    }
    assert.ok(requests.every(r => r.url.startsWith('/socket.io?') && r.url.includes('transport=polling')));
    assert.ok(requests.every(r => !r.url.includes('token=')));
  } finally {
    unauthorized.disconnectSocket();
    authorized.disconnectSocket();
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => { proxy.close(resolve); proxy.closeAllConnections(); });
  }
});
