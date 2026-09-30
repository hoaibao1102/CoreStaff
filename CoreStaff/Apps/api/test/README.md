# CoreStaff Test Suite — BE & FE Integration Tests

## 📋 Test Coverage Overview

### Backend (BE) Integration Tests

| File | Tasks Covered | Type |
|------|--------------|------|
| `timesheet-period.integration.spec.ts` | TASK-072 | Integration |
| `timesheet-summary.integration.spec.ts` | TASK-077 | Integration |
| `close-period.integration.spec.ts` | TASK-078 | Integration |
| `dependents-tax.integration.spec.ts` | Dependent + TaxPolicy | Integration |
| `pit-calculation.unit.spec.ts` | PIT Calculation | Unit |

### Frontend (FE) E2E Tests

| File | Feature Covered | Type |
|------|----------------|------|
| `e2e/timesheet-review.spec.ts` | Period Review & Close Workflow | Playwright E2E |
| `tests/timesheet-validation.test.tsx` | Validation Functions | Jest Unit |
| `tests/pit-calculation.test.tsx` | PIT Calculation Logic | Jest Unit |

---

## 🚀 Running Tests

### Backend Tests (Jest)

```bash
cd Apps/api

# Run all tests
npm test

# Run specific test file
npm test -- timesheet-period.integration.spec.ts
npm test -- timesheet-summary.integration.spec.ts
npm test -- close-period.integration.spec.ts
npm test -- dependents-tax.integration.spec.ts
npm test -- pit-calculation.unit.spec.ts

# Run with watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

### Frontend E2E Tests (Playwright)

```bash
cd Apps/web

# Install Playwright browsers
npx playwright install

# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test e2e/timesheet-review.spec.ts

# Run with UI mode (interactive)
npx playwright test --ui

# Run headed browser (visible)
npx playwright test --headed

# Generate and show trace
npx playwright test --trace on
```

### Frontend Unit Tests (Jest)

```bash
cd Apps/web

# Run all unit tests
npm test

# Run specific test file
npm test -- timesheet-validation.test.tsx
npm test -- pit-calculation.test.tsx

# Run with watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

---

## 🧪 Test Categories Explained

### 1. TASK-072 — TimesheetPeriod State Machine

**What it tests:**
- ✅ Create period with validation (28-31 days, not in past, no overlap)
- ✅ State machine transitions (OPEN → REVIEWING → READY_TO_CLOSE → CLOSED)
- ✅ Reopen closed period (version increment + reason required)
- ✅ Active period lock (only 1 active per org)
- ✅ Tenant isolation (IDOR protection)

**Key assertions:**
```typescript
// Valid transition
expect(res.body.data.status).toBe('CLOSED');

// Invalid transition rejected
expect(res.body.error.code).toBe('INVALID_TRANSITION');

// Version increment on reopen
expect(res.body.data.version).toBe(2);
```

### 2. TASK-077 — TimesheetSummary Aggregation

**What it tests:**
- ✅ Summary generation from attendance_days + overtime_results
- ✅ Work count calculations (workingDays, paidLeaveDays, etc.)
- ✅ Minute aggregations (totalWorkingMinutes, totalLateMinutes)
- ✅ OT breakdown by type (WORKING_DAY, WEEKLY_OFF, PUBLIC_HOLIDAY)
- ✅ Leave breakdown (sick, personal, annual)
- ✅ sourceHash integrity verification
- ✅ Version increment on re-aggregation

**Key assertions:**
```typescript
// Verify summary structure
expect(summary.otWorkingDayMinutes).toBe(120);
expect(summary.sourceHash).toBeDefined();
expect(summary.version).toBe(1);
```

### 3. TASK-078 — Close Period Transaction

**What it tests:**
- ✅ Atomic transaction: period lock + summary + snapshot generation
- ✅ Status transitions through READY_TO_CLOSE → CLOSED
- ✅ Return values: summariesCreated, snapshotsCreated counts
- ✅ Idempotent close (cannot close twice)
- ✅ Transaction rollback on failure
- ✅ closedBy and closedAt timestamps set

**Key assertions:**
```typescript
// Verify atomic operation
expect(res.body.data.summariesCreated).toBeGreaterThan(0);
expect(res.body.data.snapshotsCreated).toBeGreaterThan(0);

// Verify cannot close twice
expect(res.body.error.code).toBe('PERIOD_ALREADY_CLOSED');
```

### 4. Dependent + TaxPolicy Tests

**What it tests:**
- ✅ CRUD operations for dependents
- ✅ Dependent validation (name required, DOB not future)
- ✅ Multiple dependents per employee
- ✅ Tax policy versioning (auto-increment)
- ✅ Effective-dating overlap detection
- ✅ PIT calculation preview endpoint
- ✅ Progressive tax brackets application

**Key assertions:**
```typescript
// Dependent creation
expect(res.body.data.version).toBe(1);

// Tax policy overlap rejection
expect(res.body.error.code).toBe('OVERLAPPING_EFFECTIVE_DATE');

// PIT calculation result
expect(res.body.data.pitAmount).toBeDefined();
```

### 5. FE E2E Tests — Period Review & Close Workflow

**What it tests:**
- ✅ Load periods list with status badges
- ✅ View period detail with stats cards
- ✅ Progress indicators (summaries, attendance)
- ✅ Blockers warning card (red) when issues exist
- ✅ Close confirmation dialog
- ✅ Close action with loading state
- ✅ Success state animation
- ✅ Reopen dialog with mandatory reason validation
- ✅ Error handling (API failures)

**Key assertions:**
```typescript
// UI elements visible
await expect(page.getByText('CẢN ĐỪNG ĐÓ GÓI')).toBeVisible();

// Dialog interactions
await page.getByRole('button', { name: /Đóng kỳ này/i }).click();
await expect(page.getByRole('dialog')).toBeVisible();

// API calls made
const closeRequest = state.requests.find(r => r.path.includes('/close'));
expect(closeRequest).toBeDefined();
```

---

## 🔧 Test Infrastructure

### Fixtures (`test/fixtures.ts`)

Provides seeded tenant data for integration tests:
- `seedTenant()` — Creates organization, department, users, profiles
- `cookieFor(userId, orgId)` — Generates auth cookie for request
- `recentWorkDate()` — Dynamic work date within retroactive grace window
- `vn(date, hhmm)` — Vietnam timezone ISO date helper

### Test App Factory (`test/app-factory.ts`)

```typescript
const testApp = await createTestApp(); // Starts NestJS with MongoDB
await clearDatabase();                  // Drops all collections
const http = testApp.http();           // Supertest agent
```

### FE Mock Pattern

All FE tests use route interception pattern:
```typescript
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  if (path === '/api/timesheet-periods') { /* mock response */ }
  await route.fulfill({ status: 200, json: { success: true, data } });
});
```

---

## 🎯 Test Strategy Principles

1. **Integration over Unit** — Most tests are integration-level, hitting real HTTP endpoints with real MongoDB
2. **Tenant Isolation** — Every test seeds its own tenant to avoid cross-contamination
3. **Dynamic Dates** — No hardcoded dates; uses `recentWorkDate()` to avoid aging out
4. **Clean Slate** — `beforeEach` clears database before each test
5. **Mocked FE** — FE tests intercept API calls, no real backend needed
6. **State Tracking** — FE tests track requests to verify correct payloads sent

---

## 🐛 Troubleshooting

### MongoDB Connection Errors
```bash
# Ensure MongoDB is running
docker ps | grep mongo
# or
mongosh
```

### Playwright Browser Not Found
```bash
cd Apps/web
npx playwright install chromium
```

### Test Timeout
```bash
# Increase timeout for slow tests
npm test -- --testTimeout=30000
```

### Clean Test Cache
```bash
# Clear Jest cache
npm test -- --clearCache

# Clear Playwright cache
npx playwright clear-cache
```

---

## 📊 Expected Test Results

```
Backend (BE):
✅ timesheet-period.integration.spec.ts — 12 tests pass
✅ timesheet-summary.integration.spec.ts — 8 tests pass
✅ close-period.integration.spec.ts — 8 tests pass
✅ dependents-tax.integration.spec.ts — 15 tests pass
✅ pit-calculation.unit.spec.ts — 7 tests pass

Frontend (FE):
✅ e2e/timesheet-review.spec.ts — 9 tests pass
✅ tests/timesheet-validation.test.tsx — 18 tests pass
✅ tests/pit-calculation.test.tsx — 12 tests pass
```

**Total: ~69 test cases covering TASK-072, 077, 078, Dependents, TaxPolicy, PIT Calculation**
