import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function client(origin) {
  const calls = [];
  const sockets = [];
  const { outputText } = ts.transpileModule(readFileSync(new URL('../src/services/socket.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports, window: { location: new URL(origin) }, console, URL,
    require: (name) => {
      assert.equal(name, 'socket.io-client'); // No session-token dependency.
      return { io: (url, options) => {
        calls.push({ url, options });
        const socket = { connected: false, on() {}, disconnect() { this.disconnected = true; } };
        sockets.push(socket);
        return socket;
      } };
    },
  });
  return { ...exports, calls, sockets };
}

test('same-origin production uses credentialed HTTP polling, never a WebSocket upgrade', () => {
  const c = client('https://web.test');
  c.getSocket('https://web.test');
  const { url, options } = c.calls[0];
  assert.equal(url, 'https://web.test/events');
  assert.equal(options.path, '/socket.io');
  assert.deepEqual(Array.from(options.transports), ['polling']);
  assert.equal(options.upgrade, false);
  assert.equal(options.addTrailingSlash, false);
  assert.equal(options.withCredentials, true);
  assert.equal(options.auth, undefined);
  assert.equal(options.extraHeaders, undefined);
});

test('legacy remote backend retains direct transports and cookie-only authentication', () => {
  const c = client('https://web.test');
  c.getSocket('https://api.test/api');
  assert.equal(c.calls[0].url, 'https://api.test/events');
  assert.deepEqual(Array.from(c.calls[0].options.transports), ['websocket', 'polling']);
  assert.equal(c.calls[0].options.withCredentials, true);
  assert.equal(c.calls[0].options.auth, undefined);
});

test('localhost and loopback keep the direct Nest development target', () => {
  for (const host of ['localhost', '127.0.0.1']) {
    const c = client(`http://${host}:5173`);
    c.getSocket(`http://${host}:5173/local-api`);
    assert.equal(c.calls[0].url, `http://${host}:3000/events`);
    assert.equal(c.calls[0].options.path, '/socket.io');
    assert.deepEqual(Array.from(c.calls[0].options.transports), ['websocket', 'polling']);
  }
});

test('same-origin local-api prefix is retained outside localhost development', () => {
  const c = client('https://preview.test');
  c.getSocket('https://preview.test/local-api');
  assert.equal(c.calls[0].options.path, '/local-api/socket.io');
});

test('socket singleton survives reconnect and is replaced on target change', () => {
  const c = client('https://web.test');
  const first = c.getSocket();
  assert.equal(c.getSocket(), first);
  c.getSocket('https://api.test');
  assert.equal(first.disconnected, true);
  assert.equal(c.calls.length, 2);
  c.disconnectSocket();
  assert.equal(c.sockets[1].disconnected, true);
});
