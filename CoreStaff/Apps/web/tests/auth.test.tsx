import { friendlyAuthError, login } from '../src/services/auth';

jest.mock('../src/config/api', () => ({
  apiUrl: (base: string, path: string) => base + path,
}));

test('login trims identifier before sending credentials', async () => {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      success: true,
      data: {
        user: {
          id: 'u1',
          email: 'hr@example.test',
          fullName: 'HR',
          role: 'HR',
          status: 'ACTIVE',
        },
        mustChangePassword: false,
      },
    }),
  }));
  globalThis.fetch = fetchMock as typeof fetch;

  await login('https://api.example.test', ' HR-A ', 'Secret1!');

  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.example.test/api/auth/login',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ identifier: 'HR-A', password: 'Secret1!' }),
      credentials: 'include',
    }),
  );
});

test('login 401 without api error body still maps to credential message', async () => {
  globalThis.fetch = jest.fn(async () => ({
    ok: false,
    status: 401,
    text: async () => '',
  })) as typeof fetch;

  try {
    await login('https://api.example.test', 'hr@example.test', 'wrong');
    throw new Error('Expected login to fail');
  } catch (error: unknown) {
    expect(friendlyAuthError(error)).toBe('Tài khoản hoặc mật khẩu không đúng.');
  }
});
