"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.resetPassword = exports.forgotPassword = exports.changePassword = exports.getCurrentUser = exports.login = exports.AuthApiError = void 0;
exports.setSignedOutHandler = setSignedOutHandler;
exports.tryRefreshSession = tryRefreshSession;
exports.friendlyAuthError = friendlyAuthError;
const config_1 = require("./config");
class AuthApiError extends Error {
    status;
    code;
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = 'AuthApiError';
    }
}
exports.AuthApiError = AuthApiError;
/**
 * Credential endpoints. A 401 from these answers the credential the call just
 * sent, not an expired session — renewing first would be pointless (and for
 * login, wrong: there is no session to renew yet).
 */
const NO_REFRESH_PATHS = new Set([
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
]);
/** App registers this so the UI drops to the login screen when `rt` is dead too. */
let signedOutHandler = null;
function setSignedOutHandler(handler) {
    signedOutHandler = handler;
}
async function request(base, path, init, allowRefresh = true) {
    const response = await fetch((0, config_1.apiUrl)(base, path), {
        ...init,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    // SRS §4.4: the session cookie is short-lived, so a 401 usually means
    // "renew me", not "log in again". Retry once behind the refresh cookie.
    if (response.status === 401 && allowRefresh && !NO_REFRESH_PATHS.has(path)) {
        if (await tryRefreshSession(base)) {
            return request(base, path, init, false);
        }
        signedOutHandler?.();
    }
    const text = await response.text();
    let body = null;
    try {
        body = text ? JSON.parse(text) : null;
    }
    catch {
        body = null;
    }
    if (!response.ok || body?.success === false) {
        const code = body?.success === false ? body.error?.code : undefined;
        const message = body?.success === false ? body.error?.message : undefined;
        throw new AuthApiError(message || `HTTP ${response.status}`, response.status, code);
    }
    if (!body || body.success !== true)
        throw new AuthApiError('Phản hồi từ máy chủ không hợp lệ.', response.status);
    return body.data;
}
/**
 * One refresh in flight at a time: several requests failing on an expired
 * cookie must send one refresh, not one each, or they race to rewrite the
 * session token. Same contract as the web client (services/auth.ts).
 */
let refreshInflight = null;
function tryRefreshSession(base) {
    refreshInflight ??= request(base, '/api/auth/refresh', { method: 'POST' })
        .then(() => true)
        .catch(() => false)
        .finally(() => {
        refreshInflight = null;
    });
    return refreshInflight;
}
const login = (base, identifier, password) => request(base, '/api/auth/login', {
    method: 'POST', body: JSON.stringify({ identifier: identifier.trim(), password }),
});
exports.login = login;
const getCurrentUser = (base) => request(base, '/api/auth/me');
exports.getCurrentUser = getCurrentUser;
const changePassword = (base, currentPassword, newPassword, confirmPassword) => request(base, '/api/auth/change-password', {
    method: 'POST', body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
});
exports.changePassword = changePassword;
const forgotPassword = (base, email) => request(base, '/api/auth/forgot-password', {
    method: 'POST', body: JSON.stringify({ email: email.trim() }),
});
exports.forgotPassword = forgotPassword;
const resetPassword = (base, token, newPassword) => request(base, '/api/auth/reset-password', {
    method: 'POST', body: JSON.stringify({ token: token.trim(), newPassword }),
});
exports.resetPassword = resetPassword;
const logout = (base) => request(base, '/api/auth/logout', { method: 'POST' });
exports.logout = logout;
function friendlyAuthError(error) {
    if (error instanceof AuthApiError) {
        if (error.code === 'VALIDATION_FAILED')
            return 'Thông tin bạn nhập chưa hợp lệ.';
        if (error.code === 'AUTH_INVALID_CREDENTIALS' || error.status === 401)
            return 'Tài khoản hoặc mật khẩu không đúng.';
        if (error.code === 'AUTH_ACCOUNT_DISABLED')
            return 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ HR.';
        if (error.code === 'AUTH_ACCOUNT_LOCKED')
            return 'Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau.';
        if (error.code === 'AUTH_SESSION_EXPIRED')
            return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
        if (error.code === 'AUTH_CURRENT_PASSWORD_INVALID')
            return 'Mật khẩu hiện tại không đúng.';
        if (error.code === 'AUTH_PASSWORD_POLICY_FAILED')
            return 'Mật khẩu mới cần ít nhất 8 ký tự, gồm chữ và số, và không trùng mật khẩu hiện tại.';
        if (error.code === 'AUTH_RESET_TOKEN_INVALID')
            return 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';
    }
    return error instanceof Error ? error.message : 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
}
