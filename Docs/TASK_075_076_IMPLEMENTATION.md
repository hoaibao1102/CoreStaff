# TASK-075/076 — Department confirmation and invalidation (Backend)

## Scope

Backend implementation for Sprint 6 department confirmation. A confirmation is
immutable evidence for one department and one `TimesheetPeriod.version`.
Confirmations from older versions remain available for audit but are not current.

React web is connected through `confirmDepartmentTimesheet()` in `hrService.ts`.
The review screen submits `expectedPeriodVersion`, renders only confirmations
matching the displayed version, and refetches on version conflict or department
blockers. A refresh action reloads the current period and clears old previews.

## Contract

`POST /api/hr/timesheet-periods/:id/department-confirmations`

```json
{
  "departmentId": "<object-id>",
  "expectedPeriodVersion": 1
}
```

Only a `DEPARTMENT_MANAGER` with an effective `ManagerAssignment` can confirm.
The server recalculates department blockers and stores a payroll-free statistics
snapshot. When every active department containing active/probation employees has
a confirmation for the current version, the period becomes `READY_TO_CLOSE`.

The former `POST .../:id/close-snapshot` endpoint remains as a compatibility
wrapper. It creates the same confirmation and no longer generates
`TimesheetSummary` or `PayrollInputSnapshot` records.

## Acceptance criterion → implementation → test

| Criterion | Implementation | Test |
|---|---|---|
| Manager confirms an in-scope, blocker-free department | `confirmDepartment()` plus effective-date manager scope | `department-confirmation.integration.spec.ts` happy path |
| Out-of-scope department is forbidden | `ManagerScopeService.requireDepartment()` | out-of-scope integration case |
| Department with blockers cannot confirm | server-side `collectBlockers()` | blocker integration case |
| Confirmation is bound to reviewed version | required `expectedPeriodVersion` and stored `periodVersion` | stale-version integration case |
| Retry does not duplicate confirmation | unique compound index plus atomic upsert | idempotency integration case |
| HR cannot close without all current confirmations | current-version confirmation check inside close transaction | manually-ready close integration case |
| Manager endpoint never creates payroll input | legacy endpoint delegates to confirmation | legacy compatibility integration case |
| In-period mutation invalidates previous confirmation | version bump resets readiness; reads only current version | TASK-076 leave-apply integration case |
| Confirmation history is retained | old records are not deleted or updated | TASK-076 history assertion |
| CLOSED periods are not bumped | `PeriodVersionService` excludes `CLOSED` | existing period-version unit/integration tests |

## Verification

- Unit: `period-version.service.spec.ts`, `manager-snapshot-review.spec.ts`.
- Integration: `department-confirmation.integration.spec.ts`,
  `period-version.integration.spec.ts`, `period-blockers.integration.spec.ts`.
- TypeScript workspace check currently also reports pre-existing errors in
  `scripts/verify-payroll-e2e-seed.ts`; no TASK-075/076 source error is reported.
