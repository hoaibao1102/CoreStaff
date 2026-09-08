# TVS TimeKeeping — Prototype (React + Vite)

Interactive **UX prototype** for the TVS ERP Check-in/Check-out module. Rendered with a
Material-3 "Modern Enterprise" theme. Runs fully on **mock data** so no backend is needed —
but the architecture is ready to swap in the real backend with minimal effort.

```bash
npm install
npm run dev      # → http://localhost:3000 (auto-increments if occupied)
npm run lint     # tsc --noEmit
npm run build    # production build to dist/
```

---

## 🧭 Codebase layout (`src/`)

```
src/
├── main.tsx                     # entry — renders <PrototypeWorkspace/>
├── App.tsx                      # thin root re-export of PrototypeWorkspace
├── index.css                    # M3 theme tokens + Inter font (Tailwind v4)
├── types.ts                     # domain types (DayAttendance, ApproverRequest, ...)
│
├── services/                    🔌 SWAP POINT for the real backend
│   ├── attendanceService.ts     #   fetchToday / submitCheckIn / submitCheckOut / submitSelfie / resetToday
│   └── approverService.ts       #   fetchApproverRequests / approve / reject / clarify / reset
│
├── hooks/                       app-core state (components never call services directly)
│   ├── useAttendance.ts         #   today attendance + camera + check-in/out + error state
│   └── useApprover.ts           #   approver list + approve/reject/clarify
│
├── components/                  🖼 UI (kept when going to production)
│   ├── employee/                #   EmployeeHeader, VerificationCards, Camera, History, ...
│   ├── approver/                #   ApproverDashboard, ApproverSelfieDetail, ApproverGPSDetail
│   └── common/                  #   Badges, CommonStates, Modals
│
└── harness/                     🧪 TEST-ONLY — delete this folder to ship production
    ├── PrototypeWorkspace.tsx   #   app shell + role switch + spec tabs + 2-col (8-2) layout + modals
    ├── PhoneFrame.tsx           #   mobile preview surface (sticky, standard phone width)
    ├── SimulationSandbox.tsx    #   right-hand test controls (method, condition, system, GPS)
    ├── ApproverView.tsx         #   approver harness wrapper
    ├── useSimulation.ts         #   test-only simulation state
    └── docs/                    #   Wireframe Catalog, Sitemap, Flows, Button Matrix, Component Inventory
```

---

## 🗺 Nối Backend thật như thế nào

Two changes. **UI (`components/` + `hooks/`) does not need to be touched.**

### 1. Replace the service bodies (`src/services/*`)

Keep every exported **function name & signature** identical. Only replace the inside with real HTTP:

```ts
// src/services/attendanceService.ts
export async function submitCheckIn(prev, params) {
  const res = await fetch('/api/attendance/check-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ method: params.method, gps: { accuracy: params.gpsAccuracy, distance: params.gpsDistance } }),
  });
  const envelope = await res.json();
  if (!envelope.success) throw new AttendanceError(envelope.error.code, envelope.error.message);
  return envelope.state; // DayAttendance
}
```

Key rules that already shape the mock to match real behavior:

| Rule (from `OVERVIEW_TIMEKEEPING_TOOL.md`) | How the mock enforces it |
|---|---|
| **BE không tin FE** — tự kiểm tra lại | `assertSubmittable()` re-checks condition + GPS thresholds and throws an `AttendanceError` |
| **Error contract = `{code, message}`** | `AttendanceError` + `lastError` in `useAttendance` → FE renders the code |
| **Idempotency / chống trùng** | `submitCheckIn` throws `ALREADY_CHECKED_IN` if already checked in |
| **BR-GPS-10** — check-out cần check-in trước | `submitCheckOut` throws `INVALID_ATTENDANCE_ACTION` |
| **Snapshot / server-time** | Time stamped at "server" side (service), not the client clock |

Stable error codes already emitted: `NETWORK_NOT_ALLOWED`, `OUTSIDE_ALLOWED_AREA`,
`LOW_LOCATION_ACCURACY`, `LOCATION_PERMISSION_REQUIRED`, `CAMERA_PERMISSION_REQUIRED`,
`WORKPLACE_NOT_CONFIGURED`, `ALREADY_CHECKED_IN`, `ALREADY_CHECKED_OUT`,
`INVALID_ATTENDANCE_ACTION`, `INVALID_REQUEST`.

### 2. Delete the test harness & point at a production shell

```
rm -rf src/harness
```

Then `src/main.tsx` / `src/App.tsx` should render your real app shell
(e.g. `EmployeeApp` + `ApproverApp`) that consumes the same `useAttendance()`
and `useApprover()` hooks and the same `components/`.

---

## 🧪 Test note: mock persistence

Mock "server" state is persisted to **`localStorage`** so it survives reload and is shared
between the Employee and Approver harness views.

| Key | Contents |
|---|---|
| `tvs-timekeeping-mock-v1` | today's `DayAttendance` (server-side state) |
| `tvs-timekeeping-mock-approver-v1` | approver request list |

When wiring the real backend, this storage layer is naturally replaced by the actual API
calls — nothing to clean up manually in code.

---

## 🧭 Spec tabs (test/design-time)

- **Prototype Live** — the 2-column 8-2 test canvas (left: phone, right: simulation sandbox).
- **Wireframe Catalog** — every screen E01–E11 / A01–A03 with one-click preview.
- **Sitemap / User Flows / Button Matrix / Component Inventory** — UX spec views.

All of the above live in `src/harness/` and are removed for production.