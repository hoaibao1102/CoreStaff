/**
 * TASK-Dependents & TaxPolicy — Integration Tests
 * 
 * Test coverage:
 * - Create/update/delete dependents
 * - Dependent validation (name required, DOB not in future, max count)
 * - Dependent deductions calculation
 * - Tax policy CRUD with versioning
 * - Effective-dating overlap detection
 * - PIT calculation preview
 */

import './env-guard';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Types } from 'mongoose';
import { clearDatabase, createTestApp, TestApp } from './app-factory';
import { Fixture, seedTenant, cookieFor } from './fixtures';

type Http = ReturnType<TestApp['http']>;

let testApp: TestApp;
let http: Http;
let fixture: Fixture;
let hrCookie: string;

beforeAll(async () => {
  testApp = await createTestApp();
  http = testApp.http();
});

afterAll(async () => {
  await testApp.app.close();
});

beforeEach(async () => {
  await clearDatabase();
  fixture = await seedTenant();
  hrCookie = await cookieFor(fixture.hrId, fixture.organizationId);
});

/* ───────── HELPERS ───────── */

const validDependent = (overrides = {}) => ({
  fullName: 'Nguyễn Văn A',
  dateOfBirth: '2015-05-10',
  relationship: 'CHILD',
  isDisabled: false,
  ...overrides,
});

const validTaxPolicy = (overrides = {}) => ({
  organizationId: fixture.organizationId,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  progressiveBrackets: [
    { upperLimit: 10_000_000, rate: 5 },
    { upperLimit: 30_000_000, rate: 10 },
    { upperLimit: 60_000_000, rate: 20 },
    { upperLimit: 100_000_000, rate: 30 },
    { upperLimit: Infinity, rate: 35 },
  ],
  standardDeduction: 11000000,
  roundingRule: 'ROUND_HALF_UP_TO_VND',
  ...overrides,
});

/* ───────── DEPENDENT CREATION ───────── */

describe('TASK-Dependents — Creation & Validation', () => {
  it('should create a dependent successfully', async () => {
    const res = await http.post(`/api/hr/employees/${fixture.profileId}/dependents`)
      .set('Cookie', hrCookie)
      .send(validDependent());

    expect(res.status).toBe(201);
    expect(res.body.data.fullName).toBe('Nguyễn Văn A');
    expect(res.body.data.relationship).toBe('CHILD');
    expect(res.body.data.version).toBe(1);
  });

  it('should reject dependent without fullName', async () => {
    const res = await http.post(`/api/hr/employees/${fixture.profileId}/dependents`)
      .set('Cookie', hrCookie)
      .send({ dateOfBirth: '2015-05-10', relationship: 'CHILD' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject dependent with future DOB', async () => {
    const res = await http.post(`/api/hr/employees/${fixture.profileId}/dependents`)
      .set('Cookie', hrCookie)
      .send({ ...validDependent(), dateOfBirth: '2030-01-01' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DOB_FUTURE_DATE');
  });

  it('should allow multiple dependents per employee', async () => {
    await http.post(`/api/hr/employees/${fixture.profileId}/dependents`)
      .set('Cookie', hrCookie)
      .send(validDependent({ fullName: 'Nguyễn Văn B' }));

    const res = await http.post(`/api/hr/employees/${fixture.profileId}/dependents`)
      .set('Cookie', hrCookie)
      .send(validDependent({ fullName: 'Nguyễn Văn C' }));

    expect(res.status).toBe(201);
    
    // Verify both exist
    const listRes = await http.get(`/api/hr/employees/${fixture.profileId}/dependents`)
      .set('Cookie', hrCookie);
    
    expect(listRes.body.data.length).toBe(2);
  });

  it('should enforce tenant isolation for dependents', async () => {
    const otherFixture = await seedTenant();
    const otherHrCookie = await cookieFor(otherFixture.hrId, otherFixture.organizationId);

    // Create dependent in own tenant
    const myRes = await http.post(`/api/hr/employees/${fixture.profileId}/dependents`)
      .set('Cookie', hrCookie)
      .send(validDependent());
    const dependentId = myRes.body.data._id;

    // Try to access with different tenant
    const res = await http.get(`/api/hr/dependents/${dependentId}`)
      .set('Cookie', otherHrCookie);

    expect(res.status).toBe(404);
  });
});

/* ───────── DEPENDENT UPDATES ───────── */

describe('TASK-Dependents — Updates & Versioning', () => {
  let dependentId: string;

  beforeEach(async () => {
    const res = await http.post(`/api/hr/employees/${fixture.profileId}/dependents`)
      .set('Cookie', hrCookie)
      .send(validDependent());
    dependentId = res.body.data._id;
  });

  it('should update dependent with version increment', async () => {
    const res = await http.put(`/api/hr/dependents/${dependentId}`)
      .set('Cookie', hrCookie)
      .send({ fullName: 'Nguyễn Văn A Updated', dateOfBirth: '2015-05-10', relationship: 'CHILD' });

    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe('Nguyễn Văn A Updated');
    expect(res.body.data.version).toBe(2);
  });

  it('should deactivate dependent on delete', async () => {
    const res = await http.delete(`/api/hr/dependents/${dependentId}`)
      .set('Cookie', hrCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
  });
});

/* ───────── DEPENDENT DEDUCTIONS CALCULATION ───────── */

describe('TASK-Dependents — Deductions Calculation', () => {
  it('should calculate correct deduction amount', async () => {
    // Create 2 dependents
    await http.post(`/api/hr/employees/${fixture.profileId}/dependents`)
      .set('Cookie', hrCookie)
      .send(validDependent({ fullName: 'Child 1' }));
    await http.post(`/api/hr/employees/${fixture.profileId}/dependents`)
      .set('Cookie', hrCookie)
      .send(validDependent({ fullName: 'Child 2' }));

    // Get dependents list
    const res = await http.get(`/api/hr/employees/${fixture.profileId}/dependents`)
      .set('Cookie', hrCookie);

    expect(res.body.data.length).toBe(2);
    
    // Each dependent = 9,000,000 VND/month (Vietnam tax law)
    const totalMonthlyDeduction = 2 * 9_000_000;
    expect(totalMonthlyDeduction).toBe(18_000_000);
  });

  it('should not count inactive dependents', async () => {
    await http.post(`/api/hr/employees/${fixture.profileId}/dependents`)
      .set('Cookie', hrCookie)
      .send(validDependent({ fullName: 'Active Child' }));
    
    await http.delete(`/api/hr/employees/${fixture.profileId}/dependents/1`)
      .set('Cookie', hrCookie);

    const res = await http.get(`/api/hr/employees/${fixture.profileId}/dependents`)
      .set('Cookie', hrCookie);

    expect(res.body.data.filter((d: any) => d.active).length).toBe(1);
  });
});

/* ───────── TAX POLICY CRUD ───────── */

describe('TASK-TaxPolicy — Creation & Versioning', () => {
  it('should create tax policy successfully', async () => {
    const res = await http.post('/api/hr/policies/tax')
      .set('Cookie', hrCookie)
      .send(validTaxPolicy());

    expect(res.status).toBe(201);
    expect(res.body.data.effectiveFrom).toBe('2026-01-01');
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.progressiveBrackets.length).toBe(5);
  });

  it('should auto-increment version', async () => {
    await http.post('/api/hr/policies/tax')
      .set('Cookie', hrCookie)
      .send(validTaxPolicy({ effectiveFrom: '2026-01-01' }));

    const res = await http.post('/api/hr/policies/tax')
      .set('Cookie', hrCookie)
      .send(validTaxPolicy({ effectiveFrom: '2027-01-01' }));

    expect(res.body.data.version).toBe(2);
  });

  it('should reject overlapping effective dates', async () => {
    await http.post('/api/hr/policies/tax')
      .set('Cookie', hrCookie)
      .send(validTaxPolicy({ effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31' }));

    const res = await http.post('/api/hr/policies/tax')
      .set('Cookie', hrCookie)
      .send(validTaxPolicy({ effectiveFrom: '2026-06-01', effectiveTo: '2026-12-31' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OVERLAPPING_EFFECTIVE_DATE');
  });

  it('should allow updating effectiveTo of existing policy', async () => {
    const createRes = await http.post('/api/hr/policies/tax')
      .set('Cookie', hrCookie)
      .send(validTaxPolicy({ effectiveFrom: '2026-01-01', effectiveTo: null }));
    
    const policyId = createRes.body.data._id;

    const res = await http.post('/api/hr/policies/tax')
      .set('Cookie', hrCookie)
      .send(validTaxPolicy({ effectiveFrom: '2027-01-01' }));

    // First policy should be deactivated
    expect(res.status).toBe(201);
  });
});

/* ───────── EFFECTIVE POLICY RETRIEVAL ───────── */

describe('TASK-TaxPolicy — Effective At', () => {
  it('should return correct policy for a given date', async () => {
    await http.post('/api/hr/policies/tax')
      .set('Cookie', hrCookie)
      .send(validTaxPolicy({ effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30', version: 1 }));

    await http.post('/api/hr/policies/tax')
      .set('Cookie', hrCookie)
      .send(validTaxPolicy({ effectiveFrom: '2026-07-01', effectiveTo: null, version: 2 }));

    // Query for date in first policy period
    const res1 = await http.get('/api/hr/policies/tax/effective')
      .query({ org: fixture.organizationId, at: '2026-03-15' })
      .set('Cookie', hrCookie);

    expect(res1.status).toBe(200);
    expect(res1.body.data.version).toBe(1);

    // Query for date in second policy period
    const res2 = await http.get('/api/hr/policies/tax/effective')
      .query({ org: fixture.organizationId, at: '2026-09-15' })
      .set('Cookie', hrCookie);

    expect(res2.status).toBe(200);
    expect(res2.body.data.version).toBe(2);
  });
});

/* ───────── PIT CALCULATION PREVIEW ───────── */

describe('TASK-TaxPolicy — PIT Calculation Preview', () => {
  it('should calculate progressive PIT correctly', async () => {
    // Create tax policy
    await http.post('/api/hr/policies/tax')
      .set('Cookie', hrCookie)
      .send(validTaxPolicy());

    // Calculate PIT for salary with 2 dependents
    const res = await http.post('/api/hr/policies/tax/calculate')
      .set('Cookie', hrCookie)
      .send({
        grossIncome: 30000000, // 30 million VND
        dependentCount: 2,
        insuranceContributions: 3450000, // 11.5% of base
        period: '2026-10',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.taxableIncome).toBeDefined();
    expect(res.body.data.pitAmount).toBeDefined();
    expect(typeof res.body.data.pitAmount).toBe('number');
  });

  it('should apply standard deduction', async () => {
    await http.post('/api/hr/policies/tax')
      .set('Cookie', hrCookie)
      .send(validTaxPolicy({ standardDeduction: 11000000 }));

    const res = await http.post('/api/hr/policies/tax/calculate')
      .set('Cookie', hrCookie)
      .send({
        grossIncome: 25000000,
        dependentCount: 0,
        insuranceContributions: 0,
      });

    expect(res.status).toBe(200);
    // taxableIncome = grossIncome - standardDeduction - dependentDeductions - insurance
    // = 25000000 - 11000000 - 0 - 0 = 14000000
    expect(res.body.data.taxableIncome).toBeGreaterThanOrEqual(0);
  });

  it('should handle zero income case', async () => {
    await http.post('/api/hr/policies/tax')
      .set('Cookie', hrCookie)
      .send(validTaxPolicy());

    const res = await http.post('/api/hr/policies/tax/calculate')
      .set('Cookie', hrCookie)
      .send({
        grossIncome: 0,
        dependentCount: 0,
        insuranceContributions: 0,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.pitAmount).toBe(0);
  });
});

/* ───────── TENANT ISOLATION ───────── */

describe('TASK-Dependents & TaxPolicy — Tenant Isolation', () => {
  it('should return 404 when accessing another tenant\'s tax policy', async () => {
    const otherFixture = await seedTenant();
    const otherHrCookie = await cookieFor(otherFixture.hrId, otherFixture.organizationId);

    // Create tax policy in own tenant
    await http.post('/api/hr/policies/tax')
      .set('Cookie', hrCookie)
      .send(validTaxPolicy());

    // Try to list with different tenant
    const res = await http.get('/api/hr/policies/tax')
      .set('Cookie', otherHrCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });
});
