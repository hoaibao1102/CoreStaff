# TASK-068 / 069 / 070 / 071 — Nhật ký triển khai (OT tự phân loại, eligible minutes, giới hạn lao động, tests)

Ngày: 2026-09-26. Branch: `UI-Webs`. owner: Nguyễn Bá Phi Hà.
Quyết định phạm vi & deviation: `Docs/DOCS_DECISION_LOG.md` **D38**.
Backlog (`Docs/TASK_BACKLOG_9_WEEKS.md:74-77`) **không đổi** — D30 freeze; trạng thái triển khai ghi ở file này.

## Phạm vi

Bốn task cuối Sprint 5. Spec thật nằm trong `Docs/SRS_CORESTAFF.md` (§7.7,
FR-OT-01..03, BR-OT-01..05, §15.11, §16.6C, §17, §18.3, §21 AC-OT-01..06, §22,
§30B, §30H) — backlog chỉ là placeholder một dòng.

Trạng thái **trước** thay đổi: `manager_requests{type:'OVERTIME'}` + `decide()` đã
duyệt được window, `evaluateLaborLimits()`/`resolveOvertimeRates()` đã có và đã
unit-test, nhưng **không có ai gọi hai hàm đó**; `attendance.service.getHistory()`
tính `otMinutes` theo wall-clock `approvedEnd − approvedStart` với `Math.round`,
không giao punch, không trừ giờ công theo lịch, không phân loại, không check caps.

Đã làm:

- **068** — engine suy `overtimeType` từ calendar/shift/override (dùng lại
  precedence của `resolveClassification()`, không viết lại).
- **069** — `eligible = (approved ∩ punch) − scheduled`, lưu vào collection mới
  `overtime_results`; `getHistory` đọc số này; hook refresh khi check-out và khi
  sửa calendar.
- **070** — thực thi 5 giới hạn ngày/tuần/tháng/năm: **BLOCK 422 tại duyệt**,
  **WARNING tại submit** (projection), WS `compliance:warning` cho Employee/Manager/HR.
- **071** — 4 suite unit mới + **lane integration mới** `Apps/api/test/`
  (`mongodb-memory-server`, replica set 1 node) chạy app Nest thật qua HTTP.

Không làm (theo plan): `TimesheetPeriod`/confirmation (Sprint 6), migration
`manager_requests` → collection OT riêng, bất kỳ sửa nào trong `Apps/web`.

## Quyết định thiết kế đã chốt với user

1. **Model**: `manager_requests{type:'OVERTIME'}` vẫn là OvertimeRequest của hệ
   thống; **chỉ thêm** `overtime_results`. Không migrate. → deviation đặt tên
   §15.11, ghi D38.
2. **Điểm tính**: eligible **chỉ tính lúc duyệt**. Lúc submit chỉ lưu window.
3. **Retroactive**: grace window `RETROACTIVE_GRACE_DAYS = 1` (hết ngày kế tiếp
   sau `workDate`). Trong hạn → `isRetroactive: false`; ngoài hạn → bắt buộc
   `retroactiveReason`, thiếu thì 400 `OVERTIME_RETROACTIVE_REASON_REQUIRED`.
   Lý do: nghiệp vụ thật là *nhân viên tự report sau khi đã làm OT* để ghi công,
   manager đã giao việc tại chỗ — nên không được chặn báo chậm bằng một gate cứng.
4. **Enforcement**: submit = projection từ `requestedMinutes` → chỉ WARNING;
   approve = số thật → 422 BLOCK. (Điểm tension giữa (2) và "check cả lúc submit"
   được giải quyết bằng projection, không bằng tính hai lần.)

## Kiến trúc

```
src/common/vietnam-time.ts            VN UTC+7, no DST — vnDayBounds / vnTimeToUtc /
                                      parseWindowInstant / vnDateOf  (S0)
src/hr/overtime/overtime-domain.ts    thuần, không Nest/DB — interval algebra nửa mở
                                      [from,to), Math.floor, computeOvertime(),
                                      overtimeTypeOf(), inputHashOf()
src/hr/overtime/overtime.service.ts   đọc 5 collection, ghi overtime_results,
                                      guards (self-type / overlap / retro), precheck,
                                      recompute/invalidate/listResults/totalsByType
src/hr/overtime/dto/overtime.dto.ts   DTO whitelist-able
src/hr/overtime/overtime.controller.ts + module
```

Interval algebra **không** dùng `moment`/luxon: mọi phép là số học ms trên
`[from,to)`, `sumMinutes` dùng `Math.floor` (1 giây lẻ = 0 phút — hết bug
`Math.round`). Break không bị trừ riêng khỏi OT: nó nằm trong scheduled interval
đã bị trừ ở bước `eligible = subtract(intersect(approved, actual), scheduled)`,
nên không phút nghỉ nào thành OT được — ghi rõ trong doc comment của
`computeOvertime`.

`OvertimeService` **không** import `ManagerRequestService` (tránh cycle) — inject
thẳng model `ManagerRequest`. Ngược lại, `ManagerRequestService`, `AttendanceService`
và `CalendarService` nhận `@Optional() overtime?` ở **vị trí cuối constructor** để
spec cũ gọi theo vị trí không phải sửa.

`overtime.module.ts` phải tự đăng ký `{name:'User'}` + `{name:'UserSession'}` trong
`MongooseModule.forFeature` — `AuthGuard` resolve 2 token này từ context của module
đang import (convention có sẵn ở `policies.module.ts:24-28`); thiếu là controller mới 500 thay vì 401.

## Seam duyệt — `ManagerRequestService.decide()`

Thứ tự có chủ đích:

```
checks cũ (SELF_APPROVAL_FORBIDDEN / REVIEW_REASON_REQUIRED / OVERTIME_WINDOW_INVALID)
→ if OVERTIME && APPROVED: ot.precheckApproval()     // 422 BLOCK — TRƯỚC khi ghi
→ findOneAndUpdate (version filter)
→ if OVERTIME && APPROVED: ot.onApproved()           // PROVISIONAL result — SAU khi ghi
→ if violations.length: notifyComplianceWarning()     // WS, không chặn
```

- BLOCK **trước** ghi: một approval bị từ chối phải để lại `status` và `version`
  nguyên vẹn, nếu không queue của manager hiển thị một quyết định chưa từng xảy ra.
  Integration test assert đúng điều này (`labor-limits.integration.spec.ts`
  "blocks a monthly overtime breach and leaves the request untouched").
- Result ghi **sau** `findOneAndUpdate`: người duyệt thứ hai thua version filter ở
  trên nên không tới đây. Write fail **không** un-approve request (idempotent
  upsert + `POST /api/hr/overtime-results/recalculate` phục hồi).
- `otGuards()` gom `assertNoClientType` + `assertNoOverlap` + `deriveRetroactive`
  để `POST /api/requests` và `POST /api/overtime` không thể lệch nhau. Route cũ
  của web vẫn chạy qua cùng engine → nhận phân loại + gate 422 miễn phí, web
  không phải đổi vội.

## §30B.1 — không hard-code ngưỡng

`policies-domain.laborLimitsFromPolicy(row)` mới, thay cho đoạn map thủ công trùng
lặp ở `policies.service.ts`. `usageFor()` chỉ đưa metrics vào
`evaluateLaborLimits(laborLimitsFromPolicy(policy), usage)` — không một con số
pháp lý nào xuất hiện trong calculation service. Policy được đọc **theo `workDate`**
(`laborPolicyFor` probe giữa trưa giờ VN), không theo hôm nay.

Policy thiếu → `LABOR_POLICY_NOT_FOUND`: **tolerate ở submit** (request đã được ghi,
một lỗ hổng cấu hình HR không được phép báo với nhân viên rằng công anh ta làm bị
từ chối — trả `compliance: null` + `complianceNote`), **đòi ở approve** (404, vì
không có căn cứ để block hay cho qua).

## Endpoints (§16.6C)

| Method | Path | Role |
|---|---|---|
| POST | `/api/overtime` | EMPLOYEE, DEPARTMENT_MANAGER, HR |
| GET | `/api/overtime/mine?month=YYYY-MM` | như trên |
| POST | `/api/manager/overtime/:id/approve` \| `/reject` | DEPARTMENT_MANAGER |
| GET | `/api/hr/overtime-results?from&to&employeeId&departmentId` | HR |
| POST | `/api/hr/overtime-results/recalculate` | HR (backfill + recovery) |

Trust boundary BR-OT-01/AC-OT-01: `assertNoClientType` chặn
`CLIENT_TRUSTED_OT_FIELDS = [overtimeType, actualMinutes, eligibleMinutes, status, managerId]`
→ 400 `OVERTIME_SELF_TYPE_FORBIDDEN`; field lạ khác do `forbidNonWhitelisted` chặn
thành 400 `VALIDATION_FAILED`. Ngoài tenant → 404 `REQUEST_NOT_FOUND` (không 403-on-exists).

## Acceptance criterion → Implementation → Test

| Tiêu chí | Triển khai | Test | Trạng thái |
|---|---|---|---|
| FR-OT-01/BR-OT-01 nhân viên không tự chọn loại OT | `assertNoClientType` + `overtimeTypeOf` suy từ calendar/shift | unit `overtime.service.spec.ts` "refuses a client that sent its own overtime type"; integration "refuses a client that sent its own overtime type" (400, DB 0 row) | Đạt |
| AC-OT-01 loại do hệ thống sinh, chỉ lưu window lúc submit | `create()` không tính eligible; `onApproved` mới sinh result | integration: `filed.body.data.overtimeType` là `undefined`; unit `overtime-domain.spec.ts` 3 test phân loại | Đạt |
| AC-OT-02 lễ thắng nghỉ tuần, không đếm trùng | `overtimeTypeOf` precedence PUBLIC_HOLIDAY > WEEKLY_OFF > WORKING_DAY (tái dùng `resolveClassification`) | unit `overtime-domain.spec.ts` "holiday trùng weekly off…"; integration "classifies the same request as a public holiday from the calendar alone" (holiday ⇒ không trừ scheduled, eligible = cả window đã làm) | Đạt |
| AC-OT-03 / BR-OT-02 chưa check-out ⇒ 0 phút | `computeOvertime` note `NO_ACTUAL_ATTENDANCE` | unit "is zero without punches"; integration "pays nothing for an approved window nobody actually worked" | Đạt |
| FR-OT-02 / AC-OT-04 eligible ≤ approved, ≤ phút làm thật | `subtract(intersect(approved, actual), scheduled)` rồi `min(approvedMinutes)` | unit "drops the part of an approved window that was not worked"; integration "caps eligible at the minutes actually worked" (approved 240, eligible 120) và "shows eligible (not wall-clock) overtime in the attendance history" | Đạt |
| BR-OT-03 loại trừ phút theo lịch | `subtractIntervals(eligible, scheduled)`; `scheduledMinutesOf` net break (08:00–17:00/60 ⇒ **480**, khớp `normalDailyMinutes` seed §30B.1) | unit "counts nothing for a window that sits inside the schedule" (`FULLY_WITHIN_SCHEDULE`); integration assert `scheduledMinutes: 480` | Đạt |
| BR-OT-04 không trùng cửa sổ OT cùng ngày | `assertNoOverlap` nửa mở, loại `REJECTED`, loại chính request đang sửa → 409 `OVERTIME_OVERLAP` | unit "rejects an overlapping window…"; integration 409 overlap + 201 adjacent | Đạt |
| BR-OT-05 / AC-OT-05 stale khi calendar/policy đổi | `inputHash` trên mọi input; `listResults` so khớp ⇒ `recalculationRequired`; `calendar.service` gọi `invalidate()` | unit staleness (5 test); integration "lists results for HR and flags a stale one after a calendar edit" + `recalculate` ⇒ `scanned:1 changed:1` rồi `changed:0` | Đạt |
| §30B.2 BLOCK daily/weekly/monthly/annual, lưu `policyVersion`+`legalReference` | `precheckApproval` → `UnprocessableEntityException(422)`; `persistResult` ghi 2 field | unit `TASK-070 labor limits`; integration `labor-limits.integration.spec.ts` 10 test (4 mã BLOCK, warning không chặn, policy theo workDate, cửa sổ thứ 2 cộng dồn, policy thiếu ⇒ 404) | Đạt |
| WARNING không chặn, báo Employee/Manager/HR | `notifyComplianceWarning` emit `compliance:warning` vào `user:`, `dept:`, `org:…:managers` | integration "warns at the threshold without blocking" (201 + 2 violation WARNING) + `violations` có trong response | Đạt |
| AC-OT-06 tổng theo loại cho kỳ | `totalsByType` `$group` theo `(org, periodKey, overtimeType)`; `periodKey`/`yearKey` lưu sẵn để bucket index được | unit "buckets eligible minutes by type"; integration "aggregates the period by type the way Sprint 6 will" | Đạt |
| §17 idor / optimistic version | tenant filter + version filter; unique index `(organizationId, overtimeRequestId)` | integration "keeps one tenant's data out of another's reach" (404 cả GET lẫn approve) + "turns a stale expectedVersion into 409" (1 request, 1 result) | Đạt |
| Index §15.11 | 4 index trên `overtime-result.schema.ts` | `overtime-schema.spec.ts` (7 test, `hasCompoundIndex`) + `npm run ensure-indexes` | Đạt |

## 5 bug production mà lane integration bắt được

Unit suite với fake model **không** bắt được, vì fake luôn trả đúng shape test
viết ra. Ghi lại vì cả 5 đều là lỗi im lặng (silent wrong answer), không phải crash:

1. **`persistResult` stringify một populated ref.** `employeeId: String(request.employeeUserId)`
   — đường duyệt truyền request **sau** `detail()`, tức `employeeUserId` đã là object
   → `CastError ... "[object Object]" at path "employeeId"`. Fix: helper
   `otEmployeeUserId(request)` nhận cả 2 shape (đã có unit test cho chuyện này
   trong `overtime.service.spec.ts` "looks up punches by the User id even when
   employeeUserId arrives populated" — nhưng production path dùng shape khác).
2. **`dayAsDate` trả giữa trưa UTC trong khi cột lưu UTC midnight.**
   `manager_requests.workDate` là `Date` lưu `new Date('YYYY-MM-DD')` = 00:00Z;
   query dựng ra 12:00Z ⇒ **match rỗng**, overlap guard đọc thành "không có request
   nào trùng" nên **chấp nhận cả cửa sổ OT trùng nhau** (BR-OT-04). Fix: `T00:00:00.000Z`.   Ảnh hưởng `assertNoOverlap`, `recompute`, `recomputeForDay`.
3. **`laborPolicyFor` probe giữa trưa UTC.** `vnDayBounds(...).to` là 17:00 UTC,
   nên một probe 12:00Z rơi vào **sáng hôm sau** theo giờ VN ⇒ đọc nhầm policy
   dated hôm sau. Fix: giữa trưa **giờ VN** (`from + 12h`).
4. **`DecideOvertimeDto.expectedVersion` thiếu validator decorator.** Với
   `ValidationPipe({whitelist, forbidNonWhitelisted})`, một prop không có decorator
   bị coi là field lạ ⇒ mọi approve **400 `VALIDATION_FAILED`**. Fix: `@IsInt() @Min(1)`.
5. **`GET /api/overtime/mine?month=` trả 0 row.** `String(row.workDate).slice(0,7)`
   trên một `Date` cho `"Fri Sep"`. Fix: `monthKeyOf()` qua `vnDateOf`.

Thêm 1 quyết định ordering phát hiện qua test: submit không được 404 vì
`LABOR_POLICY_NOT_FOUND` (see §30B.1 ở trên).

## Test

Unit (`npm test`, jest `rootDir: src`): **47 suites / 482 tests, PASS, exit 0**.
Tăng từ baseline 43 suites. Suite mới:

| File | Tests | Phủ |
|---|---|---|
| `src/common/vietnam-time.spec.ts` | 9 | parity với `parseDateTime` cũ, naive = giờ VN, có offset = instant |
| `src/hr/overtime/overtime-domain.spec.ts` | 33 | phân loại 3 loại, floor chứ không round, clamp cross-midnight, break không thành OT, hash đổi khi input đổi |
| `src/hr/overtime/overtime.service.spec.ts` | 28 | fake model cho 5 collection; guards, retro, upsert §15.11, precheck, staleness, totals |
| `src/database/schemas/overtime-schema.spec.ts` | 7 | 4 compound index |
| `src/hr/manager/manager-request.service.spec.ts` | +7 | precheck chạy **trước** ghi, ATTENDANCE không chạm hook, self-approve chặn trước mọi precheck |

Integration (`npm run test:integration`, `test/jest-integration.config.js`):
**2 suites / 26 tests, PASS**.

- `overtime-flow.integration.spec.ts` (16) — AC-OT-01..06 end-to-end qua HTTP thật.
- `labor-limits.integration.spec.ts` (10) — §30B.2, 422 không làm đổi status/version.

Harness (`Apps/api/test/`) — 2 điểm phải ghi để người sau không phá:

- **`app-factory.ts` resolve connection qua `getConnectionToken()`.**
  `MongooseModule.forRoot` dùng `mongoose.createConnection()` (đã verify trong
  `node_modules/@nestjs/mongoose/dist/mongoose-core.module.js:114`) ⇒ global
  `mongoose.connection` **không bao giờ** connected. Grab cái global cho ra
  `TypeError: ... reading 'db'`, và `mongoose.model(name)` không tìm thấy gì.
- **Không import `AppModule`**: `database.module.ts` gọi `resolveEnv()` ngay lúc
  load module ⇒ nối Atlas thật + đổi DNS global qua `config/dns.ts`.
- Auth đi qua `AuthGuard` **thật**: dựng `UserSession` với `tokenHash = hashToken(sid)`
  rồi gửi `Cookie: sid=…`. Không override guard — nếu override thì mọi assert error
  code là giả.
- `configureApp(app)` là bắt buộc (ValidationPipe + AllExceptionsFilter sống ở đó).
- `MongoMemoryReplSet` (standalone **không** hỗ trợ session/transaction);
  `MONGODB_URI_TEST` được ưu tiên nếu set, và bị từ chối nếu trùng db với app.
  **Không bao giờ** chạy lane này vào `MONGODB_URI` trong `.env`.
- **Không hard-code ngày.** `recentWorkDate()` dẫn `workDate` từ `Date.now()` qua
  đúng công thức grace window service dùng, nên suite không tự đỏ sau một tuần
  (đã từng đỏ: 13× 409 `OVERTIME_RETROACTIVE_REASON_REQUIRED` vì fix ngày 2026-09-22
  trong khi hôm đó là 2026-09-25).

## Rà soát lại 2026-09-26

- Xoá `resultsByRequestId` — một `Map` dựng trùng với `dayResults` trong
  `attendance.service.getHistory()`, không chỗ nào đọc (dead code do edit trước để lại).
- 4 fix production ở trên đều có regression test đi kèm, không fix nào "chỉ sửa cho xanh":
  `overtime.service.spec.ts` được cân bằng lại fixture `workDate` (noon → UTC midnight)
  **sau** khi fix #2, suite unit vẫn 61/61 rồi 482/482.
- Hai expectation đã sai **về phía test, không phải code**, và đã sửa test:
  (a) `scheduledMinutes` kỳ vọng 540 — thực tế 480 vì `scheduledMinutesOf` net break;
  (b) threshold test kỳ vọng 1 violation — thực tế 2 (`normalDaily` ở 100% và
  `maxMonthlyOvertime` ở 80%), đúng những gì §30B.1 muốn flag.
- Id shape: một document `.lean()` trả `ObjectId`, nên `toMatchObject` so với string
  **fail** — lane integration so id qua `String(...)` trong một `toEqual` riêng.
- Lane không để `mongod` in-memory cô lập (chỉ còn Windows service có sẵn).

## Bổ sung D39 (2026-09-26) — trần nộp OT, cấm lấn ca, OT chưa báo

User nêu: OT chỉ được báo *sau khi làm* ⇒ cap §30B chỉ đo phút đã duyệt, và một
window đăng ký giữa ca hành chính là vô nghĩa về tiền nhưng vẫn chiếm hạn mức.
Docs đã *cố ý* chọn grace-window thay gate cứng (D38) — nên đây là **bổ sung**,
không lật D38. Chi tiết quyết định: `Docs/DOCS_DECISION_LOG.md` D39.

- **`maxRetroactiveFilingDays`** trên `LaborCompliancePolicy` (default 7, seed
  cùng giá trị): ngoài trần ⇒ 409 `OVERTIME_FILING_WINDOW_CLOSED`, lý do dài mấy
  cũng không mua được. Grace 1 ngày của D38 nằm *trong* trần đó.
- **`OVERTIME_OVERLAPS_SCHEDULE`** — chặn lúc gửi *và* lúc duyệt (manager nới
  window cũng phải sạch). Guard dùng đúng `scheduledIntervals()` mà calculator
  trừ ⇒ thứ bị chặn chính là khung có `eligibleMinutes = 0`; không có khái niệm
  "ca hành chính" thứ hai để drift. Ngày không resolve ra ca ⇒ auto pass.
  Thứ tự guard: schedule → overlap → retro.
- **OT làm mà không báo**: `unreportedOvertimeMinutes` = punch − scheduled −
  window PENDING/APPROVED, bắn `compliance:warning {reason:'UNREPORTED_OVERTIME'}`
  fire-and-forget lúc check-out. Không chặn chấm công.
- **`GET /api/overtime/schedule?date=`** để web hỏi đúng resolver, thay vì client
  tự suy precedence DEPARTMENT > ORGANIZATION.
- **Reversal của D38 "không sửa Apps/web"**: form cũ POST `/api/requests` (không
  qua projection §30B.2) và thiếu input `workDescription`/`retroactiveReason` —
  nay OT đi `POST /api/overtime`, hiển thị ca được gán, báo sớm lỗi lấn ca, render
  `compliance.violations`; ManagerScreen dịch lỗi qua `hrErrorMessage` và giữ dialog
  mở khi duyệt xong mà có WARNING; cả hai screen nghe `compliance:warning`.
- Test mới: `test/overtime-filing-rules.integration.spec.ts` (9 HTTP test) chứng
  minh guard chạy **trước** ghi: từ chối ⇒ 0 document; duyệt hỏng ⇒ request còn
  PENDING/version cũ, 0 result.

### Kiểm chứng (D39)

```powershell
cd CoreStaff/Apps/api
npx tsc --noEmit              # exit 0
npx jest                      # 47 suites / 497 tests — PASS
npm run test:integration      # 3 suites / 35 tests  — PASS
cd ../web
npx tsc --noEmit              # exit 0
npx vite build                # OK
```

`tests/policies.test.tsx › "labor edit PATCHes only changed fields"` fail
**trước và sau** khi sửa (đã stash 4 file web để xác nhận) — timeout 40s ở helper
menu base-ui của chính test đó, không liên quan OT.


1. **`Apps/web` chưa đổi** (tránh conflict branch `UI-Webs`) — việc của team web:
   thêm `overtimeType`/`eligibleMinutes`/`classificationStatus` vào
   `Attendance/types.ts` và render 3 field này.
   **`getHistory().otMinutes` giờ là số *eligible*, nhỏ hơn trước** (khi punch
   ngắn hơn window). Đây là chủ đích theo AC-OT-04 — **đừng "sửa lại như cũ"**.
   → **Cập nhật D39:** phần form OT / duyệt OT đã đổi sang `POST /api/overtime` và
   render ca + compliance. Còn lại đúng 3 field `overtimeType`/`eligibleMinutes`/
   `classificationStatus` trong `Attendance/types.ts` — vẫn chưa làm.
2. **§30K chưa chốt**: `maxCombinedDailyMinutes: 720` và
   `maxMonthlyOvertimeMinutes: 2400` trong seed là **giá trị demo**, chưa HR-legal
   xác nhận. 720 với 480 nghĩa là mọi ngày OT > 240 phút bị BLOCK (đúng tinh thần
   BLLĐ 8h + 4h). Test **không** hard-code ngưỡng này: mỗi test tự hạ một con số
   của policy được seed, nên khi HR-legal đổi số thì suite không phải sửa.
3. **Backfill**: request đã APPROVED trước TASK-069 không có result ⇒ dashboard 0
   tới khi gọi `POST /api/hr/overtime-results/recalculate` (cap ≤366 ngày).
4. **TOCTOU giữa precheck và ghi**: hai manager duyệt song song vẫn có thể cùng
   vượt monthly cap — `ponytail:` comment đã ghi ngay tại `precheckApproval`,
   guard thuộc Sprint 6 (khi có `TimesheetPeriod` + transaction).
5. **`DayClassificationService.classify` không dùng trực tiếp**: nó truyền cùng một
   id cho `EmployeeDayOverride.employeeId` (profile id) và `ShiftResolverService`
   (user id) — bug có sẵn, cần owner module leave xử lý; service OT tự tra 3 bảng
   với đúng id.
6. **Per-minute attribution giữa các loại trong một ngày** không làm — một ngày
   đúng một `overtimeType`, "một phút một loại" giữa các request do guard
   `OVERTIME_OVERLAP` đảm bảo. Chỉ cần khi có ca đêm (ngoài MVP, §30J).
7. `TimesheetPeriod`/`periodId`/confirmation không tạo (Sprint 6). Seam đã sẵn:
   `recompute(..., {targetStatus:'FINAL'})` là nguyên tử duy nhất Sprint 6 cần gọi.

## Kiểm chứng

```powershell
cd CoreStaff/Apps/api
npm run lint                 # tsc --noEmit — PASS (exit 0)
npm test                     # 47 suites / 482 tests — PASS
npm run test:integration     # 2 suites / 26 tests  — PASS (MongoMemoryReplSet)
npm run ensure-indexes       # tạo 4 index overtime_results
```

`npx tsc -p tsconfig.json --noEmit` trên cả `src/` lẫn `test/`: không lỗi.

Smoke live trên Atlas (port 3000, **không** đụng port 20128) — 5 bước của plan §9,
đã định sẵn nhưng **chưa chạy** ở phiên này:

1. `POST /api/requests {type:'OVERTIME'}` bằng employee có punch thật (ca config khác 08:00–17:00 để chứng minh không hard-code).
2. `POST /api/manager/approvals/:id/approve` → đọc `overtime_results`: type do backend sinh, `eligibleMinutes = (approved ∩ punch) − scheduled`, `policyVersion`+`legalReference` có giá trị.
3. Retry payload có `overtimeType` → 400 `OVERTIME_SELF_TYPE_FORBIDDEN`.
4. Hạ `maxMonthlyOvertimeMinutes` xuống dưới số đang có → 422 `OVERTIME_MONTHLY_LIMIT_EXCEEDED`, request vẫn PENDING.
5. `PATCH` calendar sang `PUBLIC_HOLIDAY` → `recalculationRequired`, `recalculate` đổi type sang `OT_PUBLIC_HOLIDAY`.

Bước 1–5 đã được chứng minh ở lane integration với đúng HTTP routes, guards,
ValidationPipe và exception filter thật; khác biệt duy nhất còn lại là dữ liệu
Atlas thật (punch thật, ca không phải 08:00–17:00).

## File thay đổi

**Sửa (15, +276/−27)**: `attendance.module.ts`, `attendance.service.ts`,
`attendance/services/attendance-calculator.service.ts`,
`database/schemas/manager-request.schema.ts` (+4 optional: `workDescription`,
`isRetroactive`, `retroactiveReason`, `otComputationVersion`),
`database/schemas/registry.ts`, `events/events.gateway.ts`,
`hr/calendar/calendar.module.ts`, `hr/calendar/calendar.service.ts`,
`hr/hr.module.ts`, `hr/manager/dto/manager-request.dto.ts`,
`hr/manager/manager-request.service.spec.ts`, `hr/manager/manager-request.service.ts`,
`hr/manager/manager.module.ts`, `hr/policies/policies-domain.ts`, `hr/policies/policies.service.ts`.

**Mới (21)**: `src/common/vietnam-time.ts`(+spec), `src/database/schemas/overtime-result.schema.ts`,
`src/database/schemas/overtime-schema.spec.ts`, `src/hr/overtime/{overtime-domain,overtime-domain.spec,overtime.service,overtime.service.spec,overtime.controller,overtime.module}.ts`,
`src/hr/overtime/dto/overtime.dto.ts`, `test/{app-factory,env-guard,fixtures,global-setup,global-teardown,mongo-memory}.ts`,
`test/jest-integration.config.js`, `test/{overtime-flow,labor-limits}.integration.spec.ts`.

Edit vào file chung đều ≤10 dòng, không reformat (`registry.ts`, `hr.module.ts`,
`manager.module.ts`, `manager-request.service.ts`, `attendance.service.ts` là 5
điểm conflict tiềm năng — rebase `origin/deploy` trước khi push).
