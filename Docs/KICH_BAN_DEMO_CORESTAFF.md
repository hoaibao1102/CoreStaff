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

---

## 2. PHÂN VAI & TÀI KHOẢN TRÌNH DIỄN

| Vai trò | Thiết bị demo | Tài khoản | Mục đích chính |
|---|---|---|---|
| **Nhân viên (Employee)** | **Điện thoại Android** | `nv.kinh-doanh.1@anphat.local` | Demo trải nghiệm chấm công thực tế (Vào ca/Ra ca, Wi-Fi/GPS/Selfie), gửi đơn phép, xem phiếu lương cá nhân |
| **Quản lý phòng ban (Manager)** | **Web / Laptop** | `quan.ly.kinh-doanh@anphat.local` | Rà soát bảng công phòng ban, kiểm tra blocker, duyệt đơn giải trình, xác nhận bảng công bộ phận |
| **Quản trị Nhân sự (HR Admin)** | **Web / Laptop** | `hr@anphat.local` | Giám sát toàn công ty, chốt kỳ công tháng 9, sinh snapshot, chạy tính lương, khóa bảng lương và phát hành phiếu lương |

---

## 3. TIẾN TRÌNH KỊCH BẢN DEMO CHI TIẾT (15 - 20 PHÚT)

```
[PHA 1: ANDROID MOBILE]  →  [PHA 2: WEB QUẢN LÝ]  →  [PHA 3: WEB HR CHỐT KỲ]  →  [PHA 4: ANDROID MOBILE]
Chấm công thực tế             Duyệt đơn giải trình        Chốt kỳ công tháng 9           Nhận phiếu lương tức thì
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
  - Nhấn mở phiếu lương tháng **08/2026** (kỳ đã phát hành).
  - Trình bày trực quan: Lương cơ bản, Ngày công chuẩn (22 ngày), Lương Gross, các khoản trích nộp bắt buộc (BHXH 8%, BHYT 1.5%, BHTN 1%), Thuế TNCN lũy tiến từng phần, và số tiền thực lĩnh (Net Salary).

---

### PHA 2: QUẢN LÝ PHÒNG BAN RÀ SOÁT & XỬ LÝ BLOCKER TRÊN WEB (5 Phút)

> **Mục tiêu**: Thể hiện tính chặt chẽ trong quản lý. Hệ thống tự động bắt lỗi thiếu check-in/check-out và ngăn chặn chốt công sai quy định.

#### Bước 2.1: Đăng nhập Trưởng phòng Kinh doanh
- Trên Web Dashboard, đăng nhập: `quan.ly.kinh-doanh@anphat.local` / `Demo123456!`.
- Vào mục **"Quản lý Kỳ Công"** (`/timesheet/review`) → Chọn kỳ **2026-09**.

#### Bước 2.2: Trình diễn Cảnh báo Điểm nghẽn (Blockers)
- **Điểm nhấn giải thích**:
  - Tỷ lệ hoàn thành công chưa đạt 100%.
  - Bảng blocker hiển thị rõ nhân viên `Đặng Văn Khoa` (`NV-KD-003`) bị lỗi: **"Thiếu check-in"** ngày 15/09/2026.
  - Nếu Quản lý cố tình nhấn chốt/xác nhận khi còn blocker: Hệ thống từ chối và cảnh báo lỗi nghiệp vụ. Không cho phép gian lận hay làm tròn thiếu căn cứ.

#### Bước 2.3: Duyệt Đơn Giải trình Bổ sung công
- Mở danh sách yêu cầu (`Manager Requests`):
  - Nhân viên `Đặng Văn Khoa` đã gửi đơn giải trình: *"Quên chấm công vào do vào ca gấp tiếp khách hàng"*.
- Quản lý nhấn **"Duyệt đơn"** (Approve).
- Quay lại màn hình rà soát kỳ công: Điểm nghẽn được gỡ bỏ hoàn toàn, công phòng Kinh doanh chuyển sang trạng thái sẵn sàng.
- Quản lý nhấn **"Xác nhận bảng công phòng Kinh doanh"**.

---

### PHA 3: QUẢN TRỊ HR CHỐT KỲ CÔNG & TÍNH LƯƠNG TỰ ĐỘNG (5 Phút)

> **Mục tiêu**: Minh họa "Flow chính của dự án" — Đóng gói dữ liệu chấm công thành Snapshot bất biến, kích hoạt Engine tính lương chuẩn Luật Lao động & Thuế Việt Nam.

#### Bước 3.1: HR Kiểm tra & Chốt Kỳ Công Tháng 9
- Đăng nhập tài khoản HR: `hr@anphat.local` / `Demo123456!`.
- Truy cập **"Quản lý Kỳ Công"** → Kỳ **2026-09**:
  - Trạng thái các phòng ban: Phòng KD và KT đều đã được xác nhận.
  - Kỳ chuyển sang trạng thái: **"READY_TO_CLOSE"** (Sẵn sàng chốt).
- HR nhấn nút **"Chốt kỳ công"** (`Close Timesheet Period`):
  - Hệ thống đóng băng dữ liệu công.
  - Tự động sinh `TimesheetSummary` (Tổng hợp công chuẩn, công nghỉ phép, giờ OT).
  - Tự động đóng gói `PayrollInputSnapshot` bất biến phục vụ tính lương.

#### Bước 3.2: Khởi tạo Bảng lương & Tính lương tự động
- Chuyển sang menu **"Bảng Lương"** (`Payroll Runs`):
  - Nhấn **"Tạo bảng lương mới"** cho kỳ `2026-09`.
- Bảng lương ban đầu ở trạng thái `DRAFT` (Nháp).
- HR nhấn nút **"Tính lương"** (Calculate):
  - Engine backend xử lý tự động trong mili-giây:
    - *Tính lương theo ngày công thực tế*.
    - *Tính tiền làm thêm giờ (OT) cuối tuần x2.0 cho nhân viên kỹ thuật*.
    - *Cộng phụ cấp ăn trưa miễn thuế*.
    - *Trừ BHXH, BHYT, BHTN theo tỷ lệ quy định và mức trần bảo hiểm*.
    - *Trừ giảm trừ gia cảnh (Bản thân 11 triệu + Người phụ thuộc 4.4 triệu/người)*.
    - *Tính Thuế TNCN theo 7 bậc lũy tiến*.
- Bảng lương chuyển sang trạng thái **`CALCULATED`** với đầy đủ tổng Gross, tổng Net, tổng chi phí thuế và bảo hiểm của công ty.

#### Bước 3.3: Khóa Bảng lương & Phát hành Phiếu lương
- HR kiểm tra nhanh chi tiết phiếu lương nháp của 1 nhân viên.
- Nhấn **"Khóa bảng lương"** (`Lock`) → Chuyển sang `LOCKED`.
- Nhấn **"Phát hành phiếu lương"** (`Release Payslips`) → Chuyển sang **`RELEASED`**.
- Hệ thống kích hoạt gửi thông báo và mở quyền truy cập phiếu lương cho toàn bộ 8 nhân viên.

---

### PHA 4: ĐẦU CUỐI XUYÊN SUỐT — NHÂN VIÊN XEM PHIẾU LƯƠNG TRÊN ANDROID (2 Phút)

> **Mục tiêu**: Đảm bảo tính khép kín đầu cuối (End-to-End). Dữ liệu vừa được HR chốt và phát hành trên Web hiển thị ngay lập tức trên điện thoại Android của nhân viên.

- Quay trở lại điện thoại **Android**:
- Vuốt xuống để Refresh (hoặc chuyển sang Tab **"Phiếu lương"**):
  - Xuất hiện ngay phiếu lương mới: **Kỳ Tháng 09/2026**.
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
3. **Nếu hội đồng muốn xem nhanh kết quả kỳ chốt hoàn tất**:
   - Cho xem trực tiếp kỳ lịch sử `2026-08` đã chốt và phát hành sẵn với đầy đủ 8 phiếu lương mẫu.
