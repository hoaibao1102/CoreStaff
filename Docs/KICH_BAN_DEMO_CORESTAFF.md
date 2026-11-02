# KỊCH BẢN DEMO TỔNG THỂ CORESTAFF (END-TO-END)
**Trọng tâm:** Chấm công đa phương thức trên Android (Mobile) & Quy trình rà soát, chốt công, tính lương trên Web Dashboard.

---

## 1. THIẾT LẬP MÔI TRƯỜNG & CHUẨN BỊ TRƯỚC DEMO

### 1.1. Thiết bị & Màn hình hiển thị
- **Màn hình 1 (Máy chiếu/Chia sẻ màn hình chính)**: Trình duyệt Web (Chrome) mở Web Dashboard CoreStaff (`http://localhost:5173`).
- **Màn hình 2 (Gương màn hình hoặc thiết bị thật)**: Thiết bị Android thật (hoặc Android Emulator) chạy Expo/CoreStaff Mobile App kết nối chung mạng LAN với API.
- **Tổ chức Demo**: `ANPHAT` (Công ty Cổ phần Công nghệ An Phát).
- **Mật khẩu dùng chung**: `Demo123456!`.

### 1.2. Khởi tạo dữ liệu sạch (Run trước giờ G 2 phút)
Chạy lệnh reset để đưa toàn bộ dữ liệu 3 kỳ về trạng thái chuẩn bị biểu diễn:
```bash
npm --prefix CoreStaff/Apps/api run seed:demo:reset
```
Sau reset: kỳ **2026-09** đã chốt & phát lương (để tra cứu lịch sử), kỳ **2026-10** đang ở `REVIEWING` với **4 điểm nghẽn thô**, kỳ **2026-11** mới mở (chưa tới hạn chốt).

4 điểm nghẽn của kỳ 10 ngay sau seed:

| Ngày | Mã NV | Loại | Xử lý trong kịch bản |
|---|---|---|---|
| 15/10 | `NV-KD-002` | Selfie công tác chưa duyệt | **Làm tay** — QL KD duyệt |
| 21/10 | `NV-KD-003` | Quên chấm ra, đã gửi giải trình | **Làm tay** — QL KD duyệt |
| 19/10 | `NV-KT-001` | Không có dữ liệu chấm công cả ngày | `demo:resolve` gỡ hộ |
| 30/10 | `NV-KD-001` | Quên chấm ra, chưa giải trình | `demo:resolve` gỡ hộ |

> **Mẹo rút gọn:** các thao tác lặp lại nhàm chán đều có script — xem `Docs/DEMO_SEED_GUIDE.md` mục 5.2–5.3 (`demo:resolve`, `demo:ack`, `demo:confirm`, `demo:close`). Kịch bản dưới đây cố ý **không chạy script ngay từ seed**: mở đầu bằng việc chứng minh vấn đề thật, rồi mới xin phép chạy script cho phần không cần giải thích.

> ⚠️ **Ảnh selfie không có file thật.** Seed chỉ ghi bản ghi `Evidence`, **không upload ảnh** lên storage. Khi duyệt selfie `NV-KD-002` (Bước 2.5), **không bấm xem ảnh** — sẽ ra ảnh lỗi. Duyệt theo giờ vào/ra và địa điểm hiển thị trong dialog.

---

## 2. PHÂN VAI & TÀI KHOẢN TRÌNH DIỄN

| Vai trò | Thiết bị demo | Tài khoản | Mục đích chính |
|---|---|---|---|
| **Nhân viên (Employee)** | **Điện thoại Android** | `nv.kinh-doanh.1@anphat.local` | Demo trải nghiệm chấm công thực tế (Vào ca/Ra ca, Wi-Fi/GPS/Selfie), gửi đơn phép, xem phiếu lương cá nhân |
| **Quản lý phòng ban (Manager)** | **Web / Laptop** | `quan.ly.kinh-doanh@anphat.local` | Rà soát bảng công phòng ban, kiểm tra blocker, duyệt selfie + giải trình, xác nhận bảng công phòng KD |
| **Quản trị Nhân sự (HR Admin)** | **Web / Laptop** | `hr@anphat.local` | Giám sát toàn công ty, chốt kỳ công tháng 10, sinh snapshot, chạy tính lương, khóa bảng lương và phát hành phiếu lương |

> **Toàn bộ thao tác tay nằm trong một phòng (KD) và dùng chung một tài khoản quản lý** — không phải đăng xuất/đăng nhập hay chuyển phòng ban giữa các pha.

---

## 3. TIẾN TRÌNH KỊCH BẢN DEMO CHI TIẾT (15 - 20 PHÚT)

```
[PHA 1: ANDROID MOBILE]  →  [PHA 2: WEB QUẢN LÝ]  →  [PHA 3: WEB HR CHỐT KỲ]  →  [PHA 4: ANDROID MOBILE]
Chấm công thực tế             Duyệt đơn giải trình        Chốt kỳ công tháng 10          Nhận phiếu lương tức thì
Vào ca / Ra ca                Xử lý điểm nghẽn blocker    Tính lương tự động &           Kiểm tra chi tiết
Wi-Fi / GPS / Selfie          Xác nhận công phòng ban     Phát hành phiếu lương          Gross - Net - BHXH - Thuế
```

---

### PHA 1: TRẢI NGHIỆM NHÂN VIÊN TRÊN THIẾT BỊ ANDROID (5 Phút)

> **Mục tiêu**: Chứng minh quy trình chấm công Mobile trên Android hoạt động trơn tru, bảo mật, xác thực vị trí chống gian lận và đồng bộ tức thì lên Server.

#### Bước 1.1: Đăng nhập & Tổng quan cá nhân
- Mở App **CoreStaff** trên điện thoại Android.
- Đăng nhập tài khoản: `nv.kinh-doanh.1@anphat.local` / Mật khẩu: `Demo123456!`.
- **Điểm nhấn giải thích**:
  - Giao diện thiết kế theo Design System hiện đại, trực quan, tốc độ phản hồi nhanh.
  - Card **"CA LÀM HÔM NAY"** hiển thị rõ ràng: *Ca hành chính chuẩn (08:00 - 17:00)* tại *Trụ sở chính An Phát*.
  - Trạng thái hiện tại: Đang hiển thị badge tương ứng (Chưa vào ca hoặc Đang trong ca).

#### Bước 1.2: Thực hiện Chấm công (Check-in / Check-out)
- Nhấn nút **"Chấm công & lịch sử"** (hoặc nhấn trực tiếp vào action trên Card).
- Chuyển sang màn hình **Ngày làm việc**:
  - Hệ thống tự động kích hoạt cơ chế xác thực theo thứ tự bảo mật chuẩn:
    1. **Kiểm tra Wi-Fi văn phòng**: So khớp BSSID mạng Wi-Fi công ty.
    2. **Kiểm tra GPS**: Đo khoảng cách thực tế so với bán kính cho phép của Workplace.
    3. **Chụp ảnh Selfie**: Trường hợp ngoài phạm vi hoặc ca làm lưu động (Out of office), ứng dụng kích hoạt Camera chụp ảnh khuôn mặt thực tế chống chấm công hộ.
- Nhấn nút **"Xác nhận vào ca"** (hoặc **"Xác nhận ra ca"**).
- Xác nhận trên Dialog → Thông báo thành công: *"Đã ghi nhận thời gian vào ca"*.
- **Quan sát kết quả**:
  - Mốc thời gian trên Timeline cập nhật tức thì.
  - Badge trạng thái chuyển sang **"Đang trong ca"** (hoặc **"Đã hoàn thành ca"**).

#### Bước 1.3: Xem Lịch sử & Phiếu lương đã nhận
- Cuộn xuống danh sách ngày công trong tháng để thấy dữ liệu chấm công minh bạch.
- Chuyển sang Tab **"Phiếu lương"**:
  - Nhấn mở phiếu lương tháng **09/2026** (kỳ lịch sử đã phát hành).
  - Trình bày trực quan: Lương cơ bản, Ngày công chuẩn, Lương Gross, các khoản trích nộp bắt buộc (BHXH 8%, BHYT 1.5%, BHTN 1%), Thuế TNCN lũy tiến từng phần, và số tiền thực lĩnh (Net Salary).
  - Số của `NV-KD-001` kỳ 09: **20/20 công**, gross `22.483.125`, bảo hiểm `1.760.850`, thuế TNCN `248.458`, thực lĩnh **`20.473.817`**.

> **Lưu ý khi trình diễn chấm công trực tiếp:** ngày demo là **02/11**, thuộc kỳ **2026-11** đang `OPEN`. Seed cố ý không có dữ liệu tương lai, và tài khoản `NV-KD-001` được để trống ngày hôm nay để bấm chấm công thật. Nếu mạng/Wi-Fi văn phòng không khớp BSSID lúc demo, dùng phương án **GPS trong bán kính** hoặc **Selfie** — cả hai đều hợp lệ và đều được ghi nhận minh bạch trên timeline.

---

### PHA 2: QUẢN LÝ PHÒNG BAN RÀ SOÁT & XỬ LÝ BLOCKER TRÊN WEB (5 Phút)

> **Mục tiêu**: Thể hiện tính chặt chẽ trong quản lý. Hệ thống tự động bắt lỗi thiếu check-in/check-out và ngăn chặn chốt công sai quy định.

#### Bước 2.1: Đăng nhập Trưởng phòng Kinh doanh
- Trên Web Dashboard, đăng nhập: `quan.ly.kinh-doanh@anphat.local` / `Demo123456!`.
- Vào mục **"Quản lý Kỳ Công"** (`/timesheet/review`) → Chọn kỳ **2026-10**.

#### Bước 2.2: Trình diễn Cảnh báo Điểm nghẽn (Blockers)
- **Điểm nhấn giải thích**:
  - Tỷ lệ hoàn thành công chưa đạt 100%.
  - Bảng blocker hiển thị **4 nhân viên** đang vướng:
    - `Vũ Thị Mai` (`NV-KD-002`) — **selfie công tác 15/10 chưa duyệt**.
    - `Đặng Văn Khoa` (`NV-KD-003`) — **thiếu check-out 21/10**, đã gửi giải trình.
    - `Phạm Hoàng Nam` (`NV-KD-001`) — **thiếu check-out 30/10**, chưa giải trình.
    - `Lê Quốc Bảo` (`NV-KT-001`) — **không có dữ liệu chấm công cả ngày 19/10**, đã gửi giải trình.
  - Nếu Quản lý cố tình nhấn xác nhận khi còn blocker: Hệ thống từ chối với mã lỗi `DEPARTMENT_NOT_READY`. Không cho phép gian lận hay làm tròn thiếu căn cứ.

#### Bước 2.3: Xin phép chạy script gỡ phần lặp lại
- Nói với hội đồng: *"Phần còn lại là thao tác lặp lại giống hệt nhau. Em xin phép chạy script đã chuẩn bị để dành thời gian cho phần cần giải thích."*
- Chạy:
  ```bash
  npm --prefix CoreStaff/Apps/api run demo:resolve
  ```
- Script gọi đúng service mà Web gọi (không ghi tay vào DB), xử lý: duyệt giải trình `NV-KT-001` (19/10) và tạo giải trình + duyệt cho `NV-KD-001` (30/10). In ra 2 dòng `✓`.
- Quay lại màn hình rà soát: kỳ 10 giờ còn **đúng 2 blocker**, **cả 2 đều thuộc phòng KD** — dùng cho phần trình diễn tay tiếp theo.

#### Bước 2.4: Duyệt tay 2 vướng còn lại (cùng phòng KD)
- Mở danh sách yêu cầu (`Manager Requests`), lọc kỳ `2026-10`:
  - **`NV-KD-002` — selfie công tác 15/10** (*"Gặp khách hàng Đông Á ký phụ lục hợp đồng"*): nhấn **"Duyệt đơn"**. ⚠️ Duyệt theo giờ vào `08:10` / ra `17:18` và địa điểm hiển thị, **không bấm xem ảnh** (xem cảnh báo §1.2).
  - **`NV-KD-003` — giải trình 21/10** (*"Quên chấm công ra do đi gặp khách hàng ở Thủ Đức…"*): nhấn **"Duyệt đơn"**.
- Quay lại màn hình rà soát kỳ công: **không còn blocker nào**.
- Giải thích cơ chế: mỗi lần duyệt/từ chối đều **tăng phiên bản kỳ** và **vô hiệu hoá các xác nhận bảng công trước đó** — hệ thống không cho ai xác nhận trên dữ liệu đã đổi.

#### Bước 2.5: Trình diễn Tính năng mới — Phân loại Làm nửa ngày, Đi muộn & Về sớm
- Xem chi tiết bảng công của nhân viên `Vũ Thị Mai` (`NV-KD-002`) ngày **23/10/2026** (số liệu lấy từ dữ liệu đã seed, không phải ví dụ):
  - Đã có đơn nghỉ phép nửa ngày sáng (`MORNING_HALF` 08:00 - 12:00, **240 phút**) được HR duyệt.
  - Ca làm việc buổi chiều bắt đầu từ 13:00 đến 17:00 (chuẩn **240 phút**).
  - Nhân viên vào ca chiều lúc **13:40** → hệ thống ghi **Đi muộn 25 phút** (đã trừ 15 phút ân hạn).
  - Nhân viên tan ca lúc **16:30** → hệ thống ghi **Về sớm 30 phút** so với mốc 17:00.
  - Tổng thời gian làm việc thực tế: **170 phút** (13:40 → 16:30), nghỉ phép hưởng lương: **240 phút**.
- **Nhấn mạnh điểm nghiệp vụ:** 170 + 240 = **410/480 phút**, dưới ngưỡng 87,5% (420 phút) để được tính công đầy đủ → hệ thống tự chấm ngày này **0,5 công**. Đây chính là lý do `NV-KD-002` cuối kỳ chỉ có **21.5/22 công** dù không vắng ngày nào.
- Chỉ vào phiếu lương kỳ 10 của `NV-KD-002`: **21.5/22 công**, gross `18.002.728`, thực lĩnh `16.451.878` — thấp hơn `NV-KD-001` (`22/22`, gross `21.960.114`) dù `NV-KD-002` cũng có OT.

#### Bước 2.6: Nhân viên tự xác nhận bảng công
- Mở tab/thiết bị khác, đăng nhập `nv.kinh-doanh.2@anphat.local` (`NV-KD-002`) → mục **"Công của tôi"** → xem kỳ `2026-10`.
- Cho hội đồng thấy: **21.5/22 công**, chi tiết từng ngày, có ghi chú ngày 0,5 công.
- Nhấn **"Xác nhận bảng công"**. Giải thích: nhân viên phải xác nhận thì phòng mới đủ điều kiện chốt — đây là lá chắn chống HR tự ý sửa công.

#### Bước 2.7: Xác nhận bảng công phòng Kinh doanh
- Quay lại tài khoản QL KD (`quan.ly.kinh-doanh@anphat.local`).
- Trên màn hình rà soát kỳ công, nhấn **"Xác nhận bảng công phòng Kinh doanh"**.
- Nếu bấm sớm khi còn người chưa xác nhận, hệ thống từ chối với `EMPLOYEE_ACKNOWLEDGEMENT_PENDING` — cho hội đồng thấy đây là **ràng buộc thật**, không phải nút bị ẩn.
- Bấm hộ các tài khoản còn lại (thao tác lặp, không cần trình diễn):
  ```bash
  npm --prefix CoreStaff/Apps/api run demo:ack -- --skip-ack=NV-KD-003
  ```
  Lệnh này ack hộ 6 tài khoản còn lại (kể cả `NV-KD-002` nếu chưa bấm ở Bước 2.6 — sẽ in `đã xác nhận trước đó`), để `NV-KD-003` tự làm tiếp.
- Cho `NV-KD-003` tự xác nhận (đăng nhập `nv.kinh-doanh.3@anphat.local`, **20/22 công**), hoặc:
  ```bash
  npm --prefix CoreStaff/Apps/api run demo:ack -- --skip-ack=
  ```

> **Vì sao phải có `--skip-ack=NV-KD-003` ở lệnh trên:** mặc định `demo:ack` bỏ qua **cả** `NV-KD-002` và `NV-KD-003`. Chạy trơn thì phòng KD vẫn còn người chưa xác nhận → Bước 3.1 không chốt được kỳ.

#### Bước 2.8: Xác nhận phòng Kỹ thuật (script, không trình diễn)
```bash
npm --prefix CoreStaff/Apps/api run demo:confirm
```
- Phòng KD vừa xác nhận tay nên in `đã xác nhận`; phòng KT được xác nhận hộ.
- Khi **cả 2 phòng** xong, kỳ tự chuyển `READY_TO_CLOSE`.

> **Ràng buộc quan trọng:** kỳ chỉ sang `READY_TO_CLOSE` khi **tất cả các phòng ban đang hoạt động** đều đã xác nhận — thiếu 1 phòng là HR vẫn không chốt được. Đây là lý do phải xác nhận cả phòng KT.

---

### PHA 3: QUẢN TRỊ HR CHỐT KỲ CÔNG & TÍNH LƯƠNG TỰ ĐỘNG (5 Phút)

> **Mục tiêu**: Minh họa "Flow chính của dự án" — Đóng gói dữ liệu chấm công thành Snapshot bất biến, kích hoạt Engine tính lương chuẩn Luật Lao động & Thuế Việt Nam.

#### Bước 3.1: HR Kiểm tra & Chốt Kỳ Công Tháng 10
- Đăng nhập tài khoản HR: `hr@anphat.local` / `Demo123456!`.
- Truy cập **"Quản lý Kỳ Công"** → Kỳ **2026-10**:
  - Trạng thái các phòng ban: Phòng KD và KT đều đã được xác nhận.
  - Kỳ chuyển sang trạng thái: **"READY_TO_CLOSE"** (Sẵn sàng chốt).
- HR nhấn nút **"Chốt kỳ công"** (`Close Timesheet Period`):
  - Hệ thống đóng băng dữ liệu công.
  - Tự động sinh `TimesheetSummary` (Tổng hợp công chuẩn, công nghỉ phép, giờ OT).
  - Tự động đóng gói `PayrollInputSnapshot` bất biến phục vụ tính lương.

#### Bước 3.2: Khởi tạo Bảng lương & Tính lương tự động
- Chuyển sang menu **"Bảng Lương"** (`Payroll Runs`):
  - Nhấn **"Tạo bảng lương mới"** cho kỳ `2026-10`.
- Bảng lương ban đầu ở trạng thái `DRAFT` (Nháp).
- HR nhấn nút **"Tính lương"** (Calculate):
  - Engine backend xử lý tự động trong mili-giây:
    - *Tính lương theo ngày công thực tế* (`NV-KD-003` 20/22, `NV-KD-002` 21.5/22, `NV-KT-003` 21/22).
    - *Tính tiền làm thêm giờ (OT) theo hệ số ngày* — kỳ 10 có OT ngày thường 150% và OT cuối tuần 200% (`NV-KT-001` 2.795.454, `NV-KT-003` 1.818.182).
    - *Cộng thưởng chuyên cần + thưởng KPI theo bậc* (KPI cơ sở 2.000.000, 4 bậc).
    - *Cộng phụ cấp ăn trưa / trách nhiệm / xăng xe-điện thoại* — theo quy tắc **R1** của hệ thống, **mọi phụ cấp đều tính vào thu nhập chịu thuế** (không có phần miễn thuế riêng).
    - *Trừ BHXH 8%, BHYT 1,5%, BHTN 1% theo mức trần; `NV-KD-003` đang thử việc nên **không đóng bảo hiểm***.
    - *Trừ giảm trừ gia cảnh (bản thân 15.500.000, người phụ thuộc 6.200.000/người)*.
    - *Tính Thuế TNCN theo biểu lũy tiến từng phần*.
- Bảng lương chuyển sang trạng thái **`CALCULATED`** với đầy đủ tổng Gross, tổng Net, tổng chi phí thuế và bảo hiểm của công ty.

#### Bước 3.3: Khóa Bảng lương & Phát hành Phiếu lương
- HR kiểm tra nhanh chi tiết phiếu lương nháp của 1 nhân viên.
- Nhấn **"Khóa bảng lương"** (`Lock`) → Chuyển sang `LOCKED`.
- Nhấn **"Phát hành phiếu lương"** (`Release Payslips`) → Chuyển sang **`RELEASED`**.
- Hệ thống kích hoạt gửi thông báo và mở quyền truy cập phiếu lương cho toàn bộ 8 nhân viên.

**Bảng số liệu kỳ 10 để đối chiếu trên màn hình** (lấy từ lần chạy thật, không phải số minh họa):

| Mã NV | Công | Gross | OT | BH (NV) | Thuế TNCN | Thực lĩnh |
|---|---|---|---|---|---|---|
| `NV-KD-001` | 22/22 | 21.960.114 | 230.114 | 1.760.850 | 223.458 | 19.975.806 |
| `NV-KD-002` | 21.5/22 | 18.002.728 | 136.364 | 1.550.850 | 0 | 16.451.878 |
| `NV-KD-003` | 20/22 | 14.366.364 | 0 | **0** (thử việc) | 0 | 14.366.364 |
| `NV-KT-001` | 22/22 | 30.525.454 | 2.795.454 | 2.443.350 | 179.333 | 27.902.771 |
| `NV-KT-002` | 22/22 | 26.105.000 | 375.000 | 2.233.350 | 399.833 | 23.471.817 |
| `NV-KT-003` | 21/22 | 22.639.091 | 1.818.182 | 2.023.350 | 164.878 | 20.450.863 |
| `QL-KD-001` | 22/22 | 36.730.000 | 0 | 3.020.850 | 290.458 | 33.418.692 |
| `QL-KT-001` | 22/22 | 39.730.000 | 0 | 3.388.350 | 964.165 | 35.377.485 |

Ba điểm đáng nói khi đọc bảng này:
- `NV-KD-003` **BH = 0** vì đang thử việc (hợp đồng thử việc chưa thuộc diện đóng BHXH bắt buộc) — đúng luật, không phải lỗi.
- `NV-KD-002` **thuế TNCN = 0** dù gross 18 triệu: trừ BH (1.550.850), giảm trừ bản thân (15.500.000) và **1 người phụ thuộc** (6.200.000) thì thu nhập tính thuế âm → không phát sinh thuế. Đây là ví dụ tốt để giải thích giảm trừ gia cảnh.
- `NV-KT-001` có OT cao nhất (6.000.000 ở kỳ 09, 2.795.454 ở kỳ 10) nhờ OT cuối tuần hệ số 200%.

---

### PHA 4: ĐẦU CUỐI XUYÊN SUỐT — NHÂN VIÊN XEM PHIẾU LƯƠNG TRÊN ANDROID (2 Phút)

> **Mục tiêu**: Đảm bảo tính khép kín đầu cuối (End-to-End). Dữ liệu vừa được HR chốt và phát hành trên Web hiển thị ngay lập tức trên điện thoại Android của nhân viên.

- Quay trở lại điện thoại **Android**:
- Vuốt xuống để Refresh (hoặc chuyển sang Tab **"Phiếu lương"**):
  - Xuất hiện ngay phiếu lương mới: **Kỳ Tháng 10/2026**.
- Mở phiếu lương xem chi tiết:
  - Lương thực lĩnh (Net) đã phản ánh chính xác ngày công đã chốt, giờ OT được duyệt và các khoản bảo hiểm, thuế đúng từng đồng theo quy định pháp luật.
- **Kết luận thông điệp buổi Demo**:
  - CoreStaff giải quyết triệt để bài toán chấm công minh bạch, chống gian lận trên thiết bị di động, tự động hóa 100% quy trình chốt công và tính lương, loại bỏ sai sót thủ công của phòng Nhân sự.

---

## 4. TỔNG HỢP MẸO & PHƯƠNG ÁN DỰ PHÒNG KHI DEMO

1. **Nếu thiết bị Android mất kết nối mạng**:
   - Sử dụng điện thoại phát Hotspot Wi-Fi cho laptop và điện thoại chung dải mạng, cập nhật IP máy chủ vào cấu hình API Base (`http://<LAN_IP>:3000`).
2. **Nếu muốn diễn tập lại từ đầu**:
   - Chỉ mất đúng 1 lệnh để đưa dữ liệu về ban đầu:
     ```bash
     npm --prefix CoreStaff/Apps/api run seed:demo:reset
     ```
   - Lệnh reset chỉ xoá dữ liệu có `organizationId` của tenant `ANPHAT`; không đụng collection chung hay tenant khác.
3. **Nếu hội đồng muốn xem nhanh kết quả kỳ chốt hoàn tất**:
   - Cho xem trực tiếp kỳ lịch sử `2026-09` đã chốt và phát hành sẵn với đầy đủ 8 phiếu lương mẫu.
4. **Nếu muốn chạy nhanh trọn luồng chốt kỳ 2026-10 (không demo tay)**:
   ```bash
   npm --prefix CoreStaff/Apps/api run demo:all
   ```
   Chế độ này **bỏ qua** mọi tùy chọn `--keep` / `--skip-ack` — gỡ hết blocker và ack hết 8 tài khoản.

### 4.1. Bảng lỗi nghiệp vụ có thể gặp và cách xử lý ngay tại chỗ

| Thông báo | Nguyên nhân | Nói gì / làm gì |
|---|---|---|
| `DEPARTMENT_NOT_READY` | Phòng **còn blocker** (ngày công chưa xử lý) | "Hệ thống chặn vì còn ngày chưa xử lý — đúng thiết kế." Xử lý blocker rồi bấm lại. |
| `EMPLOYEE_ACKNOWLEDGEMENT_PENDING` | Phòng **còn nhân viên chưa xác nhận bảng công** | "Cần từng nhân viên xác nhận thì phòng mới chốt được." Cho người đó ack trước. |
| `EMPLOYEE_TIMESHEET_DISPUTED` | Có nhân viên bấm "Khiếu nại" thay vì "Xác nhận" | Mở phần khiếu nại, xử lý rồi cho xác nhận lại. |
| `PERIOD_VERSION_CONFLICT` | Kỳ vừa bị thay đổi bởi thao tác khác (duyệt/khiếu nại) | Tải lại màn hình rồi làm lại — đây là bảo vệ chống ghi đè. |
| `CANNOT_CLOSE_PERIOD` | Kỳ chưa ở `READY_TO_CLOSE` (thiếu phòng xác nhận) | Kiểm tra cả 2 phòng đã xác nhận chưa. |
| `OVERTIME_OVERLAPS_SCHEDULE` | Khai OT trùng giờ làm việc theo ca | Chỉ khai OT ngoài khung ca. |

### 4.2. Ba con số dùng để kết thúc phần trình bày

```bash
npm --prefix CoreStaff/Apps/api run verify:demo
```
In ra và có thể chiếu lên màn hình:
- **326 ngày công** được tính lại bằng chính `calculateAttendance` của hệ thống
- **32 yêu cầu** (đơn từ) và **18 kết quả OT** đối chiếu chéo
- `✓ Dữ liệu nhất quán giữa chấm công, OT, bảng công và bảng lương`

Thông điệp: không có con số nào trong bảng lương được ghi tay — tất cả sinh ra từ service thật, chạy trên đồng hồ ảo để mốc thời gian giống hệ thống vận hành thật.
