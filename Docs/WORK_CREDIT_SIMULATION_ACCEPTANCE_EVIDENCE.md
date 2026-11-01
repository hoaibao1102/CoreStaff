# Work-credit Simulation Lab — acceptance evidence

Status: implementation delivered and local validation completed. HR/product approval of a real tenant policy is not implied. No default85, seed, migration, live index operation, commit or deploy performed.

## Stable-source parent verification

Final run after precision review fix: API **88 suites /1049 tests passed** (7 OT opt-in skipped in normal lane); Web **30 suites /228 Jest +17 Node tests passed**; root lint/build passed; full ephemeral API integration **14 suites /137 tests passed**. Chrome work-credit browser **4/4 passed**, APIs mocked locally. Parity suite **19 tests** passes in full API run, including stored decimal form-to-preview parity. Persisted ordinary-punch regression proves morning240/afternoon240/OT-exclusion480 with explicit lunch. Integration teardown required forced termination of a Mongo child after SIGINT timeout; all assertions passed and command exited0. Existing duplicate-index, jsdom navigation and Web bundle warnings remain.

Explicit break boundaries now produce morning240/afternoon240 and exclude outside-shift time. Aggregate-only historical snapshots keep legacy fallback, without inferred lunch or backfill. This supersedes the earlier intentional upstream RED results below.

## Scope

Pure client illustration mirrors the authoritative backend step evaluator; existing 0/0.5/1 contract remains. UI presets are explicit examples only. Existing backend coverage fallback remains 50–100. Simulation has no network/persistence path. Read-only scenario inputs do not prove employee facts or legal entitlement.

## Evidence detail

- Focused baseline backend: 2 suites / 30 tests passed.
- Parent Chrome rerun: `e2e/work-credit-simulation.spec.ts`, 4/4 passed, serial installed Chrome. All APIs/health/auth locally mocked, unexpected external requests blocked. Not real-backend persistence E2E.

- Backend regressions exposed and fixed explicit-break morning deduction; aggregate-only historical fallback remains a documented limitation.
- Parent rerun verified policy integration **3/3 passed** on disposable loopback replica set: explicit85 update invalidates acknowledgement exactly once, real close preserves frozen summary/payroll history after subsequent policy edit, and real HR/tenant guards prevent unauthorized writes. Parent exhaustive parity suite rerun **18/18 passed**.

## Acceptance map

All 28 plan IDs occur once. Partial/pending is not a pass claim for every requested tier.

| ID | Test/source evidence and remaining gate | State |
|---|---|---|
| WC-01 | Domain, helper, parity and simulation component85 examples | U/W pass |
| WC-02 |407/408 and239/240 unit/parity; browser407/408 | U/W pass |
| WC-03 | Existing100 and explicit UI100; no default edits | U/W pass |
| WC-04 |450 obligation382/383 parity/ranges | U/W pass |
| WC-05 |240 obligation domain/helper | U/W pass |
| WC-06 | Paid-leave toggle domain/parity/component | U/W pass |
| WC-07 | Unpaid leave zero domain/parity/component | U/W pass |
| WC-08 | Incomplete/forfeited parity/component | U/W pass |
| WC-09 | Holiday/off/zero parity/component | U/W pass |
| WC-10 | Cap + persisted explicit-interval OT exclusion | U/W/I pass for tested ordinary path |
| WC-11 | Half0 domain/helper/UI warning | U/W pass |
| WC-12 | Invalid/blank helper/UI/save guards | U/W pass |
| WC-13 | Exhaustive grids + exact stored form-to-preview ratios | U/W pass |
| WC-14 | Coincident integer boundaries => null range | W pass |
| WC-15 | Blank add, decimals edit, explicit preset only | Browser verified with mock API |
| WC-16 | Preset/undo preserve other fields | Browser verified with mock API |
| WC-17 | Scenario changes no POST/PATCH | Browser verified with network assertions |
| WC-18 | Ratio payload/diff, decimal mounted regression | W pass; browser persistence mocked |
| WC-19 | Save error/cancel/loading/duplicate guard | W pass |
| WC-20 | Labelled units/errors, keyboard and390px browser | Browser verified; no assistive-technology certification |
| WC-21 | Grace15 late45 and early5 | U pass |
| WC-22 | Explicit lunch ordinary punch→stored minutes→projection | U/I pass; aggregate-only history not backfilled |
| WC-23 | Effective-window update + acknowledgement invalidation | U/I pass |
| WC-24 | Real close freezes artifacts across live policy update | I pass |
| WC-25 | Real HR/tenant guards | U/I pass |
| WC-26 | Seed/verifier files unchanged; existing contract regressions | U pass; scripts not executed |
| WC-27 | Browser save→mocked refreshed GET retains values | Mock browser verified; real browser/backend persistence not run |
| WC-28 | Docs/WORK_CREDIT_POLICY_DEFENSE_GUIDE.md has13 Q&A, source ledger and assumptions | Source review done; HR/legal approval not provided |

## Operational and evidence limits

Odoo quotes in defense guide are supplied plan evidence, not newly fetched authoritative verification; no legal text/efficacy conclusion added. Real tenant approval, demo environment preparation and full real-backend browser-to-payroll rehearsal remain separate. Mobile, linear credit, new grace semantics, impact counts and discipline are out of scope. Never change seed/verifier to produce a desired85 result.
