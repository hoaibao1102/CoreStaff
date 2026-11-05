# CORESTAFF — FLUTTER SCREEN MIGRATION ROADMAP
## Kế Hoạch Lộ Trình Hiện Thực Hóa Giao Diện Mobile Flutter

> **Tài liệu tham chiếu:** `FLUTTER_SCREEN_INVENTORY.md`, `FLUTTER_SCREEN_DESIGN_SPECIFICATIONS.md`  
> **Nguyên tắc:** Hiện thực hóa theo từng giai đoạn phụ thuộc logic, đảm bảo ứng dụng luôn chạy được sau mỗi sprint.  
> **Tổng số màn hình & luồng:** 13 màn hình (`SCR-001` đến `SCR-013`)  

---

## 1. Phân Kỳ Lộ Trình (Phased Implementation Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Foundation, Auth & Application Shell (MIG-01 → MIG-08)       │
│ SCR-001, SCR-002, SCR-003, SCR-004, SCR-005, SCR-006, SCR-007         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Core Self-Service & Account (MIG-09 → MIG-12)                │
│ SCR-012 (Payslips Tab), SCR-013 (Account Tab & Logout Dialog)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Requests & Dynamic Calculation (MIG-13 → MIG-16)             │
│ SCR-010 (Requests Tab), SCR-011 (Request Modal Sheet)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 4: Dashboard & Attendance Read (MIG-17 → MIG-20)                │
│ SCR-008 (Overview Tab), SCR-009 (Attendance Read & History)           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 5: Hardware & Multi-Tier Punch Pipeline (MIG-21 → MIG-24)       │
│ Wi-Fi BSSID Matching, GPS Geofencing, Native Camera Selfie Flow        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 6: Realtime & Lifecycle Polishing (MIG-25 → MIG-28)             │
│ WebSocket /events Socket.io Listener, AppLifecycle Foreground Resume  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Bảng Kế Hoạch Chi Tiết Từng Giai Đoạn

### Giai Đoạn 1: Nền Tảng, Xác Thực & Vỏ Ứng Dụng (Foundation & Auth Shell)

| Mã Task | Screen ID | Tên Màn Hình / Module | Ưu Tiên | Phụ Thuộc (Prerequisites) | File Flutter Mục Tiêu | Trạng Thái UI Cần Triển Khai | Mức Độ Rủi Ro / Phức Tạp |
|---|---|---|---|---|---|---|---|
| **MIG-01** | `SCR-001` | Splash / Bootstrap Screen | **P0** | Dio Client, Cookie Jar | `lib/features/auth/presentation/pages/splash_page.dart` | Loading, Session Check, Auto Route | Thấp (Low) |
| **MIG-02** | `SCR-002` | Connection Error Screen | **P0** | `SCR-001` | `lib/features/auth/presentation/pages/connection_error_page.dart` | Error, Retrying, Network Resolution | Thấp (Low) |
| **MIG-03** | `SCR-003` | Login Screen | **P0** | Auth Bloc, AppCard, AppTextField | `lib/features/auth/presentation/pages/login_page.dart` | Pristine, Editing, Client Error, Server Error, Submitting | Trung bình (Medium) |
| **MIG-04** | `SCR-004` | Forgot Password Screen | **P1** | `SCR-003`, AuthLayout | `lib/features/auth/presentation/pages/forgot_password_page.dart` | Input, Sending, SuccessBanner | Thấp (Low) |
| **MIG-05** | `SCR-005` | Reset Password Screen | **P1** | `SCR-004` | `lib/features/auth/presentation/pages/reset_password_page.dart` | Input, Validation, Submitting, Success | Thấp (Low) |
| **MIG-06** | `SCR-006` | Change Password Screen | **P0** | `SCR-003`, Auth Bloc | `lib/features/auth/presentation/pages/change_password_page.dart` | Forced Mode, Voluntary Mode, Submitting, 401 Catch | Trung bình (Medium) |
| **MIG-07** | `SCR-007` | Blocked Role Notice Screen | **P1** | `SCR-003` | `lib/features/auth/presentation/pages/blocked_role_page.dart` | Blocked Notice, Safe Logout | Thấp (Low) |
| **MIG-08** | SHELL-01 | Main Bottom Nav Shell | **P0** | CustomBottomNavBar | `lib/features/home/presentation/pages/home_shell_page.dart` | 5 Tabs Switching, Active Tab State | Trung bình (Medium) |

---

### Giai Đoạn 2: Tự Phục Vụ Cốt Lõi (Core Self-Service)

| Mã Task | Screen ID | Tên Màn Hình / Module | Ưu Tiên | Phụ Thuộc | File Flutter Mục Tiêu | Trạng Thái UI Cần Triển Khai | Mức Độ Rủi Ro |
|---|---|---|---|---|---|---|---|
| **MIG-09** | `SCR-012` | Payslips Tab Screen | **P0** | Payslips Bloc, MoneyRow | `lib/features/payslips/presentation/pages/payslips_tab.dart` | Loading, Empty, Populated, Accordion Expanded, Optimistic Viewed | Trung bình (Medium) |
| **MIG-10** | `SCR-013` | Account Tab Screen | **P0** | Profile Bloc, MenuRow | `lib/features/account/presentation/pages/account_tab.dart` | Loading, Populated, Profile Details, Menu Navigation | Thấp (Low) |
| **MIG-11** | DLG-02 | Logout Confirmation Dialog | **P0** | `SCR-013`, Auth Bloc | `lib/features/account/presentation/widgets/logout_dialog.dart` | Confirming, Submitting, Session Clear | Thấp (Low) |

---

### Giai Đoạn 3: Quản Lý Đơn Từ & Tính Toán Công Động (Requests & Calculation)

| Mã Task | Screen ID | Tên Màn Hình / Module | Ưu Tiên | Phụ Thuộc | File Flutter Mục Tiêu | Trạng Thái UI Cần Triển Khai | Mức Độ Rủi Ro |
|---|---|---|---|---|---|---|---|
| **MIG-12** | `SCR-010` | Requests Tab Screen | **P0** | Requests Bloc, SegmentedControl | `lib/features/requests/presentation/pages/requests_tab.dart` | Loading, Empty, Populated, Filter Switching (All/Leave/OT) | Trung bình (Medium) |
| **MIG-13** | `SCR-011` | Request Creation Modal | **P0** | `SCR-010`, Modal Sheet | `lib/features/requests/presentation/widgets/request_creation_modal.dart` | Form Leave, Form OT, Debounced Preview, Validation, Submitting | **Cao (High)** (Phức tạp nghiệp vụ tính công) |

---

### Giai Đoạn 4: Bảng Điều Khiển & Đọc Dữ Liệu Chấm Công (Dashboard & Attendance Read)

| Mã Task | Screen ID | Tên Màn Hình / Module | Ưu Tiên | Phụ Thuộc | File Flutter Mục Tiêu | Trạng Thái UI Cần Triển Khai | Mức Độ Rủi Ro |
|---|---|---|---|---|---|---|---|
| **MIG-14** | `SCR-008` | Overview Dashboard Tab | **P0** | Overview Bloc, TodayShiftCard | `lib/features/overview/presentation/pages/overview_tab.dart` | Loading, Partial Failure, Populated, Quick Links | Trung bình (Medium) |
| **MIG-15** | `SCR-009` | Attendance Read & History | **P0** | Attendance Bloc, TimelinePoint | `lib/features/attendance/presentation/pages/attendance_tab.dart` | Today Hero, Leave Interval, Month Picker, Day Card List | Trung bình (Medium) |

---

### Giai Đoạn 5: Phần Cứng & Luồng Chấm Công Đa Tầng (Hardware & Punch Pipeline)

| Mã Task | Screen ID | Tên Màn Hình / Module | Ưu Tiên | Phụ Thuộc | File Flutter Mục Tiêu | Trạng Thái UI Cần Triển Khai | Mức Độ Rủi Ro |
|---|---|---|---|---|---|---|---|
| **MIG-16** | PUNCH-01 | Wi-Fi BSSID Matching | **P0** | `network_info_plus` | `lib/core/services/hardware/wifi_service.dart` | Fetching BSSID, Permission Denied, Matched, Fallback | **Cao (High)** (Yêu cầu quyền Location trên Android 10+) |
| **MIG-17** | PUNCH-02 | GPS Geofencing Fix | **P0** | `geolocator` | `lib/core/services/hardware/location_service.dart` | High Accuracy Fix, Out of Range, Permission Denied | Trung bình (Medium) |
| **MIG-18** | PUNCH-03 | Camera Selfie Capture | **P0** | `image_picker` / `camera` | `lib/core/services/hardware/camera_service.dart` | Launch Camera, Captured Preview, Cancelled, Upload | Trung bình (Medium) |
| **MIG-19** | PUNCH-04 | Multi-tier Fallback Coordinator | **P0** | MIG-16, 17, 18, Attendance Bloc | `lib/features/attendance/domain/services/punch_coordinator.dart` | Wi-Fi -> GPS -> Selfie Fallback, `SELFIE_REQUIRED` Catch | **Cao (High)** |

---

### Giai Đoạn 6: Đồng Bộ Thời Gian Thực & Vòng Đời Ứng Dụng (Realtime & Lifecycle)

| Mã Task | Screen ID | Tên Màn Hình / Module | Ưu Tiên | Phụ Thuộc | File Flutter Mục Tiêu | Trạng Thái UI Cần Triển Khai | Mức Độ Rủi Ro |
|---|---|---|---|---|---|---|---|
| **MIG-20** | RT-01 | Socket.io Realtime Client | **P1** | `socket_io_client` | `lib/core/services/realtime/socket_client.dart` | Connect `/events`, Listen punch/leave/payslip, Auto Reconnect | Trung bình (Medium) |
| **MIG-21** | RT-02 | AppLifecycle Foreground Resume | **P1** | `AppLifecycleListener` | `lib/app/lifecycle_observer.dart` | Catch `resumed` -> Trigger BLoC Refresh Events | Thấp (Low) |

---

## 3. Ma Trận Quản Trị Rủi Ro Kỹ Thuật (Risk Matrix)

| Rủi Ro Kỹ Thuật | Tác Động | Khả Năng Xảy Ra | Biện Pháp Khắc Phục (Mitigation Strategy) |
|---|---|---|---|
| **Không đọc được BSSID Wi-Fi trên Android 10+ / iOS 13+** | Không thể tự động xác thực qua Wi-Fi | Cao | Hệ thống tự động bắt lỗi và chuyển tầng tiếp theo: kích hoạt định vị GPS Geofence mà không làm gián đoạn người dùng. Cung cấp hướng dẫn bật quyền "Vị trí chính xác" (Fine Location). |
| **Cookie phiên HttpOnly bị thất lạc trên mobile** | Bị đăng xuất liên tục | Trung bình | Sử dụng `dio_cookie_manager` kết hợp lưu trữ `PersistCookieJar` trong thư mục tài liệu an toàn của ứng dụng (`path_provider`). |
| **Nghẽn mạng khi gọi preview ca làm liên tục** | Lag form tạo đơn nghỉ phép | Thấp | Áp dụng RxDart `debounceTime(Duration(milliseconds: 250))` trước khi gửi yêu cầu preview lên backend. |

