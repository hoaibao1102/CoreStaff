import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const health = {
  status: 'ok', service: 'corestaff-api', mongo: 'configured', timezone: 'Asia/Ho_Chi_Minh',
};

// Exercise both standalone clients without loading Vite or the native runtime.
function loadClient(platform, fetch, production = false, useDefaults = false) {
  const file = platform === 'web' ? '../src/config/api.ts' : '../../mobile/src/config.ts';
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    .replaceAll('import.meta.env', 'testEnv');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports, fetch, AbortController, setTimeout, clearTimeout,
    require: () => ({ Platform: { OS: 'android' } }),
    window: { location: { origin: 'http://web.test' } },
    testEnv: { PROD: production, VITE_API_URL: useDefaults ? undefined : 'https://api.test/' },
    process: { env: { EXPO_PUBLIC_API_URL: useDefaults ? undefined : 'https://api.test/' } },
    __DEV__: !production,
  });
  return exports;
}

function response(body = health, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

for (const platform of ['web', 'mobile']) {
  test(`${platform}: defaults to the deployed API in production`, async () => {
    const calls = [];
    const client = loadClient(platform, async url => {
      calls.push(url);
      return response();
    }, true, true);
    assert.deepEqual((await client.resolveApiBase()).health, health);
    assert.deepEqual(calls, ['https://18-141-68-40.sslip.io/api/healthz']);
  });

  test(`${platform}: reads the public health contract with one startup request`, async () => {
    const calls = [];
    const client = loadClient(platform, async (url, options) => {
      calls.push(url);
      assert.equal(options.method, undefined); // GET
      assert.equal(options.headers, undefined); // No authentication required
      assert.ok(options.signal);
      return response();
    });
    const resolved = await client.resolveApiBase();
    const base = platform === 'web' ? 'http://web.test' : 'https://api.test';
    assert.equal(resolved.base, base);
    assert.equal(resolved.source, 'remote');
    assert.deepEqual(resolved.health, health);
    assert.deepEqual(calls, [`${base}/api/healthz`]);
  });

  test(`${platform}: mongo missing is still a valid process health response`, async () => {
    const client = loadClient(platform, async () => response({ ...health, mongo: 'missing' }));
    assert.equal((await client.getHealth('https://api.test/')).mongo, 'missing');
  });

  test(`${platform}: rejects HTTP errors and invalid health payloads`, async () => {
    const invalid = [
      response(health, 503), response(null), response({}),
      response({ success: true, data: health }),
      response({ ...health, status: 'down' }), response({ ...health, service: 'other-api' }),
      response({ ...health, mongo: 'connected' }), response({ ...health, timezone: '' }),
      { ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } },
    ];
    for (const result of invalid) {
      const client = loadClient(platform, async () => result);
      await assert.rejects(client.getHealth('https://api.test'));
    }
  });

  test(`${platform}: aborts a stalled health request`, async () => {
    const client = loadClient(platform, (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
    }));
    await assert.rejects(client.getHealth('https://api.test', 5), /Hết thời gian chờ/);
  });

  test(`${platform}: validates the local fallback after a bad remote response`, async () => {
    const calls = [];
    const client = loadClient(platform, async url => {
      calls.push(url);
      return calls.length === 1 ? response({}) : response();
    });
    const resolved = await client.resolveApiBase();
    const base = platform === 'web' ? 'http://web.test/local-api' : 'http://10.0.2.2:3000';
    assert.equal(resolved.base, base);
    assert.equal(resolved.source, 'local');
    assert.deepEqual(resolved.health, health);
    assert.equal(calls.length, 2);
    assert.equal(calls[1], `${base}/api/healthz`);
  });

  test(`${platform}: reports failure when both endpoints are unavailable`, async () => {
    let calls = 0;
    const client = loadClient(platform, async () => {
      calls++;
      return response({}, 503);
    });
    await assert.rejects(client.resolveApiBase(), /HTTP 503/);
    assert.equal(calls, 2);
  });

  test(`${platform}: production never falls back to localhost`, async () => {
    const calls = [];
    const client = loadClient(platform, async url => {
      calls.push(url);
      throw new Error('Network unavailable');
    }, true);
    await assert.rejects(client.resolveApiBase(), /Network unavailable/);
    assert.deepEqual(calls, ['https://api.test/api/healthz']);
  });
}
