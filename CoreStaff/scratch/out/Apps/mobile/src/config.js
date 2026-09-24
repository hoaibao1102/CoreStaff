"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_BASE_URL = exports.FALLBACK_API_URL = exports.REMOTE_API_URL = void 0;
exports.getHealth = getHealth;
exports.resolveApiBase = resolveApiBase;
exports.apiUrl = apiUrl;
const react_native_1 = require("react-native");
const DEFAULT_REMOTE = 'https://18-141-68-40.sslip.io';
function stripSlash(url) {
    return url.replace(/\/+$/, '');
}
exports.REMOTE_API_URL = stripSlash(process.env.EXPO_PUBLIC_API_URL || DEFAULT_REMOTE);
function localFallbackUrl() {
    const fromEnv = process.env.EXPO_PUBLIC_API_FALLBACK_URL;
    if (react_native_1.Platform.OS === 'android') {
        if (fromEnv) {
            return stripSlash(fromEnv.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2'));
        }
        return 'http://10.0.2.2:3000';
    }
    return stripSlash(fromEnv || 'http://localhost:3000');
}
exports.FALLBACK_API_URL = localFallbackUrl();
/** Public health endpoint: the response is a plain object, without a data envelope. */
async function getHealth(base, timeoutMs = 4000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(apiUrl(base, '/api/healthz'), { signal: ctrl.signal });
        if (!res.ok)
            throw new Error(`Kiểm tra kết nối API thất bại (HTTP ${res.status}).`);
        const body = await res.json();
        if (!body || typeof body !== 'object' ||
            !('status' in body) || body.status !== 'ok' ||
            !('service' in body) || body.service !== 'corestaff-api' ||
            !('mongo' in body) || (body.mongo !== 'configured' && body.mongo !== 'missing') ||
            !('timezone' in body) || typeof body.timezone !== 'string' || !body.timezone.trim()) {
            throw new Error('Phản hồi kiểm tra kết nối API không hợp lệ.');
        }
        return body;
    }
    catch (error) {
        if (ctrl.signal.aborted)
            throw new Error('Hết thời gian chờ kết nối API. Vui lòng thử lại.');
        throw error;
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * Dev: thử API remote, hỏng thì fallback local (Android emulator → 10.0.2.2).
 * Release build: chỉ dùng EXPO_PUBLIC_API_URL.
 */
async function resolveApiBase() {
    if (!__DEV__) {
        return { base: exports.REMOTE_API_URL, source: 'remote', health: await getHealth(exports.REMOTE_API_URL) };
    }
    try {
        return { base: exports.REMOTE_API_URL, source: 'remote', health: await getHealth(exports.REMOTE_API_URL) };
    }
    catch {
        return { base: exports.FALLBACK_API_URL, source: 'local', health: await getHealth(exports.FALLBACK_API_URL) };
    }
}
function apiUrl(base, path) {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${stripSlash(base)}${p}`;
}
/** @deprecated Dùng resolveApiBase() — giữ export để không gãy import cũ. */
exports.API_BASE_URL = exports.REMOTE_API_URL;
