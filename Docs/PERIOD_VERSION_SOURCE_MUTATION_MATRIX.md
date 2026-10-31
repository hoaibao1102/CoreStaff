# Period-version source-mutation matrix

**Status:** Task 0C highest-risk adapter slice; WorkCreditPolicy adapter integrated  
**Rule:** A successful mutation that changes the open/reviewing timesheet projection must invalidate each impacted period exactly once. Invalidation errors propagate; callers must not report success after a failed bump.

| Source mutation | Current mutation owner | Impact resolution | Invalidation state |
|---|---|---|---|
| Attendance check-in | `AttendanceService.checkIn` | resolved active period / `AttendanceDay.periodId` | Integrated; one required `bump()`; failures propagate |
| Attendance check-out | `AttendanceService.checkOut` | resolved active period / `AttendanceDay.periodId` | Integrated; one required `bump()`; failures propagate |
| Manager attendance approval/status decision | `ManagerRequestService.decide` | request work date | Integrated; one `bumpForWorkDates()` per decision |
| Manager manual punch adjustment | `ManagerRequestService.decide` | request work date | Integrated through the same decision bump; no second adjustment bump |
| Leave manager approval | `LeaveService.managerDecision` | every date in request range | Integrated in the existing transaction; rejection does not bump |
| Leave HR apply | `LeaveService.apply` | every date in request range | Integrated in the existing transaction |
| Leave reversal after HR apply | No mutation path exists in the current API | request/override date range | Deferred: the future reversal adapter must delete/rebuild overrides and bump once in the same transaction |
| OT approval and initial classification | `ManagerRequestService.decide` + `OvertimeService.onApproved` | request work date | Integrated; result persistence must succeed, then the decision path bumps once; failures propagate |
| OT recomputation/reclassification | `OvertimeService.recompute` | changed work dates in requested range | Integrated; zero-change recomputation does not bump; one batch bump after one or more changes |
| Employee/day shift assignment create/update/delete | Assignment/shift mutation services | all open/reviewing periods intersecting the effective-date window and employee scope | **Deferred adapter integration** |
| Shift template create/update/delete | Shift-template mutation service | all open/reviewing periods whose resolved obligations use the template/effective window | **Deferred adapter integration** |
| Employee day override create/update/delete outside leave apply | Override mutation owner | override dates | **Deferred adapter integration** |
| Calendar exception create/update/delete | `CalendarService` | periods containing the created/deleted date or both old/new moved dates | Integrated; calendar write, OT recompute, and one deduplicated period bump share a transaction/session; failures propagate |
| Labor/OT policy effective-window create/update | `PoliciesService` | open/reviewing periods intersecting the create window or union of old/new half-open windows | Integrated fail-closed invalidation: policy write and period bumps share the policy model's MongoDB transaction/session; invalidation failures abort the mutation |
| Work-credit policy create/update | `PoliciesService` | open/reviewing periods intersecting the union of old/new half-open effective windows | Integrated; policy write and period bumps share one transaction/session; failures propagate |

## Adapter contract for deferred rows

1. Resolve all impacted open/reviewing periods from the source mutation's effective dates and tenant scope.
2. Apply the source write and period invalidation in one MongoDB transaction when both collections share the connection.
3. Call the period-version adapter once per mutation batch; `bumpForWorkDates()` deduplicates periods reached through multiple dates.
4. Propagate invalidation failures. Do not log-and-continue or make `PeriodVersionService` optional.
5. Add a focused RED/GREEN unit test for one bump, zero bumps on a rejected/no-op mutation, and propagated bump failure before wiring each deferred adapter.

## Labor/OT policy projection contract

- `PoliciesService` owns the atomic boundary: policy create/update and `bumpForEffectiveWindow()` use the same model connection, transaction, and `ClientSession`.
- Update invalidation covers the union of the old and new half-open effective windows, so moving or shrinking a policy cannot leave the former range current.
- `OvertimeService.recompute()` remains the explicit OT-result refresh seam. It recomputes approved requests, persists changed classification/minutes/hash, and bumps changed work dates; `targetStatus`-only promotion does not invalidate projections.
- Policy mutation does **not** invoke OT recomputation inside the policy transaction. `PoliciesModule -> OvertimeModule -> PoliciesModule` would create an unsafe service cycle, and the current recompute implementation does not accept a caller-owned session. The implemented contract therefore fails closed by invalidating all intersecting open periods atomically; any later workflow that requires eager OT-result replacement must first add session propagation to `OvertimeService.recompute()` and an acyclic orchestration owner. No fire-and-forget recomputation is permitted.

## V2 serialization boundary (implementation in progress)

`PeriodVersionService.claimForWorkDate(organizationId, workDate, session)` requires an active transaction and an exact date-only token. It resolves exactly one active covering period, rejects closed/payroll-claimed/ambiguous periods, and conditionally increments the exact version while clearing review confirmations. This claim already invalidates the period; callers must not bump it again. Source writes must follow the claim using the same session. Existing `bump()` remains an invalidation helper, not permission to mutate a locked period.

Verified on an ephemeral loopback MongoDB replica set: `CoreStaff/Apps/api/test/source-mutation-boundary.integration.spec.ts`, 3 tests passed. The tests establish competing snapshots and prove a committed source claim defeats the competing close write, close blocks a later source claim, and a failure after claim rolls back the period change. This verifies the shared helper boundary only, not every application writer.

V2 check-in/out now write day, event, evidence, pending request and idempotency in the claimed session. Notifications flush after commit and discard failed/retried attempts. Manager attendance and OT decisions share transactional guards; V1 no-period compatibility is explicit while covering closed/payroll-claimed periods still block. SELFIE provenance is promoted only with matching verified evidence; legacy status-only decisions do not invent observed provenance.

Verified feature slices: confirmation/checkout/source-close suites, 19 tests; OT overlap/rollback opt-in suite initially 2 tests, expanded legacy guard suite 7 tests reported by worker (final parent rerun pending). Some preview/scope/close artifact dependencies are stubbed. **Unverified:** full HTTP authorization and end-to-end payroll acceptance, complete failure-stage injection, and production index/data behavior. Broad final integration is running after compatibility fixes. No production database, index synchronization, migration apply, seed or cutover was performed.