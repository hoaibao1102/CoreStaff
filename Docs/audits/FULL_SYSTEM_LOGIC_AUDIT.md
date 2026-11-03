# FULL SYSTEM LOGIC AUDIT — CoreStaff

**Audit date:** 2026-11-03 (UTC+07:00)  
**Audited revision:** `feat/policy` — `ab08ce339fe9953f86146d7514a9c3b69b67517e`  
**Audit mode:** static source trace + safe local verification; production source was not modified  
**QC verdict:** **NO-GO / NOT READY FOR PRODUCTION**

> **Meaning of “Confirmed Bug”:** the faulty path or violated invariant is confirmed from the audited source/configuration or from a repeatable local command. It does **not** mean the defect has been observed in production data. Runtime incidence remains unknown unless explicitly stated.

## 1. Executive Summary

CoreStaff has a substantial automated test base and several strong controls: session-derived tenant context, DTO whitelisting, private evidence download paths, transaction-backed attendance/close flows, canonical period projections, immutable summary/snapshot identities and 137 passing Mongo replica-set integration tests. These controls do not offset the release-blocking defects found in payroll tenant isolation, period-state bypasses, payroll atomicity, unpublished payslip exposure, closed-period mutation, authorization lifecycle and cross-origin security.

The most severe issue class is **payroll trust-boundary failure**. Several payroll-run, payslip and export operations load resources by global ObjectId without the caller's `organizationId`. A tenant HR user who learns another tenant's ID can reach foreign salary data or mutate a foreign payroll run. The payroll lifecycle also updates `TimesheetPeriod`, `PayrollRun` and `Payslip` in separate commits, so failures can leave contradictory financial state.

The second severe class is **workflow bypass**. The generic timesheet status endpoint can set `READY_TO_CLOSE → CLOSED` and `CLOSED → REVIEWING` without the authoritative close/reopen workflows. Leave approval/application can write facts for dates in a closed period because the invalidation helper silently ignores closed periods. Employees can read `GENERATED` payslips before release.

The third severe class is **security/session lifecycle**. HTTP and Socket.IO reflect/accept every origin while production cookies use `SameSite=None`; there is no centralized CSRF control. Manager compatibility scope can survive assignment revocation, login lockout is not enforced for `ACTIVE` users, and already-connected sockets are not disconnected after logout/password reset/account or tenant revocation.

### Finding totals after deduplication by root cause

| Classification | Critical | High | Medium | Low | Total |
|---|---:|---:|---:|---:|---:|
| **Confirmed Bug** | 9 | 18 | 10 | 0 | **37** |
| **Potential Risk** | 0 | 4 | 4 | 0 | **8** |
| **Needs Verification** | 0 | 2 | 3 | 0 | **5** |

The counts above do not double-count the same payroll tenant or transaction defect reported independently by backend, security and database audit streams.

## 2. Audit Scope & Coverage

### Reviewed

| Area | Coverage achieved |
|---|---|
| Architecture and entry points | Nest local/Vercel entry points, global HTTP config, modules, health, Socket.IO, storage, CI, manifests and deployment documentation |
| Backend/API | All 31 controllers inventoried; high-risk controller → service → schema paths traced for auth, platform, employee, attendance, leave, overtime, manager approvals, policies, timesheet, payroll, payslip and export |
| Authorization | AuthGuard/RolesGuard, tenant context, manager assignment/scope, employee ownership, evidence/document download and socket room assignment |
| Database | All 40 `*.schema.ts` files and 48 registered models inventoried; unique indexes, transactions, CAS, idempotency and migration/index scripts reviewed |
| Web | Routing/session/API transports plus major attendance, leave, manager, timesheet, payroll, payslip, compensation, tax, insurance, employee and scheduling screens |
| Expo mobile | Auth/session, attendance, leave, overtime, overview, profile, payslip and realtime contracts |
| Flutter mobile | API config, auth/session implementation, role shell and all implemented/placeholder tabs |
| Cross-module | Attendance/leave/OT → period version/review/close → summary/snapshot → payroll/payslip; session revocation → HTTP/socket; deployment → storage/realtime/health |
| Documentation | `Docs/SRS_CORESTAFF.md`, decision log, current architecture/context, timesheet/period mutation docs and mobile/deployment READMEs |

### Not fully reviewed or not runtime-verified

- The audit did not perform a statement-by-statement review of every one of the 855 tracked `CoreStaff/**` files. Generated native Flutter host files, static assets, historical seed variants and low-risk presentational code were inventoried but not fully traced.
- No production/staging database, real tenant data, production indexes, migration, seed, `ensure-indexes`, S3 bucket, email provider, reverse proxy, CDN, Vercel deployment, geocoding provider or live WebSocket cluster was accessed.
- Browser E2E with mocked routes could not start because one Playwright spec has a parse error. Real-backend browser E2E was not available.
- No Android/iOS device execution, process-death cookie test, camera/GPS/Wi-Fi test or Flutter release build was performed.
- No backup/restore, disaster recovery, primary stepdown, ambiguous transaction commit or multi-instance Socket.IO test was performed.
- The untracked file `Docs/PLAN_ATTENDANCE_CLARIFICATION_FLOW.md` appeared during the audit and was not created, read as authoritative, modified or deleted by this audit.

Coverage is therefore broad and risk-directed, but **not a claim that every file and every deployed path has been fully tested**.

## 3. System Architecture Overview

CoreStaff is a modular monolith:

```text
React Web / Expo / Flutter
        │ REST + cookie session; Web/Expo also Socket.IO
        ▼
NestJS API (/api) ─ AuthGuard/RolesGuard/tenant context
        │
        ├─ Platform/Auth
        ├─ Attendance + evidence
        ├─ HR catalogs/employee/scheduling
        ├─ Leave/OT/manager approvals
        ├─ Timesheet review/close/versioning
        └─ Payroll/payslip/export
        │
        ├─ MongoDB replica set (Mongoose)
        ├─ private S3-compatible storage
        └─ Photon/BigDataCloud geocoding
```

The intended financial flow is:

```text
attendance + leave + OT + schedule/policy
  → canonical period obligations/version
  → employee review + manager confirmation
  → transactional period close
  → immutable summaries and payroll input snapshots
  → payroll run bound to exact snapshot IDs/hashes
  → calculation → lock → payslip release
```

The audited code violates this intended boundary in three places: generic period status mutation bypasses close/reopen; payroll calculation still resolves live PIT/profile/policy inputs; and payroll lifecycle writes are not one atomic transaction.

## 4. Business Logic Findings

1. Periods can be closed/reopened through a generic status endpoint without close/reopen invariants (`AUD-C01`).
2. Leave facts can be approved/applied after a period is closed (`AUD-C05`).
3. Employees can view generated, unreleased salary artifacts (`AUD-C04`).
4. Payroll outputs are not reproducible solely from the frozen snapshot (`AUD-C06`).
5. Generic manager approval permits self-approval (`AUD-H01`).
6. Manager authority can persist from profile fallback after assignment revocation (`AUD-H02`).
7. Attendance can choose an active-but-not-effective assignment (`AUD-H03`).
8. Payroll separation of duties and snapshot-population completeness are not enforced (`AUD-H04`, `AUD-H05`).
9. Concurrent leave and period creation can violate overlap/single-active invariants (`AUD-H10`, `AUD-H11`).
10. OT approval accepts an incomplete approved interval (`AUD-M01`).

## 5. Backend & API Findings

- Payroll lifecycle and payslip/export routes are not consistently tenant-scoped (`AUD-C02`, `AUD-C03`).
- Payroll create/calculate/lock/release use multiple non-transactional writes (`AUD-C07`, `AUD-C08`).
- Login lockout, rate limiting and account/session enforcement are incomplete (`AUD-H06`, `AUD-H08`).
- Generic approval and financial lifecycle audit trails are incomplete (`AUD-H07`, `AUD-H09`).
- HTTP CORS/CSRF and Socket.IO origin handling are release blockers (`AUD-C09`).
- Attendance uses a separate request transport without shared refresh/session-expiry behavior (`AUD-M05`).
- Generic frontend-facing envelopes are not runtime-validated (`AUD-M06`).

## 6. Frontend Findings

- Web business-date defaults and date-only rendering mix UTC, local timezone and Vietnam timezone (`AUD-M07`).
- Cross-tab logout/session expiry is not propagated (`AUD-M08`).
- Payroll initial-load failures can be presented as legitimate empty data (included under `AUD-M06` impact).
- Attendance success time/location can be synthesized from client/workplace data instead of authoritative event evidence (included in `AUD-M07`/regression roadmap).
- Playwright E2E is currently blocked by invalid regex syntax (`AUD-M09`).
- Expo ignores attendance evidence-policy flags (`AUD-H18`).
- Flutter release configuration/session storage are unsafe and the Flutter test scaffold does not compile (`AUD-H16`, `AUD-H17`, `AUD-M10`).

## 7. Database Integrity Findings

- Cross-collection payroll transitions lack a common transaction (`AUD-C07`, `AUD-C08`).
- Leave overlap, active-period overlap and manager-assignment overlap are read-check-write races without a database-enforced serialization boundary (`AUD-H10`–`AUD-H12`).
- Organization provisioning is a non-resumable sequence of writes (`AUD-H13`).
- `EmployeeDayOverride` uniqueness allows multiple rows per employee/date while some contracts describe one canonical row (`AUD-M02`).
- Production index synchronization uses `syncIndexes()` and actual production index state was not verified (`RISK-DB01`).

## 8. Cross-Module Findings

- Period state can say `CLOSED` without summaries/snapshots, or `REVIEWING` without a version bump/reopen reason (`AUD-C01`).
- Leave/attendance facts can diverge from closed summaries and payroll snapshots (`AUD-C05`).
- PayrollRun, TimesheetPeriod and Payslip can disagree after a partial failure (`AUD-C07`, `AUD-C08`).
- Session/account/tenant revocation does not terminate already-connected socket authorization (`AUD-H07`, `AUD-H08`).
- Storage configuration documented for IAM roles is rejected by the application readiness check (`AUD-H14`).
- Vercel serverless deployment is not proven compatible with stateful Socket.IO rooms (`RISK-ARCH01`).

## 9. Edge Cases & Concurrency Risks

The audit explicitly considered duplicate submission, competing users, timeout-after-commit, stale browser tabs, period close races, database errors between writes, server restart, policy/date boundaries and revoked permissions. Confirmed failures include:

- failure after period payroll claim but before PayrollRun insertion;
- failure after PayrollRun state change but before TimesheetPeriod change;
- two leave requests passing the same overlap pre-check;
- two different periods passing the “no active period” pre-check;
- stale/revoked socket remaining subscribed;
- UTC date defaults between 00:00 and 06:59 Vietnam time;
- retry after an ambiguous attendance timeout receiving a new idempotency key (`RISK-FE01`).

## 10. Detailed Bug Report

### Confirmed Critical

| Bug ID | Module / location | Description & root cause | Reproduction scenario | Expected / actual | Impact | Recommended fix | Verification |
|---|---|---|---|---|---|---|---|
| **AUD-C01** | Timesheet; `timesheet-period.controller.ts:228-248`, `timesheet-period.service.ts:803-848`, authoritative flows `887-1043` | Generic `updateStatus()` permits close/reopen transitions and uses ID-only last-write update. It bypasses blockers, confirmations, summaries, snapshots, version bump, payroll claim and reason. | HR PATCHes status from `READY_TO_CLOSE` to `CLOSED`, or `CLOSED` to `REVIEWING`. | Expected only `/close`/`/reopen`; actual direct state update. | Invalid period state and missing financial artifacts. | Forbid transitions into/out of CLOSED in generic endpoint; use tenant-scoped version CAS and specialized workflows only. | HTTP tests for forbidden generic transitions; concurrent close/reopen with artifact reconciliation. |
| **AUD-C02** | Payroll; `payroll-run.controller.ts:44-73`, `payroll-run.service.ts:183-197,290-385,453-455` | Calculate/recalculate/lock/release load run with `findById`; caller tenant is never passed. Later CAS trusts the foreign row's tenant. | HR tenant A calls lifecycle endpoint with tenant B run ID. | Expected indistinguishable 404; actual foreign run can be mutated. | Cross-tenant payroll integrity breach. | Pass caller `organizationId` into every mutation and scope every dependent query/CAS. | Two-tenant integration tests for all four mutations and unchanged foreign artifacts. |
| **AUD-C03** | Payslip/export; `payslip.controller.ts:87-120`, `payslip.service.ts:347-380,475-528`, `payroll-export.controller.ts:14-52`, `payroll-export.service.ts:27-68,162-225` | List, summary, release and export treat payrollRunId as a global capability and omit tenant filters. | HR A requests B's run list/summary/CSV/XLSX/release. | Expected 404; actual foreign salary data or release transition. | Cross-tenant disclosure of salary/tax/insurance and foreign release. | Tenant-scope run, payslip, employee, department and position queries; consolidate release path. | Same/foreign/unknown ID matrix for every format/action. |
| **AUD-C04** | Payslip; `payslip.service.ts:389-456` | Employee self-service explicitly includes `GENERATED` and can mark it `VIEWED` before release. | Calculate payroll but do not release; employee calls `/payslips/me`. | Expected only `RELEASED|VIEWED`; actual generated draft is visible/mutable. | Premature salary disclosure; VIEWED may block recalculation. | Exclude GENERATED; mark viewed only from RELEASED and verify owning run release state. | Calculate→hidden; release→visible; direct pre-release ID rejected. |
| **AUD-C05** | Leave/period; `leave.service.ts:158-193,215-281`, `period-version.service.ts:108-137` | Approval/application relies on a bump helper that excludes CLOSED periods instead of rejecting the write. | Close period, then approve/apply leave covering it. | Expected atomic rejection until reopen; actual leave/attendance mutation can commit. | Closed snapshot and source facts diverge. | Claim each affected period/date in the same transaction and fail on CLOSED/payroll-claimed state. | Replica-set tests for create/approve/apply against CLOSED and claimed periods. |
| **AUD-C06** | Payroll/PIT; `payroll-run.service.ts:219-230,421-432`, `pit.service.ts:47-78,296-304`, `payslip.service.ts:139-190` | Calculation resolves live insurance policy, dependents/profile and PIT policy after close despite frozen snapshot fields. | Close period, edit dependent or policy, then calculate/recalculate. | Expected identical result from bound snapshot; actual result can change with live master data. | Non-reproducible payroll and broken audit lineage. | Freeze all PIT/insurance inputs and use pure calculators over snapshot payload only. | Mutate live data after close; output/hash must remain byte-identical. |
| **AUD-C07** | Payroll create; `payroll-run.service.ts:90-128` | Period is claimed before sequence calculation/PayrollRun insert, outside a transaction. | Inject insert failure or crash after claim. | Expected both rollback; actual dangling `payrollRunId` claim. | Period stuck; reopen/retry blocked. | Transactional claim+insert; atomic sequence/counter; recovery reconciler for existing dangling claims. | Fault injection after claim and concurrent create. |
| **AUD-C08** | Payroll lifecycle; `payroll-run.service.ts:228-276,305-385`, `payslip.service.ts:347-386` | Payslips, run and period transition in separate writes; a second release implementation lacks CAS/transaction. | Fail between any two writes or run two releases concurrently. | Expected one all-or-nothing idempotent transition; actual partial committed state. | Financial state disagreement and false error responses after commit. | One transactional orchestration with expected versions and transactional outbox. | Failpoint after each write; one winner under concurrency; exactly one notification event. |
| **AUD-C09** | HTTP/socket security; `configure-app.ts:6-8`, `events.gateway.ts:16-23`, `session-cookies.ts:20-26` | Every Origin is reflected/accepted with credentials and `SameSite=None`; no centralized CSRF/Origin gate. | Malicious HTTPS origin sends credentialed mutation or opens `/events`. | Expected allowlisted origin + CSRF proof; actual ambient cookie is accepted cross-site. | Cross-site state changes and live HR/payroll event disclosure. | Exact production allowlist, CSRF token/Origin/Sec-Fetch-Site checks, socket ticket/origin validation. | Hostile-origin HTTP and WebSocket negative tests covering all unsafe methods/uploads. |

### Confirmed High

| Bug ID | Module / location | Description & root cause | Reproduction scenario | Expected / actual | Impact | Recommended fix | Verification |
|---|---|---|---|---|---|---|---|
| **AUD-H01** | Manager approval; `manager-request.service.ts:287-355` | Self-approval is tagged for audit but allowed. | Manager approves own attendance/OT/general request. | Expected 403/delegation; actual APPROVED. | User can legitimize own payable facts. | Block before precheck/write; route to HR/delegate. | Per-request-type no-write tests. |
| **AUD-H02** | Manager scope; `manager-assignment.service.ts:38-78`, `manager-scope.service.ts:32-46,139-142` | Deactivation does not revoke role; profile department fallback continues granting authority. | Deactivate last assignment; reuse current/new session. | Expected no manager scope; actual profile department remains authorized. | Stale approval/KPI/data access. | Derive authority only from effective assignments; revoke role/session/socket; migrate legacy data. | Expired/inactive/no-assignment matrix. |
| **AUD-H03** | Attendance; `attendance.service.ts:159-169,403-416,702-711` | `active:true` assignment is selected without effective date or deterministic overlap handling. | Keep future/expired assignment active and check in. | Expected effective assignment for work date; actual arbitrary active row. | Wrong workplace/shift/department and pay facts. | One effective-dated resolver that fails closed on overlap. | Future/expired/overlap/history tests. |
| **AUD-H04** | Payroll lifecycle/schema; payroll-run schema/service | `lockedBy` and lifecycle actor fields exist, but create/calculate/lock/release do not enforce distinct actors or formal approval stage. | Same HR creates, calculates, locks and releases. | Expected approved separation policy; actual one actor can complete lifecycle. | Fraud/error control gap. | Approve SoD policy; add reviewer/approver states and actor constraints. | Same-actor denial and authorized exception audit tests. |
| **AUD-H05** | Payroll create/snapshots; `payroll-run.service.ts:56-86,171-176` | Run accepts a non-empty bound snapshot set but does not prove it covers the complete eligible population before claim. | Remove/omit one employee snapshot then create run. | Expected population reconciliation; actual incomplete set can be claimed. | Employee omitted from payroll. | Compare canonical eligible employee IDs/count/hash to exact snapshot set. | Missing/duplicate/foreign/stale snapshot tests. |
| **AUD-H06** | Auth; `auth.service.ts:67-69,346-351` | Failed login sets `lockedUntil` but login blocks only when status is `LOCKED`; status remains ACTIVE. Counter update is also non-atomic. | Five failures then correct password before expiry. | Expected 423; actual login proceeds. | Brute-force protection ineffective. | Enforce `lockedUntil` independently; atomic `$inc`/threshold update. | Threshold, expiry and parallel-attempt tests. |
| **AUD-H07** | Socket authorization; `events.gateway.ts:36-102,110-180` | Session/user checked only at connect; logout, password reset and tenant suspension revoke DB sessions but do not disconnect sockets. Exceptions also leave socket connected. | Connect, revoke session/tenant, emit event. | Expected disconnect/no delivery; actual old room membership persists. | Sensitive realtime data after revocation. | Bind sockets to session/user/tenant; disconnect on revocation and in catch; bounded reauth. | Logout/reset/disable/suspend/reconnect tests. |
| **AUD-H08** | HTTP/socket account status; `auth.guard.ts:48-57`, `events.gateway.ts:47-64` | Protected requests and new sockets do not require user `ACTIVE`; refresh and `/me` do, creating inconsistent policy. | Disable/lock user without complete session cleanup. | Expected immediate denial; actual protected API/socket accepted. | Continued access after account disable. | Enforce ACTIVE in central guard/gateway plus mandatory revocation. | Existing and new connections for disabled/locked users. |
| **AUD-H09** | Auditability; `timesheet-period.service.ts:803-1043`, payroll lifecycle services, `manager-request.service.ts:320-355` | Critical close/reopen/payroll/generic decisions do not consistently append immutable AuditLog/ApprovalHistory in the same transaction. | Perform transition then inspect immutable history. | Expected one committed audit row; actual state may have no reconstructable decision chain. | Financial/nonrepudiation investigation gap. | Shared idempotent transaction-bound audit writer with before/after, actor, version and operation ID. | Commit/rollback/retry audit cardinality tests. |
| **AUD-H10** | Leave creation; `leave.service.ts:93-105`, leave schema indexes | Overlap pre-check and request/action inserts are not serialized or transactional. | Two concurrent overlapping submissions. | Expected one request+SUBMIT action; actual both can insert or action can be missing. | Double leave and incomplete audit trail. | Transaction request+action; per-employee/date/interval claim or serialization guard. | Barrier race and action-write failpoint. |
| **AUD-H11** | Timesheet period create; `timesheet-period.service.ts:110-154`, schema index | “One active period” and overlap are read-check-write; unique index protects only same period key. | Concurrently create two different period keys. | Expected one active period; actual both can be active/overlap. | Work-date resolution becomes ambiguous and mutations fail. | Tenant active-slot/period-date claim protected by transaction/unique guard. | Concurrent create with different keys. |
| **AUD-H12** | Manager assignment; `manager-assignment.service.ts:38-71` | Overlap pre-check races; assignment and user-role projection are separate writes. | Concurrent overlapping assignments or role update failure. | Expected no overlap and consistent role; actual overlap/drift. | Incorrect manager authority. | Transaction and serialized effective-window claim; derive role where possible. | Barrier race and role-update failpoint. |
| **AUD-H13** | Tenant provisioning; `platform.service.ts:66-166` | Organization, policies and periods are written sequentially without transaction or resumable state. | Fail after organization insert. | Expected all-or-nothing/resumable; actual half-provisioned tenant and duplicate-code retry block. | New tenant unusable without manual repair. | Transaction or durable idempotent provisioning state machine. | Failpoint at every step and retry completion. |
| **AUD-H14** | S3 storage; `storage.service.ts:31-71`, API env template | AWS SDK client can use default credentials, but `isConfigured()` rejects configuration without explicit access keys, contradicting IAM-role deployment guidance. | Deploy on EC2 IAM role with bucket/region only. | Expected provider chain; actual `STORAGE_NOT_CONFIGURED`. | Selfie/document flows fail in recommended production setup. | Treat bucket+client as configured; let provider chain resolve credentials; readiness smoke. | Inject/default-provider tests and private bucket put/get/delete smoke. |
| **AUD-H15** | Flutter release; `api_config.dart:29-87` | Release hard-codes `http://10.87.51.1:3000` and has no build-time override. | Build release outside private LAN. | Expected configured HTTPS API; actual health probe fails/insecure HTTP. | Flutter release cannot operate. | `String.fromEnvironment`, HTTPS-only release flavor and CI smoke. | Release build with explicit API base on Android/iOS. |
| **AUD-H16** | Flutter session; `api_client.dart:25-88` | `sid`/`rt` are parsed and stored plaintext in SharedPreferences, defeating HttpOnly storage protection. | Inspect app preferences after login. | Expected OS secure store/cookie jar; actual reusable tokens in plaintext preferences. | 14-day credential theft on backup/root/debug compromise. | Secure cookie jar or Keychain/Keystore storage; remove legacy keys. | Assert no tokens in SharedPreferences and restart/logout behavior. |
| **AUD-H17** | Expo attendance; `employee-api.ts:48-51`, `AttendanceScreen.tsx:57-89` | Client hard-codes Wi-Fi→GPS→selfie and ignores `allowWifiAttendance`, `allowGpsAttendance`, `allowSelfieFallback`. | Disable GPS/selfie in workplace policy and make Wi-Fi fail. | Expected no forbidden prompt; actual location/camera still requested. | Policy violation, privacy overcollection and late server failure. | Build evidence plan from server flags. | Full allow-flag matrix and permission-call assertions. |
| **AUD-H18** | CI/release gate; `.github/workflows/ci.yml:18-24`, package scripts | CI omits API integration, Playwright, Expo tests and Flutter gates; E2E currently does not parse. | Merge code with failing integration/mobile/E2E while root unit gate is green. | Expected mandatory release lanes; actual unexecuted paths. | Production regressions escape green CI. | Separate required jobs with skip allowlist and artifacts. | Deliberately break each lane and prove CI blocks merge. |

### Confirmed Medium

| Bug ID | Module / location | Description & root cause | Reproduction scenario | Expected / actual | Impact | Recommended fix | Verification |
|---|---|---|---|---|---|---|---|
| **AUD-M01** | OT approval; `manager-request.service.ts:302-313,326-350` | Validation checks ordering only if both endpoints exist; one endpoint can persist. | Approve with start-only or end-only. | Expected both-or-neither rejection; actual incomplete interval accepted. | OT minutes/intent divergence. | Cross-field DTO+service validation and normalized interval. | Start-only/end-only/reversed/off-date tests. |
| **AUD-M02** | Leave override; `employee-day-override.schema.ts:27-28`, `leave.service.ts:232-244` | Unique identity includes `leaveRequestId`, allowing multiple rows per employee/date while some consumers/contracts assume one row. | Apply two partial requests same date. | Expected one deterministic aggregate or explicit multi-row model; actual ambiguous cardinality. | Order-dependent workday classification. | Decide model; enforce one row or make all consumers deterministic aggregators. | Concurrent same-day apply and reconciliation. |
| **AUD-M03** | Auth refresh; `auth.service.ts:119-151`, session schema | Refresh token is reusable for 14 days without rotation/reuse detection despite schema comments. | Replay same copied `rt` repeatedly. | Expected rotation/family detection; actual repeated new access sessions. | Larger stolen-token blast radius. | Atomic rotation with bounded multi-tab grace and family revocation. | Replay and concurrent-refresh policy tests. |
| **AUD-M04** | Evidence serialization; `evidence.schema.ts:14-31`, `attendance.service.ts:191-198,1043-1051`, `manager-request.service.ts:182-206` | Populated evidence is returned without projection, leaking storage key/hash/retention internals. | Read attendance/manager detail with selfie evidence. | Expected safe DTO; actual internal metadata serialized. | Increases impact of storage/IAM misconfiguration. | Explicit projection/mapper; expose only stable evidence ID and authorized download path. | Recursive response assertions for forbidden fields. |
| **AUD-M05** | Web attendance transport; `attendance.service.ts:92-122`, shared auth/HR transports | Attendance fetch does not use common 401 refresh/retry/signed-out flow. | Access cookie expires during check-in/today load. | Expected single refresh+retry or logout; actual attendance error/stale workspace. | False check-in failure and trapped session. | One authenticated transport; preserve idempotency key across retry. | GET/POST 401 refresh success/failure tests. |
| **AUD-M06** | Web API/state; `auth.ts:22-25,97-109`, `hrService.ts:575-653`, payroll initial loaders | Success envelopes and payload shapes are cast, not runtime-validated; payroll load errors are logged and rendered as empty state. | Return 200 missing `data`, wrong shape, or 500 payroll list. | Expected contract/error state; actual undefined/NaN/crash or “no data”. | Misleading HR/payroll UI and delayed contract failures. | Generated/runtime schemas and explicit loading/error/empty states. | Malformed payload and partial-load tests. |
| **AUD-M07** | Web date/time; multiple screens including `AttendanceScreen.tsx:220-223`, leave/calendar/KPI/tax screens | Business dates use `toISOString()` UTC and date-only strings are sometimes passed through local `Date`. | Use app 00:30 Vietnam time or non-UTC+7 device. | Expected Vietnam calendar date; actual previous date/month or inconsistent instant. | Wrong leave/policy/calendar/KPI effective date. | Central date-only/business-time helpers; lint ban on `new Date(dateOnly)`/ISO slicing. | Multi-timezone midnight/month-boundary tests. |
| **AUD-M08** | Web session; `session.ts:1-13`, `App.tsx:88-99`, `auth.ts:47-53` | Logout/session-expiry uses same-window event only; no `storage` listener/BroadcastChannel. | Logout in tab A while tab B displays payroll. | Expected immediate purge; actual tab B retains sensitive screen until API failure. | Stale sensitive data after perceived logout. | Broadcast session events and clear cached state. | Two-tab logout/expiry/account-switch tests. |
| **AUD-M09** | Web E2E; `e2e/dependents-tax.spec.ts:371` | Regex `/trùng/lấp chồng|đã tồn tại/i` has an unescaped slash, so Playwright cannot parse any suite. | Run `npm run test:e2e --workspace @corestaff/web`. | Expected tests execute; actual SyntaxError before collection. | Browser gate provides zero current evidence. | Correct regex and add parse/list gate in CI. | `playwright test --list`, then full Chrome suite. |
| **AUD-M10** | Flutter tests/logout; `test/widget_test.dart:16`, `main.dart`, role-block logout path | Test scaffold references nonexistent `MyApp`; analyze/test fail. HR/System Admin role-block logout resets UI without calling server logout. | Run Flutter analyze/test; or logout from role-block and restart. | Expected green test and revoked session; actual compile failure/persisted credentials. | No Flutter regression gate and misleading logout. | Test `CoreStaffApp`; use one logout service path in `finally`; secure credential cleanup. | Analyze/test pass and role-block logout service assertion. |

## 11. Risk Assessment

### Potential Risks (not yet proven as application exploits/runtime failures)

| ID | Severity | Evidence and risk | Required verification |
|---|---|---|---|
| **RISK-DEP01** | High | `npm audit --omit=dev` reports 31 production-tree advisories: 1 critical, 11 high, 18 moderate, 1 low. Installed Express chain includes `proxy-addr@2.0.7`, `multer@2.2.0`, `body-parser@2.3.0`. Registry severity alone does not prove reachability. | Resolve dependency graph and endpoint reachability; upgrade safely; abuse tests for trusted proxy/IP and multipart abort/field-name cases. |
| **RISK-DB01** | High | `syncIndexes()` across all models can drop/create indexes incrementally; production inventory/backfill state is unknown. | Read-only production/staging index diff, duplicate inventory, approved versioned migration and rollback. |
| **RISK-ARCH01** | High | Vercel serverless adapter coexists with in-memory stateful Socket.IO rooms without shared adapter. | Deployed WebSocket/multi-instance smoke or choose persistent host/shared adapter. |
| **RISK-FE01** | High | Web attendance generates a new idempotency key for a new click after ambiguous timeout; stale response suppression is absent in attendance/payslip loaders. | Deterministic delayed-response and timeout-after-commit tests. |
| **RISK-DB02** | Medium | One-node replica integration tests do not exercise primary stepdown, `UnknownTransactionCommitResult` or callback replay. | Three-node/managed test lane with failover and ambiguous commit. |
| **RISK-MIG01** | Medium | Several multi-collection migration scripts have no common ledger/checkpoint/reconciliation standard. | Interrupt/restart each migration on a disposable production-like snapshot. |
| **RISK-EXT01** | Medium | Browser/backend send coordinates to Photon/BigDataCloud; privacy basis, quota, timeout and provider-failure behavior are not proven. | Legal/privacy review and provider outage/rate-limit tests. |
| **RISK-WEB01** | Medium | Unknown-route dashboard fallback and multiple async loaders can hide broken links or display stale results. | Full role×route matrix and delayed-response browser tests. |

### Needs Verification

| ID | Severity | Unknown | Evidence required |
|---|---|---|---|
| **NV-01** | High | Actual production tenant/index/data integrity after historical migrations. | Read-only reconciliation: dangling payroll claims, cross-tenant references, duplicate overlaps, snapshot completeness and index manifest. |
| **NV-02** | High | Real-backend end-to-end close→payroll→release authorization and durability. | Disposable or staging replica-set HTTP/browser run with two tenants and failure injection. |
| **NV-03** | Medium | Expo cookie persistence/sharing across fetch and Socket.IO on Android/iOS after process death. | Device matrix login→restart→refresh→socket→logout. |
| **NV-04** | Medium | S3/R2 bucket IAM, public-access block, encryption, retention and orphan cleanup. | Infrastructure policy review and private-object smoke. |
| **NV-05** | Medium | Frontend insurance-salary preview legal/business formula and production reverse-proxy trusted-IP boundary. | Payroll/legal approval, backend parity tests and deployment proxy/IP spoof tests. |

### Risk priority

- **P0:** `AUD-C01`–`AUD-C09`, especially cross-tenant payroll/payslip/export and non-atomic financial lifecycle.
- **P1:** stale manager authority, self-approval, lockout/session/socket lifecycle, concurrent creation invariants, storage/Flutter blockers and CI gates.
- **P2:** contract/runtime validation, date/time consistency, evidence DTOs, refresh rotation and override cardinality.

## 12. Remediation Roadmap

### Phase 0 — Immediate containment

1. Disable or firewall payroll lifecycle/export/payslip-run endpoints until tenant scoping is patched and cross-tenant tests pass.
2. Disable generic transitions into/out of `CLOSED`; expose only authoritative close/reopen commands.
3. Stop employee access to `GENERATED` payslips.
4. Replace permissive HTTP/Socket.IO origin handling with an exact allowlist and add CSRF protection.
5. Do not ship Flutter release; do not treat current Playwright lane as passing.

### Phase 1 — Financial/data invariants

1. Transactionalize payroll claim+run insert and every lifecycle transition across run/period/payslips/audit/outbox.
2. Eliminate duplicate release orchestration.
3. Make calculation consume only frozen PIT/insurance/dependent policy inputs.
4. Enforce exact eligible population and separation of duties.
5. Add recovery/reconciliation for dangling claims and partial historical transitions.

### Phase 2 — Authorization and concurrency

1. Remove profile fallback from authorization and implement assignment revocation/session/socket invalidation.
2. Block self-approval across all request types.
3. Enforce active account in central guard/gateway and fix atomic lockout/rate limiting.
4. Add serialized guards for leave overlap, active period and manager-assignment effective windows.
5. Reject closed/payroll-claimed period source mutation transactionally.

### Phase 3 — Clients, operations and release evidence

1. Standardize Web authenticated transport, runtime contracts, Vietnam date handling and stale-response suppression.
2. Honor Expo attendance policy flags and run real-device session/evidence tests.
3. Secure/configure Flutter or formally mark it non-production.
4. Replace broad `syncIndexes()` with reviewed versioned index migrations.
5. Add mandatory CI jobs for integration, browser, Expo and Flutter.
6. Validate dependency upgrades and production topology/storage/readiness.

## 13. Regression Test Checklist

### Tenant and authorization

- [ ] Every payroll run mutation with foreign tenant ID returns the same 404 as unknown ID.
- [ ] Payslip list/summary/release and all export formats reject foreign run IDs.
- [ ] Deactivated/expired manager assignment removes HTTP and socket authority immediately.
- [ ] Self-approval is rejected for attendance, OT, adjustment and confirmation.
- [ ] Disabled/locked user sessions fail HTTP and socket authorization.

### Period/leave/OT

- [ ] Generic status endpoint cannot enter or leave CLOSED.
- [ ] Close/reopen concurrency yields one winner and consistent summaries/snapshots/version.
- [ ] Leave create/approve/apply in CLOSED or payroll-claimed period leaves no writes.
- [ ] Concurrent overlapping leave creates yield one request and one SUBMIT audit.
- [ ] Concurrent active-period creates yield one valid period.
- [ ] OT approved interval requires both endpoints and valid work-date ordering.

### Payroll

- [ ] Failure after period claim rolls back claim and run.
- [ ] Failure after each calculate/lock/release write rolls back every collection.
- [ ] Retry after timeout returns prior result without duplicate payslips/events.
- [ ] Live profile/policy edits after close do not alter calculation.
- [ ] Missing/duplicate/stale/foreign snapshot sets are rejected.
- [ ] Employee cannot list/read/view a generated payslip before release.
- [ ] Actor separation rules and immutable audit records are enforced.

### Security/session

- [ ] Hostile Origin cannot make credentialed unsafe HTTP requests or connect Socket.IO.
- [ ] Valid unsafe request requires CSRF proof.
- [ ] Login threshold works under parallel attempts and public auth endpoints rate-limit.
- [ ] Refresh token rotates and replay policy is deterministic.
- [ ] Logout/password reset/account disable/tenant suspend disconnects sockets.

### Web/mobile

- [ ] Playwright parses and runs all specs; browser console errors fail tests.
- [ ] Two-tab logout/session expiry clears sensitive UI.
- [ ] Attendance 401 refresh retries once with the same idempotency key.
- [ ] Vietnam midnight/month boundaries are correct under multiple host timezones.
- [ ] Malformed API payload produces contract error, not empty/NaN/crash.
- [ ] Expo never requests GPS/camera when policy disables it.
- [ ] Flutter release uses configured HTTPS and stores no tokens in SharedPreferences.
- [ ] Flutter analyze/test/build are green.

### Operations

- [ ] Mongo readiness verifies connectivity, replica-set transaction support and required schema/index version.
- [ ] S3 default credential chain and private bucket put/get/delete pass.
- [ ] Index migration dry-run inventories duplicates and has rollback.
- [ ] Backup restore and primary failover are rehearsed.
- [ ] Multi-instance Socket.IO room delivery/revocation is proven.

## 14. Audit Limitations

1. Static trace proves reachable code behavior but not that a particular production tenant has already been affected.
2. Passing unit/integration tests characterize current tested behavior; they do not invalidate uncovered counterexamples listed in this report.
3. API integration used a disposable one-node in-memory replica set. It did not validate Atlas configuration, production indexes, failover or durability across process/host failure.
4. Playwright did not execute because test parsing failed. No browser result can be claimed for this revision.
5. Flutter analyze failed before tests ran; no Flutter runtime/device result can be claimed.
6. Dependency advisories were not promoted to confirmed exploitable application vulnerabilities without reachability analysis.
7. Business-policy questions requiring HR/legal authority—insurance basis, overtime/leave scope and payroll SoD—remain explicit decision gates.
8. Deployment controls outside the repository may reduce or increase several risks; none were assumed to exist without evidence.

## 15. Final QC Verdict

**NO-GO / NOT READY FOR PRODUCTION.**

There is sufficient evidence to reject production deployment of this revision for multi-tenant HR/payroll use. The blocking reasons are not cosmetic or test-coverage-only: confirmed source paths permit cross-tenant payroll operations, bypass authoritative close/reopen logic, expose unreleased payslips, mutate facts behind a closed period, calculate from live rather than frozen financial inputs, and leave payroll state partially committed.

A production decision should be reconsidered only after all Critical findings are fixed, the High authorization/transaction issues are closed, cross-tenant and failure-injection tests pass, Playwright and Flutter gates are executable, and production-like database/storage/realtime evidence is collected.

## Verification Evidence Executed During This Audit

| Command | Result |
|---|---|
| `npm run lint` | PASS — API and Web TypeScript |
| `npm run build` | PASS — API + Web; Web warned on 1,450.28 kB main JS chunk |
| `npm test` | PASS — API 88 suites/1052 tests (1 suite/7 tests skipped); Web 34 suites/256 Jest + 17 Node tests |
| `npm run test:integration --workspace @corestaff/api` | PASS — 14 suites/137 tests on disposable replica set; repeated duplicate-index warnings; child required SIGKILL after SIGINT timeout |
| `npm run lint:mobile` | PASS — Expo TypeScript |
| `npm run test:e2e --workspace @corestaff/web` | **FAIL before collection** — invalid regex at `e2e/dependents-tax.spec.ts:371` |
| `flutter.bat analyze && flutter.bat test` | **FAIL at analyze** — `test/widget_test.dart:16` references nonexistent `MyApp`; test did not run |
| `npm audit --omit=dev --json` | Exit 1 — 31 production-tree advisories (1 critical/11 high/18 moderate/1 low); reachability not established |
