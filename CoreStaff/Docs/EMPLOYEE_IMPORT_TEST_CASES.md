# Test tay: validate import nhân viên từ Excel

Tài liệu để **tự tay dựng file và chạy thử** tính năng import, kiểm tra từng điều kiện validate trước khi tin vào kết quả. Mỗi case ghi rõ: dữ liệu điền, kết quả mong đợi, mã lỗi.

Cách chạy: web → **Nhân viên** → **Import Excel** → *Tải file mẫu* → điền → tích **"Chạy thử — chỉ kiểm tra, không ghi dữ liệu"** → **Kiểm tra tệp**. Bảng lỗi hiện ra ở bước 3.

---

## 0. Chuẩn bị

1. Đăng nhập bằng tài khoản **HR** (nút Import không hiện với `DEPARTMENT_MANAGER`).
2. Bấm **Tải file mẫu**. File mẫu sinh từ dữ liệu **hiện tại** của tổ chức bạn — mở sheet **`HuongDan`** để lấy đúng mã phòng ban / chức danh / phụ cấp / chính sách thưởng đang có.
3. Ghi lại 3 thứ sau, các case bên dưới dùng lại:
   - **Mã phòng ban A** và **chức danh thuộc A** (cặp hợp lệ) — ví dụ seed chuẩn: `ENG` + `DEV`
   - **Mã phòng ban B** (khác A) — ví dụ: `FIN`
   - Một **mã không tồn tại** bất kỳ — các case dưới ghi là `KHONGCO`

> Ví dụ trong tài liệu dùng catalog seed chuẩn: phòng ban `ENG` / `FIN` / `OPS`, chức danh `DLEAD`+`DEV`+`QA` (thuộc `ENG`), `ACC` (thuộc `FIN`), `OPS` (thuộc `OPS`). **Tổ chức của bạn có thể khác — luôn thay bằng mã trong sheet `HuongDan`.**

### Thứ tự cột trên sheet `NhanVien` (template hiện tại, 25 cột)

| # | Cột | Bắt buộc |
|---|---|---|
| A | Mã nhân viên | ✔ |
| B | Họ và tên | ✔ |
| C | Email | ✔ |
| D | Vai trò | |
| E | Số điện thoại | |
| F | Ngày vào làm | ✔ |
| G | Ngày sinh | |
| H | Giới tính | |
| I | Số CCCD | |
| J | Mã số thuế | |
| K | Số BHXH | |
| L | Số tài khoản ngân hàng | |
| M | Địa chỉ | |
| N | Phòng ban | ✔ |
| O | Chức danh | ✔ |
| P | Quản lý trực tiếp | |
| Q | Lương cơ bản | |
| R | Lương đóng BHXH | |
| S | Lương hiệu lực từ ngày | |
| T | Chính sách thưởng chuyên cần | |
| U | Bảo hiểm hiệu lực từ ngày | |
| V | Bảo hiểm hiệu lực đến ngày | |
| W | Loại hợp đồng | |
| X | Ngày hiệu lực hợp đồng | có, nếu điền W |
| Y | Ngày hết hạn hợp đồng | có, nếu W = Thử việc / Có thời hạn |
| Z+ | `Phụ cấp <MÃ> (<Tên>)` | mỗi mã phụ cấp 1 cột, thêm ở cuối |

Ô `Phòng ban` / `Chức danh` / `Vai trò` / `Giới tính` / `Quản lý trực tiếp` / `Chính sách thưởng chuyên cần` / `Loại hợp đồng` là **dropdown**. Nếu bạn gõ tay thay vì chọn, gõ đúng `MÃ — Tên` (ví dụ `ENG — Engineering`) hoặc chỉ `MÃ` — cả hai đều được.

> **Định dạng ngày: `MM/DD/YYYY`.** Các cột ngày đã được đặt định dạng sẵn trong file mẫu, nên gõ `1/5/2026` Excel tự hiện `01/05/2026` và hiểu là **5 tháng 1** (tháng trước, ngày sau). Vẫn nhận `YYYY-MM-DD`. Trước đây file đọc `DD/MM/YYYY` — đã đổi (xem [EMPLOYEE_IMPORT_CONTRACT_INSURANCE_PLAN.md](EMPLOYEE_IMPORT_CONTRACT_INSURANCE_PLAN.md) §4). Ngày có số đầu > 12 (ví dụ `15/03/2026`) vẫn hiểu là ngày/tháng vì chỉ có một cách đọc hợp lệ.

---

## 1. Nhóm A — File hợp lệ (phải tạo được)

Chạy riêng từng file nhỏ để dễ đọc kết quả.

### A1 — Dòng tối thiểu

Chỉ điền 6 cột bắt buộc:

| Mã NV | Họ và tên | Email | Ngày vào làm | Phòng ban | Chức danh |
|---|---|---|---|---|---|
| `TEST-A1` | Nguyễn Văn An | test.a1@example.com | 2026-01-05 | `ENG — Engineering` | `DEV — Software Developer` |

**Mong đợi:** `0 lỗi`, "Tệp hợp lệ, sẵn sàng import."

### A2 — Điền hết mọi cột

| Cột | Giá trị |
|---|---|
| Mã NV | `TEST-A2` |
| Họ và tên | Trần Thị Bình |
| Email | test.a2@example.com |
| Vai trò | `DEPARTMENT_MANAGER — Quản lý phòng ban` |
| Số điện thoại | `0901234567` |
| Ngày vào làm | `2026-01-05` |
| Ngày sinh | `1995-03-12` |
| Giới tính | `Nam` |
| Số CCCD | `012345678901` |
| Mã số thuế | `0123456789` |
| Số BHXH | `0123456789` |
| Số tài khoản | `0123456789` |
| Địa chỉ | 12 Lê Lợi, Quận 1, TP.HCM |
| Phòng ban | `ENG — Engineering` |
| Chức danh | `DEV — Software Developer` |
| Lương cơ bản | `20000000` |
| Lương đóng BHXH | `20000000` |
| Lương hiệu lực từ ngày | `2026-02-01` |
| Bảo hiểm hiệu lực từ ngày | `2026-02-01` |

**Mong đợi:** `0 lỗi`.

### A3 — Giá trị HR gõ tay (không chọn dropdown)

Cùng A1, nhưng đổi:

| Cột | Giá trị | Kiểm tra điều gì |
|---|---|---|
| Vai trò | `Quản lý phòng ban` | tên tiếng Việt → `DEPARTMENT_MANAGER` |
| Giới tính | `Nữ` | → `FEMALE` |
| Ngày vào làm | `01/05/2026` | định dạng `MM/DD/YYYY` → `2026-01-05` |
| Ngày sinh | `43831` | số serial của Excel → `2020-01-01` |
| Phòng ban | `ENG` | chỉ mã, không có tên |

**Mong đợi:** `0 lỗi`.

### A4 — Phụ cấp và chính sách thưởng

Thêm cột `Phụ cấp <MÃ> (<Tên>)` (cột cuối, lấy mã từ sheet `HuongDan`), điền số tiền. Kèm Lương cơ bản + Lương đóng BHXH.

**Mong đợi:** `0 lỗi`. Sau khi import thật, kiểm tra `salary_profiles.allowances` có đúng mã + số tiền.

### A5 — Ô chính sách thưởng để `Không áp dụng`

**Mong đợi:** `0 lỗi` — đây là giá trị sentinel "không gắn chính sách", **không** phải lỗi `ATTENDANCE_BONUS_POLICY_NOT_FOUND`.

---

## 2. Nhóm B — Lỗi từng trường

Mỗi case là **một file một dòng**, chỉ phá đúng một thứ so với A1. Import là tất cả-hoặc-không-gì-cả → **không có nhân viên nào được tạo**.

| # | Phá gì | Giá trị điền | Mã lỗi mong đợi |
|---|---|---|---|
| B1 | Mã nhân viên | để trống | `EMPLOYEE_CODE_REQUIRED` |
| B2 | Họ và tên | để trống | `FULLNAME_REQUIRED` |
| B3 | Email | để trống | `EMAIL_REQUIRED` |
| B4 | Email | `khong-phai-email` | `EMAIL_INVALID` |
| B5 | Vai trò | `SYSTEM_ADMIN` | `ROLE_NOT_ALLOWED` |
| B6 | Vai trò | `GIAM_DOC` | `ROLE_NOT_ALLOWED` |
| B7 | Số điện thoại | `090123456` (9 số) | `PHONE_INVALID` |
| B8 | Số điện thoại | `09012345ab` | `PHONE_INVALID` |
| B9 | Ngày vào làm | để trống | `JOIN_DATE_REQUIRED` |
| B10 | Ngày vào làm | `hôm qua` | `JOIN_DATE_REQUIRED` |
| B11 | Ngày vào làm | `2099-01-01` | `JOIN_DATE_FUTURE` |
| B12 | Ngày sinh | `2099-01-01` | `DOB_FUTURE_DATE` |
| B13 | Giới tính | `Không rõ` | `GENDER_INVALID` |
| B14 | Số CCCD | `12345678` (8 số) | `CITIZEN_ID_INVALID` |
| B15 | Mã số thuế | `123456789` (9 số) | `TAX_CODE_INVALID` |
| B16 | Số BHXH | `1234567890123` (13 số) | `SOCIAL_INSURANCE_CODE_INVALID` |
| B17 | Số tài khoản | `12345` (5 số) | `BANK_ACCOUNT_INVALID` |
| B18 | Địa chỉ | chuỗi dài 257 ký tự | `ADDRESS_TOO_LONG` |
| B19 | Phòng ban | để trống | `DEPARTMENT_REQUIRED` |
| B20 | Chức danh | để trống | `POSITION_REQUIRED` |
| B21 | Lương cơ bản | `-500000`, Lương BHXH `500000` | `BASE_SALARY_INVALID` |
| B22 | Lương đóng BHXH | để trống, có Lương cơ bản | `INSURANCE_SALARY_INVALID` |
| B23 | Lương cơ bản | để trống, **chỉ** có Lương BHXH | `BASE_SALARY_INVALID` |
| B24 | Cột phụ cấp | `-1` | `ALLOWANCE_AMOUNT_INVALID` |
| B25 | Phòng ban | `KHONGCO` | `DEPARTMENT_NOT_FOUND` |
| B26 | Chức danh | `KHONGCO` | `POSITION_NOT_FOUND` |
| B27 | Quản lý trực tiếp | `KHONGCO` | `MANAGER_NOT_FOUND` |
| B28 | Cột `Phụ cấp KHONGCO (...) — thử` | `500000` | `ALLOWANCE_NOT_FOUND` |
| B29 | Chính sách thưởng | `Không có chính sách XYZ` | `ATTENDANCE_BONUS_POLICY_NOT_FOUND` |
| B30 | Loại hợp đồng | `Hợp đồng dài hạn` | `CONTRACT_TYPE_INVALID` |
| B31 | Loại hợp đồng | `Có thời hạn`, thiếu Ngày hiệu lực | `CONTRACT_EFFECTIVE_DATE_REQUIRED` |
| B32 | Loại hợp đồng | `Thử việc` + Ngày hiệu lực, thiếu Ngày hết hạn | `CONTRACT_EXPIRY_REQUIRED` |
| B33 | Loại hợp đồng | `Không thời hạn` + Ngày hiệu lực **+ Ngày hết hạn** | `CONTRACT_INDEFINITE_TERM_NO_EXPIRY` |
| B34 | Ngày hết hạn hợp đồng | `2025-12-31`, Ngày hiệu lực `2026-01-05` | `CONTRACT_EXPIRY_BEFORE_EFFECTIVE` |
| B35 | Bảo hiểm hiệu lực đến ngày | bằng đúng ngày từ | `INSURANCE_EFFECTIVE_TO_BEFORE_FROM` |

**Kiểm tra thêm:** với B19, B20 — dòng đó chỉ có 1 lỗi, không kéo theo lỗi phụ thuộc (ví dụ B19 không được sinh thêm `POSITION_NOT_FOUND`).

---

## 3. Nhóm C — Trùng lặp

### C1 — Trùng mã trong cùng file

| Mã NV | Email | Mong đợi |
|---|---|---|
| `TEST-C1` | test.c1a@example.com | không lỗi |
| `TEST-C1` | test.c1b@example.com | `DUPLICATE_IN_FILE` |

### C2 — Trùng email trong cùng file

| Mã NV | Email | Mong đợi |
|---|---|---|
| `TEST-C2A` | test.c2@example.com | không lỗi |
| `TEST-C2B` | test.c2@example.com | `DUPLICATE_IN_FILE` |

### C3 — Trùng với dữ liệu đã có trong tổ chức

Lấy một **mã nhân viên có thật** đang hiện trong Danh bạ → điền vào file.

**Mong đợi:** `EMPLOYEE_CODE_TAKEN`.

### C4 — Trùng email với tài khoản đã có

Lấy **email của một nhân viên đang có** → điền vào file.

**Mong đợi:** `EMAIL_TAKEN`.

---

## 4. Nhóm D — Phòng ban ↔ Chức danh (trọng tâm đợt sửa này)

> Dropdown `Chức danh` hiện **TẤT CẢ** chức danh của tổ chức trong **một danh sách phẳng** — không tự lọc theo phòng ban đã chọn. Server mới là bên từ chối cặp sai. Vì vậy nhóm này quan trọng nhất.

### D1 — Đúng cặp

| Phòng ban | Chức danh |
|---|---|
| `ENG — Engineering` | `DEV — Software Developer` |

**Mong đợi:** `0 lỗi`.

### D2 — Sai phòng ban (mã chức danh có thật, nhưng thuộc phòng khác)

| Phòng ban | Chức danh |
|---|---|
| `FIN — Finance` | `DEV — Software Developer` |

(`DEV` thuộc `ENG`, không thuộc `FIN`.)

**Mong đợi:** `POSITION_DEPARTMENT_MISMATCH` — nội dung: *Chức danh "DEV" không thuộc phòng ban "FIN".*
**Không được** báo `POSITION_NOT_FOUND` — mã đó có thật, HR đang nhìn thấy nó trong dropdown.

### D3 — Chức danh không tồn tại

| Phòng ban | Chức danh |
|---|---|
| `ENG — Engineering` | `KHONGCO` |

**Mong đợi:** `POSITION_NOT_FOUND` — *Không tìm thấy chức danh "KHONGCO" trong phòng ban "ENG".*

### D4 — Phòng ban không tồn tại

| Phòng ban | Chức danh |
|---|---|
| `KHONGCO` | `DEV` |

**Mong đợi:** **chỉ** `DEPARTMENT_NOT_FOUND`. Không sinh thêm lỗi chức danh nào — không có phòng ban thì không có cặp để tra.

### D5 — Đổi phòng ban trong sheet `HuongDan`

Vào **Cấu hình lương → Danh mục phòng ban**, sửa tên một phòng ban (hoặc thêm phòng ban mới + chức danh mới). **Tải lại file mẫu** và mở sheet `HuongDan`:

- [ ] Danh sách `Phòng ban` có mục vừa thêm/sửa
- [ ] Dropdown `Chức danh` có chức danh vừa thêm
- [ ] Bảng **"Chức danh theo phòng ban"** ở cuối sheet `HuongDan` khớp dữ liệu mới
- [ ] File mẫu **tải trước khi sửa** vẫn import được, nhưng thiếu mục vừa thêm (đúng như ghi chú "Cập nhật danh mục" trong sheet)

---

## 5. Nhóm E — Sheet `NguoiPhuThuoc`

Sheet 2, nối về sheet 1 qua cột **Mã nhân viên**. Dùng chung file với dòng `TEST-A2` ở trên.

| # | Mã NV | Họ tên NPT | Ngày sinh | Quan hệ | Mong đợi |
|---|---|---|---|---|---|
| E1 | `TEST-A2` | Nguyễn Bé | 2020-05-01 | `Con` | hợp lệ |
| E2 | `TEST-A2` | Nguyễn Tí | 2022-09-09 | `SPOUSE — Vợ/Chồng` | hợp lệ (nhận cả ô có dấu gạch) |
| E3 | `TEST-A2` | *(trống)* | 2020-05-01 | `Con` | `DEPENDENT_NAME_REQUIRED` |
| E4 | `TEST-A2` | Thiếu ngày sinh | *(trống)* | `Con` | `DEPENDENT_DOB_INVALID` |
| E5 | `TEST-A2` | Thiếu quan hệ | 2020-05-01 | *(trống)* | `DEPENDENT_RELATIONSHIP_REQUIRED` |
| E6 | `KHONGCO` | Mồ côi | 2020-05-01 | `Con` | `DEPENDENT_ORPHAN` |
| E7 | `TEST-A2` | Bé Tương lai | 2099-01-01 | `Con` | `DEPENDENT_DOB_INVALID` |

**Kiểm tra thêm:**
- [ ] E6 (orphan) làm **cả file bị từ chối**, dù dòng nhân viên `TEST-A2` sạch
- [ ] Xoá hẳn sheet `NguoiPhuThuoc` → file vẫn import được, không lỗi
- [ ] Đổi tên sheet thành `PhuThuoc` → người phụ thuộc **vẫn được gắn** (parser nhận theo tên cột)
- [ ] 1 nhân viên có nhiều người phụ thuộc → tất cả đều được lưu

---

## 6. Nhóm F — Lỗi cấp file (không phải lỗi dòng)

Các case này **không** hiện bảng dòng lỗi, mà hiện cảnh báo đỏ ở bước 3.

| # | Làm gì | Mong đợi |
|---|---|---|
| F1 | Upload file `.txt` / ảnh | Chặn ngay ở ô chọn tệp — "Chỉ chấp nhận tệp Excel (.xlsx)." |
| F2 | Upload file `.xlsx` > 5 MB | Chặn ngay — "Giới hạn import là 5 MB." |
| F3 | Upload file `.xlsx` hỏng (đổi đuôi từ file khác) | "Không thể xử lý tệp" |
| F4 | Xoá cột `Phòng ban` khỏi sheet `NhanVien` rồi upload | Báo thiếu cột, nêu **tên cột** bị thiếu |
| F5 | Sheet `NguoiPhuThuoc` bị xoá cột `Mối quan hệ` | Báo thiếu cột của sheet người phụ thuộc |

---

## 7. Nhóm G — Chạy thử và chạy thật

Chuẩn bị file **3 dòng**: 2 dòng hợp lệ + 1 dòng sai `Phòng ban` = `KHONGCO`.

### G1 — Chạy thử (không ghi)

- [ ] Tích "Chạy thử", bấm **Kiểm tra tệp**
- [ ] Báo cáo: `Kiểm tra 3 dòng: 2 hợp lệ, 1 lỗi.`
- [ ] **Không có bảng "Mật khẩu tạm"**
- [ ] Vào Danh bạ nhân viên → **không** có dòng nào mới

### G2 — Chạy thật với file còn lỗi

- [ ] Bỏ tích "Chạy thử", bấm **Import**
- [ ] Thông báo "Không import được dòng nào"
- [ ] Danh bạ **không** có dòng nào mới — kể cả 2 dòng hợp lệ (tất cả hoặc không gì cả)

### G3 — Chạy thật với file đã sửa

- [ ] Sửa dòng sai thành `ENG — Engineering`, bấm **Import**
- [ ] Thông báo tạo **3** nhân viên, 0 dòng lỗi
- [ ] Danh bạ có đúng 3 nhân viên mới
- [ ] Bảng **Mật khẩu tạm** có đúng 3 dòng

### G4 — Mật khẩu tạm

- [ ] Sau G3, bấm **Sao chép tất cả** → dán ra notepad, đúng định dạng `mã — email — mật khẩu`
- [ ] Đóng dialog → **không xem lại được** mật khẩu (hệ thống không lưu)
- [ ] Đăng nhập thử một tài khoản bằng mật khẩu tạm đó → vào được, buộc đổi mật khẩu

---

## 8. Nhóm H — Hợp đồng lao động

Chỉ chạy khi cột `Loại hợp đồng` được điền. Bỏ trống cột này → **không** tạo hợp đồng, không lỗi.

| # | Loại hợp đồng | Ngày hiệu lực | Ngày hết hạn | Mong đợi |
|---|---|---|---|---|
| H1 | `Có thời hạn` | 2026-01-05 | 2027-01-04 | hợp lệ |
| H2 | `Thử việc` | 2026-01-05 | 2026-04-04 | hợp lệ |
| H3 | `Không thời hạn` | 2026-01-05 | *(trống)* | hợp lệ |
| H4 | `Không thời hạn` | 2026-01-05 | 2027-01-04 | `CONTRACT_INDEFINITE_TERM_NO_EXPIRY` |
| H5 | `Có thời hạn` | 2026-01-05 | *(trống)* | `CONTRACT_EXPIRY_REQUIRED` |
| H6 | *(trống)* | 2026-01-05 | 2027-01-04 | hợp lệ — ngày bị bỏ qua, không tạo hợp đồng |

**Kiểm tra thêm:**
- [ ] Sau khi import thật, mở màn hình **Hợp đồng** → hợp đồng vừa tạo có trạng thái **Đang hiệu lực** (không phải Nháp)
- [ ] Màn hình **Tuân thủ hợp đồng** → nhân viên vừa import **không** bị báo "chưa có hợp đồng"

---

## 9. Nhóm I — Hồ sơ bảo hiểm

| # | Bảo hiểm từ ngày | Bảo hiểm đến ngày | Mong đợi |
|---|---|---|---|
| I1 | 2026-03-15 | *(trống)* | hợp lệ; DB `effectiveFrom = 2026-03-15` (**không** phải Ngày vào làm) |
| I2 | 2026-03-15 | 2027-03-14 | hợp lệ; DB `effectiveTo = 2027-03-14` |
| I3 | 2026-03-15 | 2026-03-15 | `INSURANCE_EFFECTIVE_TO_BEFORE_FROM` |
| I4 | 2026-03-15 | 2026-01-01 | `INSURANCE_EFFECTIVE_TO_BEFORE_FROM` |

**Kiểm tra thêm:**
- [ ] Không có cột nào cho `Tham gia BHXH/BHYT/BHTN` — cả 3 cờ trong DB luôn `true`
- [ ] Bỏ trống cả 2 cột → vẫn tạo hồ sơ bảo hiểm, `effectiveFrom = Ngày vào làm`

---

## 10. Nhóm K — Định dạng ngày

Cột ngày trong file mẫu được đặt định dạng `mm/dd/yyyy`, nên gõ `1/5/2026` Excel tự hiện `01/05/2026`.

| # | Gõ vào `Ngày vào làm` | Mong đợi |
|---|---|---|
| K1 | `01/05/2026` | `joinDate = 2026-01-05` (5 tháng 1 — tháng trước, **không** phải 1 tháng 5) |
| K2 | `2026-03-15` | `joinDate = 2026-03-15` (ISO vẫn nhận) |
| K3 | `15/03/2026` | `joinDate = 2026-03-15` (số đầu > 12 → chỉ có một cách đọc) |
| K4 | `13/13/2026` | lỗi ngày không hợp lệ, **không** im lặng nhận |
| K5 | `1/5/2026` (không gõ số 0 đầu) | Excel tự đổi thành `01/05/2026` → `2026-01-05` |

**Kiểm tra thêm:**
- [ ] Mở file mẫu, chọn một ô ngày → thanh formula hiện đúng `mm/dd/yyyy`
- [ ] Ô `Ngày sinh` ở sheet `NguoiPhuThuoc` cũng cùng định dạng

---

## 11. Kiểm tra sau khi import thật

Chạy 1 file hợp lệ (bỏ tích "Chạy thử"), rồi kiểm tra DB (Mongo / màn hình chi tiết):

| Bảng | Kiểm tra |
|---|---|
| `users` | có tài khoản, `role` đúng, `email` đúng, **mật khẩu là hash** (không phải plaintext) |
| `employee_profiles` | `employeeCode`, `departmentId`, `positionId` đúng; `employmentStatus = PROBATION`; `directManagerId` đúng nếu có |
| `employee_profiles.dependents` | đủ người phụ thuộc, `isDisabled = false`, `status = ACTIVE` |
| `salary_profiles` | `baseSalary`, `insuranceSalary`, `effectiveFrom`, `allowances[]`, `attendanceBonusPolicyId` |
| `insurance_profiles` | **luôn có**, cả 3 cờ `participates*` = `true` (nghĩa vụ pháp luật); `effectiveFrom` đúng cột "Bảo hiểm hiệu lực từ ngày" (không phải `joinDate`); `effectiveTo` có nếu cột đó được điền |
| `employment_contracts` | **chỉ có** khi dòng điền "Loại hợp đồng". `contractType` đúng, `status = ACTIVE`, `effectiveDate` / `expiryDate` đúng, `statusChangedAt` = `effectiveDate` |

### Quản lý trực tiếp là dòng khác trong cùng file

File 2 dòng: dòng 1 `TEST-MGR` (quản lý), dòng 2 `TEST-EMP` với `Quản lý trực tiếp = TEST-MGR`.

**Mong đợi:** cả 2 tạo được, `TEST-EMP.directManagerId` = `userId` của `TEST-MGR`. (Server chạy 2 lượt: tạo hết rồi mới gán quản lý.)

---

## 12. Bảng ghi kết quả

| Nhóm | Case | Kết quả thực tế | Đạt? |
|---|---|---|---|
| A | A1 … A5 | | |
| B | B1 … B35 | | |
| C | C1 … C4 | | |
| D | D1 … D5 | | |
| E | E1 … E7 | | |
| F | F1 … F5 | | |
| G | G1 … G4 | | |
| H | H1 … H6 | | |
| I | I1 … I4 | | |
| K | K1 … K5 | | |

---

## 13. Nếu có case sai

Ghi lại: **case nào**, **giá trị đã điền**, **mã lỗi nhận được** (hoặc "không báo lỗi"), và **mã lỗi mong đợi**. Kèm file `.xlsx` đã dùng nếu được — dễ lần lại nhất.

Lưu ý khi đọc báo cáo: mỗi dòng có thể có **nhiều lỗi cùng lúc** (ví dụ thiếu cả `Họ và tên` lẫn `Email`), nên một case có thêm lỗi khác không nhất thiết là sai — chỉ cần lỗi mong đợi **có mặt** và lỗi bị cấm (`POSITION_NOT_FOUND` ở D2) **không** có mặt.
