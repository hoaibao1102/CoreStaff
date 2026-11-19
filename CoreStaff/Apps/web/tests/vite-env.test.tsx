import { getApiBaseSync, REMOTE_API_URL } from '../src/config/api';

// The production module must parse in Jest's CommonJS runtime without using the
// runtime __VITE_ENV__ escape hatch. setup.ts supplies the explicit AST stub.
test('Jest loads the real Vite-env branch with an explicit test environment', () => {
  expect((globalThis as any).__VITE_ENV__).toBeUndefined();
  expect(REMOTE_API_URL).toBe('https://jest-api.invalid');
  expect(getApiBaseSync()).toBe('https://jest-api.invalid');
});
