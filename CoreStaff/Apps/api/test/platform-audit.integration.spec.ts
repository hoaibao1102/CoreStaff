/**
 * Platform audit, end to end over a real Mongo: the SYSTEM_ADMIN's lifecycle
 * actions and account-security events are written, readable only by the admin,
 * never contain a secret, and cannot be edited or deleted through the API.
 */
import './env-guard';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Types } from 'mongoose';
import { clearDatabase, connection, createTestApp, TestApp } from './app-factory';
import { Fixture, cookieFor, seedTenant } from './fixtures';
import { hashPassword } from '../src/auth/strategies/bcrypt.strategy';
import { userFields } from '../src/database/seed/provision';

const ADMIN_EMAIL = 'root@platform.test';
const ADMIN_PASSWORD = 'Correct#Horse9';

let testApp: TestApp;
let http: ReturnType<TestApp['http']>;
let fixture: Fixture;
let adminCookie: string;

const logs = () => connection().db!.collection('platform_audit_logs');
const rows = () => logs().find({}).sort({ occurredAt: 1 }).toArray();

async function login(password: string) {
  return http.post('/api/auth/login').send({ identifier: ADMIN_EMAIL, password });
}

beforeAll(async () => { testApp = await createTestApp(); http = testApp.http(); });
afterAll(async () => { await testApp.app.close(); });

beforeEach(async () => {
  await clearDatabase();
  fixture = await seedTenant();
  await connection().model('User').create(userFields({
    organizationId: undefined, email: ADMIN_EMAIL, fullName: 'Platform Root', passwordHash: await hashPassword(ADMIN_PASSWORD), role: 'SYSTEM_ADMIN',
  }) as never);
  // A seeded admin has already set a real password; a temporary-password session is limited to the change-password route.
  await connection().db!.collection('users').updateOne({ emailN: ADMIN_EMAIL }, { $set: { mustChangePassword: false } });
  const res = await login(ADMIN_PASSWORD);
  expect(res.status).toBe(201);
  adminCookie = String(res.headers['set-cookie']).split(';')[0];
  await logs().deleteMany({});
});

describe('admin account security events', () => {
  it('records a successful sign-in with the client address and no password', async () => {
    const res = await login(ADMIN_PASSWORD);
    expect(res.status).toBe(201);
    const [row] = await rows();
    expect(row).toMatchObject({ action: 'ADMIN_LOGIN_SUCCEEDED', actorEmailSnapshot: ADMIN_EMAIL, actorRoleSnapshot: 'SYSTEM_ADMIN', outcome: 'SUCCEEDED' });
    expect(row.ip).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain(ADMIN_PASSWORD);
  });

  it('records each wrong password and the lockout, then refuses the right one while locked', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login('Wrong#Guess1')).status).toBe(401);
    }
    const actions = (await rows()).map(row => row.action);
    expect(actions.filter(action => action === 'ADMIN_LOGIN_FAILED')).toHaveLength(5);
    expect(actions.filter(action => action === 'ADMIN_ACCOUNT_LOCKED')).toHaveLength(1);
    expect((await login(ADMIN_PASSWORD)).status).toBe(423);
    expect(JSON.stringify(await rows())).not.toContain('Wrong#Guess1');
  });

  it('does not put an HR sign-in in the platform audit', async () => {
    const hr = await connection().db!.collection('users').findOne({ _id: new Types.ObjectId(fixture.hrId) });
    expect(hr).toBeTruthy();
    await logs().deleteMany({});
    await http.post('/api/auth/login').send({ identifier: hr!.email, password: 'definitely-wrong' });
    expect(await logs().countDocuments()).toBe(0);
  });
});

describe('tenant lifecycle', () => {
  it('records create, first HR (without its temporary password), suspend and re-activate', async () => {
    const created = await http.post('/api/platform/organizations').set('Cookie', adminCookie).send({ code: 'NEWCO', name: 'New Company' });
    expect(created.status).toBe(201);
    const orgId = created.body.data._id;

    const hr = await http.post(`/api/platform/organizations/${orgId}/initial-hr`).set('Cookie', adminCookie).send({ email: 'first-hr@newco.test', fullName: 'First HR' });
    expect(hr.status).toBe(201);
    const tempPassword = hr.body.data.tempPassword;
    expect(tempPassword).toBeTruthy();

    expect((await http.post(`/api/platform/organizations/${orgId}/suspend`).set('Cookie', adminCookie)).status).toBe(201);
    expect((await http.post(`/api/platform/organizations/${orgId}/activate`).set('Cookie', adminCookie)).status).toBe(201);

    const all = await rows();
    expect(all.map(row => row.action)).toEqual(['ORGANIZATION_CREATED', 'INITIAL_HR_CREATED', 'ORGANIZATION_SUSPENDED', 'ORGANIZATION_ACTIVATED']);
    expect(all[0]).toMatchObject({ targetSummary: 'NEWCO — New Company', actorEmailSnapshot: ADMIN_EMAIL });
    expect(all[1]).toMatchObject({ targetSummary: 'first-hr@newco.test (HR)' });
    expect(all[1].targetOrganizationId).toBeTruthy();
    expect(all[2].details).toMatchObject({ previousStatus: 'ACTIVE', newStatus: 'SUSPENDED' });
    expect(JSON.stringify(all)).not.toContain(tempPassword);
  });

  it('writes nothing when the action fails', async () => {
    await http.post('/api/platform/organizations').set('Cookie', adminCookie).send({ code: 'DUP', name: 'One' });
    await logs().deleteMany({});
    const again = await http.post('/api/platform/organizations').set('Cookie', adminCookie).send({ code: 'DUP', name: 'Two' });
    expect(again.status).toBe(409);
    expect(await logs().countDocuments()).toBe(0);
  });
});

describe('GET /api/platform/audit-logs', () => {
  beforeEach(async () => {
    await http.post('/api/platform/organizations').set('Cookie', adminCookie).send({ code: 'AUD', name: 'Audit Co' });
    for (let i = 0; i < 3; i += 1) await login('Wrong#Guess1');
  });

  it('returns newest first with the total and the list of actions', async () => {
    const res = await http.get('/api/platform/audit-logs?limit=2').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(4);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[0].action).toBe('ADMIN_LOGIN_FAILED');
    expect(res.body.data.actions).toContain('ORGANIZATION_SUSPENDED');
  });

  it('filters by action, outcome and text', async () => {
    const byAction = await http.get('/api/platform/audit-logs?action=ORGANIZATION_CREATED').set('Cookie', adminCookie);
    expect(byAction.body.data.total).toBe(1);
    const byOutcome = await http.get('/api/platform/audit-logs?outcome=FAILED').set('Cookie', adminCookie);
    expect(byOutcome.body.data.total).toBe(3);
    const byText = await http.get('/api/platform/audit-logs?q=Audit%20Co').set('Cookie', adminCookie);
    expect(byText.body.data.total).toBe(1);
  });

  it('is closed to a tenant HR and to anonymous callers', async () => {
    const hrCookie = await cookieFor(fixture.hrId, fixture.organizationId);
    expect((await http.get('/api/platform/audit-logs').set('Cookie', hrCookie)).status).toBe(403);
    expect((await http.get('/api/platform/audit-logs')).status).toBe(401);
  });

  it('cannot be edited or deleted through the API', async () => {
    const [first] = await rows();
    expect((await http.delete(`/api/platform/audit-logs/${first._id}`).set('Cookie', adminCookie)).status).toBe(404);
    expect((await http.put(`/api/platform/audit-logs/${first._id}`).set('Cookie', adminCookie)).status).toBe(404);
    expect(await logs().countDocuments()).toBe(4);
  });

  it('stays out of the tenant HR audit', async () => {
    const hrCookie = await cookieFor(fixture.hrId, fixture.organizationId);
    const res = await http.get('/api/hr/audit-logs').set('Cookie', hrCookie);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('ORGANIZATION_CREATED');
  });
});
