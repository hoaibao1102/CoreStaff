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
| `nv.kinh-doanh.3@anphat.local` | Đặng Văn Khoa | `NV-KD-003` | `EMPLOYEE` | Kinh doanh (KD) | **Thử việc 85% lương, chưa đóng BH**; nghỉ không lương; **giữ blocker giải trình để demo tay**; **tự bấm xác nhận bảng công khi demo** |
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

### 3.2. Kỳ Demo Live — `2026-10` (gieo ở trạng thái `REVIEWING`, còn 4 blocker)

**Đây là kỳ dùng để demo luồng đầy đủ "từ đầu"** — gỡ vướng → nhân viên xác nhận → QL xác nhận → HR chốt → chạy lương.

Ngay sau `npm run seed:demo:reset`, kỳ này còn **4 blocker** (trạng thái thô, để trình bày được vấn đề):

| Ngày | Mã NV | Loại | Cách xử lý |
|---|---|---|---|
| 15/10 | `NV-KD-002` | Selfie công tác chưa duyệt | **Giữ lại** — QL KD duyệt tay |
| 21/10 | `NV-KD-003` | Quên chấm ra, đã gửi giải trình | **Giữ lại** — QL KD duyệt tay |
| 19/10 | `NV-KT-001` | Không có dữ liệu chấm công cả ngày | `demo:resolve` duyệt hộ |
| 30/10 | `NV-KD-001` | Quên chấm ra, chưa giải trình | `demo:resolve` giải trình + duyệt hộ |

Sau `npm run demo:resolve` (chạy riêng, **không** tự chạy trong seed) kỳ 10 chỉ còn đúng **2 vướng**, cùng phòng KD:

- `NV-KD-002` (15/10): selfie công tác chờ QL KD duyệt.
- `NV-KD-003` (21/10): quên chấm ra, đã gửi giải trình chờ QL KD duyệt.

Cả 2 tài khoản này cũng là 2 mã **không** được `demo:ack` bấm hộ (`DEMO_KEEP = DEMO_SKIP_ACK = NV-KD-002, NV-KD-003`), nên toàn bộ thao tác tay chỉ diễn ra trong một phòng ban và với một tài khoản quản lý (`quan.ly.kinh-doanh@anphat.local`).

Các vướng ở phòng KT đều được xử lý sẵn bên trong seed (không phải chuyển tài khoản khi demo): giải trình NV-KT-002 (20/10) đã QL duyệt, vắng không phép NV-KT-003 (28/10) đã QL xử lý.

> ⚠️ **Ảnh selfie là metadata, không có file thật.** Seed ghi bản ghi `Evidence` nhưng **không upload ảnh lên S3/R2** — với tenant ANPHAT, storage có 0 object. QL mở selfie `NV-KD-002` (15/10) sẽ thấy ảnh lỗi. Khi demo: duyệt dựa trên thông tin vị trí/giờ trong dialog, **không bấm xem ảnh**; nếu giảng viên hỏi, nói thẳng đây là dữ liệu minh họa và ảnh được bổ sung sau khi chấm công thật.

### 3.3. Kỳ Hiện tại — `2026-11` (`OPEN`, chưa rà soát)
- Chỉ có dữ liệu chấm công tới ngày tham chiếu, **không có dữ liệu tương lai**.
- **Chưa tạo bản ghi rà soát, chưa chốt, chưa có lương** — đúng thực tế: tháng chưa kết thúc, chưa tới kỳ tính lương.
- Có 2 đơn nghỉ phép để demo luồng duyệt đơn: 1 đơn đã duyệt (NV-KD-002, 20/11), 1 đơn chờ QL duyệt (NV-KT-002, 13/11).
- Có OT cuối tuần 01/11 của NV-KT-001 (Chủ nhật trực bảo trì, đã QL duyệt) để màn hình OT tháng hiện tại không trống.

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
| Công tác ngoài (chấm công **selfie** → QL duyệt) | NV-KD-001 (15/09, 08/10), NV-KT-002 (23/09), NV-KD-002 (15/10, chờ duyệt) — *không có file ảnh, xem cảnh báo §3.2* |
| Quên chấm công → **giải trình** được duyệt | NV-KD-001 (04/09), NV-KT-003 (09/09, 06/10), NV-KT-001 (19/10), NV-KT-002 (20/10), NV-KD-003 (21/10) |
| **Vắng không phép** (bị khấu trừ công) | NV-KD-003 (18/09), NV-KT-003 (28/10) |
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
# Reset và gieo mới toàn bộ dữ liệu demo ANPHAT (3 kỳ: 09 CLOSED+lương, 10 REVIEWING còn 4 blocker, 11 OPEN)
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

# Chạy trọn luồng resolve → ack → confirm → close (diễn tập nhanh; --keep/--skip-ack bị bỏ qua ở chế độ này)
npm run demo:all
```

**Tùy chọn (thêm sau lệnh `ts-node-script`):**
- `--keep=NV-KD-002,NV-KD-003` — tài khoản giữ blocker để demo tay (mặc định đã là 2 mã này, **cùng phòng KD**).
- `--skip-ack=NV-KD-002,NV-KD-003` — tài khoản sẽ tự bấm "Xác nhận bảng công" trên app khi demo; script không bấm hộ. Mặc định để lại 2 mã KD. Truyền danh sách dài hơn để chỉ ack hộ đúng một người (xem §5.4).
- `--period=2026-10 --org-code=ANPHAT` — đổi kỳ/tenant nếu cần.

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
| 1 | Tab 1 → màn hình kỳ công `2026-10` | "Kỳ 9 đã chốt và phát hành lương. Nhưng kỳ 10 đang mắc **4 vướng** — đây là lý do HR không thể chốt." Đọc to 4 dòng: selfie chưa duyệt (15/10), thiếu chấm công cả ngày (19/10), quên chấm ra (21/10, 30/10). |
| 2 | Tab 2 (HR) → **thử bấm chốt kỳ** | Hệ thống từ chối. "Ngay cả HR cũng không đóng được — blocker chặn ở tầng service, không phải nút bị ẩn." |
| 3 | Nhờ giảng viên cho chạy script | `npm run demo:resolve` — "Phần này là thao tác lặp lại nhàm chán, em chạy script để dành thời gian cho phần cần giải thích." |
| 4 | Tab 1 → danh sách chờ duyệt | Còn đúng **2 vướng**, cả 2 phòng KD. "Hai việc còn lại em làm tay để anh/chị xem luồng thật." |
| 5 | Duyệt **selfie `NV-KD-002` 15/10** | Duyệt theo giờ/vị trí trong dialog. ⚠️ **Không bấm xem ảnh** — seed chỉ ghi metadata, ảnh sẽ lỗi (§3.2). Nếu bị hỏi, nói đây là dữ liệu minh họa. |
| 6 | Duyệt **giải trình `NV-KD-003` 21/10** | "Nhân viên tự nộp giải trình, QL duyệt. Hệ thống tự tính lại công ngày đó." |
| 7 | Tab 3 (NV-KD-002) → "Công của tôi" → Xác nhận | "Nhân viên thấy **21.5/22 công**, xác nhận là đã đồng ý." |
| 8 | Chạy `npm run demo:ack -- --skip-ack=NV-KD-003` | ⚠️ **Bắt buộc có `--skip-ack`** — xem lưu ý bên dưới. Kết quả: ack hộ 6 người, để `NV-KD-003` chờ (và in `NV-KD-002 đã xác nhận trước đó` nếu đã bấm tay ở bước 7). |
| 9 | Tab 3 (nếu là `NV-KD-003`) hoặc chạy `npm run demo:ack -- --skip-ack=` | Cho **chính** `NV-KD-003` tự xác nhận. Kết quả: `✓ NV-KD-003 Đặng Văn Khoa: 20/22 công`. |
| 10 | Tab 1 (QL KD) → xác nhận công phòng KD | "Phòng chỉ xác nhận được khi **từng nhân viên** đã xác nhận. Chạy sớm sẽ bị chặn: `EMPLOYEE_ACKNOWLEDGEMENT_PENDING`." |
| 11 | Chạy `npm run demo:confirm` | Bấm hộ phòng KT; phòng KD vừa xác nhận tay xong nên sẽ in `đã xác nhận`. Cả 2 phòng xong → kỳ chuyển `READY_TO_CLOSE`. |
| 12 | Tab 2 (HR) → chốt kỳ + chạy lương | Hoặc `npm run demo:close`. Bốn bước: tạo bảng lương → tính → khóa → phát hành. |
| 13 | Mở 1 phiếu lương bất kỳ | So sánh với kỳ 9: `NV-KD-003` 20/22 công (nghỉ không lương 2 ngày + vắng không phép), `NV-KD-002` 21.5/22 nên gross thấp hơn `NV-KD-001` dù có OT. Đây là phần "ăn điểm" — số liệu khớp nhau qua 4 tầng: chấm công → bảng công → snapshot → phiếu lương. |

**⚠️ Vì sao bước 8 phải có `--skip-ack`:** mặc định `demo:ack` bỏ qua **cả 2** mã `NV-KD-002, NV-KD-003`. Chạy trơn thì cả 2 chưa được ack, và **bước 10–11 sẽ hỏng** — đã thử thật (blocker đã duyệt hết trước đó):

```
▶ Nhân viên xác nhận bảng công kỳ 2026-10 (tự xác nhận khi demo: NV-KD-002, NV-KD-003)
  ✓ NV-KD-001 ... ✓ QL-KT-001        ← 6 người được ack
  · NV-KD-002 Vũ Thị Mai: để tự xác nhận khi demo
  · NV-KD-003 Đặng Văn Khoa: để tự xác nhận khi demo

▶ Quản lý xác nhận công phòng ban kỳ 2026-10
  ✗ Phòng Kinh doanh: EMPLOYEE_ACKNOWLEDGEMENT_PENDING
  ✓ Phòng Kỹ thuật đã xác nhận
```

Lúc đó HR vẫn không chốt được kỳ. Chỉ định rõ `--skip-ack=NV-KD-003` ở bước 8 (và ack nốt `NV-KD-003` ở bước 9).

**Hai mã lỗi khác nhau, đừng nhầm:**

| Mã lỗi | Nghĩa | Cách gỡ |
|---|---|---|
| `DEPARTMENT_NOT_READY` | Phòng **còn blocker** (VD selfie NV-KD-002 15/10 chưa duyệt) | Duyệt hết blocker của phòng trước |
| `EMPLOYEE_ACKNOWLEDGEMENT_PENDING` | Phòng **còn người chưa xác nhận bảng công** | Cho người đó ack (`demo:ack` không skip họ) |

**Vì sao cần bước 9 riêng:** xác nhận phòng ban đòi **100% nhân viên** của phòng đã ack — đó chính là cơ chế sinh ra `EMPLOYEE_ACKNOWLEDGEMENT_PENDING` ở trên. Nên `NV-KD-003` phải ack xong thì bước 10 mới bấm được.

**Câu chốt:** `npm run verify:demo` → in ra "Đã tính lại 326 ngày công bằng calculator, 32 yêu cầu, 15 kết quả OT" và `✓ Dữ liệu nhất quán`. Chứng minh không có số nào ghi tay.

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

### 5.5. Phương án dự phòng khi có sự cố

| Sự cố | Xử lý |
|---|---|
| Bấm nhầm nút, dữ liệu hỏng | `npm run seed:demo:reset` (khoảng 3 phút) rồi làm lại từ bước 1. |
| Đã lỡ chốt kỳ 10 mà muốn demo lại | `npm run seed:demo:reset` — lệnh reset xoá sạch dữ liệu tenant ANPHAT rồi gieo lại. |
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
