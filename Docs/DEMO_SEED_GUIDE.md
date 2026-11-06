# CoreStaff — Hướng dẫn Gieo dữ liệu & Diễn tập Demo

Hướng dẫn sử dụng bộ dữ liệu mẫu (demo tenant **ANPHAT**) phục vụ thuyết trình, kiểm thử nghiệm thu (UAT) và diễn tập toàn bộ luồng kỳ công — lương của CoreStaff.

> **Triết lý của bộ seed này:** dữ liệu KHÔNG được "nhồi số" trực tiếp vào DB. Script chạy lại đúng service của hệ thống (chấm công, đơn từ, OT, chốt công, tính lương) trên một **đồng hồ ảo** tua về đúng mốc thời gian lịch sử. Vì vậy mọi con số (phút trễ/sớm, OT hợp lệ, công quy đổi, BHXH, thuế TNCN, thực lĩnh) đều do chính engine của hệ thống tính ra — giống hệt như dữ liệu phát sinh thật, nhất quán từ chấm công đến phiếu lương.

---

## 1. Thông tin Tổ chức Demo

- **Tên công ty**: Công ty Cổ phần Công nghệ An Phát
- **Mã tổ chức (code)**: `ANPHAT`
- **Mật khẩu dùng chung cho tất cả tài khoản**: `Demo123456!` (hoặc biến môi trường `DEMO_SEED_PASSWORD`)
- **Chính sách mật khẩu**: `mustChangePassword = false` (đăng nhập trực tiếp, không bắt đổi mật khẩu lần đầu)
- **Múi giờ**: toàn bộ mốc thời gian theo giờ Việt Nam (UTC+7), khớp với cấu hình `vietnam-time` của hệ thống.

---

## 2. Danh sách Tài khoản Đăng nhập

| Email | Họ và tên | Mã NV | Vai trò | Phòng ban | Vai trò trong demo |
|---|---|---|---|---|---|
| `hr@anphat.local` | Lê Thị Thu Hà | `HR-001` | `HR` | — | Quản trị HR: chốt bảng công, duyệt snapshot, chạy & phát hành lương, duyệt đơn |
| `quan.ly.kinh-doanh@anphat.local` | Trần Quốc Hưng | `QL-KD-001` | `DEPARTMENT_MANAGER` | Kinh doanh (KD) | Duyệt công phòng KD, duyệt nghỉ phép, duyệt giải trình/OT; có vài ngày đi muộn |
| `quan.ly.ky.thuat@anphat.local` | Nguyễn Thành Long | `QL-KT-001` | `DEPARTMENT_MANAGER` | Kỹ thuật (KT) | Duyệt công phòng KT, duyệt OT/giải trình; có ngày đi muộn, về sớm |
| `nv.kinh-doanh.1@anphat.local` | Phạm Hoàng Nam | `NV-KD-001` | `EMPLOYEE` | Kinh doanh (KD) | NV năng suất cao: OT ngày thường, công tác selfie, nghỉ nửa ngày chiều, có ngày quên chấm ra |
| `nv.kinh-doanh.2@anphat.local` | Vũ Thị Mai | `NV-KD-002` | `EMPLOYEE` | Kinh doanh (KD) | Hay đi muộn/về sớm; nghỉ phép nửa ngày sáng + vào ca chiều muộn (0,5 công); **giữ blocker selfie công tác để demo tay**; **tự bấm xác nhận bảng công khi demo** |
| `nv.kinh-doanh.3@anphat.local` | Đặng Văn Khoa | `NV-KD-003` | `EMPLOYEE` | Kinh doanh (KD) | **Thử việc 85% lương, chưa đóng BH**; nghỉ không lương; blocker giải trình 21/10 do `demo:resolve` duyệt hộ (không cần đăng nhập) |
| `nv.ky.thuat.1@anphat.local` | Lê Quốc Bảo | `NV-KT-001` | `EMPLOYEE` | Kỹ thuật (KT) | OT đủ hệ số (thường 150%, cuối tuần 200%, lễ 300%); nghỉ phép năm; có ngày quên chấm công |
| `nv.ky.thuat.2@anphat.local` | Hoàng Minh Tuấn | `NV-KT-002` | `EMPLOYEE` | Kỹ thuật (KT) | OT ngày thường; nghỉ phép năm nhiều ngày; quên chấm ra; có đơn nghỉ tháng 11 chờ duyệt |
| `nv.ky.thuat.3@anphat.local` | Bùi Phương Thảo | `NV-KT-003` | `EMPLOYEE` | Kỹ thuật (KT) | OT cuối tuần 200%; vắng không phép 28/10 (QL đã xử lý sẵn trong seed) |

---

## 3. Ba Kỳ Công (đã dịch về tháng 9/10/11)

### 3.1. Kỳ Lịch sử — `2026-09` (`CLOSED`, lương `RELEASED`)
Kỳ đã hoàn tất trọn vòng đời để demo tra cứu lịch sử & phiếu lương:
- Bảng tổng hợp công (`TimesheetSummary`): đủ 8 nhân viên.
- Snapshot chốt lương (`PayrollInputSnapshot`): đủ 8 nhân viên.
- Bảng lương (`PayrollRun`): `RELEASED`; 8 phiếu lương (`Payslip`) tính từ engine thật (BHXH 8%, BHYT 1.5%, BHTN 1%, thuế TNCN lũy tiến, phụ cấp, thưởng KPI, thưởng chuyên cần).

### 3.2. Kỳ Demo Live — `2026-10` (`REVIEWING`, seed xong còn đúng **1 blocker**)

**Đây là kỳ dùng để demo luồng chính "từ đầu"** — duyệt 1 vướng → nhân viên xác nhận → QL xác nhận → HR chốt → chạy lương.

Seed xong (`npm run seed:demo:reset`) tenant ở trạng thái **`main`**: kỳ 10 chỉ còn **đúng 1 blocker**, xử lý xong là chốt được kỳ.

| Ngày | Mã NV | Loại | Cách xử lý |
|---|---|---|---|
| 15/10 | `NV-KD-002` | Selfie công tác chưa duyệt | **Làm tay — blocker duy nhất**, QL KD duyệt |

> Kịch bản demo gói gọn trong **3 tài khoản**: `hr@anphat.local` (chốt kỳ + lương), `quan.ly.kinh-doanh@anphat.local` (duyệt blocker + xác nhận phòng KD), `nv.kinh-doanh.2@anphat.local` (tự xác nhận bảng công). `demo:ack` bấm hộ mọi tài khoản chưa xác nhận, chỉ chừa `NV-KD-002`.

`NV-KD-002` cũng là mã duy nhất **không** được `demo:ack` bấm hộ (`DEMO_KEEP = DEMO_SKIP_ACK = NV-KD-002`), nên toàn bộ thao tác tay chỉ diễn ra trong một phòng ban, với một tài khoản quản lý (`quan.ly.kinh-doanh@anphat.local`) và một nhân viên.

#### Nhánh alt flow — nhiều blocker/exception để demo khi hội đồng hỏi

Trạng thái **`alt`** là ngay sau khi replay dữ liệu, trước khi gỡ hộ gì — kỳ 10 còn **4 blocker** đủ loại để kể chuyện nghiệp vụ:

| Ngày | Mã NV | Loại | Nhánh demo |
|---|---|---|---|
| 15/10 | `NV-KD-002` | Selfie công tác chưa duyệt | Duyệt selfie / từ chối vì ảnh–vị trí không khớp |
| 19/10 | `NV-KT-001` | Không có dữ liệu chấm công cả ngày | Giải trình bổ sung công |
| 21/10 | `NV-KD-003` | Quên chấm ra, đã gửi giải trình | QL duyệt giải trình |
| 30/10 | `NV-KD-001` | Quên chấm ra, chưa giải trình | QL tính **vắng không phép** (không giải trình) |

```bash
npm run demo:rollback -- --to=alt   # về 4 blocker
# ... demo nhánh alt ...
npm run demo:rollback               # về main (1 blocker) để demo lại kịch bản chính
```

Ở trạng thái `alt`, thử `demo:ack` sẽ thấy hệ thống chặn đúng ràng buộc: `còn ngày chưa xử lý (blocker)`, và `demo:confirm` trả `DEPARTMENT_NOT_READY` / `MISSING_ATTENDANCE_DAY` — dùng để chứng minh chốt công không thể làm ẩu.

Các vướng ở phòng KT đều được xử lý sẵn bên trong seed (không phải chuyển tài khoản khi demo): giải trình NV-KT-002 (20/10) đã QL duyệt, vắng không phép NV-KT-003 (28/10) đã QL xử lý.

Các vướng ở phòng KT đều được xử lý sẵn bên trong seed (không phải chuyển tài khoản khi demo): giải trình NV-KT-002 (20/10) đã QL duyệt, vắng không phép NV-KT-003 (28/10) đã QL xử lý.

> ⚠️ **Ảnh selfie là metadata, không có file thật.** Seed ghi bản ghi `Evidence` nhưng **không upload ảnh lên S3/R2** — với tenant ANPHAT, storage có 0 object. QL mở selfie `NV-KD-002` (15/10) sẽ thấy ảnh lỗi. Khi demo: duyệt dựa trên thông tin vị trí/giờ trong dialog, **không bấm xem ảnh**; nếu giảng viên hỏi, nói thẳng đây là dữ liệu minh họa và ảnh được bổ sung sau khi chấm công thật.

### 3.3. Kỳ Hiện tại — `2026-11` (`OPEN`, chưa rà soát)
- Chỉ có dữ liệu chấm công tới ngày tham chiếu, **không có dữ liệu tương lai**.
- **Chưa tạo bản ghi rà soát, chưa chốt, chưa có lương** — đúng thực tế: tháng chưa kết thúc, chưa tới kỳ tính lương.
- Có 2 đơn nghỉ phép để demo luồng duyệt đơn: 1 đơn đã duyệt (NV-KD-002, 20/11), 1 đơn chờ QL duyệt (NV-KT-002, 13/11).
- Chủ nhật **01/11** có 4 người đi làm: NV-KT-001 (đã khai + duyệt OT), NV-KD-002 (đã khai + duyệt OT), NV-KT-002 (đã khai, **chờ duyệt**), NV-KD-001 (**đi làm nhưng chưa khai OT** — dùng để demo tạo đơn OT cuối tuần trên app).

### 3.4. Ngày lễ có người đi làm — vừa có đơn OT vừa không
Bộ seed cố ý để **mỗi ngày lễ đều có cả hai trường hợp**, đúng dữ liệu thật:

| Ngày lễ | Có đơn OT (đã duyệt) | Đi làm **không** khai OT |
|---|---|---|
| 02/09 (Quốc khánh) | NV-KT-001, NV-KT-003 (OT lễ 300%, đã FINAL trong kỳ 09) | NV-KT-002 (trực buổi sáng 08:03–12:06) |
| 31/10 (lễ thành lập công ty, rơi thứ Bảy) | NV-KT-003 (OT lễ 300%, PROVISIONAL kỳ 10) | NV-KT-002 (trực 07:56–17:09) |

Ngày 31/10 là **thứ Bảy nhưng khai báo là `PUBLIC_HOLIDAY`** → hệ thống phân loại OT 300% (lễ thắng cuối tuần), không phải 200%. Dùng ngày này để demo: đăng nhập `nv.ky.thuat.2@anphat.local` → tạo đơn OT cho 31/10 → QL Kỹ thuật duyệt → kết quả OT hiện hệ số lễ.

> Hệ quả kỹ thuật: bản ghi `AttendanceDay` ngày lễ/cuối tuần giờ mang `workdayType` tương ứng (`PUBLIC_HOLIDAY` / `WEEKLY_OFF`) thay vì luôn là `WORKING_DAY`, nên bảng công không đếm nhầm ngày lễ thành ngày công chuẩn.

---

## 4. Các biến thể dữ liệu (để trình diễn cơ chế tính lương)

Bộ seed cố tình trải đủ các tình huống ảnh hưởng tới công & lương, phân bổ qua 2 kỳ 9 và 10:

| Tình huống | Minh họa ở |
|---|---|
| OT ngày thường (150%) | NV-KT-002 (10/09, 22/09, 22/10), NV-KT-003 (08/09), NV-KD-001 (24/09, 29/10), NV-KD-002 (30/09, 21/10), NV-KT-001 (14/10) |
| OT cuối tuần — thứ Bảy (200%) | NV-KT-001 & NV-KT-003 (26/09, 24/10) |
| OT Chủ nhật (200%) | NV-KD-001 (20/09), NV-KT-001 & NV-KD-002 (01/11) |
| OT ngày lễ Quốc khánh (300%) | NV-KT-001, NV-KT-003 (02/09) |
| OT ngày lễ **rơi vào thứ Bảy** — vẫn 300%, lễ thắng cuối tuần | NV-KT-003 (31/10) |
| Đi làm ngày lễ **không khai OT** → demo tạo đơn OT trên app | NV-KT-002 (02/09, 31/10) |
| Đi làm Chủ nhật **không khai OT** → demo tạo đơn OT trên app | NV-KD-001 (01/11) |
| OT đã gửi nhưng **chưa duyệt** (không được tính lương) | NV-KD-002 (30/10), NV-KT-002 (01/11) |
| Đi muộn | NV-KD-002, QL-KD-001, QL-KT-001… |
| Về sớm | NV-KD-002 (22/09), QL-KT-001 (26/10), NV-KT-003 (25/09) |
| Nghỉ phép năm có lương (cả ngày) | NV-KT-001 (21/09), NV-KT-002 (18/09, 28–29/09), NV-KT-003 (15/10) |
| Nghỉ phép có lương nửa ngày | NV-KD-002 (11/09 chiều, 12/10 sáng, 23/10 sáng), NV-KD-001 (17/09 chiều, 27/10 chiều), NV-KT-001 (16/10 chiều, 29/10 sáng) |
| Nghỉ **không lương** | NV-KD-003 (17/09, 12–13/10, 15/10 chiều), NV-KT-003 (24/09), NV-KD-001 (20/10) |
| Nửa ngày + đi muộn ca chiều + về sớm → **0,5 công** | NV-KD-002 (23/10) |
| Công tác ngoài (chấm công **selfie** → QL duyệt) | NV-KD-001 (15/09, 08/10), NV-KT-002 (23/09), NV-KD-002 (15/10, chờ duyệt) — *không có file ảnh, xem cảnh báo §3.2* |
| Quên chấm công → **giải trình** được duyệt | NV-KD-001 (04/09), NV-KT-003 (09/09, 06/10), NV-KT-001 (19/10), NV-KT-002 (20/10), NV-KD-003 (21/10, 27/10) |
| **Vắng không phép** (bị khấu trừ công) | NV-KD-003 (18/09), NV-KT-002 (16/09, 13/10), NV-KT-003 (28/10) |
| Nhân viên **thử việc 85% lương, chưa đóng BH** | NV-KD-003 |
| Thưởng KPI theo bậc, thưởng chuyên cần | Tất cả (điểm KPI khai trong `KPI_SCORES`) |

### 4.1. Chính sách công ty (cấu hình, không phải dữ liệu phát sinh)

| Chính sách | Giá trị seed | Ghi chú |
|---|---|---|
| `KpiPolicy` | `Chính sách KPI An Phát 2026`, `GRADE`, `baseAmount = 2.000.000`, 4 bậc (Xuất sắc ≥90 → 100%, Tốt ≥80 → 75%, Đạt ≥70 → 50%, Chưa đạt → 0%), `scope = ALL`, hiệu lực 01/01/2026 | Khai qua `CompensationService.createKpiPolicy` — đúng endpoint màn hình Lương → Chính sách KPI. Mọi `KpiPayrollInput` trỏ `policyId` này. |
| `EnterpriseInsurancePolicy` | `Bảo Việt`, bảo hiểm tai nạn 24/24 + khám sức khỏe cơ bản, `costBearer = EMPLOYER`, `premiumPerEmployee = null`, hiệu lực 01/01/2026 | Khai qua `EnterpriseInsurancePolicyService.create` — cùng service màn hình "Bảo hiểm doanh nghiệp". Nhà cung cấp/phí là minh họa, HR thay bằng hợp đồng thật. |
| `Organization.attendanceOvertimeV2Enabled` | `true` | Một cờ duy nhất bật cả luồng chấm công + OT V2 **và** luồng "xác nhận công" kiểu mới. Schema chưa có cờ riêng cho UI xác nhận công — nếu team muốn tách thì phải thêm field vào `Organization` và đọc nó ở nơi trả config cho FE. |

Các chính sách còn lại (lương tối thiểu/giờ làm thêm/BHXH/thuế/chuyên cần/công quy đổi) đã có từ trước — xem `seedMasterData` trong `scripts/seed-demo-org.ts`.

---

## 5. Các Lệnh Thực thi (CLI Scripts)

Chạy từ thư mục `CoreStaff/Apps/api` (hoặc thêm tiền tố `npm --prefix CoreStaff/Apps/api`). Tất cả đọc chuỗi kết nối từ biến môi trường `MONGODB_URI`.

### 5.1. Gieo & kiểm tra dữ liệu

```bash
# Reset và gieo mới toàn bộ dữ liệu demo ANPHAT (3 kỳ: 09 CLOSED+lương, 10 REVIEWING còn 1 blocker, 11 OPEN)
# Cuối lệnh tự chụp 2 ảnh rollback: "alt" (4 blocker) và "main" (1 blocker)
npm run seed:demo:reset

# Kiểm tra toàn vẹn: tính lại từng ngày bằng calculator, đối chiếu OT/bảng công/phiếu lương
npm run verify:demo

# Dry-run: in kế hoạch & thử tính toán, KHÔNG ghi DB
npm run seed:demo:dry

# Diễn tập: reset + gieo + chạy luôn phần đóng kỳ để tự kiểm tra luồng chốt
npm run seed:demo:rehearsal
```

### 5.2. Script bổ sung cho buổi demo kỳ `2026-10` (`demo-flow`)

Mỗi lệnh gọi đúng service mà Web/Mobile gọi, với tài khoản có thẩm quyền tương ứng (NV tự giải trình/xác nhận, QL duyệt, HR chốt).

```bash
# Xem blocker, đơn chờ duyệt, tiến độ xác nhận, trạng thái 3 kỳ + phiếu lương các kỳ đã chốt
npm run demo:status

# Gỡ blocker của MỌI tài khoản TRỪ tài khoản demo tay (duyệt selfie/giải trình/OT, xử lý vắng)
npm run demo:resolve

# Nhân viên xác nhận bảng công kỳ 2026-10
npm run demo:ack

# Quản lý xác nhận công các phòng chưa xác nhận
npm run demo:confirm

# HR chốt kỳ + tạo/tính/khóa/phát hành lương
npm run demo:close

# Tua tenant về trạng thái "main" (đúng 1 blocker) để demo lại kịch bản chính
npm run demo:rollback

# Tua tenant về trạng thái "alt" (4 blocker) để demo nhánh phụ cho hội đồng
npm run demo:rollback -- --to=alt

# Chạy trọn luồng resolve → ack → confirm → close (diễn tập nhanh; --keep/--skip-ack bị bỏ qua ở chế độ này)
npm run demo:all
```

**Tùy chọn (thêm sau lệnh `ts-node-script`):**
- `--keep=NV-KD-002` — tài khoản giữ blocker để demo tay (mặc định đúng 1 mã KD).
- `--skip-ack=NV-KD-002` — tài khoản sẽ tự bấm "Xác nhận bảng công" trên app khi demo; `demo:ack` bấm hộ mọi người còn lại chưa xác nhận. Truyền danh sách dài hơn nếu muốn để nhiều người tự bấm.
- `--period=2026-10 --org-code=ANPHAT` — đổi kỳ/tenant nếu cần.

**`demo:rollback` hoạt động thế nào:** cuối `seed:demo:reset` script chụp **2 ảnh** vào `Apps/api/.demo-snapshot/` (local, không commit):

- `ANPHAT-alt.json` — ngay sau replay, còn đủ 4 blocker.
- `ANPHAT-main.json` — sau khi gỡ hộ 3 blocker, còn đúng selfie `NV-KD-002` (trạng thái mặc định của tenant sau seed).

`demo:rollback` xoá dữ liệu tenant rồi nạp lại ảnh chụp được chọn (`--to=main` mặc định, `--to=alt`), **giữ nguyên phiên đăng nhập** (`UserSession` không nằm trong ảnh chụp) nên các tab trình duyệt đã đăng nhập vẫn dùng được. Chạy lại `seed:demo:reset` để làm mới cả 2 ảnh.

**Tốc độ (đo thật, tenant ANPHAT ~1.400 bản ghi):** `demo:rollback` ~**10 giây** (trong đó ~2,5s biên dịch TS, ~3s nạp schema, ~3,5s đọc/ghi Mongo) so với **~260 giây** của `seed:demo:reset`. Script riêng `scripts/demo-rollback.ts` dùng mongoose thuần thay vì boot cả Nest (không boot Nest: nhanh hơn ~7 giây).

> **Ba ràng buộc thật của hệ thống, đã kiểm chứng:** (1) blocker phải xong **trước** khi ack, không thì `TIMESHEET_HAS_UNRESOLVED_DAYS`; (2) `confirmDepartment` đòi **toàn bộ nhân viên của phòng** đã ack (`EMPLOYEE_ACKNOWLEDGEMENT_PENDING`) và phòng không còn blocker (`DEPARTMENT_NOT_READY`); (3) kỳ chỉ sang `READY_TO_CLOSE` khi **cả 2 phòng** đã xác nhận.
> Mọi thao tác sửa dữ liệu công (duyệt giải trình/OT, xử lý vắng) đều tăng **phiên bản kỳ** và vô hiệu hóa các xác nhận bảng công trước đó — đúng cơ chế của hệ thống. Vì vậy nếu gỡ blocker *sau khi* nhân viên đã xác nhận thì phải xác nhận lại.

### 5.3. Kịch bản trình bày "từ đầu" (runbook)

**Chuẩn bị trước khi vào phòng (~5 phút, làm ở nhà):**

```bash
cd CoreStaff/Apps/api
npm run seed:demo:reset     # về đúng trạng thái xuất phát
npm run demo:status          # chụp lại output này để đối chiếu nếu có sự cố
```

Mở sẵn **3 tab trình duyệt**, đăng nhập trước, đừng đăng nhập trước mặt giảng viên:

| Tab | Tài khoản | Phòng ban | Dùng cho |
|---|---|---|---|
| 1 | `quan.ly.kinh-doanh@anphat.local` | `QL-KD-001` — KD | Duyệt selfie, duyệt giải trình, xác nhận công phòng |
| 2 | `hr@anphat.local` | `HR-001` | Chốt kỳ, chạy lương |
| 3 | `nv.kinh-doanh.2@anphat.local` | `NV-KD-002` — KD | Nhân viên tự xác nhận bảng công |

Mật khẩu chung: `Demo123456!`

**Diễn biến trên bục:**

| # | Việc làm | Nói gì / chứng minh gì |
|---|---|---|
| 1 | Tab 1 → màn hình kỳ công `2026-10` | "Kỳ 9 đã chốt và phát hành lương. Kỳ 10 còn **1 vướng** — selfie công tác của Vũ Thị Mai (`NV-KD-002`) ngày 15/10 chưa được duyệt." |
| 2 | Tab 2 (HR) → **thử bấm chốt kỳ** | Hệ thống từ chối. "Ngay cả HR cũng không đóng được — blocker chặn ở tầng service, không phải nút bị ẩn." |
| 3 | (Tuỳ chọn, nếu hội đồng muốn xem nhiều ca) | `npm run demo:rollback -- --to=alt` để có 4 blocker rồi quay lại `npm run demo:rollback` — xem §3.2. |
| 4 | Tab 1 → danh sách chờ duyệt | Còn đúng **1 vướng** — selfie `NV-KD-002` 15/10. "Việc còn lại em làm tay để anh/chị xem luồng thật." |
| 5 | Duyệt **selfie `NV-KD-002` 15/10** | Duyệt theo giờ/vị trí trong dialog. ⚠️ **Không bấm xem ảnh** — seed chỉ ghi metadata, ảnh sẽ lỗi (§3.2). Nếu bị hỏi, nói đây là dữ liệu minh họa. |
| 6 | Tab 1 → xác nhận công khi còn người chưa ack (tuỳ chọn) | "Phòng chỉ xác nhận được khi **từng nhân viên** đã xác nhận." Bấm sớm sẽ bị chặn: `EMPLOYEE_ACKNOWLEDGEMENT_PENDING`. |
| 7 | Chạy `npm run demo:ack` | Ack hộ mọi tài khoản chưa xác nhận, **chỉ chừa `NV-KD-002`** (mặc định `--skip-ack=NV-KD-002`). Kết quả: 7 dòng `✓`, 1 dòng `· NV-KD-002: để tự xác nhận khi demo`. |
| 8 | Tab 3 (NV-KD-002) → "Công của tôi" → Xác nhận | "Nhân viên thấy **21.5/22 công**, xác nhận là đã đồng ý." |
| 9 | Tab 1 (QL KD) → xác nhận công phòng KD | Cả 2 phòng giờ đã đủ người ack → hệ thống cho xác nhận. |
| 10 | Chạy `npm run demo:confirm` | Bấm hộ phòng KT; phòng KD vừa xác nhận tay xong nên sẽ in `đã xác nhận trước đó`. Cả 2 phòng xong → kỳ chuyển `READY_TO_CLOSE`. |
| 11 | Tab 2 (HR) → chốt kỳ + chạy lương | Hoặc `npm run demo:close`. Bốn bước: tạo bảng lương → tính → khóa → phát hành. |
| 12 | Mở 1 phiếu lương bất kỳ | So sánh với kỳ 9: `NV-KD-002` 21.5/22 nên gross thấp hơn `NV-KD-001` (22/22) dù có OT. Đây là phần "ăn điểm" — số liệu khớp nhau qua 4 tầng: chấm công → bảng công → snapshot → phiếu lương. |

> **Hội đồng hỏi tình huống khác (VD: "nếu nhân viên không giải trình thì sao?"):** chạy `npm run demo:rollback -- --to=alt` — tenant về trạng thái 4 blocker trong vài giây, các tab vẫn đăng nhập. Demo nhánh phụ xong thì `npm run demo:rollback` để về `main`.

> Ở trạng thái `alt` (chưa gỡ blocker), `demo:ack` sẽ in `✗ ...: còn ngày chưa xử lý (blocker)` và `demo:confirm` trả `DEPARTMENT_NOT_READY` / `MISSING_ATTENDANCE_DAY` — đúng ràng buộc (1) ở §5.2, dùng để chứng minh hệ thống không cho chốt ẩu.

**Hai mã lỗi khác nhau, đừng nhầm:**

| Mã lỗi | Nghĩa | Cách gỡ |
|---|---|---|
| `DEPARTMENT_NOT_READY` | Phòng **còn blocker** (VD selfie NV-KD-002 15/10 chưa duyệt) | Duyệt hết blocker của phòng trước |
| `EMPLOYEE_ACKNOWLEDGEMENT_PENDING` | Phòng **còn người chưa xác nhận bảng công** | Cho người đó ack (`demo:ack` không skip họ) |

**Vì sao vẫn cần nhân viên tự bấm:** xác nhận phòng ban đòi **100% nhân viên** của phòng đã ack — đó chính là cơ chế sinh ra `EMPLOYEE_ACKNOWLEDGEMENT_PENDING` ở trên. Nên `NV-KD-002` phải tự ack (bước 8) thì bước 9 mới bấm được.

**Câu chốt:** `npm run verify:demo` → in ra "Đã tính lại 334 ngày công bằng calculator, 45 yêu cầu, 28 kết quả OT" và `✓ Dữ liệu nhất quán`. Chứng minh không có số nào ghi tay.

### 5.4. Nếu muốn sinh viên tự bấm xác nhận rồi script chạy nốt

`demo:ack` đọc trạng thái hiện tại: ai đã `ACKNOWLEDGED` thì bỏ qua (in `đã xác nhận trước đó`), còn lại ack tiếp. Nên ack tay 1 người rồi chạy script **không lỗi**.

Chỉ ack hộ đúng **một** tài khoản (`NV-KD-001`) và để 7 người còn lại tự làm:

```bash
npm run demo:ack -- --skip-ack=NV-KD-002,NV-KD-003,NV-KT-001,NV-KT-002,NV-KT-003,QL-KD-001,QL-KT-001
```

Nhưng **không nhảy được sang `demo:confirm`** khi mới 1/8 người ack — đã thử, kết quả:

```
✗ Phòng Kinh doanh: DEPARTMENT_NOT_READY
✗ Phòng Kỹ thuật: EMPLOYEE_ACKNOWLEDGEMENT_PENDING
```

Muốn cả phòng xác nhận được thì phải ack đủ người của phòng đó trước.

### 5.7. Demo lại / chuyển nhánh giữa buổi

```bash
npm run demo:rollback               # về "main": đúng 1 blocker (selfie NV-KD-002)
npm run demo:rollback -- --to=alt   # về "alt": 4 blocker cho nhánh phụ
```

Mỗi lần mất vài giây thay vì ~3 phút seed, và **không có đơn xác nhận/chốt/lương nào phát sinh** sau điểm chụp. Dùng `--to=alt` khi hội đồng hỏi "nếu nhân viên không giải trình thì sao" (blocker `NV-KD-001` 30/10 → QL tính vắng không phép), rồi quay lại `main` để tiếp tục kịch bản chính.

Ảnh chụp được tạo tự động ở cuối mỗi lần `seed:demo:reset` (kể cả `seed:demo:rehearsal`, chụp `alt` trước khi gỡ hộ), lưu tại `Apps/api/.demo-snapshot/ANPHAT-{main,alt}.json` và **không commit** (xem `CoreStaff/.gitignore`). Phiên đăng nhập (`UserSession`) không nằm trong ảnh chụp nên các tab trình duyệt vẫn dùng được sau rollback.

### 5.5. Demo tạo đơn OT ngày lễ / cuối tuần (làm tay trên app)

Bộ seed để sẵn **người đã chấm công ngày lễ/cuối tuần nhưng chưa khai OT**, để thao tác tạo đơn diễn ra ngay trên app:

| Tài khoản | Ngày | Bản chất ngày | Đăng nhập | Kết quả sau khi QL duyệt |
|---|---|---|---|---|
| `nv.ky.thuat.2@anphat.local` (NV-KT-002) | **31/10** | `PUBLIC_HOLIDAY` rơi thứ Bảy | QL Kỹ thuật duyệt | OT lễ **300%**, 540 phút |
| `nv.kinh-doanh.1@anphat.local` (NV-KD-001) | **01/11** | `WEEKLY_OFF` (Chủ nhật) | QL Kinh doanh duyệt | OT cuối tuần **200%**, 240 phút |

Cả hai đều đang ở kỳ `2026-11` (`OPEN`) nên tạo đơn không bị chặn bởi chốt kỳ. Lưu ý khi thao tác:

- Ngày **31/10** đã quá hạn khai thường (`RETROACTIVE_GRACE_DAYS = 1`), nên form OT sẽ **bắt buộc nhập lý do bổ sung** (`OVERTIME_RETROACTIVE_REASON_REQUIRED`) — đúng nghiệp vụ, nói rõ cho người xem đây là khai bổ sung sau ca.
- Ngày **01/11** vẫn trong hạn khai thường → nộp thẳng, không cần lý do bổ sung.
- OT không được chồng lên ca hành chính: ngày lễ/cuối tuần `scheduledIntervals` rỗng nên toàn bộ thời gian làm việc đều tính OT (`OVERTIME_OVERLAPS_SCHEDULE` không kích hoạt).
- Nếu muốn demo lại từ đầu: `npm run seed:demo:reset` xoá các đơn OT tạo tay.

### 5.6. Phương án dự phòng khi có sự cố

| Sự cố | Xử lý |
|---|---|
| Bấm nhầm nút, dữ liệu hỏng | `npm run demo:rollback` (vài giây) — về đúng trạng thái sau seed (còn blocker) rồi làm lại từ đầu. |
| Hội đồng hỏi tình huống khác, cần demo lại | `npm run demo:rollback` — xem §5.7. |
| Đã lỡ chốt kỳ 10 mà muốn demo lại | `npm run demo:rollback`; dùng `seed:demo:reset` khi cần gieo lại từ dữ liệu gốc hoặc ảnh chụp bị mất. |
| Cần diễn tập toàn bộ luồng trước hôm bảo vệ | `npm run seed:demo:rehearsal` — seed lại rồi tự chạy hết resolve → ack → confirm → close. |
| Không kịp làm tay | `npm run demo:all` — chạy trọn chuỗi, dùng khi hết giờ. |
| Ảnh selfie lỗi | Đã biết trước; bỏ qua, xem cảnh báo §3.2. |

*Lưu ý an toàn: lệnh reset chỉ xóa dữ liệu có `organizationId` của `ANPHAT`, không đụng tới collection chung hay tenant khác trên MongoDB.*

---

## 6. File Mẫu Import Nhân viên Excel

Các file test cho tính năng Import Nhân viên từ Excel được sinh tại `CoreStaff/Apps/api/demo-import/` (ngày trong file dùng mốc 01/12/2026):

1. `01_nhan_vien_hop_le.xlsx` — dữ liệu hợp lệ, đủ cột bắt buộc.
2. `02_loi_thieu_cot_bat_buoc.xlsx` — thiếu cột Họ tên / Email để kiểm tra validate.
3. `03_loi_trung_ma_nhan_vien.xlsx` — trùng mã nhân viên đã tồn tại.
4. `04_loi_email_khong_hop_le.xlsx` — định dạng email sai chuẩn.
