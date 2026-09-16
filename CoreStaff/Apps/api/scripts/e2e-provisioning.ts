/**
 * Plan Sequence step 6 — end-to-end provisioning against the real replica set,
 * over HTTP. Not a jest spec: it needs a live Mongo + a running server, and it
 * exercises the cookie/session plumbing no fake can.
 *
 * Self-contained: it mints a throwaway SYSTEM_ADMIN (its own password, generated
 * per run) rather than depending on the shared dev account, and it deletes every
 * row it creates. Reads MONGODB_URI through the app's own env loader so the DNS
 * workaround applies; prints no URI, no password, and no token.
 *
 * Run:  npm run build && node dist/main.js   (other terminal)
 *       npx ts-node-script scripts/e2e-provisioning.ts
 */
import * as mongoose from 'mongoose';
import { resolveEnv } from '../src/config/env';
import { hashPassword } from '../src/auth/strategies/bcrypt.strategy';
import { generateTempPassword } from '../src/auth/strategies/password-policy';
import { userFields } from '../src/database/seed/provision';

const BASE = 'http://localhost:3000/api';

const RUN = String(Date.now()).slice(-8);
const ADMIN_EMAIL = `e2e-admin-${RUN}@e2e.local`;
const ORG_CODE = `E2E${RUN.slice(0, 4)}`;
const ORG_NAME = 'E2E Provisioning Corp';
const OTHER_ORG_CODE = `E2B${RUN.slice(0, 4)}`;
const HR_EMAIL = `e2e-hr-${RUN}@e2e.local`;
const EMP_EMAIL = `e2e-emp-${RUN}@e2e.local`;
const EMP_CODE = `E2E-${RUN}`;
const HR_SELF_CODE = `E2E-HR-${RUN}`;

let failures = 0;

function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures++;
}

/** `DEBUG=1 npx ts-node-script …` prints each >=400 response body, with any
 * tempPassword redacted to its length — never its value. */
function debug(label: string, res: Res) {
  const copy = JSON.parse(JSON.stringify(res.body ?? null));
  if (copy?.data?.tempPassword) copy.data.tempPassword = `<${String(copy.data.tempPassword).length} chars>`;
  console.log(`   ${label}: ${JSON.stringify({ status: res.status, body: copy })}`);
}

interface Res {
  status: number;
  body: any;
  cookie?: string;
}

async function req(method: string, url: string, opts: { body?: unknown; cookie?: string } = {}): Promise<Res> {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'content-type': 'application/json', ...(opts.cookie ? { cookie: opts.cookie } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const setCookie = res.headers.get('set-cookie');
  const out: Res = {
    status: res.status,
    body: await res.json().catch(() => null),
    // An explicit Set-Cookie replaces the caller's; otherwise keep sending it.
    cookie: setCookie ? setCookie.split(';')[0] : opts.cookie,
  };
  if (process.env.DEBUG && out.status >= 400) debug(`${method} ${url}`, out);
  return out;
}

const login = (identifier: string, password: string) =>
  req('POST', '/auth/login', { body: { identifier, password } });

function tempPasswordOf(res: Res): string {
  return String(res.body?.data?.tempPassword ?? '');
}

async function main() {
  const env = resolveEnv();
  if (!env.mongodbUri) throw new Error('MONGODB_URI is required for this e2e');
  const db = await mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 20000 }).asPromise();

  // A harness-owned admin, so a changed shared password cannot mask a real bug.
  const adminPassword = generateTempPassword();
  const admin = await db.collection('users').insertOne({
    ...userFields({
      organizationId: undefined,
      email: ADMIN_EMAIL,
      fullName: 'E2E Harness Admin',
      passwordHash: await hashPassword(adminPassword),
      role: 'SYSTEM_ADMIN',
    }),
    // userFields leaves emailN to the schema's pre-validate hook, which a raw
    // insert never runs — login matches on emailN, so compute it here.
    emailN: ADMIN_EMAIL.toLowerCase(),
    // The harness is not here to re-test the forced-change flow.
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  try {
    // 1 — platform login
    const adminSession = await login(ADMIN_EMAIL, adminPassword);
    check('SYSTEM_ADMIN logs in', adminSession.status === 201 && !!adminSession.cookie, `status=${adminSession.status}`);
    const adminCookie = adminSession.cookie!;

    check('platform route with no session → 401', (await req('GET', '/platform/organizations')).status === 401);

    // 2 — FR-SYS-01 create org
    const org = await req('POST', '/platform/organizations', { cookie: adminCookie, body: { code: ORG_CODE, name: ORG_NAME } });
    const orgId = String(org.body?.data?._id ?? '');
    check('POST /platform/organizations → 201 ACTIVE', org.status === 201 && org.body?.data?.status === 'ACTIVE',
      `status=${org.status} code=${org.body?.error?.code}`);
    // Everything below needs a real tenant; without one the remaining assertions
    // are noise, so stop and let cleanup run.
    if (!orgId) throw new Error('organization was not created — aborting the run');

    const dup = await req('POST', '/platform/organizations', { cookie: adminCookie, body: { code: ORG_CODE, name: 'again' } });
    check('duplicate org code → 409 ORGANIZATION_CODE_TAKEN',
      dup.status === 409 && dup.body?.error?.code === 'ORGANIZATION_CODE_TAKEN', `status=${dup.status}`);

    const badCode = await req('POST', '/platform/organizations', { cookie: adminCookie, body: { code: 'e2e!!', name: 'x' } });
    check('lowercase/invalid org code → 400 ORGANIZATION_CODE_INVALID',
      badCode.status === 400 && JSON.stringify(badCode.body).includes('ORGANIZATION_CODE_INVALID'), `status=${badCode.status}`);

    // 3 — FR-SYS-02 first HR
    const hr = await req('POST', `/platform/organizations/${orgId}/initial-hr`, {
      cookie: adminCookie,
      body: { email: HR_EMAIL, fullName: 'E2E HR One' },
    });
    const hrTemp = tempPasswordOf(hr);
    check('POST /:id/initial-hr → 201, role HR, mustChangePassword, tempPassword once',
      hr.status === 201 && hr.body?.data?.role === 'HR' && hr.body?.data?.mustChangePassword === true && hrTemp.length >= 8,
      `status=${hr.status} code=${hr.body?.error?.code}`);
    check('initial-hr response carries no passwordHash', hr.body?.data?.passwordHash === undefined);
    check('initial-hr User carries no employeeCode (TASK-120)', hr.body?.data?.employeeCode === undefined);

    const badRole = await req('POST', `/platform/organizations/${orgId}/initial-hr`, {
      cookie: adminCookie,
      body: { email: `x${RUN}@e2e.local`, fullName: 'Wanted', role: 'SYSTEM_ADMIN' },
    });
    check('platform route rejects a payload role → 400 (whitelist pipe)', badRole.status === 400, `status=${badRole.status}`);

    // 4 — HR login + forced change
    const hrSession = await login(HR_EMAIL, hrTemp);
    check('HR logs in with the temp password', hrSession.status === 201, `status=${hrSession.status}`);
    check('HR login reports mustChangePassword', hrSession.body?.data?.mustChangePassword === true);
    const hrCookie = hrSession.cookie!;

    const blocked = await req('GET', '/hr/employees', { cookie: hrCookie });
    check('business route while the temp password is in use → 403 AUTH_PASSWORD_CHANGE_REQUIRED',
      blocked.status === 403 && blocked.body?.error?.code === 'AUTH_PASSWORD_CHANGE_REQUIRED',
      `status=${blocked.status} code=${blocked.body?.error?.code}`);

    const hrPassword = 'E2eHrPass1!';
    const changed = await req('POST', '/auth/change-password', {
      cookie: hrCookie,
      body: { currentPassword: hrTemp, newPassword: hrPassword, confirmPassword: hrPassword },
    });
    check('HR sets a real password', changed.status === 201, `status=${changed.status}`);

    // 5 — Phase C: HR creates their own profile
    check('before self-provisioning, GET /hr/employees/me → 404',
      (await req('GET', '/hr/employees/me', { cookie: hrCookie })).status === 404);

    const me = await req('POST', '/hr/employees/me', {
      cookie: hrCookie,
      body: { employeeCode: HR_SELF_CODE.toLowerCase(), joinDate: '2026-01-01' },
    });
    const meProfileId = String(me.body?.data?._id ?? '');
    check('POST /hr/employees/me → 201 PROBATION, code case-folded by the profile hook',
      me.status === 201 && me.body?.data?.employmentStatus === 'PROBATION' && me.body?.data?.employeeCode === HR_SELF_CODE,
      `status=${me.status} code=${me.body?.error?.code} employeeCode=${me.body?.data?.employeeCode}`);

    const meAgain = await req('POST', '/hr/employees/me', {
      cookie: hrCookie,
      body: { employeeCode: `${HR_SELF_CODE}B`, joinDate: '2026-01-01' },
    });
    check('second self-provision → 409 EMPLOYEE_PROFILE_ALREADY_EXISTS',
      meAgain.status === 409 && meAgain.body?.error?.code === 'EMPLOYEE_PROFILE_ALREADY_EXISTS', `status=${meAgain.status}`);

    const spoof = await req('POST', '/hr/employees/me', {
      cookie: hrCookie,
      body: { employeeCode: `${HR_SELF_CODE}C`, joinDate: '2026-01-01', userId: String(hr.body?.data?._id ?? '') },
    });
    check('self route refuses an explicit userId → 400 USER_ID_NOT_ALLOWED',
      spoof.status === 400 && spoof.body?.error?.code === 'USER_ID_NOT_ALLOWED', `status=${spoof.status}`);

    const eligible = await req('GET', '/hr/employees/eligible-users', { cookie: hrCookie });
    check('HR’s own account is excluded from the link picker',
      eligible.status === 200 && !(eligible.body?.data ?? []).some((u: any) => String(u._id) === String(hr.body?.data?._id)),
      `status=${eligible.status}`);

    // 6 — the code now works as a login identifier
    const byCode = await login(HR_SELF_CODE.toLowerCase(), hrPassword);
    check('login by employeeCode after self-provisioning', byCode.status === 201, `status=${byCode.status}`);
    check('code login returns the profile’s employeeCode',
      byCode.body?.data?.user?.employeeCode === HR_SELF_CODE, `got=${byCode.body?.data?.user?.employeeCode}`);

    // 7 — §4.1: HR adds an employee = creates the EMPLOYEE account
    const created = await req('POST', '/hr/employees', {
      cookie: hrCookie,
      body: { employeeCode: EMP_CODE, fullName: 'E2E Employee', email: EMP_EMAIL, joinDate: '2026-09-01' },
    });
    const empTemp = tempPasswordOf(created);
    check('POST /hr/employees (no userId) → 201 profile + tempPassword, PROBATION',
      created.status === 201 && empTemp.length >= 8 && created.body?.data?.employmentStatus === 'PROBATION',
      `status=${created.status} code=${created.body?.error?.code}`);
    const empProfileId = String(created.body?.data?._id ?? '');
    const empUserId = String(created.body?.data?.userId ?? '');

    const dupEmail = await req('POST', '/hr/employees', {
      cookie: hrCookie,
      body: { employeeCode: `${EMP_CODE}B`, fullName: 'Dup', email: EMP_EMAIL, joinDate: '2026-09-01' },
    });
    check('duplicate email in tenant → 409 EMAIL_TAKEN',
      dupEmail.status === 409 && dupEmail.body?.error?.code === 'EMAIL_TAKEN', `status=${dupEmail.status}`);

    const dupCode = await req('POST', '/hr/employees', {
      cookie: hrCookie,
      body: { employeeCode: EMP_CODE, fullName: 'Dup', email: `z${RUN}@e2e.local`, joinDate: '2026-09-01' },
    });
    check('duplicate employeeCode → 409 EMPLOYEE_CODE_TAKEN',
      dupCode.status === 409 && dupCode.body?.error?.code === 'EMPLOYEE_CODE_TAKEN', `status=${dupCode.status}`);

    const roleFiddling = await req('POST', '/hr/employees', {
      cookie: hrCookie,
      body: { employeeCode: `${EMP_CODE}C`, fullName: 'Wanted', email: `w${RUN}@e2e.local`, joinDate: '2026-09-01', role: 'SYSTEM_ADMIN' },
    });
    check('HR cannot mint a role → 400 (whitelist pipe)', roleFiddling.status === 400, `status=${roleFiddling.status}`);

    const halfBaked = await req('POST', '/hr/employees', {
      cookie: hrCookie,
      body: { employeeCode: `${EMP_CODE}D`, email: `f${Date.now()}@e2e.local`, joinDate: '2026-09-01' },
    });
    check('account mode without fullName → 400 FULLNAME_REQUIRED',
      halfBaked.status === 400 && halfBaked.body?.error?.code === 'FULLNAME_REQUIRED', `status=${halfBaked.status} code=${halfBaked.body?.error?.code}`);

    // 8 — the employee logs in and is in the directory
    const empSession = await login(EMP_EMAIL, empTemp);
    check('provisioned employee logs in', empSession.status === 201, `status=${empSession.status}`);
    check('employee session carries role EMPLOYEE + the code',
      empSession.body?.data?.user?.role === 'EMPLOYEE' && empSession.body?.data?.user?.employeeCode === EMP_CODE,
      `role=${empSession.body?.data?.user?.role} code=${empSession.body?.data?.user?.employeeCode}`);

    const empChanged = await req('POST', '/auth/change-password', {
      cookie: empSession.cookie,
      body: { currentPassword: empTemp, newPassword: 'E2eEmpPass1!', confirmPassword: 'E2eEmpPass1!' },
    });
    check('employee sets a real password', empChanged.status === 201, `status=${empChanged.status}`);

    const directory = await req('GET', '/hr/employees', { cookie: hrCookie });
    const row = (directory.body?.data ?? []).find((r: any) => r.employeeCode === EMP_CODE);
    check('employee appears in the directory with a resolved fullName',
      !!row && row.fullName === 'E2E Employee', `codes=${(directory.body?.data ?? []).map((r: any) => r.employeeCode).join(',')}`);

    // 9 — AC-SELF-APPROVAL-01
    const selfPromote = await req('PATCH', `/hr/employees/${meProfileId}/status`, {
      cookie: hrCookie,
      body: { newStatus: 'ACTIVE', effectiveDate: '2026-09-10', reason: 'self' },
    });
    check('HR promoting their own profile → 403 SELF_APPROVAL_FORBIDDEN',
      selfPromote.status === 403 && selfPromote.body?.error?.code === 'SELF_APPROVAL_FORBIDDEN',
      `status=${selfPromote.status} code=${selfPromote.body?.error?.code}`);

    const otherPromote = await req('PATCH', `/hr/employees/${empProfileId}/status`, {
      cookie: hrCookie,
      body: { newStatus: 'ACTIVE', effectiveDate: '2026-09-10', reason: 'probation completed' },
    });
    check('HR promoting the employee → 200 ACTIVE',
      otherPromote.status === 200 && otherPromote.body?.data?.employmentStatus === 'ACTIVE', `status=${otherPromote.status}`);

    const history = await req('GET', `/hr/employees/${empProfileId}/history`, { cookie: hrCookie });
    check('promotion appended exactly one history row', history.body?.data?.length === 1,
      `rows=${history.body?.data?.length}`);

    // 10 — AC-SYS-02 suspend / activate
    check('HR reads the directory before the suspend',
      (await req('GET', '/hr/employees', { cookie: hrCookie })).status === 200);

    const suspended = await req('POST', `/platform/organizations/${orgId}/suspend`, { cookie: adminCookie });
    check('POST /:id/suspend → SUSPENDED',
      suspended.status === 201 && suspended.body?.data?.status === 'SUSPENDED', `status=${suspended.status}`);

    check('HR’s live session dies on suspend → 401',
      (await req('GET', '/hr/employees', { cookie: hrCookie })).status === 401);

    const refused = await login(HR_EMAIL, hrPassword);
    check('new login for a suspended tenant → 423 TENANT_SUSPENDED',
      refused.status === 423 && refused.body?.error?.code === 'TENANT_SUSPENDED',
      `status=${refused.status} code=${refused.body?.error?.code}`);

    check('platform admin is not tenant-gated',
      (await req('GET', '/platform/organizations', { cookie: adminCookie })).status === 200);

    const reactivated = await req('POST', `/platform/organizations/${orgId}/activate`, { cookie: adminCookie });
    check('POST /:id/activate → ACTIVE',
      reactivated.status === 201 && reactivated.body?.data?.status === 'ACTIVE', `status=${reactivated.status}`);

    const backIn = await login(HR_EMAIL, hrPassword);
    check('login works again after activate', backIn.status === 201, `status=${backIn.status}`);

    // 11 — AC-TENANT-03 + OQ-02 stopgap
    const otherOrg = await req('POST', '/platform/organizations', {
      cookie: adminCookie,
      body: { code: OTHER_ORG_CODE, name: 'E2E Second Corp' },
    });
    const otherId = String(otherOrg.body?.data?._id ?? '');
    const otherHr = await req('POST', `/platform/organizations/${otherId}/initial-hr`, {
      cookie: adminCookie,
      body: { email: HR_EMAIL, fullName: 'E2E HR One' },
    });
    check('same email in a different org → 201 (AC-TENANT-03)', otherHr.status === 201, `status=${otherHr.status}`);

    const ambiguous = await login(HR_EMAIL, hrPassword);
    check('login cannot guess a tenant → 401 AUTH_AMBIGUOUS_IDENTIFIER',
      ambiguous.status === 401 && ambiguous.body?.error?.code === 'AUTH_AMBIGUOUS_IDENTIFIER',
      `status=${ambiguous.status} code=${ambiguous.body?.error?.code}`);

    // 12 — the orgless admin cannot use tenant routes (AC-SYS-01)
    const adminOnTenantRoute = await req('GET', '/hr/employees', { cookie: adminCookie });
    check('SYSTEM_ADMIN on a tenant route → 403 (no organizationId)',
      adminOnTenantRoute.status === 403, `status=${adminOnTenantRoute.status} code=${adminOnTenantRoute.body?.error?.code}`);

    // 13 — at rest
    const hrUser = await db.collection('users').findOne({
      emailN: HR_EMAIL.toLowerCase(),
      // Stored as ObjectId by Mongoose; match the exact value written by the run.
      organizationId: new mongoose.Types.ObjectId(String(hr.body?.data?.organizationId ?? orgId)),
    });
    const empUser = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(empUserId) });
    const empProfile = await db.collection('employee_profiles').findOne({ _id: new mongoose.Types.ObjectId(empProfileId) });
    for (const [label, doc, plaintexts] of [
      ['HR account', hrUser, [hrTemp]],
      ['employee account', empUser, [empTemp, hrTemp]],
      ['employee profile', empProfile, [empTemp, hrTemp]],
    ] as Array<[string, any, string[]]>) {
      const atRest = JSON.stringify(doc ?? {});
      check(`${label}: exists`, !!doc);
      check(`${label}: no plaintext password at rest`, !!doc && plaintexts.every((p) => !atRest.includes(p)));
    }
    check('employee account: bcrypt hash only', /^\$2[aby]\$/.test(String(empUser?.passwordHash ?? '')));
    check('employee account: role EMPLOYEE, mustChangePassword cleared by the change',
      empUser?.role === 'EMPLOYEE' && empUser?.mustChangePassword === false);
    check('employee account: no employeeCode on the User (TASK-120)', empUser?.employeeCode === undefined);
    check('profile owns the code and agrees with the account on email (A3)',
      empProfile?.employeeCode === EMP_CODE && empProfile?.email === empUser?.email);
    // Session revocation is already proven over HTTP (401 right after suspend);
    // this only confirms the harness did not leak rows for another tenant.
    check('the second org’s HR account exists and is separate',
      (await db.collection('users').countDocuments({ emailN: HR_EMAIL.toLowerCase() })) === 2);
  } finally {
    // Leave nothing behind: the orgs, their users, sessions, profiles, history —
    // and the harness admin. Never printed.
    const orgIds = (await db.collection('organizations').find({ code: { $in: [ORG_CODE, OTHER_ORG_CODE] } }).toArray()).map((o) => o._id);
    for (const collection of ['user_sessions', 'employment_histories', 'employee_profiles', 'users']) {
      await db.collection(collection).deleteMany({ organizationId: { $in: orgIds } });
    }
    await db.collection('organizations').deleteMany({ _id: { $in: orgIds } });
    await db.collection('users').deleteMany({ _id: admin.insertedId });
    await db.close();
    console.log(`(cleaned up ${orgIds.length} org(s) and the harness admin)`);
  }

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
  process.exitCode = failures ? 1 : 0;
}

main().catch((err) => {
  console.error('e2e crashed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
