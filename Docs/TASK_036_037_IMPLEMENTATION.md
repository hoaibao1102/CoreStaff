# TASK-036 / TASK-037 — LaborCompliancePolicy & OvertimePayPolicy (Backend API)

Ngày: 2026-09-21. Phạm vi đã được người dùng chỉ định: **làm backend/API trước**, chưa làm UI/web.
Cả hai task đều thuộc Sprint 3 — Contract, Salary Profile & Policies, do 2026-09-24, mỗi task 6 pts.

- **TASK-036 `LaborCompliancePolicy`** — hoàn thiện artifact, API, acceptance criteria và kiểm thử (SRS §30B).
- **TASK-037 `OvertimePayPolicy`** — hoàn thiện artifact, API, acceptance criteria và kiểm thử (SRS §30D.2), phụ thuộc TASK-036.

## 1. Mục đích

- **LaborCompliancePolicy**: đơn vị cấu hình hiệu lực theo ngày (effective-dated) cho giới hạn giờ làm/giờ tăng ca của một tổ chức, dùng để áp dụng khi duyệt chấm công và validate lương thử việc. Chứa toàn bộ giới hạn §30B.1 (giờ thường ngày, tuần, tổng ngày, tăng ca tháng/năm, ngưỡng cảnh báo %, mức lương thử việc tối thiểu, tham chiếu pháp lý).
- **OvertimePayPolicy**: đơn vị cấu hình hiệu lực theo ngày cho hệ số lương tăng ca (làm việc ngày thường / nghỉ tuần / lễ), dùng để tính trả lương tăng ca. Hệ số lưu dạng số nhân thập phân (1.5 / 2.0 / 3.0), nhất quán với quy ước `probationMinimumRate: 0.85` đang có trong codebase.

## 2. Mô hình miền (domain model)

Cả hai policy dùng chung mẫu **effective-dated, versioned, tenant-scoped** đã có trong module compensation:

- `organizationId` — phạm vi tenant (bắt buộc).
- `effectiveFrom`/`effectiveTo` — cửa sổ hiệu lực **half-open**: `effectiveFrom ≤ ngày < effectiveTo`, `effectiveTo` null nghĩa là mở tới vô cùng. Không cho hai cửa sổ chồng lấn (`assertNoEffectiveOverlap`, lỗi `EFFECTIVE_DATE_OVERLAP`). Hai cửa sổ liên tiếp sát nhau (`effectiveTo` cũ = `effectiveFrom` mới) là hợp lệ.
- `version` — tăng tự động mỗi lần cập nhật (`$inc: 1`); `active` — tắt/hiệu lực.
- Tra cứu "hiệu lực tại ngày" (effective-at): `active:true, effectiveFrom ≤ at, (effectiveTo null hoặc > at)`, sort `effectiveFrom desc`.

### evaluateLaborLimits (TASK-036 — thuần hàm, không DB)

Kiểm đồng thời ngày/tuần/tháng/năm trên metrics đầu vào; mỗi kết quả kèm `policyVersion` + `legalReference` (SRS §30B.2:2524, §30K).

| Khóa | Metrics | Giới hạn | Mã lỗi (§30H) |
|---|---|---|---|
| `normalDaily` | `normalDailyMinutes` | `normalDailyMinutes` | `NORMAL_HOURS_LIMIT_EXCEEDED` |
| `normalWeekly` | `normalWeeklyMinutes` | `normalWeeklyMinutes` | `NORMAL_HOURS_LIMIT_EXCEEDED` |
| `maxCombinedDaily` | `combinedDailyMinutes` | `maxCombinedDailyMinutes` | `OVERTIME_DAILY_LIMIT_EXCEEDED` |
| `maxMonthlyOvertime` | `overtimeMonthlyMinutes` | `maxMonthlyOvertimeMinutes` | `OVERTIME_MONTHLY_LIMIT_EXCEEDED` |
| `maxAnnualOvertime` | `overtimeAnnualMinutes` | `maxAnnualOvertimeMinutes` (nếu vượt → headroom `exceptionalAnnualOvertimeMinutes`) | `OVERTIME_ANNUAL_LIMIT_EXCEEDED` |

- Mức > giới hạn → `severity: BLOCK`, `approvable=false`.
- Mức từ `warningThresholdPercent%` tới giới hạn → `severity: WARNING` (vẫn approvable).
- Annual: nếu `overtimeAnnualMinutes` vượt `maxAnnualOvertimeMinutes`, giới hạn được nới tới `exceptionalAnnualOvertimeMinutes` trước khi BLOCK. `exceptionalAnnualOvertimeMinutes` không bao giờ được đọc như sàn chặn.
- Metrics không hợp lệ (âm / không hữu hạn) → ném `INVALID_LABOR_USAGE:{key}`.

### resolveOvertimeRates (TASK-037 — thuần hàm, không DB)

Phân loại mỗi ngày theo thang ưu tiên (§30D.2:2610, AC-OT-PAY-01):

1. `isPublicHoliday` → `OT_PUBLIC_HOLIDAY` (hệ số `publicHolidayRate`), **kể cả khi ngày đó cũng là nghỉ tuần** — không tính trùng.
2. còn lại `isWeeklyOff` → `OT_WEEKLY_OFF` (`weeklyOffRate`).
3. còn lại → `OT_WORKING_DAY` (`workingDayRate`).

Trả `{ rates: [{date, type, rate}], policyVersion, legalReference }`. Hệ số âm → ném `INVALID_OVERTIME_RATE`.

## 3. Thay đổi cơ sở dữ liệu (schemas)

Tất cả tại `CoreStaff/Apps/api/src/database/schemas/compensation.schema.ts` — cùng file với SalaryProfile/allowance/bonus đang có:

- **`LaborCompliancePolicy`** (giữ nguyên `collection: 'labor_compliance_policies'`, timestamps, index `{ organizationId: 1, effectiveFrom: -1 }`) — **mở rộng thêm** các trường bắt buộc `min:0, required: true`:
  `normalDailyMinutes, normalWeeklyMinutes, maxCombinedDailyMinutes, maxMonthlyOvertimeMinutes, maxAnnualOvertimeMinutes, exceptionalAnnualOvertimeMinutes` (số nguyên phút), `warningThresholdPercent` (`min:0, max:100`), `probationMinimumRate` (`min:0.01, max:1`, đã có), `legalReference` (string bắt buộc trim). Giữ `version`/`active`.
- **`OvertimePayPolicy`** (mới, `collection: 'overtime_pay_policies'`, timestamps, index `{ organizationId: 1, effectiveFrom: -1 }`):
  `organizationId, effectiveFrom, effectiveTo?` + `workingDayRate, weeklyOffRate, publicHolidayRate` (`min:0, required: true`) + `legalReference` + `version`/`active`.
- `OvertimeType` enum: `OT_WORKING_DAY / OT_WEEKLY_OFF / OT_PUBLIC_HOLIDAY`.
- **SCHEMA_REGISTRY** (`src/database/schemas/registry.ts`): đăng ký `OvertimePayPolicy` cho DatabaseModule/ensure-indexes.

## 4. API endpoints

`@Controller('hr/policies')`, `@UseGuards(AuthGuard, RolesGuard)`, mọi route `@Roles('HR')` (không tạo role mới — theo yêu cầu người dùng). Mọi response đúng envelope `{ success: true, data }`; lỗi theo global filter `{ success:false, error:{ code, message } }` (contract §30G).

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/hr/policies/labor` | Danh sách policy (tenant, sort `effectiveFrom` desc) |
| GET | `/api/hr/policies/labor/effective?date=YYYY-MM-DD` | Policy hiệu lực tại ngày; 404 `LABOR_POLICY_NOT_FOUND` |
| POST | `/api/hr/policies/labor` | Tạo (effective-dated; reject trùng cửa sổ) |
| PATCH | `/api/hr/policies/labor/:id` | Cập nhật (`version++`, re-validate cửa sổ) |
| GET | `/api/hr/policies/labor/preview?date=&…` | Enforcement preview (AC-LABOR-01) |
| GET | `/api/hr/policies/overtime` | Danh sách policy (tenant) |
| GET | `/api/hr/policies/overtime/effective?date=` | Policy hiệu lực tại ngày; 404 `OVERTIME_POLICY_NOT_FOUND` |
| POST | `/api/hr/policies/overtime` | Tạo (effective-dated; reject trùng cửa sổ) |
| PATCH | `/api/hr/policies/overtime/:id` | Cập nhật (`version++`) |
| GET | `/api/hr/policies/overtime/rates?date=&weeklyOff=&publicHoliday=` | Rate resolution, không tính trùng (AC-OT-PAY-01) |

## 5. Request/Response DTO

`src/hr/policies/dto/policies.dto.ts` — class-validator + transform (global `ValidationPipe { whitelist, forbidNonWhitelisted, transform }`), Swagger `@ApiProperty`.

**CreateLaborPolicyDto** (bắt buộc trừ ghi chú): `effectiveFrom` `@IsDateString`, `effectiveTo?` `@IsDateString`, `normalDailyMinutes`/`normalWeeklyMinutes`/`maxCombinedDailyMinutes`/`maxMonthlyOvertimeMinutes`/`maxAnnualOvertimeMinutes`/`exceptionalAnnualOvertimeMinutes` `@IsInt @Min(0)`, `warningThresholdPercent` `@IsInt @Min(0) @Max(100)`, `probationMinimumRate` `@IsNumber @Min(0.01) @Max(1)`, `legalReference` `@IsString`, `active?` `@IsBoolean` (default true).

**CreateOvertimePolicyDto**: `effectiveFrom`/`effectiveTo?`, `workingDayRate`/`weeklyOffRate`/`publicHolidayRate` `@IsNumber @Min(0)`, `legalReference`, `active?`.

**Update*Dto extends PartialType()**. Query DTO: `PreviewLaborLimitsQuery` (các metrics phút `@IsInt @Min(0)`), `PreviewOvertimeRatesQuery` (`date` `@IsDateString`, `weeklyOff?`/`publicHoliday?` `@IsBoolean`).

Note: hệ số tăng ca nhận từ request là **số nhân thập phân** (1.5 = +150%). Giá trị 150/200/300 của VN chỉ tồn tại ở seed script — không bao giờ hard-code trong service (§30B.1:2516, §30K).

## 6. Authorization

- `AuthGuard` (session) + `RolesGuard`.
- Mọi route `@Roles('HR')` — chỉ vai trò HR hiện có; Employee/Manager/Department Manager là phạm vi Sprint 4/5 payroll, không thuộc task.
- Tenant từ `@Tenant()` → `requireOrganizationId()`; policy luôn lọc/gắn theo tổ chức ở session. Cập nhật/thao tác theo `_id` khác tenant → 404 (không lộ dữ liệu chéo).

## 7. Business rules (cốt lõi)

- Không hai cửa sổ hiệu lực chồng lấn trong cùng tenant; cập nhật đổi ngày hiệu lực sẽ re-validate với các bản còn lại.
- `version` tăng 1 mỗi lần cập nhật — mọi kết quả enforcement/rates đính kèm `policyVersion` + `legalReference` để audit.
- `effectiveTo` trống (null) = hiệu lực mở tới vô cùng.
- Preview (preview/rates) chỉ đọc, không ghi; gọi hàm thuần `policies-domain.ts` với policy hiệu lực tại ngày.

## 8. Acceptance criteria — trạng thái

### TASK-036 LaborCompliancePolicy (AC-LCP-01..10)

| AC | Triển khai | Test | Trạng thái |
|---|---|---|---|
| AC-LCP-01 Tạo policy có đủ giới hạn §30B.1 | `CreateLaborPolicyDto` + schema `required` | `policies-schemas.spec.ts` (fields required), `policies.service.spec.ts` (create version auto) | **PASS** |
| AC-LCP-02 Không trùng cửa sổ hiệu lực | `assertNoEffectiveOverlap` | service spec "rejects overlapping", "allows back-to-back" | **PASS** |
| AC-LCP-03 Tra cứu policy hiệu lực tại ngày | effective-at window match | service spec "window match, not latest row" | **PASS** |
| AC-LCP-04 Thiếu policy → 404 rõ ràng | `LABOR_POLICY_NOT_FOUND` | service spec | **PASS** |
| AC-LCP-05 Cập nhật tăng version | `$inc version` + re-validate | service spec "bumps version", "cross-tenant 404" | **PASS** |
| AC-LCP-06 Tenant isolation | filter `organizationId` | service spec "lists only tenant", cross-tenant 404 | **PASS** |
| AC-LCP-07 Enforce giờ ngày/tuần (BLOCK khi vượt) | `evaluateLaborLimits` | domain spec | **PASS** |
| AC-LCP-08 Enforce tổng ngày, tăng ca tháng/năm | `evaluateLaborLimits` | domain spec | **PASS** |
| AC-LCP-09 Cảnh báo từ 80% ngưỡng, chưa chặn | `warningThresholdPercent` | domain spec "warns not blocks" | **PASS** |
| AC-LCP-10 Headroom ngoại lệ tăng ca năm | `exceptionalAnnualOvertimeMinutes` | domain spec | **PASS** |

### TASK-037 OvertimePayPolicy (AC-OTP-01..10)

| AC | Triển khai | Test | Trạng thái |
|---|---|---|---|
| AC-OTP-01 Tạo policy hệ số 3 mức | `CreateOvertimePolicyDto` + schema `required` | schemas spec + service create | **PASS** |
| AC-OTP-02 Không trùng cửa sổ | `assertNoEffectiveOverlap` | service spec | **PASS** |
| AC-OTP-03 Tra cứu hiệu lực tại ngày | effective-at window match | service spec | **PASS** |
| AC-OTP-04 Thiếu policy → 404 rõ ràng | `OVERTIME_POLICY_NOT_FOUND` | service spec | **PASS** |
| AC-OTP-05 Cập nhật tăng version | `$inc version` | service spec | **PASS** |
| AC-OTP-06 Tenant isolation | filter `organizationId` | service spec | **PASS** |
| AC-OTP-07 Resolve hệ số theo ngày thường/nghỉ/lễ | `resolveOvertimeRates` | domain spec | **PASS** |
| AC-OTP-08 Lễ rơi vào nghỉ tuần không tính trùng | thang ưu tiên public-holiday-first | domain spec + service preview | **PASS** |
| AC-OTP-09 Kèm policyVersion + legalReference | trả trong mọi kết quả | domain spec | **PASS** |
| AC-OTP-10 Hệ số âm bị từ chối | ném `INVALID_OVERTIME_RATE` | domain spec | **PASS** |

## 9. Test cases & kết quả

Không cần MongoDB thật — mô hình Mongoose giả trong bộ nhớ theo convention `assignment.service.spec.ts`, `compensation-domain.spec.ts` (đã có).

- `policies-domain.spec.ts` (14): evaluateLaborLimits approve/dưới ngưỡng, warn ở 80%, block theo mã ngày/tuần/tháng/năm, headroom năm, vượt headroom bị chặn, usage âm throw; resolveOvertimeRates phân loại 3 loại, không double-count lễ-rơi-vào-nghỉ, mang policyVersion/legalReference, hệ số âm throw.
- `policies-schemas.spec.ts` (4): index `{organizationId, effectiveFrom}` cả hai policy; trường §30B.1 và §30D.2 là `required`.
- `policies.service.spec.ts` (10): create gắn tenant + version auto; overlap reject + back-to-back ok; list tenant-scoped; effective-at chọn đúng cửa sổ + 404; update bump version + cross-tenant 404; preview labor (daily over-cap → `OVERTIME_DAILY_LIMIT_EXCEEDED`, not approvable); preview overtime (holiday-on-weekend → `OT_PUBLIC_HOLIDAY` 3.0).

**Kết quả:** `npx jest --runInBand src/hr/policies` → **3 suites / 28 tests PASS**.

## 10. Files

**Tạo mới (`CoreStaff/Apps/api/src/hr/policies/`):**

- `policies-domain.ts` — `evaluateLaborLimits`, `resolveOvertimeRates`, types, `LABOR_LIMIT_ERROR_CODE`; re-export `OvertimeType`.
- `policies.service.ts` — `PoliciesService` (2 model inject), CRUD effective-dated + preview.
- `policies.controller.ts` — 10 routes `/hr/policies/*`.
- `policies.module.ts` — forFeature 2 schemas, AuthModule, RolesGuard.
- `dto/policies.dto.ts` — DTO create/update/query.
- `policies-domain.spec.ts`, `policies-schemas.spec.ts`, `policies.service.spec.ts`.

**Sửa:**

- `src/database/schemas/compensation.schema.ts` — mở rộng LaborCompliancePolicy §30B.1; thêm OvertimePayPolicy + OvertimeType.
- `src/database/schemas/registry.ts` — đăng ký `OvertimePayPolicy`.
- `src/hr/hr.module.ts` — import `PoliciesModule`.
- `scripts/seed-compensation.ts` — seed idempotent `LaborPolicy` v1 + `OvertimePolicy` v1 (rates 1.5/2.0/3.0, `legalReference: 'BLLĐ 45/2019/QH14'`, `$setOnInsert`).
- `src/database/seed/seed.ts` — upsert per-org cho cả hai policy.
- `scripts/verify-compensation-seed.ts` — đếm `overtimePolicies` trong báo cáo.

## 11. Kiểm chứng (commands)

| Command | Kết quả |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` (lint) | PASS |
| `npx jest --runInBand src/hr/policies` | PASS — 3 suites / 28 tests |
| `npm run test` (npx jest --runInBand, toàn API) | 298 passed / 9 failed — **9 failed là pre-existing `workplace.service.spec.ts`**, có trước task; không do thay đổi này gây ra. Baseline trước đó: 9 failed / 270 passed |
| `npx nest build` (build) | PASS |

## 12. Phạm vi ngoài / còn lại

- **Chưa làm UI/web** (theo chỉ định: backend trước). Tiếp theo nên làm route + sidebar + màn hình trong `Apps/web`.
- Chưa nối payroll cuối tháng/duyệt chấm công vào 2 policy — đó là Sprint 4/5 (Employee/Manager delegation, timesheet enforcement). Preview endpoints đã sẵn sàng để tích hợp.
- Chưa chạy seed với MongoDB thật (cần `MONGODB_URI` + `.env`). Seed script có dry-run/`--apply` viết sẵn, chạy tay khi có môi trường.
- 9 test `workplace.service.spec.ts` đã fail sẵn từ trước — không thuộc phạm vi sửa của task.