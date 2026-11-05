# CORESTAFF — FLUTTER SCREEN DESIGN SPECIFICATIONS
## Đặc Tả Kỹ Thuật Chi Tiết Từng Màn Hình Di Động

> **Tài liệu tham chiếu:** `FLUTTER_DESIGN_MASTER.md`, `FLUTTER_SCREEN_INVENTORY.md`  
> **Kiến trúc mục tiêu:** Flutter 3.x, Dart 3.x, BLoC Pattern, Clean Architecture  
> **Phạm vi kiểm toán:** 13 màn hình & luồng giao diện hoàn chỉnh (`SCR-001` đến `SCR-013`)  
> **Ngôn ngữ chuẩn giao diện:** 100% Tiếng Việt  

---

# MỤC LỤC DANH MỤC ĐẶC TẢ

1. [SCR-001: Splash / Bootstrap Screen](#scr-001-splash--bootstrap-screen)
2. [SCR-002: Connection Error Screen](#scr-002-connection-error-screen)
3. [SCR-003: Login Screen](#scr-003-login-screen)
4. [SCR-004: Forgot Password Screen](#scr-004-forgot-password-screen)
5. [SCR-005: Reset Password Screen](#scr-005-reset-password-screen)
6. [SCR-006: Change Password Screen (Forced / Voluntary)](#scr-006-change-password-screen)
7. [SCR-007: Blocked Role Notice Screen](#scr-007-blocked-role-notice-screen)
8. [SCR-008: Overview Dashboard Tab](#scr-008-overview-dashboard-tab)
9. [SCR-009: Attendance Tab & Punch Flow](#scr-009-attendance-tab--punch-flow)
10. [SCR-010: Requests Tab Screen](#scr-010-requests-tab-screen)
11. [SCR-011: Request Creation Modal Sheet](#scr-011-request-creation-modal-sheet)
12. [SCR-012: Payslips Tab Screen](#scr-012-payslips-tab-screen)
13. [SCR-013: Account Tab Screen & Logout Flow](#scr-013-account-tab-screen--logout-flow)

---

## SCR-001: Splash / Bootstrap Screen

### A. Screen Identity
- **Screen ID:** `SCR-001`
- **Canonical Name:** Splash / Bootstrap Screen
- **Type:** Full-page System Screen
- **Route / Nav Path:** `app://bootstrap`
- **RN Source Component:** `LoadingScreen` in `App.tsx:67-69`
- **Target Flutter File:** `lib/features/auth/presentation/pages/splash_page.dart`

### B. Purpose & User Journey
- **Mục đích:** Hiển thị nhận diện thương hiệu CoreStaff trong khi ứng dụng khởi tạo hệ thống ngầm: kiểm tra kết nối API backend (`resolveApiBase`) và thẩm định tính hợp lệ của phiên đăng nhập hiện hữu (`GET /api/auth/me`).
- **User Journey:** Người dùng mở app → Xem logo CoreStaff và vòng quay loading → Tự động chuyển tiếp vào màn hình Đăng nhập (`SCR-003`), Màn hình đổi pass bắt buộc (`SCR-006`), hoặc Bảng điều khiển chính (`SCR-008`) nếu phiên làm việc còn hiệu lực.

### C. Layout & Information Architecture
- **Widget Tree:**
  ```
  Scaffold (backgroundColor: AppColors.bgDefault)
  └── SafeArea
      └── Center
          └── Column (mainAxisAlignment: MainAxisAlignment.center)
              ├── AppLogo(large: true)
              ├── SizedBox(height: 34)
              ├── CircularProgressIndicator(color: AppColors.primary)
              ├── SizedBox(height: 12)
              └── Text('Đang kết nối hệ thống…', style: AppTypography.bodySmall)
  ```
- **Safe Area:** Áp dụng toàn diện cho cả thanh trạng thái (`StatusBar.dark`) và thanh điều hướng đáy.

### D. Visual Design Specification
- **Màu nền:** `AppColors.bgDefault` (`#F6F8FC`).
- **Logo Mark:** Kích thước `64x64 dp`, `borderRadius: 20 dp`, nền `AppColors.primary` (`#2563EB`), chữ cái "C" in hoa màu trắng cỡ `32 dp` trọng số `FontWeight.w800`.
- **Chữ thương hiệu:** "CoreStaff", cỡ chữ `28 dp`, màu `AppColors.textPrimary` (`#0F172A`), `FontWeight.w800`.
- **Loading Indicator:** Vòng xoay tròn Material, đường kính `32 dp`, màu `AppColors.primary`.

### E. Component Inventory
| Tên Component | Vai Trò UI | Quy Cách Trực Quan | Hành Vi / Tương Tác | Trạng Thái Hỗ Trợ |
|---|---|---|---|---|
| `AppLogo(large: true)` | Nhận diện thương hiệu | Icon chữ "C" nổi bật kèm text | Tĩnh, không tương tác | Mặc định |
| `CircularProgressIndicator` | Báo tiến trình kết nối | Vòng xoay vô hạn | Tự động quay | Đang kết nối |
| `StatusLabel` | Thông điệp người dùng | Chữ xám dịu mắt 14 dp | Hiển thị thông báo trạng thái | Mặc định |

### F. Complete State Machine & UI States
1. **Uninitialized:** Hiển thị màn hình trắng trong microsecond đầu tiên.
2. **Loading / Connecting (Default):** Hiển thị Logo + Vòng quay + "Đang kết nối hệ thống…".
3. **Connection Failure:** Chuyển ngay sang `SCR-002` (Connection Error).
4. **Session Valid (mustChangePassword = false):** Chuyển ngay sang `SCR-008` (Home Overview).
5. **Session Valid (mustChangePassword = true):** Chuyển ngay sang `SCR-006` (Change Password).
6. **Session Expired / Unauthenticated:** Chuyển ngay sang `SCR-003` (Login).

### G. User Interactions & Transitions
- Màn hình tự động điều hướng không cần người dùng chạm. Thời gian chờ kiểm tra mạng tối đa 8 giây trước khi kích hoạt timeout sang `SCR-002`.

### H. Backend Integration & Data Mapping
- **Endpoints:**
  - `GET /api/auth/me`
- **Headers:** Kèm Cookie phiên đăng nhập (`sid`, `rt`).
- **Response Handling:**
  - `200 OK`: Trả về `AuthUser { id, email, fullName, role, mustChangePassword, ... }`.
  - `401 Unauthorized`: Phiên hết hạn → điều hướng `SCR-003`.
  - `NetworkException`: Lỗi kết nối mạng → điều hướng `SCR-002`.

### I. Flutter Technical Architecture
- **Bloc:** `AuthBloc`
- **Event:** `AuthCheckStatusRequested`
- **State:** `AuthLoading`, `Authenticated(user)`, `Unauthenticated`, `AuthConnectionFailed(message)`
- **Repository:** `AuthRepository.getCurrentUser()`

### J. Acceptance Criteria
- **Given** người dùng mở ứng dụng và điện thoại có kết nối internet tốt và phiên đăng nhập còn hạn,
- **When** màn hình Bootstrap tải xong,
- **Then** ứng dụng tự động chuyển thẳng vào màn hình Tổng quan (`SCR-008`) trong vòng dưới 1.5 giây mà không nhấp nháy giao diện.

---

## SCR-002: Connection Error Screen

### A. Screen Identity
- **Screen ID:** `SCR-002`
- **Canonical Name:** Connection Error Screen
- **Type:** Full-page Error State
- **Route / Nav Path:** `app://connection-error`
- **RN Source Component:** `ConnectionError` in `App.tsx:71-73`
- **Target Flutter File:** `lib/features/auth/presentation/pages/connection_error_page.dart`

### B. Purpose & User Journey
- **Mục đích:** Thông báo rõ ràng cho nhân viên khi ứng dụng không thể kết nối tới máy chủ backend CoreStaff (do mất mạng internet, sai cấu hình máy chủ, hoặc backend đang bảo trì) kèm cơ chế bấm nút thử kết nối lại.
- **User Journey:** Người dùng mở app khi mất mạng → Màn hình hiện icon cảnh báo đỏ và thông điệp lỗi → Người dùng bật lại Wi-Fi/4G và bấm "Thử kết nối lại" → Hệ thống quay lại Bootstrap kiểm tra.

### C. Layout & Information Architecture
- **Widget Tree:**
  ```
  Scaffold (backgroundColor: AppColors.bgDefault)
  └── SafeArea
      └── Padding (all: 28)
          └── Center
              └── Column (mainAxisAlignment: MainAxisAlignment.center)
                  ├── Container (errorIcon: 56x56, circle, bg: #FEE2E2)
                  │   └── Text('!', color: #DC2626, size: 28, weight: 800)
                  ├── SizedBox(height: 16)
                  ├── Text('Không thể kết nối', style: AppTypography.titleLarge)
                  ├── SizedBox(height: 8)
                  ├── Text(errorMessage, style: AppTypography.bodySmall, textAlign: center)
                  ├── SizedBox(height: 24)
                  └── AppButton(label: 'Thử kết nối lại', onPressed: onRetry)
  ```

### D. Visual Design Specification
- **Biểu tượng lỗi:** Hình tròn đường kính `56 dp`, màu nền đỏ nhạt `AppColors.dangerSoft` (`#FEE2E2`), viền không có, chứa ký tự dấu chấm than "!" màu đỏ đậm `AppColors.danger` (`#DC2626`) cỡ `28 dp`.
- **Tiêu đề lỗi:** "Không thể kết nối", phông cỡ `22 dp`, in đậm `FontWeight.w800`, màu `AppColors.textPrimary`.
- **Mô tả lỗi:** Chiều rộng tối đa `340 dp`, màu `AppColors.textMuted`, chiều cao dòng `1.5`.
- **Nút hành động chính:** Nền xanh `AppColors.primary`, bo góc `12 dp`, chiều cao `50 dp`.

### E. Component Inventory
| Tên Component | Vai Trò UI | Quy Cách Trực Quan | Hành Vi / Tương Tác | Trạng Thái Hỗ Trợ |
|---|---|---|---|---|
| `ErrorIconCircle` | Báo hiệu lỗi nghiêm trọng | Vòng tròn đỏ nhạt chứa dấu "!" | Tĩnh | Mặc định |
| `StateTitle` | Tiêu đề thông báo | Text 22 dp bold | Tĩnh | Mặc định |
| `StateMessage` | Chi tiết lỗi | Text 14 dp muted | Co giãn theo nội dung | Mặc định |
| `AppButton` | Nút kích hoạt thử lại | Nút chính màu xanh | Chạm để gọi lại `bootstrap()` | Normal, Pressed, Loading |

### F. Complete State Machine & UI States
- **Idle / Error Displayed:** Hiển thị thông điệp lỗi và nút thử lại sẵn sàng.
- **Retrying / Submitting:** Nút bấm hiển thị vòng quay loading nhỏ, vô hiệu hóa chạm liên tục.
- **Resolved:** Tự động điều hướng về `SCR-001`.

### G. Flutter Technical Architecture
- **Bloc:** `AuthBloc`
- **Event:** `AuthBootstrapRetryRequested`
- **State:** `AuthConnectionFailed(message)`
- **Widget:** `ConnectionErrorPage`

### H. Acceptance Criteria
- **Given** người dùng bật chế độ máy bay và mở app,
- **When** ứng dụng không kết nối được tới server,
- **Then** màn hình hiển thị tiêu đề "Không thể kết nối" và nút "Thử kết nối lại"; khi tắt chế độ máy bay và bấm nút, app kết nối lại thành công.

---

## SCR-003: Login Screen

### A. Screen Identity
- **Screen ID:** `SCR-003`
- **Canonical Name:** Login Screen
- **Type:** Full-page Auth Screen
- **Route / Nav Path:** `app://login`
- **RN Source Component:** `LoginScreen` in `App.tsx:83-92`
- **Target Flutter File:** `lib/features/auth/presentation/pages/login_page.dart`

### B. Purpose & User Journey
- **Mục đích:** Cổng xác thực danh tính cho toàn bộ nhân viên và quản lý bằng định dạng Email công ty hoặc Mã nhân viên (ví dụ: `NV-0248`) kết hợp Mật khẩu cá nhân.
- **User Journey:** Người dùng chưa đăng nhập → Nhập mã nhân viên và mật khẩu → Bấm "Đăng nhập" → Hệ thống xác thực → Vào Bảng điều khiển (`SCR-008`) hoặc Đổi mật khẩu bắt buộc (`SCR-006`).

### C. Layout & Information Architecture
- **Widget Tree:**
  ```
  Scaffold (backgroundColor: AppColors.bgDefault)
  └── SafeArea
      └── SingleChildScrollView (keyboardShouldPersistTaps: handled)
          └── Padding (horizontal: 22, vertical: 32)
              └── Column
                  ├── AppLogo()
                  ├── SizedBox(height: 22)
                  ├── HeaderSection (Eyebrow: "ỨNG DỤNG NHÂN VIÊN", Title: "Chào mừng trở lại", Description)
                  ├── SizedBox(height: 20)
                  ├── AppCard (padding: 20, borderRadius: 20)
                  │   ├── if (error != null) ErrorBanner(message: error)
                  │   ├── AppTextField(label: 'Email hoặc mã nhân viên', placeholder: 'VD: NV-0248')
                  │   ├── AppTextField(label: 'Mật khẩu', isPassword: true, trailing: TogglePasswordButton)
                  │   ├── Align(alignment: Alignment.centerRight, child: LinkButton('Quên mật khẩu?'))
                  │   ├── AppButton(label: 'Đăng nhập', isLoading: isBusy, onPressed: submit)
                  │   └── Align(alignment: Alignment.center, child: LinkButton('Bạn đã có mã đặt lại mật khẩu?'))
                  ├── SizedBox(height: 20)
                  └── Text('Phiên đăng nhập được tự động làm mới khi bạn còn dùng; dừng quá 14 ngày thì cần đăng nhập lại.', style: AppTypography.caption)
  ```

### D. Visual Design Specification
- **Card Form:** Nền trắng `AppColors.surface`, viền `AppColors.border` 1 dp, bo góc `20 dp`, đổ bóng `BoxShadow(color: Color(0x0F0F172A), offset: Offset(0, 8), blurRadius: 18)`.
- **Typography:**
  - Eyebrow: `AppTypography.eyebrow` (11 dp, w800, letterSpacing 1.4, màu `AppColors.primary`).
  - Title: Cỡ chữ `30 dp`, `FontWeight.w800`, màu `AppColors.textPrimary`.
  - Description: Cỡ chữ `14 dp`, `FontWeight.w400`, màu `AppColors.textMuted`.
- **Khoảng cách (Spacing):** Khoảng cách giữa các ô nhập trong card là `16 dp`. Chiều cao nút đăng nhập tối thiểu `50 dp`.

### E. Component Inventory
| Tên Component | Vai Trò UI | Quy Cách Trực Quan | Hành Vi / Tương Tác | Trạng Thái Hỗ Trợ |
|---|---|---|---|---|
| `AppLogo` | Nhận diện thương hiệu | Kích thước vừa (34x34 dp) | Tĩnh | Mặc định |
| `ErrorBanner` | Cảnh báo sai thông tin | Nền `#FEF2F2`, viền `#FECACA`, chữ đỏ `#B91C1C` | Xuất hiện khi có lỗi | Ẩn, Hiển thị |
| `AppTextField` | Trường nhập tài khoản | Chiều cao 50 dp, bo góc 12 dp | Nhập text, tự động unfocus | Normal, Focused, Error, Disabled |
| `AppTextField` (Pass) | Trường nhập mật khẩu | Kèm nút Hiện/Ẩn mắt phải | Ẩn ký tự `••••••` hoặc hiện rõ | Normal, Focused, Obscured, Revealed |
| `LinkButton` (Right) | Quên mật khẩu | Chữ xanh 13 dp bold, canh phải | Chạm mở `SCR-004` | Normal, Pressed |
| `LinkButton` (Center)| Có mã đặt lại mật khẩu | Chữ xám 13 dp w600, canh giữa | Chạm mở `SCR-005` | Normal, Pressed |
| `AppButton` | Nút Đăng nhập | Nền xanh `AppColors.primary`, chữ trắng bold 15 dp | Chạm gửi form, xoay tròn khi đang xử lý | Normal, Pressed, Loading, Disabled |

### F. Complete State Machine & UI States
1. **Initial / Pristine:** Cả hai trường trống, nút bấm khả dụng nhưng form chưa submit.
2. **Editing / Dirty:** Người dùng đang gõ, lỗi cũ tự động xóa.
3. **Validation Error (Client):** Bỏ trống email hoặc mật khẩu → Hiện banner "Vui lòng nhập email/mã nhân viên và mật khẩu."
4. **Submitting / Network Busy:** Nút Đăng nhập hiện vòng quay loading, hai trường input bị vô hiệu hóa (`enabled = false`).
5. **Auth Failure (Server):** Sai thông tin hoặc tài khoản bị khóa → Hiện banner lỗi tiếng Việt tương ứng từ backend.
6. **Password Change Required:** Đăng nhập thành công nhưng `mustChangePassword === true` → Chuyển sang `SCR-006`.
7. **Role Blocked:** Đăng nhập thành công nhưng role là `HR` hoặc `SYSTEM_ADMIN` → Chuyển sang `SCR-007`.
8. **Auth Success:** Vào thẳng `SCR-008`.

### G. Form & Input Specifications
- **Trường Tài khoản (`identifier`):**
  - Không viết hoa tự động (`autoCapitalize: TextCapitalization.none`).
  - Không tự sửa lỗi (`autocorrect: false`).
  - Bàn phím: `TextInputType.emailAddress`.
- **Trường Mật khẩu (`password`):**
  - Mặc định ẩn ký tự (`obscureText: true`).
  - Nút bấm đuôi: "Hiện" hoặc "Ẩn" với vùng chạm tối thiểu 44x44 dp.

### H. Backend Integration & Data Mapping
- **Endpoint:** `POST /api/auth/login`
- **Request Body:**
  ```json
  {
    "identifier": "NV-0248",
    "password": "Password123!"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "user": {
      "id": "usr_123",
      "email": "nam@anphat.vn",
      "employeeCode": "NV-0248",
      "fullName": "Nguyễn Văn Nam",
      "role": "EMPLOYEE",
      "mustChangePassword": false
    },
    "mustChangePassword": false
  }
  ```
- **Error Codes:** `400` Thiếu dữ liệu, `401` Sai thông tin xác thực, `423` Tài khoản bị khóa tạm thời sau 5 lần nhập sai.

### I. Flutter Technical Architecture
- **Bloc:** `AuthBloc`
- **Events:** `AuthLoginSubmitted(identifier, password)`, `AuthErrorDismissed`
- **States:** `AuthInitial`, `AuthSubmitting`, `Authenticated(user, mustChangePassword)`, `AuthFailure(errorMessage)`
- **Target File:** `lib/features/auth/presentation/pages/login_page.dart`

### J. Acceptance Criteria
- **Given** người dùng đang ở màn hình Đăng nhập,
- **When** người dùng để trống ô mật khẩu và bấm "Đăng nhập",
- **Then** màn hình hiển thị Banner đỏ thông báo "Vui lòng nhập email/mã nhân viên và mật khẩu." mà không gửi request lên server.
- **Given** người dùng nhập đúng tài khoản có cờ `mustChangePassword = true`,
- **When** xác thực thành công,
- **Then** hệ thống điều hướng trực tiếp đến màn hình Đổi mật khẩu bắt buộc (`SCR-006`).

---

## SCR-004: Forgot Password Screen

### A. Screen Identity
- **Screen ID:** `SCR-004`
- **Canonical Name:** Forgot Password Screen
- **Type:** Full-page Auth Screen
- **Route / Nav Path:** `app://forgot`
- **RN Source Component:** `ForgotScreen` in `App.tsx:94-98`
- **Target Flutter File:** `lib/features/auth/presentation/pages/forgot_password_page.dart`

### B. Purpose & User Journey
- **Mục đích:** Cho phép nhân viên yêu cầu nhận email chứa mã khôi phục mật khẩu khi bị quên.
- **User Journey:** Người dùng bấm "Quên mật khẩu?" tại Login → Nhập email công ty → Bấm "Gửi hướng dẫn" → Nhận thông báo thành công → Bấm "Nhập mã đặt lại" để mở `SCR-005`.

### C. Layout & Information Architecture
- **Widget Tree:**
  ```
  AuthLayout (Eyebrow: "KHÔI PHỤC TÀI KHOẢN", Title: "Quên mật khẩu", Description: "Nếu tài khoản tồn tại, hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu.")
  └── AppCard
      ├── if (error != null) ErrorBanner(message: error)
      ├── if (isSent) ...[
      │     SuccessBanner(message: "Yêu cầu đã được tiếp nhận. Hãy kiểm tra email của bạn."),
      │     SizedBox(height: 16),
      │     AppButton(label: "Nhập mã đặt lại", onPressed: navigateToReset)
      │   ] else ...[
      │     AppTextField(label: 'Email đăng nhập', placeholder: 'ten@congty.vn', keyboardType: emailAddress),
      │     SizedBox(height: 16),
      │     AppButton(label: 'Gửi hướng dẫn', isLoading: isBusy, onPressed: submit)
      │   ],
      ├── SizedBox(height: 12),
      └── AppButton.secondary(label: 'Quay lại đăng nhập', onPressed: navigateBack)
  ```

### D. Visual Design Specification
- Theo quy chuẩn `AuthLayout` chung: Nền `AppColors.bgDefault`, Card bo góc `20 dp`.
- Banner thông báo thành công: Nền xanh lá nhạt `AppColors.successSoft` (`#F0FDF4`), viền `#BBF7D0`, chữ xanh đậm `#166534`.

### E. Backend Integration & Data Mapping
- **Endpoint:** `POST /api/auth/forgot-password`
- **Request Body:** `{ "email": "nam@anphat.vn" }`
- **Response `200 OK`:** `{ "success": true }`

### F. Flutter Technical Architecture
- **Bloc / Cubit:** `ForgotPasswordCubit`
- **Target File:** `lib/features/auth/presentation/pages/forgot_password_page.dart`

### G. Acceptance Criteria
- **Given** người dùng nhập email hợp lệ và bấm gửi,
- **When** API trả về thành công,
- **Then** form chuyển sang trạng thái đã gửi kèm Banner xanh và nút chuyển nhanh đến màn hình Đặt lại mật khẩu (`SCR-005`).

---

## SCR-005: Reset Password Screen

### A. Screen Identity
- **Screen ID:** `SCR-005`
- **Canonical Name:** Reset Password Screen
- **Type:** Full-page Auth Screen
- **Route / Nav Path:** `app://reset`
- **RN Source Component:** `ResetScreen` in `App.tsx:100-104`
- **Target Flutter File:** `lib/features/auth/presentation/pages/reset_password_page.dart`

### B. Purpose & User Journey
- **Mục đích:** Cho phép người dùng nhập mã token nhận từ email để thiết lập mật khẩu mới và khôi phục quyền truy cập.
- **User Journey:** Người dùng mở `SCR-005` → Nhập mã token, mật khẩu mới và mật khẩu xác nhận → Bấm "Đặt lại mật khẩu" → Nhận thông báo thành công → Bấm "Về trang đăng nhập".

### C. Layout & Information Architecture
- **Widget Tree:**
  ```
  AuthLayout (Eyebrow: "BẢO MẬT TÀI KHOẢN", Title: "Đặt lại mật khẩu", Description: "Nhập mã trong email và tạo mật khẩu mới cho tài khoản.")
  └── AppCard
      ├── if (error != null) ErrorBanner(message: error)
      ├── if (isDone) ...[
      │     SuccessBanner(message: "Mật khẩu đã được cập nhật. Bạn có thể đăng nhập lại."),
      │     SizedBox(height: 16),
      │     AppButton(label: "Về trang đăng nhập", onPressed: navigateToLogin)
      │   ] else ...[
      │     AppTextField(label: 'Mã đặt lại mật khẩu', placeholder: 'Dán mã từ email'),
      │     AppTextField(label: 'Mật khẩu mới', isPassword: true, placeholder: 'Ít nhất 8 ký tự, gồm chữ và số'),
      │     AppTextField(label: 'Xác nhận mật khẩu', isPassword: true),
      │     AppButton(label: 'Đặt lại mật khẩu', isLoading: isBusy, onPressed: submit),
      │     AppButton.secondary(label: 'Hủy và quay lại', onPressed: navigateBack)
      │   ]
  ```

### D. Validation Rules
- Mã token không được rỗng (`token.trim().isNotEmpty`).
- Mật khẩu mới tối thiểu 8 ký tự.
- Mật khẩu xác nhận phải trùng khớp (`password === confirm`).

### E. Backend Integration & Data Mapping
- **Endpoint:** `POST /api/auth/reset-password`
- **Request Body:** `{ "token": "string", "newPassword": "string" }`
- **Response `200 OK`:** `{ "success": true }`

### F. Flutter Technical Architecture
- **Bloc / Cubit:** `ResetPasswordCubit`
- **Target File:** `lib/features/auth/presentation/pages/reset_password_page.dart`

---

## SCR-006: Change Password Screen (Forced / Voluntary)

### A. Screen Identity
- **Screen ID:** `SCR-006`
- **Canonical Name:** Change Password Screen
- **Type:** Full-page Auth & Security Screen
- **Route / Nav Path:** `app://change-password`
- **RN Source Component:** `ChangePasswordScreen` in `App.tsx:106-110`
- **Target Flutter File:** `lib/features/auth/presentation/pages/change_password_page.dart`

### B. Purpose & User Journey
- **Mục đích:** Xử lý 2 tình huống đổi mật khẩu:
  1. **Bắt buộc lần đầu (`forced = true`):** Quản trị viên cấp tài khoản mới kèm mật khẩu tạm; người dùng không thể bỏ qua hoặc truy cập các chức năng khác cho đến khi đổi thành công.
  2. **Tự nguyện (`forced = false`):** Người dùng chủ động đổi mật khẩu định kỳ từ tab Tài khoản (`SCR-013`). Có nút "Để sau" để hủy bỏ thao tác.

### C. Layout & Information Architecture
- **Widget Tree:**
  ```
  AuthLayout (
    eyebrow: forced ? 'YÊU CẦU BẢO MẬT' : 'TÀI KHOẢN',
    title: 'Đổi mật khẩu',
    description: forced ? 'Bạn cần đổi mật khẩu tạm thời trước khi tiếp tục.' : 'Cập nhật mật khẩu để bảo vệ tài khoản.'
  )
  └── AppCard
      ├── if (forced) NoticeBox(message: 'Đây là mật khẩu tạm thời do quản trị viên cấp.')
      ├── if (error != null) ErrorBanner(message: error)
      ├── AppTextField(label: 'Mật khẩu hiện tại', isPassword: true)
      ├── AppTextField(label: 'Mật khẩu mới', isPassword: true, placeholder: 'Ít nhất 8 ký tự, gồm chữ và số')
      ├── AppTextField(label: 'Xác nhận mật khẩu mới', isPassword: true)
      ├── AppButton(label: 'Cập nhật mật khẩu', isLoading: isBusy, onPressed: submit)
      └── if (!forced) AppButton.secondary(label: 'Để sau', onPressed: onCancel)
  ```

### D. Visual Design Specification
- **Hộp thông báo bắt buộc (`NoticeBox`):** Nền xanh dương nhạt `#EFF6FF`, viền `#BFDBFE`, chữ xanh đậm `#1E40AF`, cỡ chữ 13 dp.

### E. Backend Integration & Data Mapping
- **Endpoint:** `POST /api/auth/change-password`
- **Request Body:**
  ```json
  {
    "currentPassword": "TempPassword123!",
    "newPassword": "NewSecurePassword456@",
    "confirmPassword": "NewSecurePassword456@"
  }
  ```
- **Xử lý đặc biệt:** Nếu trả về `401 Unauthorized` (phiên hết hạn trong lúc đang đổi pass) → kích hoạt `onSessionExpired` quay về màn hình Login `SCR-003`.

### F. Flutter Technical Architecture
- **Bloc / Cubit:** `ChangePasswordBloc`
- **Target File:** `lib/features/auth/presentation/pages/change_password_page.dart`

---

## SCR-007: Blocked Role Notice Screen

### A. Screen Identity
- **Screen ID:** `SCR-007`
- **Canonical Name:** Blocked Role Notice Screen
- **Type:** Full-page Warning Screen
- **Route / Nav Path:** `app://blocked-role`
- **RN Source Component:** `isBlockedRole` condition in `App.tsx:117-129`
- **Target Flutter File:** `lib/features/auth/presentation/pages/blocked_role_page.dart`

### B. Purpose & User Journey
- **Mục đích:** Ngăn chặn các tài khoản có vai trò `HR` hoặc `SYSTEM_ADMIN` sử dụng ứng dụng di động; hướng dẫn họ truy cập cổng Web Portal chuyên dụng để quản trị nhân sự và hệ thống.
- **User Journey:** Người dùng HR đăng nhập trên mobile → Màn hình chặn xuất hiện → Người dùng đọc hướng dẫn → Bấm "Đăng xuất" để trở về màn hình Login.

### C. Layout & Information Architecture
- **Widget Tree:**
  ```
  Scaffold (backgroundColor: AppColors.bgDefault)
  └── SafeArea
      └── Padding (all: 28)
          └── Center
              └── Column (mainAxisAlignment: MainAxisAlignment.center)
                  ├── Container (errorIcon: 56x56, bg: #FEE2E2)
                  │   └── Text('!', color: #DC2626, size: 28, weight: 800)
                  ├── SizedBox(height: 16)
                  ├── Text('Cổng quản trị Web', style: AppTypography.titleLarge)
                  ├── SizedBox(height: 8)
                  ├── Text('Tài khoản vai trò Nhân sự (HR) / Quản trị hệ thống (System Admin) cần sử dụng cổng quản trị web.', style: AppTypography.bodySmall, textAlign: center)
                  ├── if (error != null) ErrorBanner(message: error)
                  ├── SizedBox(height: 24)
                  └── AppButton(label: 'Đăng xuất', isLoading: isBusy, onPressed: signOut)
  ```

### D. Flutter Technical Architecture
- **Widget:** `BlockedRolePage(user: AuthUser)`
- **Event:** `AuthLogoutRequested`
- **Target File:** `lib/features/auth/presentation/pages/blocked_role_page.dart`

---

## SCR-008: Overview Dashboard Tab

### A. Screen Identity
- **Screen ID:** `SCR-008`
- **Canonical Name:** Overview Dashboard Tab
- **Type:** Bottom Navigation Tab Screen (Tab 1)
- **Route / Nav Path:** `app://home/overview`
- **RN Source Component:** `OverviewScreen` in `OverviewScreen.tsx:1-66`
- **Target Flutter File:** `lib/features/overview/presentation/pages/overview_tab.dart`

### B. Purpose & User Journey
- **Mục đích:** Bảng điều khiển cá nhân hóa trung tâm cho nhân viên mỗi ngày: nắm bắt ca làm việc hôm nay, trạng thái chấm công hiện tại, các việc cần chú ý (đơn chờ duyệt, phiếu lương mới chưa xem) và lối tắt truy cập nhanh.
- **User Journey:** Mở app → Đọc ca làm hôm nay (Ví dụ: Ca Hành Chính 08:00 - 17:30 tại Văn phòng Tòa A) → Bấm vào nút ca làm để chuyển sang Chấm công (`SCR-009`) → Hoặc kiểm tra các cảnh báo đơn từ và phiếu lương.

### C. Layout & Information Architecture
- **Widget Tree:**
  ```
  Scaffold (backgroundColor: AppColors.bgDefault)
  └── RefreshIndicator (onRefresh: loadData)
      └── SingleChildScrollView (physics: AlwaysScrollableScrollPhysics())
          └── Padding (horizontal: 22, top: 28, bottom: 40)
              └── Column
                  ├── HeaderRow:
                  │   ├── Column:
                  │   │   ├── Text('KHÔNG GIAN CÁ NHÂN', style: AppTypography.eyebrow)
                  │   │   ├── Text('Chào bạn,', style: AppTypography.caption)
                  │   │   └── Text(user.fullName, style: AppTypography.titleLarge)
                  │   └── AvatarBox(initials: 'NN')
                  ├── SizedBox(height: 16)
                  ├── if (error != null) ErrorBanner(message: error)
                  ├── if (isLoading) LoadingBlock() else TodayShiftCard(dark: true)
                  │   ├── ShiftName + StatusBadge
                  │   ├── ShiftHours - WorkplaceName
                  │   ├── TimeRow: Vào ca (HH:mm) | Ra ca (HH:mm)
                  │   └── ActionRow: 'Mở chấm công để vào ca' ›
                  ├── SizedBox(height: 20)
                  ├── Text('Cần bạn chú ý', style: AppTypography.titleSmall)
                  ├── SizedBox(height: 12)
                  ├── MetricRow:
                  │   ├── MetricBox(count: pendingRequests, label: 'Đơn đang chờ', tone: warning)
                  │   └── MetricBox(count: newPayslips, label: 'Phiếu lương mới', tone: blue)
                  ├── SizedBox(height: 20)
                  ├── Text('Truy cập nhanh', style: AppTypography.titleSmall)
                  ├── SizedBox(height: 12)
                  ├── QuickRow(icon: fingerprint, title: 'Chấm công & lịch sử', desc: 'Vào ca, ra ca và theo dõi ngày công')
                  ├── QuickRow(icon: calendar, title: 'Nghỉ phép & tăng ca', desc: 'Tạo mới và xem trạng thái phê duyệt')
                  └── QuickRow(icon: wallet, title: 'Phiếu lương & thu nhập', desc: 'Xem chi tiết các kỳ lương đã phát hành')
  ```

### D. Visual Design Specification
- **Thẻ Dark Ca Làm (`TodayShiftCard`):** Nền `AppColors.navy` (`#172554`), bo góc `20 dp`, padding `20 dp`.
  - Phân cách thời gian vào/ra bằng đường kẻ mỏng độ trong suốt `10% white`.
  - Số giờ vào/ra ca: Cỡ `22 dp` bold màu trắng.
- **Hộp Thống Kê Chú Ý (`MetricBox`):**
  - Chiều cao tối thiểu `92 dp`, bo góc `16 dp`, padding `16 dp`.
  - Cảnh báo đơn (`warning`): Nền `#FFFBEB`, viền `#FDE68A`.
  - Phiếu lương mới (`blue`): Nền `#EFF6FF`, viền `#BFDBFE`.
  - Số lượng lớn: Cỡ chữ `24 dp` `FontWeight.w800`.
- **Hàng Lối Tắt (`QuickRow`):**
  - Chiều cao tối thiểu `76 dp`, nền trắng, viền `#E2E8F0`, bo góc `16 dp`.
  - Icon bọc trong hộp vuông `38x38 dp` màu xanh nhạt `AppColors.primarySoft`.

### E. Backend Integration & Data Mapping
- **Các API gọi đồng thời qua `Promise.allSettled`:**
  1. `GET /api/attendance/me/today` → `TodayAttendance`
  2. `GET /api/leave/me` → Lọc số đơn có `status === 'PENDING_MANAGER'`
  3. `GET /api/overtime/me` → Lọc số đơn có `status === 'PENDING' || 'CLARIFICATION_REQUESTED'`
  4. `GET /api/payslips/me` → Lọc số kỳ có `status === 'RELEASED'`
- **Tự động làm mới:** Kích hoạt lại khi `realtimeRevision` tăng (qua Socket `/events` hoặc khi quay lại app).

### F. Flutter Technical Architecture
- **Bloc:** `OverviewBloc`
- **Events:** `OverviewLoadStarted`, `OverviewRefreshed`
- **States:** `OverviewLoading`, `OverviewLoaded(today, pendingCount, newPayslipCount)`, `OverviewFailure(error)`
- **Target File:** `lib/features/overview/presentation/pages/overview_tab.dart`

---

## SCR-009: Attendance Tab & Punch Flow

### A. Screen Identity
- **Screen ID:** `SCR-009`
- **Canonical Name:** Attendance Tab & Punch Flow
- **Type:** Bottom Navigation Tab Screen (Tab 3 - Central Highlight) + Native Flow
- **Route / Nav Path:** `app://home/attendance`
- **RN Source Component:** `AttendanceScreen` in `AttendanceScreen.tsx:1-147`
- **Target Flutter File:** `lib/features/attendance/presentation/pages/attendance_tab.dart`

### B. Purpose & User Journey
- **Mục đích:** Trung tâm ghi nhận thời gian làm việc hàng ngày của nhân viên với cơ chế kiểm thực đa tầng nghiêm ngặt (Wi-Fi BSSID -> GPS Geofence -> Ảnh chụp Selfie) và theo dõi lịch sử chấm công cả tháng.
- **User Journey:**
  1. Mở tab Chấm công (nút nổi bật chính giữa thanh điều hướng đáy).
  2. Xem ca làm hôm nay, địa điểm văn phòng, mốc thời gian vào/ra ca.
  3. Bấm "Xác nhận vào ca" hoặc "Xác nhận ra ca".
  4. Hệ thống hiện hộp thoại xác nhận `AlertDialog`.
  5. Nếu ca trong văn phòng (`IN_OFFICE`): Kiểm tra BSSID Wi-Fi trước. Nếu trùng khớp -> ghi nhận thành công tức thì.
  6. Nếu Wi-Fi không khớp hoặc không có: Kiểm tra GPS Geofence (Haversine). Nếu hợp lệ -> ghi nhận.
  7. Nếu ngoài phạm vi công ty hoặc ca ngoài văn phòng (`OUT_OFFICE`): Mở camera chụp ảnh selfie gửi quản lý duyệt ngoại lệ.
  8. Ghi nhận thành công -> Cập nhật timeline tức thì và hiển thị banner thành công.

### C. Layout & Information Architecture
- **Widget Tree:**
  ```
  Scaffold (backgroundColor: AppColors.bgDefault)
  └── RefreshIndicator (onRefresh: loadData)
      └── SingleChildScrollView
          └── Padding (horizontal: 22, top: 28, bottom: 40)
              └── Column
                  ├── ScreenHeader(eyebrow: 'CHẤM CÔNG', title: 'Ngày làm việc', desc: 'Ghi nhận thời gian và theo dõi công của bạn.')
                  ├── if (error != null) ErrorBanner(message: error)
                  ├── if (success != null) SuccessBanner(message: success)
                  ├── AttendanceHeroCard (dark: true)
                  │   ├── TopRow: ShiftName + ShiftHours + StatusBadge
                  │   ├── WorkplaceText: WorkplaceName - Address
                  │   ├── Timeline: [Vào ca (dot/time)] ───line─── [Ra ca (dot/time)]
                  │   ├── AppButton(label: actionLabel, isLoading: submitting, onPressed: confirmSubmit)
                  │   └── if (isOutOffice) Text('Ca ngoài văn phòng có thể yêu cầu vị trí hoặc selfie...')
                  ├── if (attendanceRequirements != null) LeaveIntervalCard (green)
                  │   ├── 'Nghỉ phép đã được HR áp dụng'
                  │   ├── Thời gian nghỉ: approvedLeaveIntervals (approvedLeaveMinutes)
                  │   ├── Thời gian còn phải làm: requiredWorkingIntervals (requiredWorkingMinutes)
                  │   └── Khung chấm công hiệu lực: effectiveCheckInTime – effectiveCheckOutTime
                  ├── if (pendingLeave != null) PendingLeaveCard (amber)
                  ├── MetricGrid: [Giờ làm (phút)] | [Đi muộn (phút)] | [Về sớm (phút)]
                  ├── MonthHeader: Tiêu đề 'Lịch sử tháng' + [‹] Tháng MM/YYYY [›]
                  ├── MonthSummaryRow: [Ngày công] | [Đi muộn] | [OT (giờ)]
                  └── MonthDayList:
                      ├── if (items.isEmpty) EmptyHistoryCard
                      └── for (day in items) DayCard:
                          ├── TopRow: Ngày/tháng + Giờ vào-ra + StatusBadge
                          └── MetaRow: Thời gian làm + Muộn Xp + Về sớm Yp + OT Zp
  ```

### D. Visual Design Specification
- **Timeline Vào/Ra Ca:**
  - Điểm mốc: Hình tròn đường kính `13 dp`, viền `2 dp`. Khi đã ghi nhận (`active = true`), viền xanh `#86EFAC`, nền xanh lá `AppColors.success`.
  - Đường nối: Chiều cao `2 dp`. Đổi sang màu xanh lá khi đã check-out hoàn tất.
- **Thẻ Khung Giờ Nghỉ Phép HR Áp Dụng (`LeaveIntervalCard`):** Nền xanh lá nhạt `AppColors.successSoft`, viền `AppColors.success`, tiêu đề chữ xanh đậm `FontWeight.w800`.
- **Thẻ Lịch Sử Ngày Công (`DayCard`):** Nền trắng, viền `#E2E8F0`, bo góc `16 dp`. Các thẻ tag cảnh báo (Muộn: chữ cam, Về sớm: chữ đỏ, OT: chữ xanh đậm).

### E. Multi-tier Punch Pipeline Logic
```dart
// Thứ tự thẩm định đa tầng đồng bộ với React Native & NestJS Backend:
if (workplaceType == 'OUT_OFFICE') {
  final selfie = await takeSelfie();
  if (selfie == null) return; // User hủy camera
  await punch({ selfieUri: selfie });
} else {
  final wifiFirst = assignment.hasWifiNetworks != false;
  final wifi = wifiFirst ? await currentWifi() : {};
  if (!(wifiFirst && await tryPunch({ wifi }))) {
    // Không khớp Wi-Fi -> Chuyển sang GPS
    notify('Chưa xác thực được Wi-Fi công ty. Đang kiểm tra vị trí GPS…');
    final location = await currentLocation();
    if (!(await tryPunch({ location, wifi }))) {
      // Ngoài phạm vi GPS -> Bắt buộc chụp selfie ngoại lệ
      notify('Vị trí ngoài phạm vi công ty. Chụp ảnh selfie để gửi quản lý duyệt.');
      final selfie = await takeSelfie();
      if (selfie == null) return;
      await punch({ location, selfie, wifi });
    }
  }
}
```

### F. Backend Integration & Data Mapping
- **Endpoints:**
  - `GET /api/attendance/me/today`
  - `GET /api/attendance/me/history?month=YYYY-MM`
  - `POST /api/attendance/me/punch`
    - Payload:
      ```json
      {
        "action": "CHECK_IN", // hoặc "CHECK_OUT"
        "workMode": "IN_OFFICE", // hoặc "OUT_OFFICE"
        "location": { "latitude": 10.7769, "longitude": 106.7009, "accuracyMeters": 15 },
        "wifi": { "ssid": "CoreStaff_Corp", "bssid": "00:14:22:01:23:45" },
        "selfieUri": "file:///path/to/selfie.jpg"
      }
      ```
- **Mã lỗi đặc biệt:** `SELFIE_REQUIRED` (mã HTTP 400 kèm code `SELFIE_REQUIRED`).

### G. Flutter Technical Architecture
- **Bloc:** `AttendanceBloc`
- **Events:** `AttendanceLoaded`, `AttendanceMonthChanged(newMonth)`, `AttendancePunchSubmitted(action)`
- **States:** `AttendanceInitial`, `AttendanceLoading`, `AttendanceSuccess(today, history)`, `AttendancePunching`, `AttendanceFailure(message)`
- **Target File:** `lib/features/attendance/presentation/pages/attendance_tab.dart`

---

## SCR-010: Requests Tab Screen

### A. Screen Identity
- **Screen ID:** `SCR-010`
- **Canonical Name:** Requests Tab Screen
- **Type:** Bottom Navigation Tab Screen (Tab 2)
- **Route / Nav Path:** `app://home/requests`
- **RN Source Component:** `RequestsScreen` in `RequestsScreen.tsx:1-53`
- **Target Flutter File:** `lib/features/requests/presentation/pages/requests_tab.dart`

### B. Purpose & User Journey
- **Mục đích:** Trung tâm quản lý các đơn từ hành chính của nhân viên: đơn xin nghỉ phép (phép năm, không lương) và đơn đăng ký làm thêm giờ (OT). Cung cấp bộ lọc theo trạng thái và nút tạo mới.
- **User Journey:** Người dùng mở tab Đơn từ → Xem danh sách các yêu cầu gần đây sắp xếp theo thời gian mới nhất → Bấm nút (+) trên Header hoặc chọn thẻ "Xin nghỉ phép" / "Đăng ký tăng ca" để mở Sheet tạo đơn (`SCR-011`) → Theo dõi phản hồi phê duyệt của quản lý.

### C. Layout & Information Architecture
- **Widget Tree:**
  ```
  Scaffold (backgroundColor: AppColors.bgDefault)
  └── RefreshIndicator (onRefresh: loadRequests)
      └── SingleChildScrollView
          └── Padding (horizontal: 22, top: 28, bottom: 40)
              └── Column
                  ├── ScreenHeader(
                  │     eyebrow: 'ĐƠN TỪ', title: 'Yêu cầu của tôi', desc: 'Tạo và theo dõi phê duyệt nghỉ phép, tăng ca.',
                  │     action: AddIconButton(onPressed: openLeaveModal)
                  │   )
                  ├── if (error != null) ErrorBanner(message: error)
                  ├── if (success != null) SuccessBanner(message: success)
                  ├── ActionRow (2 cột):
                  │   ├── ActionCard(icon: calendar, title: 'Xin nghỉ phép', desc: 'Có lương hoặc không lương')
                  │   └── ActionCard(icon: time, title: 'Đăng ký tăng ca', desc: 'Hệ thống tự phân loại OT')
                  ├── SizedBox(height: 16)
                  ├── SegmentedControl: ['Tất cả', 'Nghỉ phép', 'Tăng ca']
                  ├── SizedBox(height: 16)
                  ├── SectionHeader: 'Hoạt động gần đây' ── Badge('X yêu cầu')
                  ├── SizedBox(height: 12)
                  ├── if (isLoading) LoadingBlock()
                  ├── else if (rows.isEmpty) EmptyState(icon: checkmark, title: 'Chưa có yêu cầu')
                  └── else for (item in filteredRows) item.isLeave ? LeaveCard : OvertimeCard
  ```

### D. Visual Design Specification
- **Thẻ Action Nhanh (`ActionCard`):** Nền trắng, viền `#E2E8F0`, bo góc `16 dp`, padding `16 dp`. Icon màu xanh thương hiệu trong vòng tròn xanh nhạt.
- **Bộ Lọc Phân Đoạn (`SegmentedControl`):** Chiều cao `44 dp`, bo góc `12 dp`, nền xám `#E2E8F0`, tab active nền trắng chữ xanh đậm kèm shadow nhẹ.
- **Thẻ Đơn Từ (`LeaveCard` / `OvertimeCard`):**
  - Icon phân loại: Nghỉ phép = Icon Lịch màu xanh lá; Tăng ca = Icon Đồng hồ màu xanh dương.
  - Hiển thị phản hồi phê duyệt của quản lý (`reviewComment`) trong ô xám nhạt dưới chân thẻ nếu có.

### E. Backend Integration & Data Mapping
- **Endpoints:**
  - `GET /api/leave/me` → `LeaveRequest[]`
  - `GET /api/overtime/me` → `OvertimeRequest[]`
- **Sắp xếp hiển thị:** Hợp nhất danh sách và sắp xếp giảm dần theo thời gian tạo (`createdAt`).

### F. Flutter Technical Architecture
- **Bloc:** `RequestsBloc`
- **Events:** `RequestsLoadStarted`, `RequestsFilterChanged(filter)`
- **States:** `RequestsLoading`, `RequestsLoaded(leaves, overtime, filter)`, `RequestsFailure(error)`
- **Target File:** `lib/features/requests/presentation/pages/requests_tab.dart`

---

## SCR-011: Request Creation Modal Sheet

### A. Screen Identity
- **Screen ID:** `SCR-011`
- **Canonical Name:** Request Creation Modal Sheet
- **Type:** Modal Bottom Sheet
- **Route / Nav Path:** `app://home/requests/create`
- **RN Source Component:** `RequestModal` in `RequestsScreen.tsx:54-137`
- **Target Flutter File:** `lib/features/requests/presentation/widgets/request_creation_modal.dart`

### B. Purpose & User Journey
- **Mục đích:** Biểu mẫu linh động tạo đơn xin nghỉ phép hoặc đăng ký tăng ca. Đối với đơn nghỉ phép, tự động gọi API preview để tính toán số phút và số ngày công bị trừ theo ca làm việc thực tế trước khi gửi.
- **User Journey:** Người dùng chọn loại đơn → Nhập ngày/giờ → Hệ thống hiển thị hộp tính công động (`ShiftPreviewBox`) → Nhập lý do (tối thiểu 10 ký tự) → Bấm "Gửi đơn" → Modal đóng lại và cập nhật danh sách ở `SCR-010`.

### C. Layout & Information Architecture
- **Widget Tree:**
  ```
  showModalBottomSheet (isScrollControlled: true, shape: RoundedTop(20))
  └── KeyboardAvoidingPadding
      └── SingleChildScrollView
          └── Padding (horizontal: 20, vertical: 20)
              └── Column
                  ├── ModalHandleBar (width: 40, height: 4, bg: #CBD5E1)
                  ├── HeaderRow: Tiêu đề 'Đơn nghỉ phép' / 'Đăng ký tăng ca' + CloseButton
                  ├── if (error != null) ErrorBanner(message: error)
                  ├── if (type == 'leave') ...[
                  │     SegmentedControl: ['Có lương', 'Không lương'],
                  │     DurationGrid (4 nút): ['Cả ngày', 'Buổi sáng', 'Buổi chiều', 'Theo giờ'],
                  │     Row: [Từ ngày] [Đến ngày],
                  │     if (durationType == 'CUSTOM_HOURS') Row: [Từ giờ] [Đến giờ],
                  │     ShiftPreviewBox: Hiển thị kết quả tính từ ca làm việc (ca bắt đầu, nghỉ trưa, ngày phép trừ...),
                  │   ] else ...[
                  │     Field: [Ngày tăng ca],
                  │     Row: [Bắt đầu] [Kết thúc],
                  │     Field: [Mô tả công việc] (multiline),
                  │     Field: [Lý do khai báo muộn] (nếu sau hạn chốt),
                  │   ],
                  ├── Field: [Lý do] (multiline, tối thiểu 10 ký tự),
                  ├── InfoNote: Giải thích quy trình phê duyệt của Quản lý và HR,
                  ├── AppButton(label: 'Gửi yêu cầu', isLoading: isBusy, onPressed: submit),
                  └── AppButton.secondary(label: 'Hủy', onPressed: close)
  ```

### D. Dynamic Shift Preview Logic
- **Cơ chế Debounce:** Khi người dùng thay đổi ngày bắt đầu, ngày kết thúc hoặc khoảng giờ lẻ, modal tự động debounce `250ms` trước khi gọi `POST /api/leave/me/preview`.
- **Hiển thị Preview Box:**
  - Nền xám nhạt `#F8FAFC`, viền `#E2E8F0`, bo góc `12 dp`.
  - Hiển thị ca làm: `08:00–17:30`, Nghỉ trưa: `12:00–13:30`.
  - Kết quả: `Tổng: 480 phút · 1.000 ngày phép`.

### E. Validation Rules
- Lý do bắt buộc tối thiểu 10 ký tự (`reason.trim().length >= 10`).
- Định dạng ngày chuẩn ISO `YYYY-MM-DD`.
- Đơn nghỉ một phần ngày (`MORNING_HALF`, `AFTERNOON_HALF`, `CUSTOM_HOURS`) bắt buộc Ngày bắt đầu trùng Ngày kết thúc.
- Giờ kết thúc phải lớn hơn giờ bắt đầu.

### F. Backend Integration & Data Mapping
- **Endpoints:**
  - `POST /api/leave/me/preview`
  - `POST /api/leave/me`
  - `POST /api/overtime/me`

### G. Flutter Technical Architecture
- **Bloc / Cubit:** `RequestFormCubit`
- **Target File:** `lib/features/requests/presentation/widgets/request_creation_modal.dart`

---

## SCR-012: Payslips Tab Screen

### A. Screen Identity
- **Screen ID:** `SCR-012`
- **Canonical Name:** Payslips Tab Screen
- **Type:** Bottom Navigation Tab Screen (Tab 4)
- **Route / Nav Path:** `app://home/payslips`
- **RN Source Component:** `PayslipsScreen` in `PayslipsScreen.tsx:1-120`
- **Target Flutter File:** `lib/features/payslips/presentation/pages/payslips_tab.dart`

### B. Purpose & User Journey
- **Mục đích:** Tra cứu thu nhập, tiền lương thực nhận và chi tiết các khoản khấu trừ (BHXH, BHYT, BHTN, thuế TNCN) minh bạch theo từng kỳ lương đã được HR phát hành.
- **User Journey:** Mở tab Phiếu lương → Xem Thẻ Tối (Dark Card) hiển thị kỳ gần nhất và số tiền thực nhận → Xem danh sách các kỳ lương dạng Accordion Card → Chạm vào một kỳ lương để mở rộng chi tiết phân rã tài chính → Ứng dụng tự động đánh dấu kỳ lương là đã xem (`VIEWED`).

### C. Layout & Information Architecture
- **Widget Tree:**
  ```
  Scaffold (backgroundColor: AppColors.bgDefault)
  └── RefreshIndicator (onRefresh: loadPayslips)
      └── SingleChildScrollView
          └── Padding (horizontal: 22, top: 28, bottom: 40)
              └── Column
                  ├── ScreenHeader(eyebrow: 'THU NHẬP', title: 'Phiếu lương', desc: 'Theo dõi thu nhập và các khoản khấu trừ của bạn.')
                  ├── if (error != null) ErrorBanner(message: error)
                  ├── SummaryDarkCard (AppColors.navy):
                  │   ├── TopRow: 'KỲ GẦN NHẤT' + 'Tháng MM/YYYY' + Badge unread ('X mới')
                  │   ├── Label: 'Thực nhận'
                  │   ├── Value: FormatMoney(netSalary) (30 dp bold white)
                  │   └── Meta: 'Phát hành DD/MM/YYYY'
                  ├── SizedBox(height: 20)
                  ├── SectionHeader: 'Lịch sử phiếu lương' ── Badge('X kỳ')
                  ├── SizedBox(height: 12)
                  ├── if (isLoading) LoadingBlock()
                  ├── else if (items.isEmpty) EmptyState(icon: wallet, title: 'Chưa có phiếu lương')
                  └── else for (item in items) PayslipAccordionCard(item, isExpanded, onTap: () => toggle(item))
  ```

### D. Visual Design Specification
- **Thẻ Accordion Phiếu Lương (`PayslipAccordionCard`):**
  - Trạng thái thu gọn: Hiển thị Kỳ lương, Ngày phát hành, StatusBadge (`RELEASED` / `VIEWED`), Hộp thực nhận màu xanh đậm, Dòng chữ gợi ý "Chạm để xem chi tiết".
  - Trạng thái mở rộng (`isExpanded = true`):
    - `Tổng thu nhập (Gross)`
    - `Bảo hiểm (BHXH, BHYT, BHTN)` (số âm màu đỏ `#B91C1C`)
    - `Thuế TNCN` (số âm màu đỏ)
    - `Khấu trừ khác`
    - Đường kẻ chia cắt `Divider`
    - `Thực nhận (Net)` in đậm cỡ lớn.

### E. Optimistic Status Update Logic
- Khi người dùng chạm mở thẻ phiếu lương có `status === 'RELEASED'`:
  1. Cập nhật state nội bộ ngay lập tức sang `VIEWED`.
  2. Giảm số đếm badge chưa xem.
  3. Gửi lời gọi ngầm không chặn: `POST /api/payslips/me/:id/viewed`.
  4. Nếu API thất bại, người dùng vẫn xem được chi tiết mà không bị chặn giao diện.

### F. Backend Integration & Data Mapping
- **Endpoints:**
  - `GET /api/payslips/me` → `Payslip[]`
  - `POST /api/payslips/me/:id/viewed` → `{ success: true }`

### G. Flutter Technical Architecture
- **Bloc:** `PayslipsBloc`
- **Events:** `PayslipsLoaded`, `PayslipViewedMarked(id)`
- **States:** `PayslipsLoading`, `PayslipsLoaded(items, expandedId)`, `PayslipsFailure(error)`
- **Target File:** `lib/features/payslips/presentation/pages/payslips_tab.dart`

---

## SCR-013: Account Tab Screen & Logout Flow

### A. Screen Identity
- **Screen ID:** `SCR-013`
- **Canonical Name:** Account Tab Screen & Logout Flow
- **Type:** Bottom Navigation Tab Screen (Tab 5) + Dialog
- **Route / Nav Path:** `app://home/account`
- **RN Source Component:** `AccountScreen` in `AccountScreen.tsx:1-63`
- **Target Flutter File:** `lib/features/account/presentation/pages/account_tab.dart`

### B. Purpose & User Journey
- **Mục đích:** Quản lý thông tin hồ sơ nhân viên (phòng ban, chức danh, quản lý trực tiếp, nơi làm việc, ngày vào làm), cung cấp các tiện ích cá nhân (tra cứu phiếu lương, đổi mật khẩu) và đăng xuất khỏi tài khoản an toàn.
- **User Journey:** Mở tab Tài khoản → Kiểm tra thông tin chức danh / phòng ban → Chọn "Đổi mật khẩu" để mở `SCR-006` → Hoặc bấm "Đăng xuất" màu đỏ → Hệ thống hiện hộp thoại xác nhận → Thoát phiên an toàn và trở về màn hình Đăng nhập `SCR-003`.

### C. Layout & Information Architecture
- **Widget Tree:**
  ```
  Scaffold (backgroundColor: AppColors.bgDefault)
  └── RefreshIndicator (onRefresh: loadProfile)
      └── SingleChildScrollView
          └── Padding (horizontal: 22, top: 28, bottom: 40)
              └── Column
                  ├── ScreenHeader(eyebrow: 'TÀI KHOẢN', title: 'Hồ sơ cá nhân', desc: 'Thông tin công việc và bảo mật tài khoản.')
                  ├── if (error != null) ErrorBanner(message: error)
                  ├── if (logoutError != null) ErrorBanner(message: logoutError)
                  ├── HeroProfileSection:
                  │   ├── AvatarLarge(initials: 'NN', size: 78x78, radius: 25)
                  │   ├── FullName (21 dp bold)
                  │   ├── EmployeeCode (12 dp muted)
                  │   └── StatusBadge(employmentStatus)
                  ├── SizedBox(height: 16)
                  ├── InfoCard:
                  │   ├── InfoRow('Phòng ban', departmentName)
                  │   ├── Divider()
                  │   ├── InfoRow('Chức danh', positionName)
                  │   ├── Divider()
                  │   ├── InfoRow('Quản lý trực tiếp', managerName)
                  │   ├── Divider()
                  │   ├── InfoRow('Nơi làm việc', workplaceName)
                  │   ├── Divider()
                  │   └── InfoRow('Ngày vào làm', joinDate)
                  ├── SizedBox(height: 20)
                  ├── Text('Tiện ích cá nhân', style: AppTypography.titleSmall)
                  ├── SizedBox(height: 12)
                  ├── MenuRow(icon: wallet, title: 'Phiếu lương', desc: 'X kỳ lương đã phát hành', badge: unreadCount, onTap: openPayslips)
                  ├── MenuRow(icon: lock, title: 'Đổi mật khẩu', desc: 'Cập nhật thông tin bảo mật', onTap: openChangePassword)
                  ├── SizedBox(height: 20)
                  ├── ContactCard:
                  │   ├── Text('Thông tin liên hệ', style: AppTypography.titleSmall)
                  │   ├── InfoRow('Email', email)
                  │   ├── Divider()
                  │   ├── InfoRow('Số điện thoại', phone)
                  │   ├── Divider()
                  │   └── InfoRow('Địa chỉ', address)
                  ├── SizedBox(height: 24)
                  └── AppButton.danger(label: 'Đăng xuất', isLoading: logoutBusy, onPressed: confirmLogout)
  ```

### D. Logout Dialog Specification
- **Trigger:** Người dùng bấm nút "Đăng xuất" màu đỏ.
- **Dialog Spec:**
  - Tiêu đề: "Xác nhận đăng xuất"
  - Nội dung: "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản trên thiết bị này?"
  - Nút Hủy: Nền trắng, chữ xám đậm.
  - Nút Xác nhận: Nền đỏ `AppColors.danger`, chữ trắng bold.

### E. Backend Integration & Data Mapping
- **Endpoints:**
  - `GET /api/employee/me/profile` → `EmployeeProfile`
  - `GET /api/payslips/me` → Đếm số kỳ lương phát hành
  - `POST /api/auth/logout` → Xóa HttpOnly Cookies

### F. Flutter Technical Architecture
- **Bloc:** `ProfileBloc`, `AuthBloc`
- **Events:** `ProfileLoaded`, `AuthLogoutRequested`
- **States:** `ProfileLoading`, `ProfileLoaded(profile, payslips)`, `ProfileFailure(error)`
- **Target File:** `lib/features/account/presentation/pages/account_tab.dart`

---
