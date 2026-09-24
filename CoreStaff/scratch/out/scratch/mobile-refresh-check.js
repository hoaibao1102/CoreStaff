"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const auth_1 = require("../Apps/mobile/src/auth");
const user = { email: 'hr@x.test', fullName: 'HR', role: 'HR', status: 'ACTIVE' };
const json = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
const expired = () => json(401, { success: false, error: { code: 'AUTH_SESSION_EXPIRED' } });
let calls = [];
let sidAlive = false;
let rtAlive = true;
function route(loginSucceeds = true) {
    globalThis.fetch = (async (url) => {
        const path = new URL(url).pathname;
        calls.push(path);
        if (path === '/api/auth/refresh') {
            if (!rtAlive)
                return expired();
            sidAlive = true;
            return json(200, { success: true, data: { user } });
        }
        if (path === '/api/auth/login') {
            return loginSucceeds
                ? json(200, { success: true, data: { user, mustChangePassword: false } })
                : json(401, { success: false, error: { code: 'AUTH_INVALID_CREDENTIALS' } });
        }
        if (path === '/api/auth/me')
            return sidAlive ? json(200, { success: true, data: user }) : expired();
        return json(200, { success: true });
    });
}
async function scenario(fn) {
    calls = [];
    sidAlive = false;
    rtAlive = true;
    (0, auth_1.setSignedOutHandler)(null);
    await fn();
    (0, auth_1.setSignedOutHandler)(null);
}
async function main() {
    await scenario(async () => {
        // Expired `sid` + live `rt`: refresh once, replay the original call once.
        route();
        strict_1.default.deepEqual(await (0, auth_1.getCurrentUser)('https://api.test'), user);
        strict_1.default.deepEqual(calls, ['/api/auth/me', '/api/auth/refresh', '/api/auth/me']);
        console.log('ok  401 renews and replays once');
    });
    await scenario(async () => {
        // Both tokens dead: sign-out handler fires, refresh attempted exactly once.
        let signedOut = false;
        (0, auth_1.setSignedOutHandler)(() => { signedOut = true; });
        route();
        rtAlive = false;
        await strict_1.default.rejects(() => (0, auth_1.getCurrentUser)('https://api.test'));
        strict_1.default.equal(signedOut, true);
        strict_1.default.equal(calls.filter((c) => c === '/api/auth/refresh').length, 1);
        console.log('ok  dead refresh token signs out, no loop');
    });
    await scenario(async () => {
        // Five concurrent expired calls share ONE refresh (single-flight).
        route();
        let release;
        const gate = new Promise((r) => (release = r));
        const real = globalThis.fetch;
        globalThis.fetch = (async (url) => {
            if (new URL(url).pathname === '/api/auth/me') {
                await gate;
                calls.push('/api/auth/me');
                return sidAlive ? json(200, { success: true, data: user }) : expired();
            }
            return real(url, undefined);
        });
        const five = Promise.allSettled(Array.from({ length: 5 }, () => (0, auth_1.getCurrentUser)('https://api.test')));
        release();
        await five;
        strict_1.default.equal(calls.filter((c) => c === '/api/auth/refresh').length, 1);
        console.log('ok  concurrent 401s collapse into one refresh');
    });
    await scenario(async () => {
        // Credential endpoints never trigger a refresh.
        route(false);
        await strict_1.default.rejects(() => (0, auth_1.login)('https://api.test', 'hr@x.test', 'wrong'));
        strict_1.default.deepEqual(calls, ['/api/auth/login']);
        console.log('ok  login 401 never fires a refresh');
    });
    await scenario(async () => {
        // logout goes through request(); with sid dead it renews then logs out —
        // and must not leave a "resurrected" session behind (server revokes it).
        route();
        await (0, auth_1.logout)('https://api.test');
        strict_1.default.deepEqual(calls, ['/api/auth/logout']);
        console.log('ok  logout passes through');
    });
    console.log('\nAll 5 mobile silent-refresh checks passed.');
}
main().catch((err) => { console.error(err); process.exit(1); });
