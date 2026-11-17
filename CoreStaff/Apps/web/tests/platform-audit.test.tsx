/** @jest-environment jsdom */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { PlatformAuditScreen } from '../src/screens/PlatformAudit/PlatformAuditScreen';
import { describePlatformAudit, platformAuditActionLabel } from '../src/screens/PlatformAudit/platformAuditPresentation';
import * as platform from '../src/services/platformService';

jest.mock('../src/config/api', () => ({ apiUrl: (base: string, path: string) => base + path }));
jest.mock('../src/services/platformService', () => ({
  ...jest.requireActual('../src/services/platformService'),
  getPlatformAuditLogs: jest.fn(),
  listOrganizations: jest.fn(),
}));

const getLogs = platform.getPlatformAuditLogs as jest.Mock;
const listOrgs = platform.listOrganizations as jest.Mock;

const row = (over: Partial<platform.PlatformAuditLogItem>): platform.PlatformAuditLogItem => ({
  _id: 'a1', eventId: 'e1', occurredAt: '2026-11-05T03:00:00.000Z', action: 'ORGANIZATION_SUSPENDED', targetType: 'ORGANIZATION',
  targetSummary: 'ABC — ABC JSC', outcome: 'SUCCEEDED', actorNameSnapshot: 'Platform System Administrator', actorEmailSnapshot: 'sysadmin@corestaff.local',
  ip: '113.161.22.41', details: { revokedSessions: 7 }, ...over,
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  getLogs.mockReset(); listOrgs.mockReset();
  listOrgs.mockResolvedValue([{ _id: 'o1', code: 'ABC', name: 'ABC JSC', status: 'ACTIVE' }]);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

const render = async () => { await act(async () => root.render(<PlatformAuditScreen apiBase="https://api.test" />)); await act(async () => { await Promise.resolve(); }); };

describe('presentation', () => {
  it('names every recorded action in Vietnamese and falls back to the raw code', () => {
    expect(platformAuditActionLabel('ORGANIZATION_SUSPENDED')).toBe('Khóa tổ chức');
    expect(platformAuditActionLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
  it('explains an event in one sentence, with the reason and dates in dd/mm/yyyy', () => {
    expect(describePlatformAudit(row({ reason: 'Rà soát phân quyền' }))).toBe('Thu hồi 7 phiên đăng nhập đang hoạt động. Lý do: Rà soát phân quyền');
    expect(describePlatformAudit(row({ action: 'ADMIN_LOGIN_FAILED', details: { failedLoginCount: 3 } }))).toBe('Sai mật khẩu (lần 3 liên tiếp)');
    expect(describePlatformAudit(row({ action: 'ADMIN_ACCOUNT_LOCKED', details: { lockedUntil: '2026-11-05T03:15:00.000Z' } }))).toBe('Tạm khóa đến 10:15 05/11/2026');
  });
});

describe('PlatformAuditScreen', () => {
  it('lists events with who, what, target, outcome, detail and IP, dated dd/mm/yyyy', async () => {
    getLogs.mockResolvedValue({ items: [row({})], total: 1, actions: ['ORGANIZATION_SUSPENDED'] });
    await render();
    const text = host.textContent!;
    expect(text).toContain('Nhật ký hệ thống');
    expect(text).toContain('10:00 05/11/2026');
    expect(text).toContain('Platform System Administrator');
    expect(text).toContain('Khóa tổ chức');
    expect(text).toContain('ABC — ABC JSC');
    expect(text).toContain('Thành công');
    expect(text).toContain('Thu hồi 7 phiên đăng nhập');
    expect(text).toContain('113.161.22.41');
  });

  it('shows an empty state when nothing has been recorded', async () => {
    getLogs.mockResolvedValue({ items: [], total: 0, actions: [] });
    await render();
    expect(host.textContent).toContain('Chưa có sự kiện nào được ghi lại.');
  });

  it('shows a failed attempt as Thất bại', async () => {
    getLogs.mockResolvedValue({ items: [row({ action: 'ADMIN_LOGIN_FAILED', outcome: 'FAILED', details: { failedLoginCount: 2 } })], total: 1, actions: [] });
    await render();
    expect(host.textContent).toContain('Thất bại');
    expect(host.textContent).toContain('Đăng nhập admin thất bại');
  });

  it('sends the chosen filter to the API and returns to page 1', async () => {
    getLogs.mockResolvedValue({ items: [row({})], total: 45, actions: ['ORGANIZATION_SUSPENDED', 'ADMIN_LOGIN_FAILED'] });
    await render();
    const select = host.querySelectorAll('select')[0] as HTMLSelectElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
      setter.call(select, 'ADMIN_LOGIN_FAILED');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const last = getLogs.mock.calls.at(-1)![1];
    expect(last).toMatchObject({ action: 'ADMIN_LOGIN_FAILED', page: 1, limit: 20 });
  });

  it('pages through the results using the total from the API', async () => {
    getLogs.mockResolvedValue({ items: [row({})], total: 45, actions: [] });
    await render();
    expect(host.textContent).toContain('Trang 1 / 3');
    const next = [...host.querySelectorAll('button')].find(b => b.textContent === 'Trang sau')!;
    await act(async () => { next.click(); });
    expect(getLogs.mock.calls.at(-1)![1]).toMatchObject({ page: 2 });
  });

  it('reports an error with a retry instead of an empty table', async () => {
    getLogs.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 500 })).mockResolvedValue({ items: [row({})], total: 1, actions: [] });
    await render();
    expect(host.querySelector('[role=alert]')!.textContent).toContain('Không tải được nhật ký hệ thống');
    const retry = [...host.querySelectorAll('button')].find(b => b.textContent === 'Thử lại')!;
    await act(async () => { retry.click(); });
    expect(host.textContent).toContain('Khóa tổ chức');
  });

  it('opens the full detail of an event, with no secret and a demo marker for seeded rows', async () => {
    getLogs.mockResolvedValue({ items: [row({ source: 'SEED', userAgent: 'Mozilla/5.0 test' })], total: 1, actions: [] });
    await render();
    await act(async () => { host.querySelector<HTMLTableRowElement>('tbody tr')!.click(); });
    const dialog = document.body.textContent!;
    expect(dialog).toContain('Mozilla/5.0 test');
    expect(dialog).toContain('Dữ liệu demo');
    expect(dialog).toContain('Mật khẩu và mã xác thực không bao giờ được lưu');
  });
});
