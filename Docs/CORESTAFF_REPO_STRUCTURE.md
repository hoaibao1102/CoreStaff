# CoreStaff — Cấu trúc Monorepo (Sprint 2 — Foundation)

> Tài liệu mô tả cấu trúc mã nguồn thực tế trong thư mục `CoreStaff/`, triển khai cho
> **TASK-014** (Khởi tạo NestJS API, ReactJS Web, MongoDB replica set và CI) và
> **TASK-015** (Mongoose schemas/index bootstrap Organization/User/UserSession).
> Tham chiếu SRS §23.2 (Technology stack) và Milestone Sprint 2.

## 1. Tổng quan layout

```text
CoreStaff/
├── package.json                 # npm workspaces root (api + web)
├── .gitignore                   # Chặn node_modules/, .env
├── .github/workflows/ci.yml     # CI: npm ci → lint → build → test
├── .env.example                 # Hướng dẫn tạo .env (không chứa secret)
└── Apps/
    ├── api/                     # NestJS + Mongoose REST API
    │   ├── .env.example         # Template env cho API
    │   └── .env                 # Credential thật (git-ignored)
    ├── web/                     # ReactJS + Vite Web MVP (Sprint 2 shell)
    │   └── .env.example         # Template env cho Web (VITE_API_URL)
    └── mobile/                  # React Native + Expo Employee App (SHOULD, standalone)
        └── .env.example         # Template env cho Mobile (EXPO_PUBLIC_API_URL)
```

> **Ghi chú:** `Apps/mobile` (React Native + Expo) là **SHOULD** (Sprint 8), chưa nằm
> trong npm workspaces ở Sprint 2 để tránh xung đột hoisting. Mỗi app tự quản `.env`
> (git-ignored), template nằm trong `.env.example`.

## 2. Apps/api — NestJS + Mongoose

| Đường dẫn | Trách nhiệm |
|---|---|
| `src/main.ts` | Bootstrap NestJS, prefix `/api`, CORS, listen `PORT` |
| `src/app.module.ts` | Root module: ConfigModule + DatabaseModule + HealthController |
| `src/config/env.ts` | Load `.env` từ `Apps/api`; resolve URI từ nhiều key |
| `src/health.controller.ts` | `GET /api/healthz` — status/service/mongo/tz, không leak URI |
| `src/database/database.module.ts` | `MongooseModule.forRoot` + `forFeature` từ registry; no-op khi thiếu URI |
| `src/database/schemas/*.ts` | Organization, User, UserSession, enums (Role/UserStatus/OrganizationStatus + normalize) |
| `src/database/indexes.ts` | Helper `listIndexes` / `hasCompoundIndex` cho tests |
| `src/database/mongo-tools.ts` | `syncAllIndexes` + `runTransactionSmoke` (rollback proof) + `closeConnection` |
| `src/database/ensure-indexes.ts` | CLI idempotent bootstrap (chạy `npm run ensure-indexes`) |
| `src/database/indexes.spec.ts` | Unit contract cho compound tenant indexes + normalization |

**Schemas đã bootstrap (TASK-015):**

- **Organization** — `code` (unique platform-wide), name, status, timezone, evidenceRetentionDays, payrollSeparationOfDuties.
- **User** — organizationId (null cho SYSTEM_ADMIN), email + `emailN` (normalized), employeeCode (sparse), passwordHash, role, status, mustChangePassword, failedLoginCount, lockedUntil.
  - Unique tenant-scoped: `{ organizationId, emailN }`, `{ organizationId, employeeCode }` (sparse).
- **UserSession** — userId, organizationId, tokenHash (unique — lưu hash, không lưu token thô), expiresAt, revokedAt, userAgent, ipAddress.
  - Indexes: `{ tokenHash }` unique, `{ userId, expiresAt }`, `{ organizationId, userId }`.

## 3. Apps/web — ReactJS + Vite

| Đường dẫn | Trách nhiệm |
|---|---|
| `vite.config.ts` | Dev server port 5173, proxy `/api` → `http://localhost:3000` |
| `index.html` + `src/main.tsx` | Entry React + StrictMode |
| `src/App.tsx` | Shell Sprint 2: gọi `/api/healthz` hiển thị trạng thái |
| `src/index.css` | Style tối giản |

## 4. Chạy & kiểm chứng

```bash
# Từ thư mục CoreStaff/
npm install                   # cài workspaces (api + web)
npm run dev:api               # NestJS watch (PORT 3000)
npm run dev:web               # Vite dev (5173, proxy /api)
npm run ensure-indexes        # bootstrap indexes idempotent (cần MONGODB_URI)
npm run lint                  # tsc --noEmit cho api + web
npm run build                 # nest build + vite build
npm test                      # jest unit (index contracts, không cần DB sống)

# Tạo .env cho từng app trước khi chạy lần đầu:
cp Apps/api/.env.example Apps/api/.env       # API: điền MONGODB_URI
cp Apps/web/.env.example Apps/web/.env       # Web: VITE_API_URL
cp Apps/mobile/.env.example Apps/mobile/.env # Mobile: EXPO_PUBLIC_API_URL

# Mobile (standalone — SHOULD)
cd Apps/mobile
npm install                   # chỉ cần chạy lần đầu
npm run start                 # Expo dev server (mở Expo Go / emulator)
npm run lint                  # tsc --noEmit
```

**Kim chỉ nam bảo mật:** tooling không bao giờ in giá trị trong `.env`; `.env.example` chỉ chứa placeholder.

## 5. Liên quan

- `PLANNING_FREEZE_RULE.md` — D30: Milestone/Backlog immutable; task mới append từ TASK-119.
- `DOCS_DECISION_LOG.md` — D20/D29 chốt stack NestJS + MongoDB replica set + ReactJS MVP.