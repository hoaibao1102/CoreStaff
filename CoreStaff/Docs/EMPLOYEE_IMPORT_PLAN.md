# Plan: Import nhân viên hàng loạt (Bulk Employee Import)

## Context

Hiện tại HR phải tạo nhân viên thủ công qua `EmployeeCreateDialog`, rồi tạo riêng SalaryProfile, InsuranceProfile, phụ cấp ở các màn hình khác nhau. Với công ty có hàng trăm nhân viên, thao tác này không khả thi.

Feature này cho phép HR upload **một file Excel** chứa thông tin cá nhân + chức vụ + lương thưởng, hệ thống parse → validate → tạo đồng bộ `User` + `EmployeeProfile` + `SalaryProfile` + `InsuranceProfile`, và trả về báo cáo lỗi theo từng dòng.

## Quyết định phạm vi

**Trong phạm vi:**
- Import nhân viên **mới** (tạo tài khoản + hồ sơ + lương + bảo hiểm trong 1 lần).
- File `.xlsx` (dùng `exceljs` đã có sẵn ở `Apps/api` cho payroll export — không thêm dependency).
- Có template tải về, có preview lỗi trước khi ghi, có báo cáo kết quả từng dòng.
- `role` import từ `users.role` — **giới hạn** `EMPLOYEE` / `DEPARTMENT_MANAGER` / `HR`, **chặn** `SYSTEM_ADMIN`.

**Ngoài phạm vi (để sau):**
- Update nhân viên đã tồn tại (upsert).
- Import avatar, lịch sử công tác, hợp đồng lao động.
- Import qua Mobile.
- Gửi email mật khẩu tạm tự động (hiện `EmployeeService.provisionProfile` trả `tempPassword` một lần, HR tự chuyển).

---

## Data Model — cột trong file import

File có **2 sheet dữ liệu** + 1 sheet danh mục ẩn + 1 sheet hướng dẫn. Tên sheet khớp chính xác.

> **Tên cột HR nhìn thấy là tiếng Việt, không phải tên field trong code.** Template ghi `Mã nhân viên`, `Họ và tên`, `Quản lý trực tiếp`… vì mục đích là để HR dùng được, không phải để lộ tên biến. Parser vẫn nhận **cả hai** cách viết (tên code cũ và nhãn tiếng Việt) — file lưu từ template cũ không bị vỡ. Các bảng dưới đây ghi tên code vì đó là key nội bộ; nhãn hiển thị nằm ở `HEADER_LABELS` / `DEPENDENT_HEADER_LABELS` trong `employee-import.service.ts`.
>
> **Cột nào có danh sách cố định thì là dropdown thật trong Excel** (`Vai trò`, `Giới tính`, `Phòng ban`, `Chức danh`, `Quản lý trực tiếp`, `Chính sách thưởng chuyên cần`, `Mối quan hệ`). Danh sách nằm ở sheet ẩn `DanhMuc`, sinh từ dữ liệu thật của tenant — HR chọn chứ không gõ, nên không còn lỗi gõ sai mã phòng ban. Ô dropdown chứa `"MÃ — Tên"` (ví dụ `IT — Phòng IT`); parser lấy phần trước dấu gạch làm mã. Cột tiền (`Lương cơ bản`, `Lương đóng BHXH`, `Phụ cấp <MÃ>`) vẫn là ô nhập số tự do — đó là số tiền, không phải lựa chọn. **Mọi danh sách đều phẳng, không danh sách nào lọc theo cột khác.**
>
> **`Chức danh` KHÔNG cascade theo `Phòng ban` trong Excel.** Dropdown chức danh hiện **tất cả** chức danh của tenant trong một danh sách phẳng — cố ý. Danh sách cascade (defined name `CD_<MÃ PHÒNG>` + `INDIRECT`) đã bỏ: ô phòng ban bị sửa tay hoặc dữ liệu cũ đi một nhịp là danh sách rỗng/thiếu, giấu mất chức danh có thật — hỏng nặng hơn một lỗi dòng. Vì chức danh thuộc về đúng một phòng ban (`position.schema.ts`), server tra theo **cặp** `(departmentId, code)` trong `validateRefs`; chọn sai phòng ban → lỗi `POSITION_DEPARTMENT_MISMATCH` ở dòng đó (mã có thật nhưng khác phòng ban) hoặc `POSITION_NOT_FOUND` (mã không tồn tại ở đâu cả); import là tất cả-hoặc-không-gì-cả nên không ghi gì, HR sửa rồi import lại. Sheet `HuongDan` có bảng **"Chức danh theo phòng ban"** liệt kê chức danh của từng phòng ban — đây là chỗ duy nhất HR thấy được cặp hợp lệ, vì dropdown không tự lọc. Bảng này được sinh lại mỗi lần tải file mẫu, nên nó luôn khớp dữ liệu phòng ban/chức danh hiện tại.

### Sheet 1 — `NhanVien` (1 dòng = 1 nhân viên)

Dòng 1 là header. Khớp tên cột không phân biệt hoa/thường, dấu tiếng Việt và khoảng trắng thừa (`Mã nhân viên` = `ma nhan vien` = `MÃ  NHÂN  VIÊN`).

#### Nhóm 1 — Tài khoản (`users`)

| Cột | Bắt buộc | Map tới | Ghi chú |
|---|---|---|---|
| `employeeCode` | Có | `employee_profiles.employeeCode` | Unique theo tổ chức; normalize qua `normalizeEmployeeCode` |
| `fullName` | Có | `users.fullName` | |
| `email` | Có | `users.email` | Unique theo tổ chức (`emailN`); bắt buộc vì tạo tài khoản |
| `role` | Không | `users.role` | Dropdown. Mặc định `EMPLOYEE`. Chỉ 3 role `EMPLOYEE`/`DEPARTMENT_MANAGER`/`HR` — `SYSTEM_ADMIN` → lỗi `ROLE_NOT_ALLOWED` |
| `phone` | Không | `users.phone` + `employee_profiles.phone` | 10 chữ số (`PHONE_INVALID`) |

#### Nhóm 2 — Hồ sơ nhân sự (`employee_profiles`)

| Cột | Bắt buộc | Map tới | Ghi chú |
|---|---|---|---|
| `joinDate` | Có | `employee_profiles.joinDate` | `YYYY-MM-DD`, không ở tương lai |
| `dateOfBirth` | Không | `employee_profiles.dateOfBirth` | `YYYY-MM-DD` |
| `gender` | Không | `employee_profiles.gender` | Dropdown. `MALE`/`FEMALE`/`OTHER` |
| `citizenId` | Không | `employee_profiles.citizenId` | 9–12 chữ số |
| `taxCode` | Không | `employee_profiles.taxCode` | 10–12 chữ số |
| `socialInsuranceCode` | Không | `employee_profiles.socialInsuranceCode` | 1–12 chữ số |
| `bankAccount` | Không | `employee_profiles.bankAccount` | 6–17 chữ số |
| `address` | Không | `employee_profiles.address` | ≤256 ký tự |
| `departmentCode` | Có | `departments.code` → `departmentId` | Dropdown. Ô chứa `"IT — Phòng IT"`, parser lấy phần trước dấu gạch. Không thấy → `DEPARTMENT_NOT_FOUND` |
| `positionCode` | Có | `positions.code` → `positionId` | Dropdown phẳng (tất cả chức danh). Mã không tồn tại ở bất kỳ phòng ban nào → `POSITION_NOT_FOUND`; mã có thật nhưng thuộc phòng ban khác với cột `Phòng ban` cùng dòng → `POSITION_DEPARTMENT_MISMATCH` |
| `directManagerCode` | Không | `employee_profiles.directManagerId` | Dropdown `"MÃ — Họ tên"` của nhân viên đã có trong tổ chức → resolve ra `User._id`. Hỗ trợ manager import cùng file (xem thứ tự xử lý) |

`employmentType` **không có cột**: enum hiện chỉ có `FULL_TIME` (`enums.ts:24`), nên một cột chỉ có một lựa chọn là cột HR chỉ có thể điền sai. `provisionAccount` để schema tự mặc định.

#### Nhóm 3 — Lương (`salary_profiles`)

| Cột | Bắt buộc | Map tới | Ghi chú |
|---|---|---|---|
| `baseSalary` | Có (nếu muốn tạo SalaryProfile) | `salary_profiles.baseSalary` | Số nguyên ≥ 0, VND |
| `insuranceSalary` | Có cùng lúc | `salary_profiles.insuranceSalary` | Số nguyên ≥ 0; schema **required** |
| `salaryEffectiveFrom` | Không | `salary_profiles.effectiveFrom` | Mặc định = `joinDate` |
| `allowance_<CODE>` | Không | `salary_profiles.allowances[]` | Cột tiếng Việt: `Phụ cấp <MÃ> (<Tên>)` (ví dụ `Phụ cấp PHONE (Điện thoại)`) — **mỗi mã phụ cấp của tenant là một cột**, sinh từ `OrganizationAllowance` đang active. Tên trong ngoặc là nhãn cho HR đọc; parser tra `code` trong tenant (bỏ phần tên), không thấy → lỗi dòng. Giá trị = số tiền |

`version` = 1, `currency` = `VND`, `roundingRule` = `ROUND_HALF_UP_TO_VND` (schema default).

#### Nhóm 4 — Bảo hiểm (`insurance_profiles`)

Bảo hiểm là **bắt buộc** (D40 — BHXH/BHYT/BHTN là nghĩa vụ pháp luật), nên **không có cột** `Tham gia BHXH/BHYT/BHTN` và không có cột lý do miễn giảm. `createOne` luôn tạo `InsuranceProfile` với cả 3 cờ `true`, dùng schema default.

| Cột | Bắt buộc | Map tới | Ghi chú |
|---|---|---|---|
| `insuranceEffectiveFrom` | Không | `insurance_profiles.effectiveFrom` | Mặc định = `joinDate` |

#### Nhóm 5 — Thưởng chuyên cần (`salary_profiles.attendanceBonusPolicyId`)

| Cột | Bắt buộc | Map tới | Ghi chú |
|---|---|---|---|
| `attendanceBonusPolicyCode` | Không | `salary_profiles.attendanceBonusPolicyId` | Cột `Chính sách thưởng chuyên cần`, dropdown lấy từ `AttendanceBonusPolicy` đang active của tenant. `AttendanceBonusPolicy` **không có `code`**, nên dropdown liệt kê **tên chính sách**; ô `Không áp dụng` là giá trị sentinel nghĩa là không gắn. Không thấy tên → `ATTENDANCE_BONUS_POLICY_NOT_FOUND` |

### Sheet 2 — `NguoiPhuThuoc` (1 dòng = 1 người phụ thuộc)

Sheet tùy chọn — bỏ trống hoàn toàn nếu không nhân viên nào có người phụ thuộc. Không giới hạn số người phụ thuộc mỗi nhân viên.

| Cột | Bắt buộc | Map tới | Ghi chú |
|---|---|---|---|
| `employeeCode` | Có | khóa nối về sheet `NhanVien` | Normalize giống sheet 1, nếu không sẽ join trượt. Không khớp dòng nào → `DEPENDENT_ORPHAN` |
| `fullName` | Có | `dependents[].fullName` | |
| `dateOfBirth` | Có | `dependents[].dateOfBirth` | `YYYY-MM-DD`, không ở tương lai |
| `relationship` | Có | `dependents[].relationship` | Dropdown `Con`/`Vợ/Chồng`/`Bố/Mẹ`/`Anh/Chị/Em ruột` → `CHILD`/`SPOUSE`/`PARENT`/`SIBLING` |
| `idCardNumber` | Không | `dependents[].idCardNumber` | |

`isDisabled` **không có cột**: schema yêu cầu field này và mặc định `false`; đây là trường hợp hiếm, HR tích checkbox ở form chi tiết sau khi import. Import luôn ghi `false`.

Subdocument tạo qua `DependentItemSchema`, `active: true`, `status: 'ACTIVE'`, `version: 1`.

**Vì sao tách sheet thay vì cột đánh số `dependent1_*`:** một dòng = một người phụ thuộc thì HR sắp xếp/lọc sheet `NhanVien` vẫn không làm người phụ thuộc nhảy sang nhân viên khác. Cột đánh số nằm cùng dòng sẽ bị di chuyển theo khi sort, gán sai người mà không báo lỗi.

**Vì sao không tách thêm theo tab UI (cá nhân / công việc / đãi ngộ):** hai tab đầu cùng một entity `EmployeeProfile` (1:1), tách ra chỉ thêm join chứ không thêm khả năng. Tab "Trạng thái" là lịch sử chuyển trạng thái, import luôn tạo `PROBATION`, không nhập được.

### Sheet 3 — `HuongDan`

Liệt kê giá trị hợp lệ của `role`, `gender`, `relationship`, và danh sách `departmentCode`/`positionCode`/`allowance_*`/chính sách thưởng chuyên cần hiện có của tenant (kèm tên), và giải thích rằng mỗi mã phụ cấp là một cột riêng trên sheet `NhanVien`. Do `buildTemplate` sinh tự động.

### Sheet 4 — `DanhMuc` (ẩn)

Sheet `veryHidden` chứa các danh sách cho dropdown (mỗi danh sách 1 cột: dòng 1 là tên danh sách, giá trị từ dòng 2). Excel giới hạn danh sách nhúng trong ô ở 255 ký tự — danh sách phòng ban của một tenant thật vượt xa mức đó — nên validation trỏ vào range trên sheet này. HR không thấy sheet; tenant chưa có phòng ban/chức danh nào thì cột đó không có validation (thay vì một validation Excel từ chối).

---

## Vị trí trên UI — HR only

Tính năng này **chỉ hiện cho HR**, không hiện cho `DEPARTMENT_MANAGER`.

Căn cứ code hiện tại:

| Chỗ | Hiện tại |
|---|---|
| `employee.controller.ts:27` | `POST /hr/employees` → `@Roles('HR')` — manager không tạo được nhân viên |
| `employee.controller.ts:47` | `GET /hr/employees` → `@Roles('HR', 'DEPARTMENT_MANAGER')` — manager chỉ đọc |
| `AppHeader.tsx:16` | nav "Nhân viên" → `visible: user.role === 'HR'` |
| `WorkspaceModules.tsx:109` | module "Danh bạ nhân viên" → `roles: ['HR']` |
| `WorkspaceRoutes.tsx:109-120` | `hrScoped` chặn non-HR ở `/hr/employees` |

Lý do nghiệp vụ: import tạo **tài khoản đăng nhập** (`User` + mật khẩu tạm) và **lương** (`SalaryProfile`). Manager không được cấp tài khoản và không được xem/sửa lương người khác.

**Điểm đặt UI:** [EmployeeDirectoryScreen.tsx](Apps/web/src/screens/EmployeeDirectory/EmployeeDirectoryScreen.tsx) — nút "Import Excel" cạnh nút tạo nhân viên, mở `EmployeeImportDialog`.

Route `/hr/employees` đã nằm trong `hrScoped` → **không cần sửa guard**, chỉ thêm dialog.

**Backend:** `@Roles('HR')` cho cả `POST /api/hr/employees/import` và `GET /api/hr/employees/import/template`.

Manager vẫn xem được kết quả import gián tiếp qua danh sách nhân viên (`GET` đã cho `HR, DEPARTMENT_MANAGER`), nhưng không thấy nút Import.

## Thứ tự xử lý (quan trọng)

`directManagerCode` có thể trỏ tới một nhân viên cũng nằm trong file. Xử lý 2 lượt:

1. **Lượt 1 — validate toàn bộ:** parse, kiểm tra required, format, duplicate trong file (`employeeCode`, `email`), tra `departmentCode`/`positionCode`/`allowance_*`/chính sách thưởng chuyên cần theo tenant, kiểm tra trùng với DB hiện có.
2. **Lượt 2 — tạo tài khoản + hồ sơ:** bỏ `directManagerId`, tạo hết `User` + `EmployeeProfile`.
3. **Lượt 3 — gán quản lý:** sau khi mọi profile đã có, resolve `directManagerCode` → `User._id` và `$set` `directManagerId`.
4. **Lượt 4 — lương + bảo hiểm:** tạo `SalaryProfile`, `InsuranceProfile` (chỉ khi có dữ liệu).

Nếu lượt 1 fail → không ghi gì cả.

---

## Một chế độ ghi: tất cả hoặc không gì cả

Bất kỳ dòng nào lỗi → rollback toàn bộ, `created: 0`. Dùng một transaction (`connection.startSession()`) bọc cả 4 lượt.

Đã **bỏ** chế độ `continue` (bỏ qua dòng lỗi, tạo dòng hợp lệ). Lý do: file import là một đợt nhân sự, không phải một tập dòng rời. Ghi một nửa rồi báo nửa còn lại khiến HR phải đối chiếu thủ công xem ai đã vào, và lần import sau (file đã sửa) sẽ vướng `EMPLOYEE_CODE_TAKEN` ở đúng những dòng đã ghi — buộc HR phải xoá tay. Một transaction cũng ngắn hơn nhiều transaction nhỏ và không để lại trạng thái nửa vời khi serverless timeout.

---

## Triển khai

### Backend

**File mới:**

1. `Apps/api/src/hr/employee/dto/import-employee.dto.ts`
   - `ImportEmployeesDto`: `dryRun?: boolean`.
   - `ImportEmployeeRowDto` — shape một dòng sau khi parse, dùng `class-validator` (tái dùng regex từ `create-employee-profile.dto.ts`: `PHONE_INVALID`, `CITIZEN_ID_INVALID`, `TAX_CODE_INVALID`, `SOCIAL_INSURANCE_CODE_INVALID`, `BANK_ACCOUNT_INVALID`).

2. `Apps/api/src/hr/employee/services/employee-import.service.ts`
   - `parseWorkbook(buffer): ParsedWorkbook` — `exceljs` đọc sheet `NhanVien` (theo tên, fallback theo vị trí) và sheet `NguoiPhuThuoc`, map header → key, chuẩn hóa ngày (`Date` object của Excel → `YYYY-MM-DD`), rồi gắn từng dòng người phụ thuộc vào nhân viên qua `employeeCode`. Trả `{ rows, orphans }` — `orphans` là dòng người phụ thuộc không khớp nhân viên nào, báo ở cấp file vì không có dòng nhân viên nào để gắn lỗi vào.
   - `validateRows(orgId, rows)` — gom lỗi theo dòng, lookup department/position/allowance bằng `$in` một lần (không query từng dòng).
   - `import(orgId, actorUserId, buffer, dryRun)` — điều phối 4 lượt ở trên trong một transaction. `orphans` cũng là lý do rollback.
   - Tái dùng **`provisionAccount`** (`Apps/api/src/database/seed/provision.ts`) cho mỗi nhân viên — đây là implementation duy nhất đảm bảo `User` và `EmployeeProfile` khớp nhau. Truyền `session` để ghim transaction.
   - Mật khẩu tạm: `generateTempPassword()` + `hashPassword()` từ `auth/strategies/` (giống `EmployeeService.provisionProfile`), hash **ngoài** transaction.
   - `buildTemplate(): Buffer` — sinh file `.xlsx` mẫu bằng `exceljs`: sheet `NhanVien` (21 cột + `allowance_<CODE>`), sheet `NguoiPhuThuoc` (5 cột), sheet `DanhMuc` ẩn (danh sách cho dropdown, sinh từ dữ liệu thật của tenant), sheet `HuongDan` liệt kê giá trị hợp lệ.

3. `Apps/api/src/hr/employee/employee-import.controller.ts`
   - `POST /api/hr/employees/import` — `@UseInterceptors(FileInterceptor('file'))`, `@UploadedFile() file: Express.Multer.File`, `@Roles('HR')`.
   - `GET /api/hr/employees/import/template` — trả file, set `Content-Disposition`.
   - Response: `{ success: true, data: { total, created, failed, dryRun, errors: [{ row, employeeCode, code, message }], tempPasswords: [{ employeeCode, email, tempPassword }] } }`.
   - `tempPasswords` chỉ trả khi `dryRun = false`.

**File sửa:**

- `Apps/api/src/hr/employee/employee.module.ts` — đăng ký controller/service mới, thêm `MongooseModule.forFeature` cho `SalaryProfile`, `InsuranceProfile`, `OrganizationAllowance`, `Department`, `Position`, `User` (kiểm tra module hiện có để không khai báo trùng).
- `Apps/api/src/hr/hr.module.ts` — không cần sửa nếu import qua `EmployeeModule`.

**Giới hạn kích thước:** chặn file > 5MB hoặc > 1000 dòng (`FILE_TOO_LARGE` / `TOO_MANY_ROWS`) — tránh request treo trên Vercel serverless.

### Frontend

**File mới:**

1. `Apps/web/src/screens/EmployeeDirectory/components/EmployeeImportDialog.tsx`
   - Bước 1: chọn file (input `accept=".xlsx"`), nút "Tải template".
   - Bước 2: checkbox "Chạy thử (không ghi dữ liệu)" + một dòng giải thích import là tất cả-hoặc-không-gì-cả.
   - Bước 3: bảng kết quả — dòng thành công, dòng lỗi kèm số dòng + mã lỗi dịch sang tiếng Việt; nút "Tải danh sách lỗi" (CSV).
   - Dùng `FormLabel`/`FormError` (`components/form/`) và `toast` (`components/toast`) như các dialog hiện có.

**File sửa:**

2. `Apps/web/src/screens/EmployeeDirectory/EmployeeDirectoryScreen.tsx` — thêm nút "Import Excel" cạnh nút tạo nhân viên, mở dialog trên.
3. `Apps/web/src/services/hrService.ts` — thêm `importEmployees(apiBase, file, dryRun)` dùng `FormData` + `hrRequest` (không set `Content-Type` thủ công để browser tự thêm boundary). Thêm mã lỗi mới vào `HR_ERROR_CODES` (`ROLE_NOT_ALLOWED`, `DEPARTMENT_NOT_FOUND`, `POSITION_NOT_FOUND`, `DUPLICATE_IN_FILE`, `FILE_TOO_LARGE`, `TOO_MANY_ROWS`, `ALLOWANCE_NOT_FOUND`).
4. `Apps/web/src/routes/WorkspaceRoutes.tsx` — **không cần sửa.** Nút Import nằm trong `EmployeeDirectoryScreen`, route `/hr/employees` đã nằm trong danh sách `hrScoped` nên guard HR đã có sẵn.

### Test

- `Apps/api/src/hr/employee/employee-import.service.spec.ts` — jest unit, dùng fixture workbook dựng bằng `exceljs` in-memory:
  - File hợp lệ 5 dòng → tạo đủ 5 user + profile + salary + insurance.
  - Thiếu `employeeCode`/`fullName`/`email` → lỗi đúng mã.
  - `employeeCode` trùng trong file và trùng với DB → `DUPLICATE_IN_FILE` / `EMPLOYEE_CODE_TAKEN`.
  - `departmentCode` không tồn tại → `DEPARTMENT_NOT_FOUND`.
  - `role = SYSTEM_ADMIN` → `ROLE_NOT_ALLOWED`.
  - 1 dòng lỗi trong file 5 dòng → **không** document nào được tạo, báo cáo đúng 1 lỗi.
  - `directManagerCode` trỏ tới nhân viên trong cùng file → `directManagerId` được gán đúng.
- Test không cần DB sống nếu mock model; nếu cần transaction thật thì dùng `mongodb-memory-server` (đã có trong devDependencies) — xem `Apps/api/test/jest-integration.config.js`.

---

## Verification (thủ công)

1. `npm run dev:api` + `npm run dev:web`.
2. Login HR → Employee Directory → "Tải template" → mở file, xác nhận header + sheet hướng dẫn.
3. Điền 5 nhân viên (1 dòng cố tình sai `departmentCode`).
4. Chạy **dry run** → xem bảng lỗi, xác nhận DB chưa đổi.
5. Sửa dòng sai rồi import lại → cả 5 nhân viên xuất hiện trong directory, có department/position/lương đúng.
6. Kiểm tra Mongo: `users` (role đúng), `employee_profiles` (dependents, directManagerId), `salary_profiles` (allowances), `insurance_profiles`.
7. Login thử một tài khoản mới bằng `tempPassword` → buộc đổi mật khẩu.
8. Chạy lại với file có lỗi → xác nhận rollback sạch (không có user nào được tạo).
9. `npm run lint` (api + web) và `npm test`.

---

## Rủi ro & lưu ý

| Rủi ro | Xử lý |
|---|---|
| `role` cho phép HR tự nâng quyền | Whitelist cứng `EMPLOYEE`/`DEPARTMENT_MANAGER`/`HR`; `SYSTEM_ADMIN` bị chặn ở service, không chỉ ở DTO |
| Transaction dài trên Vercel serverless | Một transaction cho cả file, nhưng chặn ở 1000 dòng; hash mật khẩu (bcrypt, chậm) chạy **ngoài** transaction |
| File Excel ngày tháng trả về `Date` object hoặc serial number | Chuẩn hóa trong `parseWorkbook`: nhận `Date`, số serial Excel, hoặc chuỗi `YYYY-MM-DD`/`DD/MM/YYYY` |
| `employmentType` enum chỉ có `FULL_TIME` | Không nhận giá trị khác; ghi rõ trong sheet hướng dẫn. Nếu cần PART_TIME/CONTRACT phải mở rộng enum trước (task riêng) |
| Trùng lặp khi HR bấm import 2 lần | Unique index (`organizationId+emailN`, `organizationId+employeeCode`) là chốt cuối; pre-flight check chỉ để có thông báo đẹp |
| `tempPassword` lộ trong log | Không log; chỉ trả trong response một lần, giống `EmployeeService.provisionProfile` |

---

## Cần bạn xác nhận

1. **File format:** chỉ `.xlsx`, hay cần cả `.csv`? (đề xuất: `.xlsx` trước — `exceljs` đã có sẵn)
2. **Gửi email mật khẩu tạm:** cần luôn trong feature này, hay để HR tự gửi (như hiện tại)?

**Đã chốt:** phụ cấp giữ cột `allowance_<CODE>` nhập số tiền tự do (không dropdown — đó là số tiền, không phải lựa chọn); `role` vẫn có trong file, dropdown 3 giá trị.
