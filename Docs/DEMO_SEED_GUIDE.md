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
| `nv.kinh-doanh.2@anphat.local` | Vũ Thị Mai | `NV-KD-002` | `EMPLOYEE` | Kinh doanh (KD) | Hay đi muộn/về sớm; nghỉ phép nửa ngày sáng + vào ca chiều muộn (0,5 công); selfie công tác chờ duyệt |
| `nv.kinh-doanh.3@anphat.local` | Đặng Văn Khoa | `NV-KD-003` | `EMPLOYEE` | Kinh doanh (KD) | **Thử việc 85% lương, chưa đóng BH**; nghỉ không lương; **giữ blocker để demo tay** |
| `nv.ky.thuat.1@anphat.local` | Lê Quốc Bảo | `NV-KT-001` | `EMPLOYEE` | Kỹ thuật (KT) | OT đủ hệ số (thường 150%, cuối tuần 200%, lễ 300%); nghỉ phép năm; có ngày quên chấm công |
| `nv.ky.thuat.2@anphat.local` | Hoàng Minh Tuấn | `NV-KT-002` | `EMPLOYEE` | Kỹ thuật (KT) | OT ngày thường; nghỉ phép năm nhiều ngày; quên chấm ra; có đơn nghỉ tháng 11 chờ duyệt |
| `nv.ky.thuat.3@anphat.local` | Bùi Phương Thảo | `NV-KT-003` | `EMPLOYEE` | Kỹ thuật (KT) | OT cuối tuần 200%; **vắng không phép (bị khấu trừ công)**; **giữ blocker để demo tay** |

---

## 3. Ba Kỳ Công (đã dịch về tháng 9/10/11)

### 3.1. Kỳ Lịch sử — `2026-09` (`CLOSED`, lương `RELEASED`)
Kỳ đã hoàn tất trọn vòng đời để demo tra cứu lịch sử & phiếu lương:
- Bảng tổng hợp công (`TimesheetSummary`): đủ 8 nhân viên.
- Snapshot chốt lương (`PayrollInputSnapshot`): đủ 8 nhân viên.
- Bảng lương (`PayrollRun`): `RELEASED`; 8 phiếu lương (`Payslip`) tính từ engine thật (BHXH 8%, BHYT 1.5%, BHTN 1%, thuế TNCN lũy tiến, phụ cấp, thưởng KPI, thưởng chuyên cần).

### 3.2. Kỳ Demo Live — `2026-10` (gieo ở trạng thái `OPEN`, còn blocker)
**Đây là kỳ dùng để demo luồng đầy đủ "từ đầu"** — gỡ vướng → nhân viên xác nhận → QL xác nhận → HR chốt → chạy lương. Sau khi seed, kỳ này còn:
- **2 blocker giữ lại cho người demo tự xử lý trên Web/Mobile** (`DEMO_KEEP = NV-KD-003, NV-KT-003`):
  - `NV-KD-003` (21/10): quên chấm ra, đã gửi giải trình → QL Kinh doanh duyệt tay khi demo.
  - `NV-KT-003` (28/10): vào làm rồi tự ý về giữa giờ, không đơn → HR/QL xử lý vắng không phép tay khi demo.
- **Các blocker & đơn chờ còn lại** (do script bổ sung `demo:resolve` gỡ hộ, vì thao tác tay quá mất thời gian): selfie công tác NV-KD-002 (15/10) chờ duyệt; giải trình NV-KT-001 (19/10) & NV-KT-002 (20/10) chờ duyệt; NV-KD-001 (30/10) quên chấm ra chưa giải trình; OT NV-KD-002 (30/10) chờ duyệt.

### 3.3. Kỳ Hiện tại — `2026-11` (`OPEN`, chưa rà soát)
- Chỉ có dữ liệu chấm công tới ngày tham chiếu, **không có dữ liệu tương lai**.
- **Chưa tạo bản ghi rà soát, chưa chốt, chưa có lương** — đúng thực tế: tháng chưa kết thúc, chưa tới kỳ tính lương.
- Có 2 đơn nghỉ phép để demo luồng duyệt đơn: 1 đơn đã duyệt (NV-KD-002, 20/11), 1 đơn chờ QL duyệt (NV-KT-002, 13/11).

---

## 4. Các biến thể dữ liệu (để trình diễn cơ chế tính lương)

Bộ seed cố tình trải đủ các tình huống ảnh hưởng tới công & lương, phân bổ qua 2 kỳ 9 và 10:

| Tình huống | Minh họa ở |
|---|---|
| OT ngày thường (150%) | NV-KT-002 (10/09, 22/10), NV-KD-001 (24/09, 29/10), NV-KT-001 (14/10) |
| OT cuối tuần — thứ Bảy (200%) | NV-KT-001 & NV-KT-003 (26/09, 24/10) |
| OT ngày lễ Quốc khánh (300%) | NV-KT-001 (02/09) |
| OT đã gửi nhưng **chưa duyệt** (không được tính lương) | NV-KD-002 (30/10) |
| Đi muộn | NV-KD-002, QL-KD-001, QL-KT-001… |
| Về sớm | NV-KD-002 (22/09), QL-KT-001 (26/10), NV-KT-003 (25/09) |
| Nghỉ phép năm có lương (cả ngày) | NV-KT-001 (21/09), NV-KT-002 (28–29/09, nghỉ 2 ngày), NV-KT-001 (09/10) |
| Nghỉ phép có lương nửa ngày | NV-KD-002 (11/09 chiều, 23/10 sáng), NV-KD-001 (27/10 chiều) |
| Nghỉ **không lương** (NV thử việc) | NV-KD-003 (17/09, 12–13/10) |
| Nửa ngày + đi muộn ca chiều + về sớm → **0,5 công** | NV-KD-002 (23/10) |
| Công tác ngoài (chấm công **selfie** → QL duyệt) | NV-KD-001 (15/09, 08/10), NV-KT-002 (23/09), NV-KD-002 (15/10, chờ duyệt) |
| Quên chấm công → **giải trình** được duyệt | NV-KD-001 (04/09), NV-KT-003 (09/09, 06/10), NV-KT-001 (19/10), NV-KT-002 (20/10), NV-KD-003 (21/10) |
| **Vắng không phép** (bị khấu trừ công) | NV-KD-003 (18/09), NV-KT-003 (28/10) |
| Nhân viên **thử việc 85% lương, chưa đóng BH** | NV-KD-003 |
| Thưởng KPI theo bậc, thưởng chuyên cần | Tất cả (điểm KPI khai trong `KPI_SCORES`) |

---

## 5. Các Lệnh Thực thi (CLI Scripts)

Chạy từ thư mục `CoreStaff/Apps/api` (hoặc thêm tiền tố `npm --prefix CoreStaff/Apps/api`). Tất cả đọc chuỗi kết nối từ biến môi trường `MONGODB_URI`.

### 5.1. Gieo & kiểm tra dữ liệu

```bash
# Reset và gieo mới toàn bộ dữ liệu demo ANPHAT (3 kỳ: 09 CLOSED+lương, 10 OPEN còn blocker, 11 OPEN)
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

# Quản lý xác nhận công phòng ban
npm run demo:confirm

# HR chốt kỳ + tạo/tính/khóa/phát hành lương
npm run demo:close

# Chạy trọn luồng resolve → ack → confirm → close (diễn tập nhanh)
npm run demo:all
```

**Tùy chọn (thêm sau lệnh `ts-node-script`):**
- `--keep=NV-KD-003,NV-KT-003` — danh sách tài khoản giữ blocker để demo tay (mặc định đã là 2 tài khoản này).
- `--skip-ack=NV-KD-001` — tài khoản sẽ tự bấm "Xác nhận bảng công" trên app khi demo (script không bấm hộ).
- `--period=2026-10 --org-code=ANPHAT` — đổi kỳ/tenant nếu cần.

> **Thứ tự khi demo tay:** gỡ blocker (phần demo tay + `demo:resolve`) → `demo:ack` → `demo:confirm` → `demo:close`.
> Mọi thao tác sửa dữ liệu công (duyệt giải trình/OT, xử lý vắng) đều tăng **phiên bản kỳ** và vô hiệu hóa các xác nhận bảng công trước đó — đúng cơ chế của hệ thống. Vì vậy nếu gỡ blocker *sau khi* nhân viên đã xác nhận thì phải xác nhận lại.

### 5.3. Kịch bản demo "từ đầu" được khuyến nghị
1. `npm run seed:demo:reset` → có sẵn kỳ 09 đã phát lương, kỳ 10 còn vướng, kỳ 11 đang mở.
2. Mở Web/Mobile, **xử lý tay** blocker của NV-KD-003 (duyệt giải trình) và NV-KT-003 (xử lý vắng không phép) để diễn tập thao tác thật.
3. `npm run demo:resolve` để gỡ nhanh các vướng còn lại.
4. Diễn tập nhân viên xác nhận (hoặc `demo:ack`), QL xác nhận phòng ban (hoặc `demo:confirm`).
5. HR chốt kỳ và chạy lương (hoặc `demo:close`), rồi xem phiếu lương kỳ 10.

*Lưu ý an toàn: lệnh reset chỉ xóa dữ liệu có `organizationId` của `ANPHAT`, không đụng tới collection chung hay tenant khác trên MongoDB.*

---

## 6. File Mẫu Import Nhân viên Excel

Các file test cho tính năng Import Nhân viên từ Excel được sinh tại `CoreStaff/Apps/api/demo-import/` (ngày trong file dùng mốc 01/12/2026):

1. `01_nhan_vien_hop_le.xlsx` — dữ liệu hợp lệ, đủ cột bắt buộc.
2. `02_loi_thieu_cot_bat_buoc.xlsx` — thiếu cột Họ tên / Email để kiểm tra validate.
3. `03_loi_trung_ma_nhan_vien.xlsx` — trùng mã nhân viên đã tồn tại.
4. `04_loi_email_khong_hop_le.xlsx` — định dạng email sai chuẩn.
