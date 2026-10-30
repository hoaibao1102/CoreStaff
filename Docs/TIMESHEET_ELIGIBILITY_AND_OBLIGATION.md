# Canonical Timesheet Eligibility and Period Obligation Contract

## Scope

This contract defines the versioned employee population and deterministic daily fact projection used by future employee review, manager confirmation, summary generation, and close validation. It does not persist acknowledgements or integrate summaries/payroll/UI.

## Eligibility V1

`TIMESHEET_ELIGIBILITY_V1` includes an employee when all of the following hold:

- employment overlaps the period (`joinDate <= period.endDate` and no `endDate`, or `endDate >= period.startDate`);
- pay basis is the currently supported `FULL_TIME` employment type;
- at least one active employee assignment is effective during the period;
- at least one scheduled-obligation date falls inside the period.

Consequences:

- a mid-period transfer retains every effective department in the eligibility evidence;
- terminated/resigned employees remain eligible through an in-period `endDate`;
- `ON_LEAVE` and full-period paid leave do not remove an employee when an underlying schedule exists;
- zero `AttendanceDay` rows do not remove an employee;
- HR and department-manager identities are included when they also have an eligible employee profile;
- candidates from another tenant are excluded.

## Manager authority

New timesheet review and confirmation capabilities use only active, effective `ManagerAssignment` rows at action time. `EmployeeProfile.departmentId` remains compatibility data for existing manager features but grants no new review authority. Direct department checks outside this effective assignment set fail with `DEPARTMENT_SCOPE_VIOLATION`.

## Review-state vocabulary reserved for later persistence

Append-only review history uses: `PENDING`, `ACKNOWLEDGED`, `DISPUTED`, `RESOLVED_BY_CORRECTION`, `RESOLVED_NO_CHANGE`, and `EXCEPTED`. A superseded period version remains history and is never rewritten as acknowledgement. Deadline timezone, exception actors, and reason-code catalog remain product decisions and are not persisted by Tasks 0A/0B.

## Period obligation/fact projection

For every eligible employee and covered civil date, resolve in this order:

1. effective assignment and calendar exception;
2. effective department shift, falling back to organization shift;
3. approved/applied paid and unpaid leave;
4. left-joined attendance evidence;
5. overtime restricted by tenant input, employee, work date, exact `periodKey`, and requested classification status.

Each day exposes scheduled obligation, worked scheduled minutes, payable/unpaid leave minutes, standard units/minutes, overtime minutes, blocker codes, and source IDs/versions. A scheduled date without attendance emits `MISSING_ATTENDANCE_DAY`. Weekly-off/public-holiday dates have zero standard obligation. Multiple effective assignments or multiple shifts at the winning scope fail closed.

The adapter accepts a Mongoose `ClientSession` and passes it to its fact source. Callers choose `PROVISIONAL` or `FINAL` OT explicitly; there is no status fallback.

## Canonical integrity

Canonical JSON sorts object keys and employee/date rows, preserves daily dates, statuses, blockers, source references, and totals, then hashes the UTF-8 payload with SHA-256. Equal aggregate totals with different daily facts therefore do not produce the same canonical hash.
