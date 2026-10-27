# Plan: thêm Hợp đồng lao động và Hồ sơ bảo hiểm vào Import Excel

> Tiếp nối [EMPLOYEE_IMPORT_PLAN.md](EMPLOYEE_IMPORT_PLAN.md). Đọc plan này trước khi sửa code.
>
> **Phân công nhân sự đã bỏ khỏi phạm vi** (quyết định của bạn).

## Hiện trạng (đã đọc code)

| Thứ | Đã có trong import? | Ở đâu |
|---|---|---|
| Hợp đồng lao động | **Chưa** | `hr/employment-contract/` — `employment_contracts` |
| Hồ sơ bảo hiểm | **Có, nhưng cứng** | `createOne` tạo vô điều kiện, 3 cờ `participates*` luôn `true` |
| Định dạng ngày trong file | **`dd/mm/yyyy` — sai** | `DMY_DATE` trong parser |

### Xác nhận: `Bảo hiểm hiệu lực từ ngày` **đã** vào `insurance_profiles`

[employee-import.service.ts:997](Apps/api/src/hr/employee/services/employee-import.service.ts):

```ts
effectiveFrom: new Date(row.insuranceEffectiveFrom ?? row.joinDate!),
```

Cột này ghi đúng vào `insurance_profiles.effectiveFrom`, fallback `joinDate`. Cái **thiếu** là `effectiveTo` — không có cột nào cho nó, và plan này thêm.

`Số BHXH` (`socialInsuranceCode`) ghi vào `employee_profiles`, **không** vào `insurance_profiles` — đúng như vậy: schema `insurance_profiles` không có field đó, số BHXH là thuộc tính của nhân viên chứ không phải của từng giai đoạn tham gia.

Hai entity riêng, mỗi cái có service riêng. Import **không gọi service** của chúng — lý do ở mục "Quyết định thiết kế".

### Hợp đồng lao động — `EmploymentContractService`

- Schema: `contractType` (`PROBATION` / `FIXED_TERM` / `INDEFINITE_TERM`), `status` (`DRAFT` mặc định), `effectiveDate` (bắt buộc), `expiryDate?`, `endDate?`, `statusReason?`, `statusChangedAt?`, `note?`. Không có unique index → nhiều hợp đồng theo thời gian là hợp lệ.
- Luật ngày (`assertDateRules`): `INDEFINITE_TERM` **cấm** `expiryDate` (`CONTRACT_INDEFINITE_TERM_NO_EXPIRY`); các loại khác **bắt buộc** có (`CONTRACT_EXPIRY_REQUIRED`); `expiryDate > effectiveDate` (`CONTRACT_EXPIRY_BEFORE_EFFECTIVE`).
- `assertNoActiveOverlap`: không cho 2 hợp đồng `ACTIVE` chồng khoảng thời gian.
- `create()` luôn bắt đầu ở `DRAFT`; `changeStatus()` mới đẩy sang `ACTIVE` và stamp `statusChangedAt`.

### Hồ sơ bảo hiểm — `InsuranceProfile`

- Schema: `employeeId` (ref EmployeeProfile), `effectiveFrom` (bắt buộc), `effectiveTo?`, 3 cờ `participates*` (bắt buộc, default `true`), `note?`, `version`, `createdBy?`.
- D40 (2026-09-28): BHXH/BHYT/BHTN là nghĩa vụ pháp luật, không phải lựa chọn của HR. Web form đã **bỏ** 3 checkbox; cờ chỉ còn đường vào qua API trực tiếp cho trường hợp miễn giảm có văn bản.

---

## Quyết định thiết kế

### 1. Ghi thẳng bằng model, không gọi service

`EmploymentContractService` **không nhận `session`**. Import chạy trong một transaction, nên không thể tái dùng nó mà không sửa chữ ký của một service dùng chung ở nhiều controller.

→ `createOne` ghi thẳng `this.contractModel.create([...], {session})`. Đổi lại: **luật nghiệp vụ phải lặp lại ở tầng validate của import**, và đó là chủ ý — import báo lỗi **theo dòng** (`ImportRowError`), còn service ném exception. Hai kiểu báo lỗi khác nhau, gộp lại chỉ làm rối.

`ponytail:` 3 luật ngày của hợp đồng chép lại trong nhóm parse của `parseWorkbook` (không phải `validateRows` — hàm đó không tồn tại). Nếu luật này đổi, phải sửa cả 2 chỗ. Nâng cấp khi: luật hợp đồng phức tạp hơn 3 dòng → tách hàm thuần `assertContractDates()` dùng chung.

### 2. Hợp đồng tạo thẳng `ACTIVE`, không qua `DRAFT`

`create()` của service bắt đầu ở `DRAFT` vì đó là luồng "HR soạn hợp đồng cho một người". Import là luồng **backfill một lực lượng lao động đã đi làm**: nếu tạo `DRAFT`, màn hình `GET /hr/contracts/compliance` sẽ báo `NO_CONTRACT` cho toàn bộ nhân viên vừa import (compliance chỉ tính `ACTIVE`/`EXPIRED`), và HR phải vào từng hợp đồng bấm kích hoạt — đúng cái thao tác thủ công mà tính năng import sinh ra để xoá.

→ Import ghi `status: ACTIVE`, `statusChangedAt = effectiveDate`.

**Đã chốt (2026-10-06).**

### 3. Bảo hiểm: thêm `effectiveTo`, **không** thêm 3 cờ

D40 đã chốt 3 cờ là nghĩa vụ, không phải lựa chọn, và web form đã bỏ checkbox. Thêm 3 cột "Có/Không" vào file import là mở lại đúng cánh cửa vừa đóng, với hậu quả nặng hơn: một file 200 dòng ghi sai cột đó tạo ra 200 hồ sơ miễn giảm BHXH trái luật, không ai đọc lại.

→ Chỉ thêm **1 cột** `insuranceEffectiveTo`. Trường hợp miễn giảm có văn bản vẫn đi qua API trực tiếp như hiện tại.

### 4. Đổi định dạng ngày trong file sang `mm/dd/yyyy`

**Đây là sửa lỗi, không phải đổi cho đẹp.** Parser hiện tại đọc chuỗi ngày không có năm ở đầu là **`dd/mm/yyyy`**:

```ts
const DMY_DATE = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/;   // (d)(m)(y)
```

`01/05/2026` (HR gõ: 1 tháng 5) → parser hiểu **5 tháng 1**. Không có lỗi nào được báo, vì cả hai đều là ngày hợp lệ. Nhân viên vào làm sai 4 tháng, lương và bảo hiểm tính từ sai ngày, và không có gì trong báo cáo import chỉ ra điều đó.

**Sửa gồm 2 phần, phải làm cùng lúc:**

1. **Template** — đặt `numFmt` cho mọi cột ngày để Excel hiện `mm/dd/yyyy`:

   ```ts
   const DATE_COLUMNS = ['joinDate', 'dateOfBirth', 'salaryEffectiveFrom',
       'insuranceEffectiveFrom', 'insuranceEffectiveTo',
       'contractEffectiveDate', 'contractExpiryDate'] as const;
   for (const key of DATE_COLUMNS) {
       const col = COLUMNS.indexOf(key) + 1;
       if (col > 0) sheet.getColumn(col).numFmt = 'mm/dd/yyyy';
   }
   ```

   Ô được định dạng như vậy khi HR gõ `1/5/2026` Excel lưu thành **số serial ngày**, không phải chuỗi → parser đi nhánh `serialToIso`, không đụng tới regex. Đây là lý do phải làm cả hai phần: chỉ đổi template mà không đổi parser thì ô gõ tay dạng chuỗi vẫn sai.

2. **Parser** — đổi `DMY_DATE` thành `MDY_DATE`, đọc `(m)(d)(y)`:

   ```ts
   const MDY_DATE = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/;
   // ... const [, m, d, y] = MDY_DATE.exec(text);
   ```

   `YYYY-MM-DD` (nhánh `ISO_DATE`) **giữ nguyên** — đó là dạng chuẩn ISO, không nhập nhằng, và mọi file cũ đang dùng nó. Chỉ dạng có dấu phân cách mới đổi thứ tự.

   Đổi luôn tên hằng và biến cho khớp thứ tự mới — để tên `DMY` mà đọc `(m)(d)(y)` là bẫy cho người sửa sau.

3. **Message lỗi + sheet `HuongDan`** — sửa `(YYYY-MM-DD)` → `(MM/DD/YYYY)` ở 2 message lỗi (`JOIN_DATE_REQUIRED`, `DEPENDENT_DOB_INVALID` — cả ở API và `hrService.ts`) và dòng hướng dẫn `Ngày vào làm / Ngày sinh` thành `MM/DD/YYYY (hoặc YYYY-MM-DD)`.

**Hệ quả cần biết:** file `.xlsx` HR đã điền từ trước, nếu ngày gõ dạng `dd/mm/yyyy` **không** qua dropdown/định dạng ô, sẽ bị đọc sai sau thay đổi này. Ngày đã lưu trong DB không đổi — chỉ ảnh hưởng file chưa import. Ngày `15/01/2026` trở đi không nhập nhằng (15 không thể là tháng) nên chỉ các ngày ≤ 12 mới lệch.

---

## Cột mới trên sheet `NhanVien`

21 cột cố định hiện tại (A–U) + cột phụ cấp động. Thêm **4 cột**, chèn **trước** nhóm phụ cấp để phụ cấp vẫn nằm cuối:

| # | Cột (nhãn HR thấy) | Key | Bắt buộc | Map tới | Ghi chú |
|---|---|---|---|---|---|
| V | Bảo hiểm hiệu lực đến ngày | `insuranceEffectiveTo` | Không | `insurance_profiles.effectiveTo` | `MM/DD/YYYY`; phải sau `Bảo hiểm hiệu lực từ ngày` |
| W | Loại hợp đồng | `contractType` | Không | `employment_contracts.contractType` | **Dropdown** `Thử việc` / `Có thời hạn` / `Không thời hạn` → `PROBATION`/`FIXED_TERM`/`INDEFINITE_TERM` |
| X | Ngày hiệu lực hợp đồng | `contractEffectiveDate` | Có, nếu điền W | `employment_contracts.effectiveDate` | `MM/DD/YYYY` |
| Y | Ngày hết hạn hợp đồng | `contractExpiryDate` | Có, nếu W ∈ {PROBATION, FIXED_TERM} | `employment_contracts.expiryDate` | Cấm điền khi W = `Không thời hạn` |
| Z+ | `Phụ cấp <MÃ> (<Tên>)` | | | | như hiện tại, vẫn ở cuối |

**Cả nhóm W–Y đều tùy chọn.** Bỏ trống hết → không tạo hợp đồng, chỉ tạo hồ sơ bảo hiểm như hiện tại (hành vi cũ không đổi).

Quy tắc "có dữ liệu mới tạo", giống nhóm lương:

| Điều kiện | Kết quả |
|---|---|
| `contractType` trống | Không tạo hợp đồng |
| `contractType` có, `contractEffectiveDate` trống | Lỗi `CONTRACT_EFFECTIVE_DATE_REQUIRED` |

### Danh mục mới trong sheet ẩn `DanhMuc`

- `LoaiHopDong` — 3 dòng cố định (`Thử việc`/`Có thời hạn`/`Không thời hạn`), không phụ thuộc tenant.

Sheet `HuongDan` thêm một dòng giải thích nhóm hợp đồng.

---

## Mã lỗi mới

Thêm vào `HR_ERROR_CODES` ([hrService.ts](Apps/web/src/services/hrService.ts)) + message tiếng Việt:

| Mã | Khi nào |
|---|---|
| `CONTRACT_TYPE_INVALID` | `Loại hợp đồng` không thuộc 3 giá trị |
| `CONTRACT_EFFECTIVE_DATE_REQUIRED` | Có loại hợp đồng, thiếu ngày hiệu lực |
| `CONTRACT_EFFECTIVE_DATE_INVALID` | Ngày hiệu lực sai định dạng |
| `CONTRACT_EXPIRY_REQUIRED` | Loại `PROBATION`/`FIXED_TERM` thiếu ngày hết hạn |
| `CONTRACT_INDEFINITE_TERM_NO_EXPIRY` | Loại `INDEFINITE_TERM` **có** ngày hết hạn |
| `CONTRACT_EXPIRY_BEFORE_EFFECTIVE` | Ngày hết hạn ≤ ngày hiệu lực |
| `INSURANCE_EFFECTIVE_TO_BEFORE_FROM` | Ngày hết hạn bảo hiểm ≤ ngày hiệu lực bảo hiểm |

Không thêm mã cho "chồng khoảng hợp đồng ACTIVE": nhân viên import là **mới toanh**, chưa có hợp đồng nào để chồng. `assertNoActiveOverlap` không thể kích hoạt ở đường này.

Không thêm mã cho định dạng ngày: ngày không parse được vẫn là `*_REQUIRED` / `*_INVALID` hiện có — thông điệp đã nêu định dạng đúng.

---

## Triển khai

### Backend

**Sửa `employee.module.ts`** — thêm vào `MongooseModule.forFeature`:

```
EmploymentContract
```

**Sửa `services/employee-import.service.ts`:**

1. Constructor — inject thêm `@InjectModel(EmploymentContract.name) contractModel`.
2. `COLUMNS` — thêm 4 key mới; `HEADER_LABELS` — thêm 4 nhãn tiếng Việt; parser nhận cả key lẫn nhãn như hiện tại.
3. `ParsedRow` — thêm `contractType?`, `contractEffectiveDate?`, `contractExpiryDate?`, `insuranceEffectiveTo?`.
4. Nhóm parse hợp đồng trong `parseWorkbook` — thêm 3 luật ngày của hợp đồng + bảo hiểm (`effectiveTo > effectiveFrom`). Lỗi gắn đúng `rowNumber`. (Kiểm tra catalog vẫn ở `validateRefs`, chạy sau `parseWorkbook`.)
5. `createOne` — sau khi có `employeeProfileId`:
   ```ts
   // Hợp đồng: chỉ khi dòng có loại hợp đồng. ACTIVE ngay — xem plan §2.
   if (row.contractType) {
       await this.contractModel.create([{
           organizationId, employeeProfileId,
           contractType: row.contractType,
           status: ContractStatus.ACTIVE,
           effectiveDate: new Date(row.contractEffectiveDate!),
           expiryDate: row.contractExpiryDate ? new Date(row.contractExpiryDate) : undefined,
           statusChangedAt: new Date(row.contractEffectiveDate!),
       }], { session });
   }
   ```
   Bảo hiểm: thêm `effectiveTo` vào document đã tạo sẵn (`row.insuranceEffectiveTo ? new Date(...) : undefined`).
6. `buildTemplate` — thêm danh mục `LoaiHopDong` vào sheet `DanhMuc`, 4 cột vào `NhanVien`, gọi `applyDropdown` cho `Loại hợp đồng`, đặt `numFmt = 'mm/dd/yyyy'` cho 7 cột ngày (xem §4), thêm dòng hướng dẫn.
7. `toIsoDate` + `DMY_DATE` → `MDY_DATE` (xem §4), và 4 chỗ message/hướng dẫn ghi `YYYY-MM-DD`.

`Refs` và `validateRefs` **không đổi** — hợp đồng chỉ tra enum cục bộ, không tra catalog tenant nào.

**Không sửa** `employee-import.controller.ts` — response shape giữ nguyên (`total/created/failed/dryRun/errors/tempPasswords`), chỉ phần mô tả Swagger thêm một câu về hợp đồng.

### Frontend

Không có màn hình mới. Sửa **1 file**:

- [hrService.ts](Apps/web/src/services/hrService.ts) — thêm 7 mã lỗi ở trên vào `HR_ERROR_CODES`.
- [EmployeeImportDialog.tsx](Apps/web/src/screens/EmployeeDirectory/components/EmployeeImportDialog.tsx) — cập nhật `DialogDescription` (thêm "hợp đồng"), không đổi logic.

Bảng lỗi và CSV lỗi dùng chung `mapHrError` → mã mới tự hiện tiếng Việt, không phải sửa gì thêm.

### Test — `employee-import.service.spec.ts`

Fixture: thêm `contracts` model giả; `buildFixture` truyền thêm model đó.

| Case | Mong đợi |
|---|---|
| Dòng đầy đủ W–Y | `contracts.create` gọi 1 lần, `status: ACTIVE`, `contractType` đúng |
| Dòng không có W–Y | `contracts.create` **không** gọi |
| `INDEFINITE_TERM` + có `contractExpiryDate` | `CONTRACT_INDEFINITE_TERM_NO_EXPIRY` |
| `FIXED_TERM` thiếu `contractExpiryDate` | `CONTRACT_EXPIRY_REQUIRED` |
| `contractExpiryDate` < `contractEffectiveDate` | `CONTRACT_EXPIRY_BEFORE_EFFECTIVE` |
| `contractType` = `KHONGCO` | `CONTRACT_TYPE_INVALID` |
| `insuranceEffectiveTo` < `insuranceEffectiveFrom` | `INSURANCE_EFFECTIVE_TO_BEFORE_FROM` |
| `insuranceEffectiveTo` hợp lệ | `insurances.create` nhận đúng `effectiveTo` |
| `insuranceEffectiveFrom` = `2026-03-15` | `insurances.create` nhận `effectiveFrom` đúng ngày đó (**không** phải `joinDate`) |
| `joinDate` gõ `03/15/2026` (MM/DD/YYYY) | parse ra `2026-03-15` — chốt thứ tự mới |
| `joinDate` gõ `15/03/2026` | parse ra `2026-03-15` (15 không thể là tháng → vẫn đúng) |
| `joinDate` gõ `01/05/2026` | parse ra **`2026-01-05`** (MM/DD) — case chốt rằng thứ tự đã đổi, trước đây ra `2026-05-01` |
| `joinDate` gõ `2026-03-15` (ISO) | vẫn parse ra `2026-03-15` — file cũ không vỡ |
| Dòng có hợp đồng lỗi + 2 dòng sạch | `created: 0`, không document nào được tạo (tất cả-hoặc-không-gì-cả vẫn giữ) |

---

## Test tay — bổ sung vào `EMPLOYEE_IMPORT_TEST_CASES.md`

Bảng cột ở mục 0 cập nhật thành **25 cột cố định** + phụ cấp từ cột `Z`, và ghi định dạng ngày là **`MM/DD/YYYY`** (kèm ghi chú vẫn nhận `YYYY-MM-DD`). Thêm 3 nhóm sau nhóm G:

- **Nhóm H — Hợp đồng:** H1 điền đủ `Có thời hạn` + 2 ngày → hợp lệ; H2 `Không thời hạn` để trống ngày hết hạn → hợp lệ; H3 `Không thời hạn` **có** ngày hết hạn → `CONTRACT_INDEFINITE_TERM_NO_EXPIRY`; H4 `Có thời hạn` thiếu ngày hết hạn → `CONTRACT_EXPIRY_REQUIRED`; H5 ngày hết hạn trước ngày hiệu lực → `CONTRACT_EXPIRY_BEFORE_EFFECTIVE`; H6 để trống `Loại hợp đồng` → không lỗi, **không** tạo hợp đồng (kiểm DB).
- **Nhóm I — Bảo hiểm:** I1 có `Bảo hiểm hiệu lực đến ngày` → `insurance_profiles.effectiveTo` đúng; I2 ngày đến ≤ ngày từ → `INSURANCE_EFFECTIVE_TO_BEFORE_FROM`; I3 điền `Bảo hiểm hiệu lực từ ngày` = `2026-03-15` → `insurance_profiles.effectiveFrom` = `2026-03-15` (**không** phải `Ngày vào làm`); I4 xác nhận **không có cột** nào cho 3 cờ `participates*` và DB luôn `true`.
- **Nhóm K — Định dạng ngày:** K1 gõ `01/05/2026` vào `Ngày vào làm` → nhân viên có `joinDate` = `2026-01-05` (MM/DD), **không** phải `2026-05-01`; K2 gõ `2026-03-15` (ISO) → vẫn đúng; K3 gõ `15/03/2026` → vẫn đúng (`15` không thể là tháng); K4 mở file mẫu, xác nhận các ô ngày hiện `mm/dd/yyyy` và gõ `1/5/2026` Excel tự chuyển thành `01/05/2026`; K5 gõ `13/13/2026` → báo lỗi ngày không hợp lệ, không im lặng nhận.

Mục 8 (kiểm tra sau import) thêm 1 dòng bảng: `employment_contracts` (đúng `contractType`, `status = ACTIVE`, `effectiveDate`, `expiryDate`).

---

## Verification (thủ công)

1. `npm run dev:api` + `npm run dev:web`, login HR.
2. Tải file mẫu → xác nhận **25 cột cố định**, dropdown `Loại hợp đồng` có 3 giá trị, sheet `HuongDan` có dòng mới, các cột ngày hiện `mm/dd/yyyy`.
3. Điền 3 dòng: (a) đầy đủ hợp đồng, (b) chỉ tối thiểu, (c) một dòng sai `Loại hợp đồng`. Dòng (a) gõ ngày dạng `01/05/2026` để chốt thứ tự MM/DD.
4. **Chạy thử** → 1 lỗi đúng mã, DB chưa đổi.
5. Sửa rồi **Import** → kiểm 2 collection `employment_contracts` / `insurance_profiles` khớp dòng đã điền, và `joinDate` = `2026-01-05` (không phải `2026-05-01`).
6. Mở màn hình **Hợp đồng** → thấy hợp đồng vừa import; màn hình **Tuân thủ hợp đồng** không báo `NO_CONTRACT` cho các nhân viên này.
7. Import lại file cũ (bỏ trống W–Y, ngày dạng ISO `YYYY-MM-DD`) → vẫn chạy đúng, không tạo hợp đồng nào.

---

## Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Luật ngày hợp đồng bị chép 2 nơi, lệch nhau | Ghi rõ trong comment cạnh khối validate; test tay nhóm H là chốt |
| Hợp đồng `ACTIVE` tạo thẳng bỏ qua audit trail `changeStatus` | Chấp nhận: import là backfill, không có "HR soạn rồi duyệt". `statusChangedAt = effectiveDate` để màn hình không hiện "vừa đổi trạng thái hôm nay". **Đã chốt** — xem §2 |
| File import cũ (21 cột) sau khi thêm cột | Parser khớp theo **tên cột**, không theo vị trí → file cũ vẫn chạy; 4 cột mới vắng mặt = bỏ trống |
| **File cũ có ngày dạng `dd/mm/yyyy` bị đọc sai sau khi đổi sang `mm/dd/yyyy`** | Không tự phát hiện được (`01/05` là ngày hợp lệ ở cả hai cách đọc). Chỉ ảnh hưởng file **chưa từng import**; dữ liệu đã trong DB không đổi. Ghi rõ trong thông báo phát hành và trong sheet `HuongDan` |
| Đổi thứ tự ngày mà quên đổi tên hằng `DMY_DATE` | Đổi tên thành `MDY_DATE` cùng lúc; case test `01/05/2026` là chốt |
| `numFmt` không áp cho cột phụ cấp động (nằm sau cột ngày) | `numFmt` đặt theo **chỉ số cột cố định** từ `COLUMNS.indexOf`, không đụng cột phụ cấp |

---

## Đã chốt

1. **Trạng thái hợp đồng khi import: `ACTIVE` ngay** (chốt 2026-10-06). Không tạo `DRAFT`.
2. **Phân công nhân sự: bỏ khỏi phạm vi** (chốt 2026-10-06).
3. **Định dạng ngày trong file: `MM/DD/YYYY`**, vẫn nhận `YYYY-MM-DD`.
4. **Hồ sơ bảo hiểm: thêm `effectiveTo`, không thêm 3 cờ `participates*`** (D40).

Plan đã đủ để triển khai.
