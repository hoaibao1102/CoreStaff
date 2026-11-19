import { getTodayAttendance, checkIn } from '../src/services/attendance.service';
import { getMyEmployeeProfile, hrRequest, uploadDocument, downloadDocument, downloadEmployeeImportTemplate } from '../src/services/hrService';
import { getSessionToken, setSessionToken, me, signedOutEvent, refreshSession, logout } from '../src/services/auth';

jest.mock('../src/config/api', () => ({ apiUrl: (base: string, path: string) => base + path }));

const storage = new Map<string, string>();
const events = new EventTarget();
const response = (status: number, data?: unknown) => ({
  status, ok: status >= 200 && status < 300,
  text: async () => JSON.stringify(status < 300 ? { success: true, data } : { success: false, error: { code: 'AUTH_SESSION_EXPIRED' } }),
  json: async () => status < 300 ? { success: true, data } : { success: false, error: { code: 'AUTH_SESSION_EXPIRED' } },
}) as Response;
let fetchMock: jest.Mock;

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
  setSessionToken('access-a');
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock;
});

test.each(['logout', 'switch'])('in-flight refresh cannot overwrite a later %s', async action => {
  let release!: (res: Response) => void;
  fetchMock.mockImplementation((url: string) => url.endsWith('/refresh') ? new Promise<Response>(resolve => { release = resolve; }) : Promise.resolve(response(200)));
  const pending = refreshSession('');
  if (action === 'logout') await logout('');
  else setSessionToken('other-account');
  release(response(200, { token: 'stale-refresh' }));
  await pending;
  expect(getSessionToken()).toBe(action === 'logout' ? null : 'other-account');
});

test('in-flight invalid refresh cannot sign out a newer login', async () => {
  let release!: (res: Response) => void;
  fetchMock.mockImplementation(() => new Promise<Response>(resolve => { release = resolve; }));
  const pending = refreshSession('');
  setSessionToken('other-account');
  release(response(401));
  await pending;
  expect(getSessionToken()).toBe('other-account');
});

test('today refreshes once and retries with the replacement access token', async () => {
  fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, { token: 'access-b' })).mockResolvedValueOnce(response(200, { workDate: '2026-11-19' }));
  await expect(getTodayAttendance('')).resolves.toMatchObject({ workDate: '2026-11-19' });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
  expect(new Headers(fetchMock.mock.calls[1][1].headers).has('Authorization')).toBe(false);
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get('Authorization')).toBe('Bearer access-b');
  expect(getSessionToken()).toBe('access-b');
});

test('two independent tab modules serialize refresh and recheck the shared token', async () => {
  let tail = Promise.resolve();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: {
    request: (_name: string, run: () => Promise<unknown>) => {
      const next = tail.then(run);
      tail = next.then(() => undefined);
      return next;
    },
  } } });
  let tabA!: typeof import('../src/services/auth');
  let tabB!: typeof import('../src/services/auth');
  jest.isolateModules(() => { tabA = require('../src/services/auth'); });
  jest.isolateModules(() => { tabB = require('../src/services/auth'); });
  fetchMock.mockResolvedValue(response(200, { token: 'access-b' }));
  await Promise.all([tabA.refreshSession(''), tabB.refreshSession('')]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(getSessionToken()).toBe('access-b');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
});

test.each(['offline', 'server', 'malformed'])('refresh %s failure preserves the session and reports a transient error', async (failure) => {
  const signedOut = jest.fn();
  events.addEventListener(signedOutEvent, signedOut);
  fetchMock.mockResolvedValueOnce(response(401));
  if (failure === 'offline') fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  else fetchMock.mockResolvedValueOnce(response(failure === 'server' ? 503 : 200, {}));
  await expect(me('')).rejects.toMatchObject({ code: 'AUTH_REFRESH_UNAVAILABLE' });
  expect(getSessionToken()).toBe('access-a');
  expect(signedOut).not.toHaveBeenCalled();
  events.removeEventListener(signedOutEvent, signedOut);
});

test('profile transient refresh does not sign out', async () => {
  fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(503));
  await expect(getMyEmployeeProfile('')).rejects.toMatchObject({ code: 'AUTH_REFRESH_UNAVAILABLE' });
  expect(getSessionToken()).toBe('access-a');
});

test('concurrent today/profile/me share refresh and replace caller stale Authorization', async () => {
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    if (url.endsWith('/refresh')) return response(200, { token: 'access-b' });
    return new Headers(init.headers).get('Authorization') === 'Bearer access-b' ? response(200, { id: 'ok' }) : response(401);
  });
  await Promise.all([getTodayAttendance(''), getMyEmployeeProfile(''), hrRequest('', '/api/hr/employees/me', { headers: { Authorization: 'Bearer stale' } }), me('')]);
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/refresh'))).toHaveLength(1);
});

test('late 401 from the old token retries latest token without another refresh', async () => {
  let release!: (res: Response) => void;
  fetchMock.mockImplementation((url: string, init: RequestInit) => {
    if (url.endsWith('/refresh')) return Promise.resolve(response(200, { token: 'access-b' }));
    if (new Headers(init.headers).get('Authorization') === 'Bearer access-b') return Promise.resolve(response(200, {}));
    if (url.endsWith('/me')) return new Promise<Response>(resolve => { release = resolve; });
    return Promise.resolve(response(401));
  });
  const late = me('');
  await getTodayAttendance('');
  release(response(401));
  await late;
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/refresh'))).toHaveLength(1);
});

test('late 401 cannot replay an old account request under another tab login', async () => {
  let otherTab!: typeof import('../src/services/auth');
  jest.isolateModules(() => { otherTab = require('../src/services/auth'); });
  let release!: (res: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; }));
  fetchMock.mockResolvedValue(response(200, { id: 'other-account' }));
  const pending = me('');
  otherTab.setSessionToken('other-account');
  release(response(401));
  await expect(pending).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(getSessionToken()).toBe('other-account');
});

test.each([200, 401])('other-tab account switch fences in-flight refresh status %s', async status => {
  let otherTab!: typeof import('../src/services/auth');
  jest.isolateModules(() => { otherTab = require('../src/services/auth'); });
  let release!: (res: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; }));
  const pending = refreshSession('');
  otherTab.setSessionToken('other-account');
  release(response(status, { token: 'stale-refresh' }));
  await expect(pending).resolves.toEqual({ status: 'transient-failure' });
  expect(getSessionToken()).toBe('other-account');
});

test('account switch while waiting for navigator lock never refreshes the new account', async () => {
  let run!: () => Promise<unknown>;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: {
    request: (_: string, callback: () => Promise<unknown>) => new Promise(resolve => { run = () => callback().then(resolve); }),
  } } });
  let otherTab!: typeof import('../src/services/auth');
  jest.isolateModules(() => { otherTab = require('../src/services/auth'); });
  const pending = refreshSession('');
  otherTab.setSessionToken('other-account');
  await run();
  await expect(pending).resolves.toEqual({ status: 'transient-failure' });
  expect(fetchMock).not.toHaveBeenCalled();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
});

test('concurrent invalid refresh broadcasts sign-out only once', async () => {
  const signedOut = jest.fn();
  events.addEventListener(signedOutEvent, signedOut);
  fetchMock.mockResolvedValue(response(401));
  await Promise.allSettled([me(''), getTodayAttendance(''), getMyEmployeeProfile('')]);
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/refresh'))).toHaveLength(1);
  expect(signedOut).toHaveBeenCalledTimes(1);
  expect(getSessionToken()).toBeNull();
  events.removeEventListener(signedOutEvent, signedOut);
});

test.each([401, 403, 422])('retry remains bounded or skips refresh for status %s', async status => {
  fetchMock.mockImplementation(async (url: string) => url.endsWith('/refresh') ? response(200, { token: 'access-b' }) : response(status));
  await expect(getMyEmployeeProfile('')).rejects.toMatchObject({ status });
  expect(fetchMock).toHaveBeenCalledTimes(status === 401 ? 3 : 1);
  expect(getSessionToken()).toBe(status === 401 ? 'access-b' : 'access-a');
});

test('attendance multipart retry preserves body and idempotency key', async () => {
  const body = new FormData();
  body.append('note', 'selfie');
  fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, { token: 'access-b' })).mockResolvedValueOnce(response(200, {}));
  await checkIn('', body, 'same-id');
  for (const index of [0, 2]) {
    const init = fetchMock.mock.calls[index][1];
    expect(init.body).toBe(body);
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('same-id');
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
  }
});

test('HR multipart transient refresh preserves access token', async () => {
  fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(503));
  await expect(uploadDocument('', { employeeProfileId: 'employee' } as any, new Blob(['test']) as File)).rejects.toMatchObject({ code: 'AUTH_REFRESH_UNAVAILABLE' });
  expect(getSessionToken()).toBe('access-a');
});

test.each([downloadEmployeeImportTemplate, (base: string) => downloadDocument(base, 'doc')])('download uses replacement Bearer and retries once', async download => {
  fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, { token: 'access-b' })).mockResolvedValueOnce(response(403));
  await expect(download('')).rejects.toMatchObject({ status: 403 });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get('Authorization')).toBe('Bearer access-b');
});
