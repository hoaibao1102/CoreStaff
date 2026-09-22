# CoreStaff API — Luồng code hiện tại (2026-09-22)

> Tài liệu này mô tả **những gì đang thực sự chạy trong code** (`CoreStaff/Apps/api/src`),
> không phải toàn bộ đặc tả trong `SRS_CORESTAFF.md`. Phần nào SRS có nhưng code
> chưa làm sẽ được ghi rõ ở mục 6. Nếu code và SRS lệch nhau, tài liệu này ưu tiên
> mô tả đúng **code**, và ghi chú SRS nói gì.

## 1. Request flow chung (mọi route tenant-scoped)

```text
HTTP request (cookie `sid`)
  → AuthGuard (auth/guards/auth.guard.ts)
      - đọc cookie, hash token, tìm UserSession còn hạn (expiresAt >= now, revokedAt = null)
      - tìm User theo session.userId
      - nếu User.mustChangePassword = true và route không @AllowTempPassword() → 403 AUTH_PASSWORD_CHANGE_REQUIRED
      - gắn req.user và req.tenantContext = { organizationId: session.organizationId ?? null }
  → RolesGuard (common/rbac.decorator.ts)
      - đọc @Roles(...) trên handler/class
      - SYSTEM_ADMIN luôn qua được (trừ @PlatformOnly nếu route chặn ngược)
      - role khác phải nằm trong danh sách @Roles, không thì 403 FORBIDDEN
  → Controller
      - lấy organizationId qua @Tenant() + requireOrganizationId() (403 TENANT_CONTEXT_REQUIRED nếu null — SYSTEM_ADMIN không có tenant)
      - KHÔNG BAO GIỜ lấy organizationId từ body/query của client
  → Service
      - mọi query Mongo đều có organizationId trong filter
      - tài nguyên khác tenant → 404 (không phải 403, để không lộ ID tồn tại hay không)
  → ValidationPipe global (configure-app.ts): whitelist + forbidNonWhitelisted + transform
      - field lạ trong body bị 400 VALIDATION_FAILED, không âm thầm bỏ qua
  → AllExceptionsFilter (common/http-exception.filter.ts)
      - mọi response lỗi theo envelope { success: false, error: { code, message, details } }
```

Điểm mấu chốt: **tenant isolation nằm ở tầng service, không phải chỉ ở guard** — mỗi
service tự thêm `organizationId` vào mọi `find/findOne/exists`. Đây là quy ước bắt
buộc cho mọi module mới (đã áp dụng cho cả 4 module Contract/SalaryProfile/
InsuranceProfile/InsurancePolicy thêm ngày 2026-09-22).

## 2. HR Core — CRUD thuần, không có công thức tính

Các module này (`hr/department`, `hr/position`, `hr/workplace`, `hr/shift-template`,
`hr/employee`, `hr/assignment`) **không tính toán tiền lương hay công**, chỉ quản lý
danh mục và hồ sơ:

| Module | Vai trò | Quy định đáng chú ý trong code |
|---|---|---|
| Department/Position | Danh mục tenant-scoped, soft-CRUD (`active` flag, không xóa cứng) | Unique `(organizationId, code)` |
| Workplace | Danh mục địa điểm làm việc | Có `defaultShiftTemplateId` |
| ShiftTemplate | Ca hành chính theo Workplace | 1 workplace = 1 shift template (unique index); `startTime < endTime` bắt buộc; không cho deactivate nếu còn `Assignment.active=true` tham chiếu tới workplace đó (`CANNOT_DEACTIVATE_SHIFT_IN_USE_BY_ACTIVE_ASSIGNMENTS`) |
| EmployeeProfile | Tách khỏi `User` (đăng nhập). Tạo theo 2 chế độ: link vào `User` có sẵn, hoặc `provisionProfile` tạo cả `User` mới (role EMPLOYEE, mật khẩu tạm) trong 1 Mongo transaction | `employeeCode` chuẩn hoá UPPERCASE (`normalizeEmployeeCode`), là chủ sở hữu duy nhất của mã này (không còn ở `User`) |
| EmploymentHistory | Append-only, ghi mỗi lần đổi `employmentStatus` | Transition hợp lệ theo `EMPLOYMENT_STATUS_TRANSITIONS` (vd RESIGNED/TERMINATED là trạng thái cuối, không đổi tiếp được); chặn tự duyệt chính mình (`SELF_APPROVAL_FORBIDDEN` khi actor = chủ hồ sơ) |
| Assignment | Gắn `User` vào `Department` (+ Workplace/ShiftTemplate tuỳ chọn), có `effectiveFrom/effectiveTo` | 1 user chỉ có 1 assignment active/department tại một thời điểm (unique index) |

Không có "cách tính" nào ở nhóm này — `ShiftTemplate` có `startTime/endTime/
breakMinutes/gracePeriodMinutes` nhưng **chưa có code nào cộng trừ ra
`scheduledWorkingMinutes`** (SRS §30A.4 có công thức này, nhưng module Attendance
tính công theo ca chưa tồn tại trong repo).

## 3. Contract → SalaryProfile → InsuranceProfile → InsurancePolicy

Bốn module thêm ngày 2026-09-22 (`hr/contract`, `hr/salary-profile`,
`hr/insurance-profile`, `hr/insurance-policy`) dùng chung **một pattern
"effective-dating"**, định nghĩa tại `common/effective-dating.ts`:

```text
mỗi entity = nhiều document, mỗi document là MỘT GIAI ĐOẠN [effectiveFrom, effectiveTo]
→ tạo bản ghi mới = tạo document mới, KHÔNG sửa document cũ (immutable)
→ không có API update/delete — sửa sai = tạo giai đoạn mới
→ khi tạo mới: rangesOverlap() chặn 2 giai đoạn của cùng employee/tổ chức đè lên nhau
→ đọc "giá trị đang hiệu lực tại ngày X": findEffective() tìm document có
  effectiveFrom <= X <= (effectiveTo ?? +∞)
```

Đây chính là cách "lịch sử thay đổi" được giữ mà không cần collection audit riêng —
list toàn bộ document theo `employeeId`/`organizationId` chính là lịch sử.

| Entity | File | Field chính | Nguồn |
|---|---|---|---|
| `EmploymentContract` | `database/schemas/employment-contract.schema.ts` | `contractType` (PROBATION\|FIXED_TERM\|INDEFINITE_TERM), `startDate`, `endDate` (bắt buộc trừ INDEFINITE_TERM) | SRS §30A.2, nguyên văn |
| `SalaryProfile` | `.../salary-profile.schema.ts` | `baseSalary`, `insuranceSalary` (tách biệt hoàn toàn), `probation*`, `version` | SRS §30D.1, nguyên văn |
| `InsuranceProfile` | `.../insurance-profile.schema.ts` | `participatesSocialInsurance/HealthInsurance/UnemploymentInsurance` (boolean, HR set tay), `note` tự do | **Đề xuất kỹ thuật** — SRS chưa có field-spec (xem `DOCS_DECISION_LOG.md` D32) |
| `InsurancePolicy` | `.../insurance-policy.schema.ts` | `socialInsuranceEmployeeRate/health.../unemployment...` (seed 8%/1,5%/1% theo §30D.3), `salaryBaseRules[]`, `capRules[]`, `employerContributionRates[]` | Field tên đúng SRS §30D.3; **shape `{type, floorAmount\|capAmount}` là đề xuất kỹ thuật**, mọi giá trị mặc định `null` (chưa có số pháp lý nào được xác nhận) |

**Quy định quan trọng đang được enforce trong code, không phải chỉ trong doc:**

- `InsurancePolicyService.create()` bắt buộc `salaryBaseRules`/`capRules`/
  `employerContributionRates` phải cover **đúng cả 3 loại** BHXH/BHYT/BHTN, không
  thiếu không trùng (`assertCoversAllTypes`) — thiếu 1 loại sẽ 400.
- Participation (`InsuranceProfile.participates*`) **không bao giờ được suy ra tự
  động** từ `contractType` hay `EmployeeProfile.employmentStatus` ở bất kỳ đâu trong
  code — luôn là giá trị HR truyền vào khi tạo record. Đây là literal hoá của SRS
  §30A.3: "Trạng thái thử việc không tự quyết định nghĩa vụ bảo hiểm".

## 4. Cách tính duy nhất hiện có trong repo: engine bảo hiểm

File: `hr/insurance-policy/insurance-calculation.ts` — hàm thuần
`calculateInsuranceContributions(policy, participation, insuranceSalary)`, **không
đọc DB**, không phụ thuộc NestJS. Đây là "cách tính" duy nhất đã có code + test
trong toàn bộ dự án tại thời điểm này.

```text
với mỗi loại T ∈ {SOCIAL_INSURANCE, HEALTH_INSURANCE, UNEMPLOYMENT_INSURANCE}:
  bỏ qua nếu participation[T] = false          (AC-INS-02)

  floor = policy.salaryBaseRules[T].floorAmount   (null = không áp sàn)
  cap   = policy.capRules[T].capAmount            (null = không áp trần)
  base  = clamp(insuranceSalary, floor, cap)      (AC-INS-03)

  employeeContribution[T] = ROUND_HALF_UP(base × policy.<T>EmployeeRate)
  employerContribution[T] = ROUND_HALF_UP(base × policy.employerContributionRates[T])

mandatoryEmployeeInsurance = Σ employeeContribution[T]   → dùng cho Net Salary/PIT sau này
employerInsuranceCost      = Σ employerContribution[T]   → chỉ vào Employer Cost, KHÔNG trừ Net Salary (AC-PAYROLL-02)
```

Quy tắc bắt buộc (đã có test khoá lại trong `insurance-calculation.spec.ts`):

- **Không bao giờ tính `grossSalary × 10,5%`** — mỗi dòng dùng `insuranceSalary`
  (từ `SalaryProfile`, không phải Gross Income) và rate riêng của nó (AC-INS-01).
  Ba rate seed 8%+1,5%+1% cộng lại đúng bằng 10,5% — điều cấm là dùng **sai base**
  (Gross thay vì insuranceSalary), không phải tổng rate khác 10,5%.
- Làm tròn (`roundHalfUpToVnd`) áp dụng **từng dòng riêng**, không làm tròn tổng —
  để số nhân viên/doanh nghiệp đối chiếu khớp theo từng khoản.
- `floorAmount`/`capAmount`/rate doanh nghiệp hiện **chưa có giá trị seed thật** nào
  trong code hay doc — HR/pháp lý phải nhập khi tạo `InsurancePolicy` thật.

Engine này **chưa được gọi từ bất kỳ luồng HTTP nào** — chưa có `PayrollInputSnapshot`
hay `PayrollRun` trong repo để gọi vào. Nó tồn tại như một hàm đã unit-test sẵn,
chờ module Payroll (sprint sau) import và dùng.

## 5. Quy ước dùng chung cho mọi module (áp dụng khi thêm module mới)

- **Tenant scope**: mọi câu query Mongo có `organizationId`; ID ngoài tenant → 404,
  không phải 403 (tránh lộ thông tin tồn tại/không tồn tại).
- **RBAC**: `@UseGuards(AuthGuard, RolesGuard)` + `@Roles('HR')` ở controller;
  `SYSTEM_ADMIN` bypass RolesGuard nhưng luôn bị chặn ở bước `requireOrganizationId`
  vì session System Admin có `organizationId = null`.
- **Soft-CRUD**: danh mục (Department/Position/ShiftTemplate) dùng flag `active`,
  không xoá cứng. Entity effective-dated (Contract/SalaryProfile/Insurance*) không
  có API xoá/sửa nào cả — chỉ tạo giai đoạn mới.
- **Lỗi**: NestJS exception với message là UPPER_SNAKE_CASE code (`EMPLOYEE_PROFILE_NOT_FOUND`,
  `CONTRACT_PERIOD_OVERLAPS`...), không phải câu tiếng Anh tự nhiên — client parse theo `error.code`.
- **Test**: mock Mongoose Model bằng object JS thuần (`{create, find, findOne,
  findOneAndUpdate, exists}` implement thủ công trên mảng in-memory) — không có
  Docker/Mongo thật trong unit test. Xem `*.service.spec.ts` bất kỳ làm mẫu.
- **Index**: mọi collection có index `(organizationId, ...)`; khai báo trong schema,
  đăng ký tập trung tại `database/schemas/registry.ts`, và có assertion tương ứng
  trong `database/indexes.spec.ts`.

## 6. Những gì SRS có mô tả nhưng CODE CHƯA LÀM (đừng nhầm là đã chạy)

- **Attendance / chấm công**: check-in/out, GPS, selfie, evidence — chưa có module.
- **Timesheet / TimesheetPeriod**: chốt kỳ, blocker, DepartmentConfirmation — chưa có.
- **Leave / Overtime request** và luồng duyệt Manager → HR — chưa có.
- **AllowanceCatalog / OrganizationAllowance / AttendanceBonusPolicy / KpiPayrollInput**
  (TASK-033..035) — chưa có, dù `SalaryProfile` đã có field tham chiếu lỏng
  (`organizationAllowanceIds`, `attendanceBonusPolicyId`, `kpiAmount`) chờ sẵn.
- **LaborCompliancePolicy / OvertimePayPolicy** (TASK-036/037) — chưa có.
- **TaxProfile / TaxPolicy / PIT** (TASK-040/041) — chưa có.
- **PayrollInputSnapshot / PayrollRun / Payslip** — chưa có; đây là nơi engine ở
  mục 4 sẽ được gọi vào thực tế.
- **EmployeeDocument** (upload file hợp đồng private, TASK-029) — chưa có;
  `EmploymentContract.documentRef` hiện chỉ là ObjectId rỗng chờ FK.

## 7. Kế hoạch 9 Sprint đang làm gì — giải thích dễ hiểu

Cứ tưởng tượng cả dự án giống như **tổ chức một chuyến đi dã ngoại cho cả trường**:
phải làm từng việc theo đúng thứ tự thì mới ra chuyến đi hoàn chỉnh được. Dưới đây
là 9 "chặng" (Sprint) của dự án, mỗi chặng làm 1 việc lớn, **theo đúng thứ tự viết
trong kế hoạch gốc** (`MILESTONE_9_WEEKS.md`, không tự đổi thứ tự).

> Trạng thái ✅/🔶/⏳ dưới đây là **trạng thái THẬT của code** hôm nay (2026-09-22),
> không phải cột "trạng thái" trong file kế hoạch — file kế hoạch đó đã đông cứng
> (frozen) từ lúc lập kế hoạch nên không cập nhật theo code được nữa.

| # | Chặng (Sprint) | Ví dụ dễ hiểu | Trạng thái thật |
|---|---|---|---|
| 1 | Lên kế hoạch chuyến đi | Họp bàn: đi đâu, ai được đi, luật chơi ra sao | ✅ Xong (viết tài liệu) |
| 2 | Làm thẻ tên + sổ danh sách học sinh | Ai cũng có thẻ đăng nhập, có hồ sơ, thuộc phòng ban nào | ✅ Xong phần lõi |
| 3 | Ký giấy phép phụ huynh + tính tiền mỗi bạn đóng | Hợp đồng, lương, bảo hiểm, thuế | 🔶 Làm được 1 phần |
| 4 | Xếp lịch đi + điểm danh mỗi ngày | Ca làm việc, chấm công, xin nghỉ | ⏳ Chưa tới lượt |
| 5 | Chụp ảnh làm bằng chứng + xin duyệt | Chụp ảnh check-in, xin làm thêm giờ, cấp trên duyệt | ⏳ Chưa tới lượt |
| 6 | Tổng kết sổ điểm danh cuối tháng | Khoá sổ công, không cho sửa lung tung nữa | ⏳ Chưa tới lượt |
| 7 | Tính tiền và phát "phong bì lương" | Ra số tiền cuối cùng mỗi người nhận, gửi phiếu lương | ⏳ Chưa tới lượt |
| 8 | Kiểm tra thật kỹ trước khi đi thật | Test bảo mật, test lỗi, dọn dẹp, triển khai lên mạng | ⏳ Chưa tới lượt |
| 9 | Thuyết trình báo cáo | Demo cho thầy cô xem, làm slide, bàn giao | ⏳ Chưa tới lượt |

Hiện dự án đang **đứng ở giữa chặng 3** — đã làm xong khâu "tính tiền bảo hiểm" và
"lương cơ bản", còn khâu "tính thêm giờ", "thuế", "tiền thưởng" của chặng 3 thì
chưa làm. Các chặng 4–9 hoàn toàn chưa bắt đầu.

### Chặng 2 — "Làm thẻ tên + sổ danh sách" — từng việc nhỏ

| Việc | Giải thích như lớp 5 | Đã làm chưa |
|---|---|---|
| Dựng khung nhà (NestJS API + Web + MongoDB) | Xây cái nhà trống trước, chưa có đồ đạc | ✅ |
| Bảng dữ liệu + đánh số nhanh (schema + index) | Kẻ sẵn ô trong sổ để ghi tên, tìm tên nhanh | ✅ |
| Đăng nhập/đăng xuất/đổi mật khẩu/quên mật khẩu | Như đăng nhập tài khoản game, quên mật khẩu bấm "lấy lại" | ✅ |
| Nhận diện "bạn thuộc trường nào" (tenant) | Ai ở trường A chỉ xem được data trường A, không thấy trường B | ✅ |
| Phân quyền ai được làm gì (RBAC) | Lớp trưởng làm được nhiều việc hơn học sinh thường | ✅ |
| Dữ liệu mẫu để test (seed) | Tạo sẵn 1-2 "trường giả" để thử nghiệm | ✅ |
| Hồ sơ nhân viên | Sổ ghi tên, ngày sinh, chức vụ mỗi người | ✅ |
| Danh sách phòng ban | Sổ ghi có những phòng ban nào (Kế toán, Kỹ thuật...) | ✅ |
| Danh sách chức danh | Sổ ghi có những chức vụ nào (Nhân viên, Trưởng phòng...) | ✅ |
| Lịch sử đổi trạng thái nhân viên | Ghi lại "bạn A từ thử việc lên chính thức ngày nào" | ✅ |
| Gán nhân viên vào phòng ban/ca làm | Ghi "bạn A thuộc phòng Kỹ thuật, làm ở chi nhánh 1" | ✅ |
| Màn hình xem danh bạ nhân viên (web) | Trang web để HR xem danh sách mọi người | ✅ |
| Màn hình xem hồ sơ của chính mình (web) | Trang web để mỗi người xem hồ sơ bản thân | ✅ |
| Test "không cho nhìn lén trường khác" | Kiểm tra thật kỹ việc phân trường ở mục trên có bị lọt không | 🔶 Có test rải rác trong từng phần, chưa có 1 bộ test riêng gom hết lại |

### Chặng 3 — "Ký giấy phép + tính tiền mỗi bạn đóng" — từng việc nhỏ

| Việc | Giải thích như lớp 5 | Đã làm chưa |
|---|---|---|
| Hợp đồng lao động (model + API) | Giấy hợp đồng ghi loại hợp đồng, ngày bắt đầu/kết thúc | ✅ (phần lưu trữ/API — chưa có màn hình web riêng) |
| Tài liệu hợp đồng (upload file riêng tư) | Đính kèm file PDF hợp đồng, chỉ người liên quan xem được | ⏳ |
| Cảnh báo hợp đồng sắp hết hạn | Như nhắc "3 ngày nữa hết hạn thẻ thư viện" | ⏳ |
| Kiểm tra lương thử việc hợp lệ | Không cho trả lương thử việc quá thấp so với luật | ⏳ |
| Hồ sơ lương theo thời gian (SalaryProfile) | Sổ ghi "từ ngày nào đến ngày nào, lương bao nhiêu" | ✅ |
| Phụ cấp (ăn trưa, xăng xe...) | Tiền thêm ngoài lương chính | ⏳ |
| Thưởng chuyên cần | Tiền thưởng nếu đi làm đều, không nghỉ | ⏳ |
| Chỉ tiêu KPI ảnh hưởng lương | Làm tốt chỉ tiêu thì có thêm tiền | ⏳ (mới có 1 ô trống chờ sẵn trong SalaryProfile) |
| Luật giờ làm (LaborCompliancePolicy) | Quy định làm tối đa mấy giờ/ngày, mấy giờ/tuần | ⏳ |
| Luật tính tiền tăng ca | Làm thêm giờ được trả thêm bao nhiêu % | ⏳ |
| **Ai phải đóng bảo hiểm nào (InsuranceProfile)** | Sổ ghi "bạn A có đóng BHXH/BHYT/BHTN không" | ✅ |
| **Luật tính bảo hiểm (InsurancePolicy rate/base/caps)** | Quy định đóng bao nhiêu %, tối thiểu/tối đa bao nhiêu | ✅ |
| Hồ sơ thuế + người phụ thuộc | Sổ ghi ai được giảm trừ thuế vì nuôi con/cha mẹ | ⏳ |
| Luật tính thuế thu nhập (PIT) | Quy định các bậc thuế, được trừ bao nhiêu tiền | ⏳ |
| Test kiểm tra "luật cũ/luật mới không lẫn lộn" | Kiểm tra đổi luật không làm sai số tiền cũ | 🔶 Đã test đủ cho phần ✅ ở trên (Contract/SalaryProfile/Insurance*); phần Labor/OT/Tax chưa có gì để test vì chưa xây |

Hai việc **in đậm** ở trên chính là TASK-038 và TASK-039 mà mình vừa làm xong.

## 8. Tài liệu liên quan

- `Docs/SRS_CORESTAFF.md` §30A–§30K — đặc tả nghiệp vụ gốc (source of truth).
- `Docs/DOCS_DECISION_LOG.md` D32 — quyết định phạm vi/đề xuất kỹ thuật cho
  Contract/SalaryProfile/InsuranceProfile/InsurancePolicy.
- `Docs/TASK_038_039_IMPLEMENTATION.md` — nhật ký triển khai, bảng AC → code → test.
