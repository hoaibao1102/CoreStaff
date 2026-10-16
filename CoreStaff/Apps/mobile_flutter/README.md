# CoreStaff Mobile (Flutter)

Dự án ứng dụng di động **CoreStaff** xây dựng bằng **Flutter**, song hành cùng phiên bản React Native (Expo) và bám sát tài liệu thiết kế hệ thống tại [MOBILE_DESIGN_MASTER.md](../../Docs/MOBILE_DESIGN_MASTER.md).

---

## 1. Cấu trúc thư mục (Architecture)

```text
lib/
├── main.dart                          # Điểm khởi chạy app, Theme, Bootstrap & Router phân luồng
├── core/
│   ├── config/
│   │   └── api_config.dart            # Cấu hình API endpoint (Remote & Local fallback 10.0.2.2 / localhost, health check)
│   ├── network/
│   │   ├── api_client.dart            # HTTP Client tự động quản lý cookie (sid, rt), tự động refresh phiên 401
│   │   └── api_exception.dart         # Xử lý lỗi và thông báo thân thiện (Vietnamese friendlyAuthError)
│   └── theme/
│       ├── app_colors.dart            # Bảng màu chuẩn (#2563eb, #172554, #f6f8fc, success, danger...)
│       ├── app_typography.dart        # Quy chuẩn kích thước, trọng số font (ExtraBold 800, Bold 700...)
│       └── app_theme.dart             # Material 3 ThemeData tùy biến cho CoreStaff
├── models/
│   └── auth_user.dart                 # Model thông tin nhân viên, quyền hạn & avatar initials
├── services/
│   └── auth_service.dart              # Các API: login, me, changePassword, forgotPassword, resetPassword, logout
├── widgets/
│   ├── app_logo.dart                  # Logo huy hiệu "C" + nhận diện thương hiệu CoreStaff
│   ├── auth_layout.dart               # Khung bố cục chuẩn các màn hình xác thực (Eyebrow, Title, Card, Security note)
│   ├── buttons.dart                   # Reusable PrimaryButton (loading spinner) & SecondaryButton (danger variant)
│   ├── fields.dart                    # Reusable AppTextField (label, toggle Ẩn/Hiện mật khẩu, border chuẩn)
│   ├── banners.dart                   # ErrorBanner, SuccessBanner, NoticeBanner
│   └── bottom_tab_bar.dart            # Thanh điều hướng 4 tab chân trang chuẩn thiết kế (Overview, Attendance, Requests, Account)
└── screens/
    ├── splash/
    │   └── splash_screen.dart         # Màn hình Splash/Loading kết nối và ConnectionError có nút thử lại
    ├── auth/
    │   ├── login_screen.dart          # Đăng nhập bằng Email / Mã nhân viên (NV-xxxx)
    │   ├── forgot_password_screen.dart# Quên mật khẩu & gửi mã hướng dẫn qua email
    │   ├── reset_password_screen.dart # Đặt lại mật khẩu mới bằng Token
    │   └── change_password_screen.dart# Đổi mật khẩu (hỗ trợ bắt buộc đổi nếu là mật khẩu tạm từ Admin)
    ├── main_shell_screen.dart         # Vỏ ứng dụng chính sau khi đăng nhập (kiểm soát role EMPLOYEE)
    ├── overview/
    │   └── overview_tab.dart          # Tab Tổng quan: Lời chào, Thẻ ca làm việc tối màu (#172554), Lối tắt nhanh, Tóm tắt hồ sơ
    ├── attendance/
    │   └── attendance_tab.dart        # Tab Chấm công: Đồng hồ thời gian thực, Nút Vào ca / Ra ca, Thống kê, Lịch sử quẹt thẻ
    ├── requests/
    │   └── requests_tab.dart          # Tab Đơn từ: Nút tạo đơn (Nghỉ phép, OT, Giải trình), Lọc trạng thái, BottomSheet gửi đơn
    └── account/
        └── account_tab.dart           # Tab Tài khoản: Thẻ hồ sơ Hero, Mã nhân viên, Menu đổi mật khẩu, Đăng xuất an toàn
```

---

## 2. Hướng dẫn chạy ứng dụng

### Yêu cầu môi trường
- **Flutter SDK**: >= 3.13.1 (Đã kiểm tra tương thích trên Flutter 3.47+)
- **Android Studio / Xcode** (hoặc thiết bị thật bật USB Debugging)
- Backend CoreStaff API đang chạy hoặc kết nối qua môi trường remote

### Cài đặt gói phụ thuộc
```bash
flutter pub get
```

### Chạy ứng dụng trên thiết bị / máy ảo
```bash
# Xem danh sách thiết bị khả dụng
flutter devices

# Chạy trên máy ảo Android hoặc thiết bị thật
flutter run
```

---

## 3. Các tính năng chính đã tích hợp

1. **Bootstrap & Auto-resolve API**:
   - Kiểm tra kết nối API qua `/api/healthz`.
   - Tự động fallback giữa Remote API (`https://18-141-68-40.sslip.io`) và Localhost (`http://10.0.2.2:3000` trên Android emulator hoặc `http://localhost:3000`).
2. **Quản lý phiên đăng nhập (Session & Refresh Cookies)**:
   - Client tự động bắt và lưu `sid` và `rt` vào `SharedPreferences`.
   - Khi token ngắn hạn hết hạn (HTTP 401), client tự động gọi `/api/auth/refresh` và retry request gốc mượt mà không làm gián đoạn người dùng.
3. **Phân quyền và bảo mật**:
   - Ràng buộc tài khoản có `mustChangePassword == true` chuyển thẳng đến màn hình đổi mật khẩu bắt buộc.
   - Nhắc nhở người dùng có vai trò khác `EMPLOYEE` sử dụng giao diện Web Admin.
4. **Bộ giao diện chuẩn Enterprise**:
   - Chấm công nhanh một chạm.
   - Quản lý và nộp đơn từ trực quan.
   - Bố cục responsive, tối ưu vùng chạm (touch target $\ge$ 48px).
