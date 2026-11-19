/** @jest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import App from '../src/App';
import { rememberSession, hasRememberedSession } from '../src/lib/session';
import { me, signedOutEvent } from '../src/services/auth';

jest.mock('../src/config/api', () => ({ resolveApiBase: jest.fn(async () => ({ base: 'https://api.test', source: 'remote', health: {} })) }));
jest.mock('../src/services/auth', () => ({ me: jest.fn(), signedOutEvent: 'signed-out' }));
jest.mock('../src/components/toast', () => ({ ToastViewport: () => null }));
jest.mock('../src/components/CoreStaffLogo', () => ({ CoreStaffLogo: () => null }));
jest.mock('../src/components/AppLink', () => ({ navigationEvent: 'nav' }));
jest.mock('../src/screens/Auth/AuthScreen', () => ({ AuthScreen: ({ user }: any) => <div>{user ? 'authenticated-user' : 'login-form'}</div> }));
jest.mock('../src/routes/WorkspaceRoutes', () => ({ WorkspaceRoutes: () => <div>workspace</div> }));

test('transient bootstrap keeps remembered session and offers retry rather than login', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  rememberSession();
  (me as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'AUTH_REFRESH_UNAVAILABLE', status: 503 })).mockResolvedValueOnce({ role: 'EMPLOYEE' });
  const host = document.createElement('div');
  const root = createRoot(host);
  await act(async () => { root.render(<App />); });
  expect(hasRememberedSession()).toBe(true);
  expect(host.textContent).not.toContain('login-form');
  const button = host.querySelector('button');
  expect(button?.textContent).toContain('Thử lại');
  await act(async () => { button?.click(); });
  expect(me).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
});

test('sign-out during bootstrap prevents a late successful me from restoring the user', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  rememberSession();
  let release!: (user: unknown) => void;
  (me as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const host = document.createElement('div');
  const root = createRoot(host);
  await act(async () => { root.render(<App />); });
  await act(async () => { window.dispatchEvent(new Event(signedOutEvent)); });
  await act(async () => { release({ role: 'EMPLOYEE' }); });
  expect(host.textContent).toContain('login-form');
  expect(host.textContent).not.toContain('authenticated-user');
  await act(async () => root.unmount());
});
