import { fetchPhoto } from '../src/components/AuthedImage';
import { setSessionToken } from '../src/services/auth';
jest.mock('../src/config/api', () => ({ apiUrl: (base: string, path: string) => base + path, getApiBaseSync: () => 'https://api.test' }));
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); } } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { href: 'https://web.test/app/attendance', origin: 'https://web.test' } } });
  setSessionToken('access-a');
});
test('private evidence retries with new Bearer token on trusted configured API', async () => {
  const fetchMock = jest.fn().mockResolvedValueOnce({ status: 401 }).mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ success: true, data: { token: 'access-b' } }) }).mockResolvedValueOnce({ ok: true, status: 200, blob: async () => new Blob(['photo']) });
  globalThis.fetch = fetchMock;
  await fetchPhoto('https://api.test/api/attendance/evidence/photo');
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get('Authorization')).toBe('Bearer access-b');
});
test('untrusted evidence URL never receives session credentials', async () => {
  globalThis.fetch = jest.fn();
  await expect(fetchPhoto('https://evil.test/api/attendance/evidence/photo')).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
