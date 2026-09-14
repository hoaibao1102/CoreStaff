import { describe, expect, it, beforeEach } from 'vitest';
import { addWorkplace, createOrganization, loadActiveWorkplace, updateWorkplace } from './adminService';
import type { NewWorkplaceInput } from './adminService';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  },
});

const HQ: NewWorkplaceInput = {
  name: 'VP Minh An', address: '1 đường mẫu, Q1, TP.HCM',
  latitude: 10.7512, longitude: 106.6974,
  allowedRadiusMeters: 100, maximumAccuracyMeters: 80,
  bssid: '11:22:33:44:55:66', ssid: 'MINHAN_Q1',
};

const newOrg = () => createOrganization({ name: 'Công ty TNHH Minh An', code: 'MAN', workplace: HQ });

describe('adminService workplace config', () => {
  beforeEach(() => localStorage.clear());

  it('rejects a latitude outside [-90, 90]', async () => {
    await expect(createOrganization({ name: 'X', code: 'XX', workplace: { ...HQ, latitude: 95 } }))
      .rejects.toMatchObject({ code: 'WORKPLACE_GEO_INVALID' });
  });

  it('rejects a malformed BSSID', async () => {
    await expect(createOrganization({ name: 'X', code: 'XX', workplace: { ...HQ, bssid: 'AA:BB:CC' } }))
      .rejects.toMatchObject({ code: 'BSSID_INVALID' });
  });

  it('creates the tenant and its HQ workplace with the router signature', async () => {
    const { organizations, workplace } = await newOrg();
    expect(organizations.map((o) => o.code)).toContain('MAN');
    expect(workplace.code).toBe('MAN-HQ');
    expect(workplace.networks[0].bssid).toBe('11:22:33:44:55:66');
  });

  it('an admin BSSID edit is what the check-in loop reads back', async () => {
    const { workplace } = await newOrg();
    await updateWorkplace(workplace.organizationId, workplace.id, {
      networks: [{ id: 'net-edit', name: 'Mạng văn phòng', bssid: 'FF:EE:DD:CC:BB:AA', active: true }],
    });
    expect(loadActiveWorkplace(workplace.organizationId)?.networks[0].bssid).toBe('FF:EE:DD:CC:BB:AA');
  });

  it('a tenant with no configured workplace gets undefined, never another tenant geofence', async () => {
    await newOrg();
    expect(loadActiveWorkplace('org-tvs')?.organizationId).toBe('org-tvs'); // seeded HQ
    expect(loadActiveWorkplace('org-abc')).toBeUndefined();
  });

  it('addWorkplace attaches to an existing tenant without duplicating the org', async () => {
    const list = await addWorkplace('org-abc', { ...HQ, latitude: 10.8, longitude: 106.7 });
    expect(list).toHaveLength(1);
    expect(list[0].organizationId).toBe('org-abc');
    expect(loadActiveWorkplace('org-abc')?.name).toBe('VP Minh An');
  });
});
