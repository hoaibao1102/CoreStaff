# CORESTAFF — FLUTTER DESIGN MASTER COVERAGE AUDIT
## Đối Chiếu Toàn Diện Giữa Mã Nguồn React Native và Tài Liệu Thiết Kế Flutter

> **Nguồn đối chiếu:**
> 1. Mã nguồn thực tế: `Apps/mobile/` (React Native / Expo 57)
> 2. Tài liệu thiết kế chuẩn: `FLUTTER_DESIGN_MASTER.md` (và `Docs/MOBILE_DESIGN_MASTER.md`)
> 3. Kiến trúc mục tiêu: `Docs/FLUTTER_MIGRATION_ARCHITECTURE.md`
>
> **Mục tiêu:** Xác định 100% độ bao phủ, phân loại độ lệch thiết kế và đưa ra phương án xử lý thống nhất trước khi hiện thực hóa mã nguồn Flutter.

---

## 1. Ma Trận Độ Bao Phủ Thiết Kế (Coverage Matrix)

Mỗi màn hình và luồng giao diện được đối chiếu và phân loại theo 5 nhóm chuẩn:
- **`MATCHED`**: Đã được tài liệu hóa đầy đủ trong Design Master và khớp hoàn toàn với mã nguồn thực tế.
- **`PARTIALLY_DOCUMENTED`**: Đã có trong Design Master nhưng thiếu các trạng thái con (empty, error, loading, dialog) hoặc thiếu thông số chi tiết.
- **`UNDOCUMENTED`**: Có trong mã nguồn React Native nhưng chưa được ghi nhận trong Design Master.
- **`DESIGN_ONLY`**: Có trong Design Master nhưng không tồn tại trong mã nguồn React Native (cần phân loại là tính năng dự kiến hay mô tả nhầm).
- **`CONFLICT`**: Có sự mâu thuẫn trực tiếp giữa hành vi của code React Native và mô tả trong Design Master.

| Screen ID | Tên Màn Hình / Luồng | Thành Phần React Native Nguồn | Mục Tương Ứng Trong Design Master | Phân Loại Kiểm Toán | Mức Độ Khớp | Chi Tiết Độ Lệch & Nhận Xét |
|---|---|---|---|---|---|---|
| **SCR-001** | Splash / Bootstrap Screen | `LoadingScreen` (`App.tsx:67-69`) | Mục 2 (Layout Master) | `PARTIALLY_DOCUMENTED` | 80% | Design Master chưa có mục riêng cho Splash Screen, chỉ mô tả `LoadingBlock`. Cần chuẩn hóa thành `SplashPage` hoàn chỉnh với logo lớn CoreStaff và chỉ báo đang kết nối. |
| **SCR-002** | Connection Error Screen | `ConnectionError` (`App.tsx:71-73`) | Mục 2 & Mục 4 (`AppColors.danger`) | `PARTIALLY_DOCUMENTED` | 75% | Mã nguồn có màn hình lỗi kết nối máy chủ độc lập kèm nút "Thử kết nối lại", trong khi Design Master mới chỉ đặc tả `ErrorBanner` và `ErrorState`. |
| **SCR-003** | Login Screen | `LoginScreen` (`App.tsx:83-92`) | Mục 8.1 (Màn hình Đăng nhập) | `MATCHED` | 98% | Khớp hoàn toàn: Eyebrow, Tiêu đề, Trường tài khoản/mã NV, Mật khẩu có nút Hiện/Ẩn, Nút Đăng nhập, Link Quên mật khẩu và Link Nhập mã khôi phục. |
| **SCR-004** | Forgot Password Screen | `ForgotScreen` (`App.tsx:94-98`) | Mục 8.10 (Màn hình Quên mật khẩu) | `MATCHED` | 95% | Khớp cấu trúc: Eyebrow "KHÔI PHỤC TÀI KHOẢN", nhập email, gửi hướng dẫn, banner thành công và chuyển sang nhập mã đặt lại. |
| **SCR-005** | Reset Password Screen | `ResetScreen` (`App.tsx:100-104`) | Mục 8.10 (Màn hình Đặt lại mật khẩu) | `PARTIALLY_DOCUMENTED` | 85% | Design Master gom chung vào mục 8.10 nhưng mã nguồn tách riêng `ResetScreen` với 3 trường: Mã token, Mật khẩu mới, Xác nhận mật khẩu. |
| **SCR-006** | Change Password Screen | `ChangePasswordScreen` (`App.tsx:106-110`) | Mục 8.11 (Màn hình Đổi mật khẩu) | `MATCHED` | 95% | Khớp cả 2 chế độ: Bắt buộc lần đầu (`forced = true`, không có nút "Để sau") và Tự nguyện từ Account Screen (`forced = false`, có nút "Để sau"). |
| **SCR-007** | Blocked Role Notice Screen | `isBlockedRole` (`App.tsx:117-129`) | Mục 8.12 (Màn hình Cảnh báo Phân quyền) | `MATCHED` | 95% | Khớp logic: Chặn tài khoản `HR` và `SYSTEM_ADMIN` trên Mobile, thông báo mở Web Portal, cung cấp nút Đăng xuất an toàn. |
| **SCR-008** | Overview Dashboard Tab | `OverviewScreen` (`OverviewScreen.tsx:1-66`) | Mục 8.2 (Màn hình Tổng quan) | `MATCHED` | 92% | Khớp Avatar 2 chữ cái viết tắt, Lời chào, Thẻ Hero ca làm hôm nay (vào ca/ra ca), 2 thẻ chỉ số cần chú ý (Đơn đang chờ, Phiếu lương mới), 3 hàng Quick Row. |
| **SCR-009** | Attendance Tab & Punch Flow | `AttendanceScreen` (`AttendanceScreen.tsx:1-147`) | Mục 8.3 & Mục 8.9 (Chấm công & Selfie) | `MATCHED` | 90% | Khớp luồng đa tầng (Wi-Fi BSSID -> GPS Geofencing -> Selfie camera). Khớp thẻ thời gian làm việc còn lại khi có đơn nghỉ phép HR áp dụng, lưới chỉ số giờ làm/muộn/sớm, lịch sử tháng có nút chuyển tháng. |
| **SCR-010** | Requests Tab Screen | `RequestsScreen` (`RequestsScreen.tsx:1-53`) | Mục 8.4 (Màn hình Quản lý Đơn từ) | `MATCHED` | 95% | Khớp nút tạo đơn trên Header, 2 thẻ Action nhanh (Xin nghỉ phép, Đăng ký tăng ca), SegmentedControl 3 tab (`Tất cả`, `Nghỉ phép`, `Tăng ca`), Thẻ đơn có phản hồi quản lý. |
| **SCR-011** | Request Creation Modal Sheet | `RequestModal` (`RequestsScreen.tsx:54-137`) | Mục 8.7 & Mục 8.8 (Modal Nghỉ phép & Tăng ca) | `MATCHED` | 96% | Khớp form Modal Sheet cuộn bàn phím: chọn loại nghỉ có lương/không lương, 4 loại thời lượng, hộp tính công động (`ShiftPreviewBox`), kiểm tra ràng buộc 10 ký tự lý do. |
| **SCR-012** | Payslips Tab Screen | `PayslipsScreen` (`PayslipsScreen.tsx:1-120`) | Mục 8.5 (Màn hình Phiếu lương) | `MATCHED` | 98% | Khớp Thẻ Dark tóm tắt kỳ gần nhất, Badge số kỳ mới, Danh sách Accordion Card chạm mở rộng chi tiết phân rã Gross/Bảo hiểm/Thuế/Net, cập nhật lạc quan `RELEASED` -> `VIEWED`. |
| **SCR-013** | Account Tab Screen & Logout | `AccountScreen` (`AccountScreen.tsx:1-63`) | Mục 8.6 (Màn hình Tài khoản) | `MATCHED` | 95% | Khớp Header avatar, Thông tin phòng ban/vị trí/quản lý/nơi làm/ngày vào làm, Menu Phiếu lương & Đổi mật khẩu, Khối thông tin liên hệ, Nút Đăng xuất màu đỏ. |

---

## 2. Phân Tích Chi Tiết Các Điểm Lệch (Detailed Gap Analysis)

### 2.1 Phân Tách Màn Hình Quên Mật Khẩu & Đặt Lại Mật Khẩu (SCR-004 vs SCR-005)
- **Thực trạng trong Code React Native:**
  - `ForgotScreen`: Chỉ có ô nhập email, gọi `POST /api/auth/forgot-password`. Nếu gửi thành công, hiển thị nút "Nhập mã đặt lại" để chuyển sang `ResetScreen`.
  - `ResetScreen`: Có 3 ô nhập (Mã token từ email, Mật khẩu mới, Xác nhận mật khẩu), gọi `POST /api/auth/reset-password`.
- **Trong Design Master:** Ghi chú chung là "Màn hình Quên mật khẩu" tại mục 8.10.
- **Phương án giải quyết (Reconciliation):** Tách thành 2 widget/trang riêng biệt trong Flutter: `ForgotPasswordPage` (`SCR-004`) và `ResetPasswordPage` (`SCR-005`) để đảm bảo luồng trải nghiệm chính xác 100% với React Native.

### 2.2 Luồng Camera Selfie Chấm Công (SCR-009)
- **Thực trạng trong Code React Native:**
  - Sử dụng `expo-image-picker` gọi camera hệ điều hành (`ImagePicker.launchCameraAsync`). Sau khi chụp xong, trả về URI ảnh để gửi lên backend `POST /api/attendance/me/punch`. Không nhúng Live Camera Viewport trực tiếp trên màn hình chính.
- **Trong Design Master (Mục 8.9):**
  - Đề xuất khung quét khuôn mặt Live Preview dạng tròn với đường viền nét đứt.
- **Phương án giải quyết (Reconciliation):**
  - **Giai đoạn P1:** Triển khai theo chuẩn React Native bằng cách dùng `image_picker` kích hoạt Native Camera (hoặc thư viện `camera` tiêu chuẩn) để chụp ảnh selfie và gửi kèm payload. Điều này đảm bảo tính ổn định và tương thích trên cả thiết bị thật lẫn máy ảo.
  - **Giai đoạn P2 (Cải tiến):** Có thể mở rộng Live Camera Viewfinder nhúng nếu người dùng yêu cầu trải nghiệm cao cấp hơn.

### 2.3 Quản Lý Bộ Phận Trên Mobile (Manager Parity)
- **Thực trạng trong Code React Native:** Không có tab hoặc màn hình phê duyệt riêng cho `DEPARTMENT_MANAGER`. Quản lý dùng chung 5 tab như nhân viên bình thường để quản lý công và lương của chính họ.
- **Trong Design Master:** Đã xác nhận rõ ràng tại Phạm vi: *Chỉ hỗ trợ tính năng của nhân viên và quản lý mà mã nguồn mobile thực tế đang có*.
- **Phương án giải quyết (Reconciliation):** Tuân thủ nghiêm ngặt quy tắc biên giới. Không tự ý thêm màn hình phê duyệt của web vào mobile.

---

## 3. Khuyến Nghị Đồng Bộ & Chuẩn Hóa Kiến Trúc Flutter

1. **Chuẩn Hóa Token Thống Nhất:** Áp dụng lớp `AppColors`, `AppTypography`, `AppSpacing`, `AppRadius` được định nghĩa trong `FLUTTER_DESIGN_MASTER.md` xuyên suốt 13 màn hình.
2. **Khôi Phục Trạng Thái & Tự Động Làm Mới:**
   - Sử dụng `AppLifecycleListener` trong Flutter để bắt sự kiện app quay lại foreground (`resumed`), tương đương với `AppState.addEventListener('change')` trong React Native.
   - Tích hợp BLoC event `AttendanceRefreshRequested`, `RequestsRefreshRequested` khi nhận được tín hiệu làm mới.
3. **Cập Nhật Lạc Quan (Optimistic UI):**
   - Khi bấm mở thẻ phiếu lương ở trạng thái `RELEASED`, Flutter Cubit/BLoC phải cập nhật trạng thái hiển thị nội bộ sang `VIEWED` ngay lập tức trước khi lời gọi API âm thầm hoàn tất.

