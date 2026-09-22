# CoreStaff API — Luồng code hiện tại (2026-09-22, cập nhật sau merge `origin/deploy`)

> Tài liệu này mô tả **những gì đang thực sự chạy trong code** (`CoreStaff/Apps/api/src`),
> không phải toàn bộ đặc tả trong `SRS_CORESTAFF.md`. Phần nào SRS có nhưng code
> chưa làm sẽ được ghi rõ ở mục 6. Nếu code và SRS lệch nhau, tài liệu này ưu tiên
> mô tả đúng **code**, và ghi chú SRS nói gì.
>
> **Bản cập nhật này** phản ánh trạng thái sau khi `feat/task38-39-sprint3` merge
> `origin/deploy` — nơi team đã push song song rất nhiều module (Contract, Compensation,
> Policies, Manager, EmployeeDocument, Storage). Phiên bản trước của file này (viết
> trước khi biết về `deploy`) liệt kê nhiều thứ là "chưa làm" mà thực ra team đã làm —
> mục 2 và 6 dưới đây đã được sửa lại cho đúng.

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
buộc cho mọi module (kể cả 2 module `InsuranceProfile`/`InsurancePolicy` thêm ngày
2026-09-22).

## 2. Các module hiện có trong `hr/` (sau merge)

```text
hr/
├── department, position, workplace, shift-template   → danh mục tenant-scoped, soft-CRUD
├── employee                                           → EmployeeProfile, tách khỏi User
├── assignment                                         → gán User vào Department/Workplace/Shift
├── employment-contract   (team, TASK-028/030)         → hợp đồng: status DRAFT→ACTIVE→…, cảnh báo hết hạn
├── employee-document      (team, TASK-029)             → upload/tải file hợp đồng riêng tư
├── compensation           (team, TASK-031..035)        → SalaryProfile, Allowance, AttendanceBonusPolicy, KPI
├── policies                (team, TASK-036/037)        → LaborCompliancePolicy, OvertimePayPolicy
├── manager                 (team, D36)                 → ManagerAssignment/scope, hàng đợi phê duyệt/request
├── insurance-profile       (mình, TASK-038)            → ai đóng bảo hiểm nào
└── insurance-policy        (mình, TASK-039)            → luật tính bảo hiểm (rate/base/caps)
```

Ngoài `hr/`, còn có `storage/` (team) — lưu file, dùng bởi `employee-document`.

### Danh mục/hồ sơ thuần (không tính toán tiền)

| Module | Vai trò | Quy định đáng chú ý trong code |
|---|---|---|
| Department/Position | Danh mục tenant-scoped, soft-CRUD (`active` flag, không xóa cứng) | Unique `(organizationId, code)` |
| Workplace | Danh mục địa điểm làm việc | Có `defaultShiftTemplateId` |
| ShiftTemplate | Ca hành chính theo Workplace | 1 workplace = 1 shift template (unique index); `startTime < endTime` bắt buộc; không cho deactivate nếu còn `Assignment.active=true` tham chiếu tới workplace đó |
| EmployeeProfile | Tách khỏi `User` (đăng nhập). Tạo theo 2 chế độ: link vào `User` có sẵn, hoặc `provisionProfile` tạo cả `User` mới (role EMPLOYEE, mật khẩu tạm) trong 1 Mongo transaction | `employeeCode` chuẩn hoá UPPERCASE, là chủ sở hữu duy nhất của mã này |
| EmploymentHistory | Append-only, ghi mỗi lần đổi `employmentStatus` | Transition hợp lệ theo `EMPLOYMENT_STATUS_TRANSITIONS`; chặn tự duyệt chính mình |
| Assignment | Gắn `User` vào `Department` (+ Workplace/ShiftTemplate tuỳ chọn), có `effectiveFrom/effectiveTo` | 1 user chỉ có 1 assignment active/department tại một thời điểm |

`ShiftTemplate` có `startTime/endTime/breakMinutes/gracePeriodMinutes` nhưng chưa
thấy code nào cộng trừ ra `scheduledWorkingMinutes` (SRS §30A.4) — chưa xác minh
kỹ liệu Attendance module có làm việc này ở nơi khác hay chưa tồn tại (mục 6).

### `hr/employment-contract` (team, TASK-028/030)

Route `/hr/contracts`. Field chính: `contractType`, `status` (DRAFT→ACTIVE→
EXPIRED/TERMINATED, xem `ContractStatus`/`CONTRACT_STATUS_TRANSITIONS` trong
`database/schemas/enums.ts`), `effectiveDate`/`expiryDate`/`endDate`,
`statusReason`. Cảnh báo sắp hết hạn tính động lúc đọc, không lưu trạng thái
riêng. Đây là bản đầy đủ hơn hẳn bản mình từng tự dựng tạm — đã gỡ bản của mình,
xem `Docs/TASK_038_039_IMPLEMENTATION.md`.

### `hr/employee-document` (team, TASK-029)

Route `/hr/documents` (HR) và một route riêng cho app phía nhân viên. Upload,
liệt kê, tải xuống, xoá — gắn với `contractId`. Dùng `storage/` module để lưu file.

### `hr/compensation` (team, TASK-031..035)

Route chung `hr` (không tiền tố riêng), gồm nhiều nhóm: `salary-profiles`
(SalaryProfile effective-dated, có endpoint `/effective` để resolve theo ngày),
`allowance-catalog` + `organization-allowances` (thư viện phụ cấp + tuỳ biến theo
tổ chức), `attendance-bonus-templates`/`attendance-bonus-policies` (mẫu thưởng
chuyên cần, có endpoint `preview` để xem trước số tiền), và KPI (schema
`KpiPolicy`/`KpiPayrollInput` thấy trong `compensation.schema.ts`, chưa đọc kỹ
route). `SalaryProfile` ở đây dùng field `employeeProfileId` (khác tên
`employeeId` mình từng dùng) và có thêm `allowances[]` embedded.

### `hr/policies` (team, TASK-036/037)

Route `/hr/policies/labor` và `/hr/policies/overtime`, đều theo pattern
effective-dating + version giống Insurance. Có endpoint `preview`/`rates` để
xem trước kết quả áp dụng policy hiện hành, không chỉ CRUD thô.

### `hr/manager` (team, D36 — Manager Workspace)

`ManagerAssignment`/`ManagerRequest`, scope theo `managedDepartmentIds` hiệu
lực. Có hàng đợi `manager/approvals` (approve/reject/request-clarification) và
`requests` generic cho Employee/Manager/HR tạo — đây có thể là nơi Leave/OT
request thật sự sống, nhưng mình **chưa đọc kỹ nội dung nghiệp vụ bên trong**,
chỉ xác nhận route tồn tại — đừng coi phần này là đã kiểm chứng đầy đủ.

## 3. Insurance (TASK-038/039) — pattern effective-dating dùng chung toàn repo

`hr/insurance-profile` + `hr/insurance-policy`, dùng helper chung
`common/effective-dating.ts`:

```text
mỗi entity = nhiều document, mỗi document là MỘT GIAI ĐOẠN [effectiveFrom, effectiveTo]
→ tạo bản ghi mới = tạo document mới, KHÔNG sửa document cũ (immutable)
→ không có API update/delete — sửa sai = tạo giai đoạn mới
→ khi tạo mới: rangesOverlap() chặn 2 giai đoạn của cùng employee/tổ chức đè lên nhau
→ đọc "giá trị đang hiệu lực tại ngày X": findEffective() tìm document có
  effectiveFrom <= X <= (effectiveTo ?? +∞)
```

Đây không chỉ là pattern riêng của Insurance — `SalaryProfile`, `OrganizationAllowance`,
`AttendanceBonusPolicy`, `LaborCompliancePolicy`, `OvertimePayPolicy` của team cũng
đều có `effectiveFrom/effectiveTo/version`, cùng triết lý "không sửa, chỉ tạo mới".
Helper `effective-dating.ts` hiện chỉ được Insurance dùng trực tiếp; các module
kia tự implement logic tương đương riêng (chưa hợp nhất về 1 helper).

| Entity | File | Field chính | Nguồn |
|---|---|---|---|
| `InsuranceProfile` | `database/schemas/insurance-profile.schema.ts` | `participatesSocialInsurance/HealthInsurance/UnemploymentInsurance` (boolean, HR set tay), `note` tự do | **Đề xuất kỹ thuật** — SRS chưa có field-spec (xem `DOCS_DECISION_LOG.md` D37) |
| `InsurancePolicy` | `database/schemas/insurance-policy.schema.ts` | `socialInsuranceEmployeeRate/health.../unemployment...` (seed 8%/1,5%/1% theo §30D.3), `salaryBaseRules[]`, `capRules[]`, `employerContributionRates[]` | Field tên đúng SRS §30D.3; **shape `{type, floorAmount\|capAmount}` là đề xuất kỹ thuật**, mọi giá trị mặc định `null` (chưa có số pháp lý nào được xác nhận) |

**Quy định quan trọng đang được enforce trong code, không phải chỉ trong doc:**

- `InsurancePolicyService.create()` bắt buộc `salaryBaseRules`/`capRules`/
  `employerContributionRates` phải cover **đúng cả 3 loại** BHXH/BHYT/BHTN, không
  thiếu không trùng (`assertCoversAllTypes`) — thiếu 1 loại sẽ 400. Cũng chặn
  `floorAmount > capAmount` cùng loại (`INSURANCE_POLICY_FLOOR_ABOVE_CAP`).
- Participation (`InsuranceProfile.participates*`) **không bao giờ được suy ra tự
  động** từ `contractType` hay `EmployeeProfile.employmentStatus` ở bất kỳ đâu trong
  code — luôn là giá trị HR truyền vào khi tạo record. Đây là literal hoá của SRS
  §30A.3: "Trạng thái thử việc không tự quyết định nghĩa vụ bảo hiểm".

## 4. Cách tính duy nhất mình đã kiểm chứng kỹ: engine bảo hiểm

File: `hr/insurance-policy/insurance-calculation.ts` — hàm thuần
`calculateInsuranceContributions(policy, participation, insuranceSalary)`, **không
đọc DB**, không phụ thuộc NestJS.

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
  (từ `SalaryProfile` của team, không phải Gross Income) và rate riêng của nó
  (AC-INS-01). Ba rate seed 8%+1,5%+1% cộng lại đúng bằng 10,5% — điều cấm là
  dùng **sai base** (Gross thay vì insuranceSalary), không phải tổng rate khác 10,5%.
- Làm tròn (`roundHalfUpToVnd`) áp dụng **từng dòng riêng**, không làm tròn tổng.
- `floorAmount`/`capAmount`/rate doanh nghiệp hiện **chưa có giá trị seed thật** nào
  trong code hay doc — HR/pháp lý phải nhập khi tạo `InsurancePolicy` thật.

Engine này **chưa được gọi từ bất kỳ luồng HTTP nào** — chưa có `PayrollInputSnapshot`
hay `PayrollRun` trong repo (xác nhận lại sau merge: vẫn không có). Nó tồn tại
như một hàm đã unit-test sẵn, chờ module Payroll (sprint sau) import và dùng.

## 5. Quy ước dùng chung cho mọi module

- **Tenant scope**: mọi câu query Mongo có `organizationId`; ID ngoài tenant → 404.
- **RBAC**: `@UseGuards(AuthGuard, RolesGuard)` + `@Roles(...)` ở controller;
  `SYSTEM_ADMIN` bypass RolesGuard nhưng luôn bị chặn ở bước `requireOrganizationId`
  vì session System Admin có `organizationId = null`.
- **Soft-CRUD**: danh mục (Department/Position/ShiftTemplate) dùng flag `active`,
  không xoá cứng. Entity effective-dated (Insurance*, SalaryProfile, Allowance,
  Bonus, Labor/OT Policy) không có API xoá — sửa = tạo giai đoạn mới hoặc version++.
- **Lỗi**: NestJS exception với message là UPPER_SNAKE_CASE code, không phải câu
  tiếng Anh tự nhiên — client parse theo `error.code`.
- **Test**: mock Mongoose Model bằng object JS thuần (`{create, find, findOne,
  findOneAndUpdate, exists}` implement thủ công trên mảng in-memory) — không có
  Docker/Mongo thật trong unit test.
- **Index**: mọi collection có index `(organizationId, ...)`; khai báo trong schema,
  đăng ký tập trung tại `database/schemas/registry.ts`, assertion trong
  `database/indexes.spec.ts`.

## 6. Những gì SRS có mô tả nhưng CODE CHƯA LÀM (đã kiểm tra lại sau merge)

Đã xác nhận lại bằng grep code thật (không đoán) ngày 2026-09-22:

- **Attendance / chấm công thật sự (check-in/out, GPS, selfie, evidence)**: không
  tìm thấy route/module backend nào (`check-in`, `checkin`, `attendance/today`...).
  Web đã có UI scaffolding (`Attendance/components/GpsAttendanceFlow.tsx`,
  `SelfieAttendanceFlow.tsx`...) nhưng chưa thấy API backend tương ứng — có thể
  đang làm dở hoặc UI đi trước.
- **TimesheetPeriod / chốt kỳ công**: không tìm thấy trong code.
- **TaxProfile / TaxPolicy / PIT** (TASK-040/041): không tìm thấy trong code.
- **PayrollInputSnapshot / PayrollRun / Payslip**: không tìm thấy trong code —
  đây là nơi engine bảo hiểm ở mục 4 sẽ được gọi vào thực tế.

Đã **sửa lại** so với bản trước (những thứ này hoá ra ĐÃ CÓ, do team làm trên
`origin/deploy`, không phải "chưa làm" như bản CODE_FLOW trước từng ghi nhầm):
Allowance/AttendanceBonusPolicy/KPI (`hr/compensation`), LaborCompliancePolicy/
OvertimePayPolicy (`hr/policies`), EmployeeDocument (`hr/employee-document`),
Contract đầy đủ hơn (`hr/employment-contract`).

## 7. Kế hoạch 9 Sprint đang làm gì — giải thích dễ hiểu

Cứ tưởng tượng cả dự án giống như **tổ chức một chuyến đi dã ngoại cho cả trường**:
phải làm từng việc theo đúng thứ tự thì mới ra chuyến đi hoàn chỉnh được. Dưới đây
là 9 "chặng" (Sprint) của dự án, mỗi chặng làm 1 việc lớn, **theo đúng thứ tự viết
trong kế hoạch gốc** (`MILESTONE_9_WEEKS.md`, không tự đổi thứ tự).

> Trạng thái ✅/🔶/⏳ dưới đây là **trạng thái THẬT của code** hôm nay (2026-09-22,
> sau merge), không phải cột "trạng thái" trong file kế hoạch — file đó đã đông
> cứng (frozen) từ lúc lập kế hoạch.

| # | Chặng (Sprint) | Ví dụ dễ hiểu | Trạng thái thật |
|---|---|---|---|
| 1 | Lên kế hoạch chuyến đi | Họp bàn: đi đâu, ai được đi, luật chơi ra sao | ✅ Xong (viết tài liệu) |
| 2 | Làm thẻ tên + sổ danh sách học sinh | Ai cũng có thẻ đăng nhập, có hồ sơ, thuộc phòng ban nào | ✅ Xong |
| 3 | Ký giấy phép phụ huynh + tính tiền mỗi bạn đóng | Hợp đồng, lương, bảo hiểm, thuế | 🔶 Gần xong — chỉ còn thiếu Thuế |
| 4 | Xếp lịch đi + điểm danh mỗi ngày | Ca làm việc, chấm công, xin nghỉ | 🔶 Có scaffolding, chưa xác nhận API chấm công thật |
| 5 | Chụp ảnh làm bằng chứng + xin duyệt | Chụp ảnh check-in, xin làm thêm giờ, cấp trên duyệt | 🔶 Có hàng đợi phê duyệt (`hr/manager`), chưa rõ nối với Attendance/OT thật chưa |
| 6 | Tổng kết sổ điểm danh cuối tháng | Khoá sổ công, không cho sửa lung tung nữa | ⏳ Chưa tìm thấy |
| 7 | Tính tiền và phát "phong bì lương" | Ra số tiền cuối cùng mỗi người nhận, gửi phiếu lương | ⏳ Chưa tìm thấy |
| 8 | Kiểm tra thật kỹ trước khi đi thật | Test bảo mật, test lỗi, dọn dẹp, triển khai lên mạng | ⏳ Chưa tới lượt |
| 9 | Thuyết trình báo cáo | Demo cho thầy cô xem, làm slide, bàn giao | ⏳ Chưa tới lượt |

So với lần cập nhật trước, dự án **tiến xa hơn nhiều** so với mình tưởng — vì lúc
đó chỉ nhìn thấy code trên nhánh của mình, chưa biết team đã làm gì trên `deploy`.
Chặng 3 gần như xong (chỉ thiếu Thuế/PIT). Chặng 4-5 có vẻ đã bắt đầu qua
`hr/manager`, nhưng mình **chưa đọc kỹ đủ để khẳng định** — cần một lượt kiểm tra
riêng nếu muốn báo cáo chính xác chặng 4-5 đang tới đâu.

### Việc mình (TASK-038/039) đã làm trong Chặng 3

| Việc | Giải thích như lớp 5 | Đã làm chưa |
|---|---|---|
| **Ai phải đóng bảo hiểm nào (InsuranceProfile)** | Sổ ghi "bạn A có đóng BHXH/BHYT/BHTN không" | ✅ |
| **Luật tính bảo hiểm (InsurancePolicy rate/base/caps)** | Quy định đóng bao nhiêu %, tối thiểu/tối đa bao nhiêu | ✅ |

Các việc còn lại của Chặng 3 (hợp đồng, tài liệu, cảnh báo hết hạn, phụ cấp,
thưởng, KPI, luật giờ làm, luật tăng ca) — team đã làm trên `deploy`, không phải
mình. Chỉ còn "Hồ sơ thuế + luật thuế thu nhập (TaxProfile/TaxPolicy)" là thật
sự chưa ai làm.

## 8. Tài liệu liên quan

- `Docs/SRS_CORESTAFF.md` §30A–§30K — đặc tả nghiệp vụ gốc (source of truth).
- `Docs/DOCS_DECISION_LOG.md` D37 — quyết định phạm vi/đề xuất kỹ thuật cho
  InsuranceProfile/InsurancePolicy, và lý do bỏ Contract/SalaryProfile tự viết.
- `Docs/TASK_038_039_IMPLEMENTATION.md` — nhật ký triển khai, bảng AC → code →
  test, và nhật ký merge với `origin/deploy`.
