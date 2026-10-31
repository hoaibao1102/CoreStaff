# OT / attendance V2 acceptance evidence

Status: additive API/Web implementation delivered with green local gates; cutover disabled. The full rollout definition of done and all acceptance tiers are NOT complete.

## Final integration rerun

Final stable-source gates: API **87 suites / 1002 tests passed**, 7 opt-in tests skipped in the normal lane and explicitly run separately **7/7 passed**; Web **27 suites / 205 Jest tests + 17 Node tests passed**; root lint and API/Web build passed. All API integration suites passed: **13 suites / 131 tests**, ephemeral replica set with external URI overrides cleared. Browser tests passed **3/3** using locally mocked APIs. These results supersede earlier intermediate runs; production rollout criteria and incomplete acceptance tiers below remain outstanding.

## Executed by parent

- Full API unit: 86 suites / 962 tests passed.
- Full Web: 27 suites / 205 Jest tests + 17 Node tests passed.
- Root lint and API/Web build passed before final transaction-integration edits; rerun required after those edits.
- Isolated ephemeral replica set: confirmation + source/close + checkout boundary: 3 suites / 19 tests passed. Additional opt-in OT replica suite: 2 tests passed (overlap winner and rollback of request/period/day claims). Narrow races stub preview/scope or close artifact dependencies; they do NOT prove HTTP authorization or complete payroll close.
- Existing warnings: duplicate Mongoose indexes, jsdom navigation, Web bundle size/dynamic imports.
- Parent browser run: `PLAYWRIGHT_CHANNEL=chrome npx playwright test e2e/attendance-confirmation-v2.spec.ts --reporter=line --workers=1`: 3 tests passed. Route-mocked API, no live backend: date-change preview invalidation, server-stale confirmation reload and OT suggestion/matching preview/hash submission. This does not prove real backend persistence or authorization.

## Acceptance inventory

All 39 plan IDs are listed once below. `Partial` means tests exist for part of the requirement, NOT accepted across its requested tiers. Source tests must be read together with the plan; no count here implies all acceptance criteria passed.

| ID | Evidence / missing gate | Status |
|---|---|---|
| OT-01 | OT service/domain verification tests; both HTTP routes integration pending | Partial |
| OT-02 | OT V2 provenance tests + Web blocked preview; DB integration pending | Partial |
| OT-03 | OT service evidence guards; selfie promotion/HTTP integration pending | Partial |
| OT-04 | V2 domain threshold/service tests; HTTP integration pending | Partial |
| OT-05 | overtime-v2-domain.spec.ts threshold/block cases | Partial — final mapping review pending |
| OT-06 | V2 domain zero-step cases | Partial — final mapping review pending |
| OT-07 | V2 policy/service tests; effective-date DB integration pending | Partial |
| OT-08 | Per-request domain contract; UI scenario pending | Partial |
| OT-09 | Actual intersection domain tests; HTTP integration pending | Partial |
| OT-10 | Service suggestion/Web selection tests; DB integration pending | Partial |
| OT-11 | Real shared-guard overlapping filing race: exactly one winner; preview/outside-schedule stubbed | Partial — HTTP routes pending |
| OT-12 | V2 observed compliance unit coverage; DB integration pending | Partial |
| OT-13 | Policy workDate helpers tested; submit integration pending | Partial |
| OT-14 | Request-owned V1 dispatch tests; close/recompute DB scenario pending | Partial |
| OT-15 | Equal-pay policy/evidence hash tests; close invalidation race pending | Partial |
| AT-01 | Pure proposal and conditional endpoint tests; browser E2E pending | Partial |
| AT-02 | Full-day integration writes linked synthetic events; required intervals unit tests | Partial |
| AT-03 | Pure missing-in proposal tests; persisted legacy scenario pending | Partial |
| AT-04 | Proposal guards + endpoint CAS integration | Partial |
| AT-05 | New confirmation has no editable endpoint type; browser scenario pending | Partial |
| AT-06 | Obligation/proposal unit tests; persisted overlap/full-leave scenarios pending | Partial |
| AT-07 | Required interval/calculator unit tests; persisted partial leave scenario pending | Partial |
| AT-08 | Last-slot quota integration; Web blocking; limit-zero DB scenario pending | Partial |
| AT-09 | Source-specific quota indexes/queries; legacy coexistence integration pending | Partial |
| AT-10 | Last-slot race passes; duplicate-day race separate scenario pending | Partial |
| AT-11 | Same-key replay and changed-payload integration passes | Partial — HTTP envelope pending |
| AT-12 | Reject replay releases once integration; clarification integration pending | Partial |
| AT-13 | Month-start helper tests; real month-start preview integration passes for one policy | Partial |
| AT-14 | Context hash/stale unit tests; persisted fact-change/UI combined scenario pending | Partial |
| AT-15 | Real checkout versus confirmation service race passes; not forced dual-snapshot barrier, confirmation preview/scope stubbed | Partial |
| AT-16 | Event-write failure rolls back decision/day/period; remaining failure stages pending | Partial |
| AT-17 | Closed refusal, shared helper snapshots and real close-service snapshot versus checkout pass; artifacts/blockers stubbed | Partial |
| AT-18 | Manager scope reused, but integration scope stubbed; auth acceptance pending | Pending |
| AT-19 | Date/overnight/no-period unit guards; HTTP/Web complete scenario pending | Partial |
| AT-20 | Approval period invalidation tested; employee-review/OT/browser E2E pending | Partial |
| UX-01 | Stale date/window response unit/component tests pass | Partial — browser pending |
| UX-02 | Deep-link + explicit disabled/legacy Web tests; old-client HTTP integration pending | Partial |
| MG-01 | Offline migration unknown/conflict/read-only tests pass; live export not inspected | Partial |
| MG-02 | V1/V2 reader preservation unit tests; actual rollout/rollback rehearsal pending | Pending |

## Operational boundary

No seed, migration apply, live index synchronization, tenant activation, commit, push or deploy was performed. Offline inspector is not an operational migration implementation. HR/product approval and compliance interpretation, backup/export, migration/index review, old deployed clients and Mobile inventory remain required before rollout.
