# CORESTAFF — FLUTTER SCREEN DECISIONS & TECHNICAL TRADE-OFFS
## Các Quyết Định Kiến Trúc, Khác Biệt Nền Tảng & Đề Xuất Phê Duyệt

> **Tài liệu tham chiếu:** `FLUTTER_DESIGN_MASTER.md`, `FLUTTER_SCREEN_DESIGN_SPECIFICATIONS.md`  
> **Mục tiêu:** Nhận diện và làm rõ toàn bộ các bài toán kỹ thuật nhạy cảm, sự khác biệt giữa React Native và Flutter trên nền tảng Android/iOS, các thỏa hiệp thiết kế (trade-offs) và khuyến nghị xử lý trước khi bước vào giai đoạn lập trình.

---

## 1. Danh Mục Khác Biệt Nền Tảng Phần Cứng (Native Platform Differences)

### 1.1 Đọc Wi-Fi SSID / BSSID: Android 10+ vs iOS 13+
- **Vấn Đề Kỹ Thuật:**
  - Để chống gian lận chấm công, CoreStaff đối soát BSSID (địa chỉ MAC của điểm truy cập Wi-Fi tại văn phòng).
  - Trên **Android 10+ (API 29+)**, Google xếp BSSID vào nhóm dữ liệu nhạy cảm. Để đọc được BSSID, ứng dụng bắt buộc phải xin quyền `ACCESS_FINE_LOCATION` và người dùng phải bật định vị GPS của thiết bị.
  - Trên **iOS 13+**, Apple yêu cầu ứng dụng phải có quyền `Location When In Use` HOẶC sử dụng chức năng `Access WiFi Information` (đòi hỏi cấu hình Entitlement có trả phí trong Apple Developer Program).
- **Thực Trạng React Native:**
  - `Apps/mobile/src/wifi.ts` thử đọc BSSID; nếu không được hoặc nếu thiết bị không cấp quyền thì trả về đối tượng rỗng `{}` và chuyển tầng sang định vị GPS.
- **Đề Xuất Cho Flutter (`network_info_plus`):**
  - Sử dụng package `network_info_plus`.
  - Nếu không đọc được BSSID (người dùng từ chối cấp quyền vị trí hoặc iOS chặn), hệ thống **tự động chuyển ngay sang kiểm tra GPS Geofencing** mà không làm crash ứng dụng.
  - Hiển thị thông báo hướng dẫn dịu dàng: *"Không thể xác thực Wi-Fi tự động, đang chuyển sang vị trí GPS…"*.

---

### 1.2 Chụp Ảnh Selfie Chấm Công: Native Camera Intent vs Custom Live Viewfinder
- **Vấn Đề Kỹ Thuật:**
  - Trong `FLUTTER_DESIGN_MASTER.md` (Mục 8.9), có mô tả khung tròn Live Camera Viewfinder nhúng trực tiếp vào giao diện với vòng quét khuôn mặt.
  - Tuy nhiên, trong mã nguồn React Native thực tế (`AttendanceScreen.tsx:27-32`), ứng dụng sử dụng Native Intent Camera (`ImagePicker.launchCameraAsync({ quality: 0.6 })`).
- **Thỏa Hiệp Đánh Đổi (Trade-off):**
  - *Phương án A (Native Camera Intent qua `image_picker`):* Tương thích 100% mọi dòng máy Android/iOS, hoạt động hoàn hảo trên Android Emulator, kích thước code gọn nhẹ, không lo lỗi rò rỉ bộ nhớ (memory leak) của camera controller.
  - *Phương án B (Custom Live Camera qua `camera` package):* Giao diện đẹp hơn, có khung quét khuôn mặt tròn, nhưng phức tạp hơn, tiêu tốn pin hơn và hay gặp lỗi crash trên các máy ảo (Emulator) không có webcam ảo.
- **Khuyến Nghị (Recommendation):**
  - **Áp dụng Phương án A cho giai đoạn P1 (chuẩn hóa tương thích 100% với React Native hiện tại)**.
  - Chuyển sang Phương án B ở phiên bản P2 sau khi toàn bộ nghiệp vụ cốt lõi đã hoàn thành và được kiểm thử ổn định.

---

### 1.3 Độ Chính Xác GPS Geofencing: High Accuracy vs Tiết Kiệm Pin
- **Vấn Đề Kỹ Thuật:**
  - Backend NestJS kiểm tra bán kính văn phòng bằng công thức Haversine với độ sai số `accuracyMeters <= maximumAccuracyMeters` (thường là 50m).
  - Nếu chỉ dùng `LocationAccuracy.medium`, tọa độ trên máy ảo hoặc trong nhà cao tầng có thể bị lệch trên 100m, dẫn đến việc bị ép chụp selfie ngoại lệ.
- **Đề Xuất Cho Flutter (`geolocator`):**
  - Sử dụng `LocationAccuracy.high` với timeout tối đa 5 giây khi bấm nút "Xác nhận vào ca".
  - Chỉ kích hoạt lấy vị trí duy nhất một lần khi thực hiện chấm công (One-shot fix), **tuyệt đối không bật tracking liên tục ngầm (Background Location)** để tối ưu 100% thời lượng pin của nhân viên.

---

## 2. Các Quyết Định Nghiệp Vụ Cốt Lõi (Core Business Decisions)

### 2.1 Giữ Nguyên Biên Giới Phân Quyền Quản Lý (Manager Scope Boundary)
- **Quyết Định:** Ứng dụng di động CoreStaff được thiết kế tập trung cho Nhân viên (`EMPLOYEE`). Đối với Quản lý bộ phận (`DEPARTMENT_MANAGER`), ứng dụng di động chỉ cung cấp các chức năng tự phục vụ (chấm công của chính họ, tạo đơn nghỉ phép/tăng ca của họ, tra cứu lương của họ).
- **Lý Do:** Toàn bộ quy trình duyệt đơn phức tạp, đối soát bảng công bộ phận, giải trình công và khóa kỳ công đòi hỏi màn hình lớn, bảng dữ liệu nhiều cột (data grid) và xác thực 2 lớp, đã được hoàn thiện trên Web Portal.
- **Kết Luận:** **KHÔNG** đưa màn hình phê duyệt quản lý của Web vào ứng dụng mobile Flutter, tuân thủ đúng hiện trạng của `Apps/mobile`.

---

### 2.2 Quản Lý Session Cookie & Làm Mới Tự Động (Silent Session Refresh)
- **Quyết Định:** Backend CoreStaff áp dụng cơ chế bảo mật HttpOnly Dual Cookie:
  - Cookie `sid`: Session ID ngắn hạn (30 phút).
  - Cookie `rt`: Refresh Token dài hạn (14 ngày).
- **Giải Pháp Cho Flutter:**
  - Sử dụng `dio` kết hợp `dio_cookie_manager` và `persist_cookie_jar`.
  - Bộ interceptor của Dio sẽ tự động bắt mã lỗi `401 Unauthorized`. Khi gặp `401`, interceptor sẽ tự động gọi endpoint refresh session ngầm. Nếu refresh thành công, request ban đầu được gửi lại trong suốt (transparent retry).
  - Nếu cả refresh token cũng hết hạn (sau 14 ngày không mở app), kích hoạt event `AuthSessionExpired` để đưa người dùng về `SCR-003` (Login).

---

### 2.3 Cập Nhật Lạc Quan Trạng Thái Phiếu Lương (Optimistic UI for Payslip Viewed)
- **Quyết Định:** Khi người dùng chạm mở thẻ phiếu lương có trạng thái `RELEASED`:
  - Giao diện Flutter lập tức cập nhật trạng thái hiển thị sang `VIEWED` và trừ số lượng thông báo chưa xem trên badge mà **không cần chờ API phản hồi**.
  - Gọi ngầm `POST /api/payslips/me/:id/viewed`. Nếu cuộc gọi mạng thất bại, giữ nguyên giao diện đã mở và không hiển thị popup lỗi làm phiền người dùng.

---

## 3. Danh Mục Các Câu Hỏi Chờ Phê Duyệt Trước Khi Lập Trình

| # | Câu Hỏi Kỹ Thuật | Lựa Chọn Đề Xuất (Recommended) | Lựa Chọn Thay Thế | Trạng Thái Phê Duyệt |
|---|---|---|---|---|
| **1** | Luồng chụp ảnh selfie chấm công nên dùng Native Camera Intent hay Custom Live Viewfinder? | **(Recommended) Native Camera Intent** thông qua `image_picker` (đồng bộ hoàn toàn với React Native và ổn định trên máy ảo) | Custom Live Viewfinder nhúng qua package `camera` (giao diện bo tròn đẹp mắt nhưng rủi ro trên máy ảo) | Chờ phê duyệt |
| **2** | Khi thiết bị không thể đọc được BSSID của Wi-Fi, app xử lý như thế nào? | **(Recommended) Tự động chuyển êm sang định vị GPS** kèm dòng thông báo nhỏ | Hiển thị Dialog bắt buộc người dùng vào Cài đặt cấp quyền Vị trí chính xác | Chờ phê duyệt |
| **3** | Có triển khai Push Notifications (FCM) ngay trong đợt chuyển đổi UI này không? | **(Recommended) Chưa triển khai FCM trong sprint này**, chỉ sử dụng WebSocket `/events` và kiểm tra khi mở lại app (`resumed`) | Tích hợp đầy đủ Firebase Cloud Messaging ngay từ đầu | Chờ phê duyệt |
| **4** | Màn hình lỗi kết nối (`SCR-002`) hiển thị khi nào? | **(Recommended) Chỉ hiển thị khi bootstrap ban đầu không tìm thấy API**, còn lỗi mạng khi đang dùng tab thì dùng `ErrorBanner` hoặc `ErrorState` nội bộ | Hiển thị đè toàn màn hình mỗi khi mất mạng | Chờ phê duyệt |
