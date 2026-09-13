# CoreStaff

Human Resource, Attendance & Payroll — monorepo. API, Web và **Employee Mobile** phát triển song song từ Sprint 2.

| App | Stack | Chạy local | Phạm vi |
|---|---|---|---|
| `Apps/api` | NestJS + Mongoose | http://localhost:3000/api | REST, prefix `/api` |
| `Apps/web` | ReactJS + Vite | http://localhost:5173 | Web MVP (mọi role) |
| `Apps/mobile` | React Native + Expo | Expo Go / emulator | Employee app |

Ba app dùng chung API. Mobile **không** nằm trong npm workspaces (React 19 / Expo vs React 18 của web) — cài deps riêng, vẫn setup cùng lúc với api+web.

Tài liệu kiến trúc: [`Docs/CORESTAFF_REPO_STRUCTURE.md`](../Docs/CORESTAFF_REPO_STRUCTURE.md), SRS §23.2.

## Yêu cầu

- Node.js **20+** (CI dùng 22) và npm
- Cluster **MongoDB Atlas replica set** (không dùng standalone — transaction cần replica set)
- Dev mobile: [Expo Go](https://expo.dev/go) trên điện thoại, hoặc Android emulator / iOS simulator

Thư mục làm việc của mọi lệnh bên dưới là **`CoreStaff/`** (sau khi clone repo, `cd CoreStaff`).

## Setup lần đầu

### 1. Cài dependencies

API + Web (workspaces):

```bash
npm install
```

Mobile (standalone — bắt buộc nếu làm Employee app):

```bash
cd Apps/mobile
npm install
cd ../..
```

Hoặc từ `CoreStaff/`: `npm --prefix Apps/mobile install`

### 2. Tạo file env local

API **chỉ** đọc `Apps/api/.env` (git-ignored). Không đặt credential ở `CoreStaff/.env`.

PowerShell:

```powershell
Copy-Item Apps\api\.env.example Apps\api\.env
Copy-Item Apps\web\.env.example Apps\web\.env
Copy-Item Apps\mobile\.env.example Apps\mobile\.env
```

bash / Git Bash:

```bash
cp Apps/api/.env.example Apps/api/.env
cp Apps/web/.env.example Apps/web/.env
cp Apps/mobile/.env.example Apps/mobile/.env
```

Mở `Apps/api/.env` và điền:

| Biến | Bắt buộc? | Ý nghĩa |
|---|---|---|
| `MONGODB_URI` | Có (để nối DB) | Connection string Atlas. Tooling không in giá trị này. |
| `PORT` | Không (local) | Mặc định `3000`. **Không** set trên Vercel (reserved). |
| `APP_TZ` | Không | Mặc định `Asia/Ho_Chi_Minh`. Dùng `APP_TZ`, **không** dùng `TZ` (Vercel reserved). |
| `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` | Chưa dùng | Dành cho bootstrap System Admin ở task sau |

`Apps/web/.env` và `Apps/mobile/.env`:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `VITE_API_URL` / `EXPO_PUBLIC_API_URL` | `https://becorestaff.vercel.app` | API remote (Vercel) |
| `VITE_API_FALLBACK_URL` / `EXPO_PUBLIC_API_FALLBACK_URL` | `http://localhost:3000` | Fallback khi remote healthz fail (**chỉ dev**). Android emulator đổi `localhost` → `10.0.2.2`. |

Dev (`npm run dev:web` / Expo `__DEV__`): thử remote ~4s; 500/timeout thì tự gọi API local. Production/release **không** fallback localhost.

**Không commit** `.env`. Chỉ commit `.env.example`.

### 3. (Khuyến nghị) Bootstrap indexes

Cần `MONGODB_URI` hợp lệ. Idempotent — chạy lại được.

```bash
npm run ensure-indexes
```

In ra tên collection + index, không in URI.

## Chạy local

Cần **API** cho cả web và mobile. Mở 3 terminal từ `CoreStaff/`:

```bash
npm run dev:api       # http://localhost:3000/api
npm run dev:web       # http://localhost:5173
npm run dev:mobile    # Expo Dev Tools — quét QR / mở emulator
```

Kiểm tra:

- API: [http://localhost:3000/api/healthz](http://localhost:3000/api/healthz) — `mongo` là `configured` khi đã có URI.
- Web: [http://localhost:5173](http://localhost:5173) — thử Vercel trước, fail thì local; card hiện `remote` hoặc `local fallback`.
- Mobile: cùng logic; màn hình hiện `remote` / `local fallback` + URL.

API vẫn start khi thiếu URI (Mongo no-op). Login / chấm công / leave chưa có ở shell hiện tại.

## Mobile — chạy & nối API

`Apps/mobile` là Expo app (`slug`: `corestaff`, scheme `corestaff`). Dev server: `expo start`.

| Lệnh | Việc |
|---|---|
| `npm run dev:mobile` | Expo start (từ `CoreStaff/`) |
| `npm run lint:mobile` | `tsc --noEmit` |
| `cd Apps/mobile && npm run android` | Mở Android emulator |
| `cd Apps/mobile && npm run ios` | Mở iOS simulator (macOS) |
| `cd Apps/mobile && npm run web` | Expo web (không thay `Apps/web`) |

Dev thử `EXPO_PUBLIC_API_URL` (Vercel) trước; hỏng thì `EXPO_PUBLIC_API_FALLBACK_URL`.

| Môi trường | Fallback local |
|---|---|
| Android emulator | `http://10.0.2.2:3000` (localhost trong env được rewrite) |
| iOS simulator / Expo web | `http://localhost:3000` |
| Máy thật (Expo Go) | Remote Vercel, hoặc đổi fallback thành IP LAN máy chạy API |

Máy thật + fallback local: điện thoại phải gọi được máy dev (cùng Wi‑Fi, firewall mở cổng 3000). CORS API `origin: true`.

Restart Expo sau khi sửa `.env` (`EXPO_PUBLIC_*` chỉ nạp lúc start).

## Scripts

| Lệnh | Việc |
|---|---|
| `npm run dev:api` | NestJS watch |
| `npm run dev:web` | Vite dev + proxy `/api` |
| `npm run dev:mobile` | Expo start |
| `npm run lint` | `tsc --noEmit` api + web |
| `npm run lint:mobile` | `tsc --noEmit` mobile |
| `npm run build` | nest build + vite build |
| `npm test` | Jest unit api (index contracts, **không** cần DB sống) |
| `npm run ensure-indexes` | Sync index Organization / User / UserSession |

## Layout

```text
CoreStaff/
├── package.json              # workspaces: api + web
├── .env.example              # tham chiếu — runtime không load file này
└── Apps/
    ├── api/                  # NestJS; .env local tại đây
    ├── web/                  # ReactJS + Vite
    └── mobile/               # Expo Employee app (standalone package)
```

## Env trên Vercel

Vercel cấm một số tên biến hệ thống. Map như sau:

| Local / `.env.example` | Trên Vercel | Ghi chú |
|---|---|---|
| `MONGODB_URI` | `MONGODB_URI` | Secret |
| `APP_TZ` | `APP_TZ=Asia/Ho_Chi_Minh` | **Không** tạo key `TZ` |
| `PORT` | *không thêm* | Host tự gán `PORT` |
| `PLATFORM_ADMIN_*` | chỉ khi đã dùng bootstrap | Secret |

Local `Apps/api/.env`: đổi dòng `TZ=...` thành `APP_TZ=Asia/Ho_Chi_Minh` (code vẫn fallback `TZ` nếu quên đổi).

### API trên Vercel (serverless)

Vercel không chạy `app.listen()`. Entry là `Apps/api/api/index.js` → `dist/vercel.js` (không bind port).

Trong project Vercel (BE):

1. **Root Directory** = `CoreStaff/Apps/api`
2. Build Command = `npm run build` (đã ghi trong `vercel.json`)
3. Env: `MONGODB_URI`, `APP_TZ` — **không** set `PORT` / `TZ`
4. Tắt Deployment Protection nếu cần gọi public `healthz`
5. Push code adapter rồi Redeploy Production (**không** dùng Build Cache)

Sau deploy: `GET https://<domain>/api/healthz` phải trả JSON `status: ok`.

Web trên Vercel: project riêng, Root Directory `CoreStaff/Apps/web`, env build-time `VITE_API_URL=https://becorestaff.vercel.app` (Vite bake lúc build, không fallback localhost).

## Ghi chú

- MongoDB phải là **replica set** (Atlas managed). Local/CI không dùng Docker (D31).
- Log và CLI không được in `MONGODB_URI` hay password.
- SRS xếp React Native là SHOULD cho *phạm vi nghiệm thu MVP web*; folder mobile vẫn là app chính thức của track Employee, setup cùng repo.
- Chi tiết schema/index: [`Docs/CORESTAFF_REPO_STRUCTURE.md`](../Docs/CORESTAFF_REPO_STRUCTURE.md).
