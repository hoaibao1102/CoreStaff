# CORESTAFF — COMPLETE MOBILE SCREEN INVENTORY
## Flutter UI/UX Migration Audit & Catalog

> **Tài liệu nguồn kiểm toán:** `Apps/mobile` (React Native / Expo 57, React Native 0.86)  
> **Mục tiêu di chuyển:** `Apps/mobile_flutter` (Flutter 3.x, Dart 3.x, BLoC Architecture)  
> **Trạng thái:** Hoàn tất kiểm toán mã nguồn thực tế 100%  
> **Phạm vi đối tượng:** Nhân viên (`EMPLOYEE`) & Quản lý bộ phận (`DEPARTMENT_MANAGER`)  
> **Thời điểm kiểm toán:** Tháng 11/2026  

---

## 1. Cấu Trúc Điều Hướng React Native Thực Tế

Kiểm toán toàn diện tại `Apps/mobile/App.tsx`, `Apps/mobile/src/screens/*.tsx`, và `Apps/mobile/src/components/*.tsx` cho thấy ứng dụng React Native sử dụng cơ chế **State-driven Navigation** (quản lý điều hướng qua React State ở cấp Root `AppContent` và `EmployeeHome`), kết hợp với Modal Sheets và Alert Dialogs hệ thống.

### 1.1 Quản Lý Trạng Thái Cấp Gốc (`AppContent` — `App.tsx:21-65`)
- **Trạng thái kết nối & Khởi động:**
  - `connecting: boolean`: Quản lý trạng thái bootstrap kiểm tra URL máy chủ (`resolveApiBase()`) và lấy thông tin phiên hiện tại (`getCurrentUser()`).
  - `connectionError: string | null`: Lưu thông báo lỗi nếu không kết nối được máy chủ backend.
- **Trạng thái phiên & Xác thực:**
  - `screen: 'login' | 'forgot' | 'reset' | 'change-password' | 'home'`
  - `user: AuthUser | null`: Dữ liệu nhân viên đang đăng nhập.
  - `forcedPasswordChange: boolean`: Kích hoạt khi cờ `mustChangePassword === true` (tài khoản cấp mới bởi quản trị viên).
- **Trạng thái Shell Đã Đăng Nhập (`EmployeeHome` — `App.tsx:112-138`):**
  - `activeTab: 'overview' | 'requests' | 'attendance' | 'payslips' | 'account'`
  - `realtimeRevision: number`: Bộ đếm tăng dần khi nhận socket `/events` hoặc khi app chuyển từ background sang foreground (`AppState.addEventListener('change')`).
  - `isBlockedRole: boolean`: Chặn vai trò `HR` hoặc `SYSTEM_ADMIN` truy cập mobile shell.

---

## 2. Bảng Danh Mục Màn Hình & Luồng Giao Diện (Screen Inventory Table)

Toàn bộ ứng dụng React Native bao gồm **13 màn hình và luồng giao diện riêng biệt**:

| Screen ID | Tên Màn Hình / Flow | Loại Giao Diện | Đường Dẫn / Route Nội Bộ | RN Source Component | Vị Trí File Nguồn (Lines) | Phân Quyền Vai Trò | Điểm Vào (Entry Points) | Điểm Ra (Exit Points) | Mục Đích Chính | Hành Động Người Dùng | Phụ Thuộc API Backend | Trạng Thái Flutter Target |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **SCR-001** | Splash / Bootstrap Screen | Full-page System | `app://bootstrap` | `LoadingScreen` | `App.tsx:67-69` | Mọi vai trò | Khởi chạy App | SCR-002, SCR-003, SCR-006, SCR-008 | Hiển thị thương hiệu và kiểm tra trạng thái phiên | Chờ hệ thống tự động kiểm tra | `GET /api/auth/me` | ⏳ Chưa hoàn thiện |
| **SCR-002** | Connection Error Screen | Full-page Error | `app://connection-error` | `ConnectionError` | `App.tsx:71-73` | Mọi vai trò | Lỗi bootstrap / Mất kết nối API | SCR-001 (Thử lại) | Thông báo lỗi không kết nối được backend | Bấm "Thử kết nối lại" | `resolveApiBase()` | ⏳ Chưa hoàn thiện |
| **SCR-003** | Login Screen | Full-page Auth | `app://login` | `LoginScreen` | `App.tsx:83-92` | Khách / Chưa đăng nhập | Khởi động, Đăng xuất, Hết hạn phiên | SCR-004, SCR-005, SCR-006, SCR-008 | Xác thực danh tính người dùng | Nhập email/mã NV, mật khẩu; Ẩn/Hiện pass; Đăng nhập; Chuyển Quên pass | `POST /api/auth/login` | ⏳ Đã có khung UI |
| **SCR-004** | Forgot Password Screen | Full-page Auth | `app://forgot` | `ForgotScreen` | `App.tsx:94-98` | Khách / Người dùng quên pass | Link "Quên mật khẩu?" tại SCR-003 | SCR-003 (Quay lại), SCR-005 (Nhập mã) | Yêu cầu gửi mã khôi phục qua email | Nhập email; Bấm gửi hướng dẫn; Bấm chuyển sang nhập mã | `POST /api/auth/forgot-password` | ⏳ Chưa hoàn thiện |
| **SCR-005** | Reset Password Screen | Full-page Auth | `app://reset` | `ResetScreen` | `App.tsx:100-104` | Khách / Có mã đặt lại | Link từ SCR-003 hoặc SCR-004 | SCR-003 (Về đăng nhập) | Xác thực mã token và đặt mật khẩu mới | Dán mã token, nhập pass mới, xác nhận pass, gửi form | `POST /api/auth/reset-password` | ⏳ Chưa hoàn thiện |
| **SCR-006** | Change Password Screen | Full-page Auth/Security | `app://change-password` | `ChangePasswordScreen` | `App.tsx:106-110` | Người dùng đăng nhập | SCR-003 (khi `mustChangePassword`), SCR-013 (Cài đặt) | SCR-008 (Đổi xong hoặc Để sau), SCR-003 (Hết phiên) | Đổi mật khẩu bắt buộc hoặc tự nguyện | Nhập mật khẩu hiện tại, mật khẩu mới, xác nhận; Lưu / Bỏ qua | `POST /api/auth/change-password` | ⏳ Chưa hoàn thiện |
| **SCR-007** | Blocked Role Notice Screen | Full-page Warning | `app://blocked-role` | `isBlockedRole` block in `EmployeeHome` | `App.tsx:117-129` | `HR`, `SYSTEM_ADMIN` | Đăng nhập với tài khoản HR/Admin | SCR-003 (Đăng xuất) | Ngăn tài khoản HR/Admin thao tác trên mobile, hướng dẫn dùng Web | Bấm "Đăng xuất" | `POST /api/auth/logout` | ⏳ Chưa hoàn thiện |
| **SCR-008** | Overview Dashboard Tab | Bottom Tab Screen | `app://home/overview` | `OverviewScreen` | `OverviewScreen.tsx:1-66` | `EMPLOYEE`, `DEPARTMENT_MANAGER` | Đăng nhập thành công, Tab bar, Quick back | SCR-009, SCR-010, SCR-012 | Bảng điều khiển cá nhân: ca làm hôm nay, chỉ số chú ý, truy cập nhanh | Kéo làm mới; Xem giờ vào/ra; Chạm mở Chấm công, Đơn từ, Phiếu lương | `GET /api/attendance/me/today`, `GET /api/leave/me`, `GET /api/overtime/me`, `GET /api/payslips/me` | ⏳ Đã có khung UI |
| **SCR-009** | Attendance Tab & Punch Flow | Bottom Tab Screen + Native Flow | `app://home/attendance` | `AttendanceScreen` | `AttendanceScreen.tsx:1-147` | `EMPLOYEE`, `DEPARTMENT_MANAGER` | Tab bar "Chấm công", Action từ SCR-008 | Camera selfie native, Alert dialog | Ghi nhận chấm công (Wi-Fi, GPS, Selfie) và xem lịch sử tháng | Xác nhận vào/ra ca; Chụp ảnh selfie; Đổi tháng lịch sử; Kéo làm mới | `GET /api/attendance/me/today`, `POST /api/attendance/me/punch`, `GET /api/attendance/me/history?month=YYYY-MM` | ⏳ Đã có khung UI |
| **SCR-010** | Requests Tab Screen | Bottom Tab Screen | `app://home/requests` | `RequestsScreen` | `RequestsScreen.tsx:1-53` | `EMPLOYEE`, `DEPARTMENT_MANAGER` | Tab bar "Đơn từ", Action từ SCR-008 | SCR-011 (Modal tạo đơn) | Quản lý danh sách đơn xin nghỉ phép và đăng ký tăng ca | Lọc danh sách (Tất cả / Nghỉ phép / Tăng ca); Kéo làm mới; Bấm tạo đơn | `GET /api/leave/me`, `GET /api/overtime/me` | ⏳ Đã có khung UI |
| **SCR-011** | Request Creation Modal Sheet | Modal Bottom Sheet | `app://home/requests/create` | `RequestModal` | `RequestsScreen.tsx:54-137` | `EMPLOYEE`, `DEPARTMENT_MANAGER` | Nút "+" hoặc thẻ Action từ SCR-010 | SCR-010 (Đóng modal / Gửi thành công) | Biểu mẫu tạo mới đơn nghỉ phép (có preview ca làm) hoặc tăng ca | Chọn loại đơn; Nhập ngày/giờ; Xem preview trừ công; Nhập lý do; Gửi đơn | `POST /api/leave/me/preview`, `POST /api/leave/me`, `POST /api/overtime/me` | ⏳ Chưa hoàn thiện |
| **SCR-012** | Payslips Tab Screen | Bottom Tab Screen | `app://home/payslips` | `PayslipsScreen` | `PayslipsScreen.tsx:1-120` | `EMPLOYEE`, `DEPARTMENT_MANAGER` | Tab bar "Phiếu lương", Action từ SCR-008, SCR-013 | Mở rộng chi tiết thẻ lương | Tra cứu thu nhập, phân rã lương Gross, bảo hiểm, PIT, lương Net | Kéo làm mới; Chạm mở rộng/thu gọn chi tiết phân rã kỳ lương | `GET /api/payslips/me`, `POST /api/payslips/me/:id/viewed` | ⏳ Đã có khung UI |
| **SCR-013** | Account Tab Screen & Logout | Bottom Tab Screen + Dialog | `app://home/account` | `AccountScreen` | `AccountScreen.tsx:1-63` | `EMPLOYEE`, `DEPARTMENT_MANAGER` | Tab bar "Tài khoản" | SCR-006, SCR-012, SCR-003 (Đăng xuất) | Xem hồ sơ nhân sự, tiện ích bảo mật, đăng xuất an toàn | Xem chi tiết hợp đồng, phòng ban; Bấm mở đổi pass, phiếu lương; Bấm đăng xuất | `GET /api/employee/me/profile`, `GET /api/payslips/me`, `POST /api/auth/logout` | ⏳ Đã có khung UI |

---

## 3. Bản Đồ Đồ Thị Điều Hướng (Navigation Graphs)

### 3.1 Luồng Xác Thực & Khởi Động Ứng Dụng (Auth Navigation Graph)

```
                    ┌─────────────────────────┐
                    │       App Launch        │
                    └────────────┬────────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │  SCR-001: Bootstrap   │
                     │    (LoadingScreen)    │
                     └───────────┬───────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
            ▼                    ▼                    ▼
     [Network Failed]     [Valid Session]     [Unauthenticated]
            │                    │                    │
            ▼                    │                    ▼
┌───────────────────────┐        │         ┌───────────────────────┐
│ SCR-002: Conn Error   │        │         │   SCR-003: Login      │
│   (Thử kết nối lại)   │        │         └───────────┬───────────┘
└───────────┬───────────┘        │                     │
            │ (Retry)            │         ┌───────────┴───────────┐
            └────────────────────┤         ▼                       ▼
                                 │  ┌───────────────┐     ┌───────────────┐
                                 │  │ SCR-004:      │     │ SCR-005:      │
                                 │  │ Quên mật khẩu │     │ Đặt lại mật   │
                                 │  └───────┬───────┘     │ khẩu          │
                                 │          │             └───────┬───────┘
                                 │          └──────────┬──────────┘
                                 │                     ▼
                                 │             [Nhập mã đặt lại]
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
[mustChangePassword = true]                [mustChangePassword = false]
           │                                           │
           ▼                                           ▼
┌───────────────────────┐                   ┌───────────────────────┐
│ SCR-006: Đổi mật khẩu │                   │ Vai trò người dùng?   │
│   (Bắt buộc)          │                   └───────────┬───────────┘
└───────────┬───────────┘                               │
            │ (Thành công)                 ┌────────────┴────────────┐
            ▼                              ▼                         ▼
   ┌─────────────────┐             [HR / SYSTEM_ADMIN]      [EMPLOYEE / MANAGER]
   │ Vào Mobile Home │                     │                         │
   └─────────────────┘                     ▼                         ▼
                                ┌───────────────────────┐ ┌───────────────────────┐
                                │ SCR-007: Blocked Role │ │ SCR-008: Overview     │
                                │   (Dùng Web Portal)   │ │  (App Shell 5 Tabs)   │
                                └───────────────────────┘ └───────────────────────┘
```

### 3.2 Luồng Vỏ Ứng Dụng Đã Đăng Nhập (Authenticated Shell Navigation Graph)

```
┌────────────────────────────────────────────────────────────────────────┐
│                      CORESTAFF MOBILE SHELL                            │
│                  (Persistent Bottom Navigation)                        │
└─────┬──────────────┬──────────────┬──────────────┬──────────────┬──────┘
      │              │              │              │              │
      ▼              ▼              ▼              ▼              ▼
┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
│  TAB 1    │  │  TAB 2    │  │  TAB 3    │  │  TAB 4    │  │  TAB 5    │
│ SCR-008   │  │ SCR-010   │  │ SCR-009   │  │ SCR-012   │  │ SCR-013   │
│ Tổng quan │  │ Đơn từ    │  │ Chấm công │  │ Phiếu     │  │ Tài khoản │
│           │  │           │  │ (Primary) │  │ lương     │  │           │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └───────────┘  └─────┬─────┘
      │              │              │                             │
      │ Quick Links  │              │ Punch Flow                  │ Menu Items
      │              │              │                             │
      ├──────────────┼──────────────┼─────────────────────────────┤
      │              │              ▼                             │
      │              │      ┌───────────────┐                     │
      │              │      │ Multi-tier    │                     │
      │              │      │ Punch Flow:   │                     │
      │              │      │ 1. Wi-Fi AP   │                     │
      │              │      │ 2. GPS Fence  │                     │
      │              │      │ 3. Selfie Cam │                     │
      │              │      └───────────────┘                     │
      │              ▼                                            │
      │      ┌───────────────┐                                    │
      │      │ SCR-011:      │                                    │
      │      │ Request Modal │                                    │
      │      │ Sheet (Leave  │                                    │
      │      │ & Overtime)   │                                    │
      │      └───────────────┘                                    │
      │                                                           │
      │                                                           ▼
      │                                                   ┌───────────────┐
      │                                                   │ SCR-006:      │
      │                                                   │ Đổi mật khẩu  │
      │                                                   │ (Tự nguyện)   │
      └───────────────────────────────────────────────────┴───────────────┘
```

---

## 4. Phân Tích Truy Cập Dựa Trên Vai Trò (Role-Based Access Analysis)

### 4.1 Vai Trò `EMPLOYEE` (Nhân Viên)
- Toàn quyền truy cập 5 tab: Tổng quan, Đơn từ, Chấm công, Phiếu lương, Tài khoản.
- Tự chấm công vào/ra ca theo ca làm việc được HR phân công.
- Tự tạo đơn xin nghỉ phép (Full day, Morning, Afternoon, Custom hours) và đăng ký tăng ca.
- Tra cứu bảng lương cá nhân theo từng kỳ và tự động đánh dấu đã xem khi mở chi tiết.
- Tự đổi mật khẩu định kỳ.

### 4.2 Vai Trò `DEPARTMENT_MANAGER` (Quản Lý Bộ Phận)
- **Đặc điểm kiến trúc trên Mobile:** Trong ứng dụng di động React Native hiện tại (`Apps/mobile`), vai trò `DEPARTMENT_MANAGER` **dùng chung hoàn toàn giao diện với `EMPLOYEE`**.
- Quản lý bộ phận trên mobile chấm công cho chính mình, tạo đơn nghỉ phép/tăng ca cho bản thân và tra cứu lương cá nhân của họ.
- **Quy tắc biên giới (Strict Boundary):** Các tính năng duyệt đơn của cấp dưới, phê duyệt ảnh chấm công ngoại lệ và khóa bảng công bộ phận được thực hiện **độc quyền trên Web Portal**. Ứng dụng mobile KHÔNG chứa màn hình phê duyệt quản lý.

### 4.3 Vai Trò `HR` & `SYSTEM_ADMIN` (Quản Trị Bị Chặn)
- Khi đăng nhập vào mobile, `App.tsx:117` kiểm tra:
  ```typescript
  const isBlockedRole = user.role === 'HR' || user.role === 'SYSTEM_ADMIN';
  ```
- Nếu đúng, ứng dụng hiển thị màn hình thông báo cảnh báo chuyên biệt (`SCR-007`) với nội dung:
  > *"Cổng quản trị Web: Tài khoản vai trò Nhân sự (HR) / Quản trị hệ thống (System Admin) cần sử dụng cổng quản trị web."*
- Người dùng chỉ có một hành động duy nhất là bấm nút **"Đăng xuất"** để thoát phiên.

---

## 5. Danh Mục Các Màn Hình Ẩn, Modal & Trạng Thái Điều Kiện

| ID | Thành Phần Giao Diện | Loại Kích Hoạt | Điều Kiện Hiển Thị | Vị Trí Mã Nguồn | Xử Lý Trong Flutter Target |
|---|---|---|---|---|---|
| **MDL-01** | `RequestModal` (Xin nghỉ phép) | Modal Bottom Sheet | Bấm nút "+" hoặc "Xin nghỉ phép" tại Requests Screen | `RequestsScreen.tsx:54-137` | `showModalBottomSheet(isScrollControlled: true)` |
| **MDL-02** | `RequestModal` (Đăng ký tăng ca) | Modal Bottom Sheet | Bấm "Đăng ký tăng ca" tại Requests Screen | `RequestsScreen.tsx:54-137` | Cùng Sheet với `RequestModal`, chuyển FormType |
| **DLG-01** | Xác nhận Chấm công Alert | Native Dialog | Bấm nút "Xác nhận vào ca" hoặc "Xác nhận ra ca" | `AttendanceScreen.tsx:105-109` | `showDialog` / `AlertDialog` với 2 nút Hủy và Xác nhận |
| **DLG-02** | Xác nhận Đăng xuất Alert | Native Dialog / Action | Bấm nút "Đăng xuất" trong Account Screen | `AccountScreen.tsx:43` | `showDialog` xác nhận đăng xuất an toàn |
| **CAM-01** | Chụp ảnh Selfie Chấm công | Native Camera Flow | Kích hoạt khi chấm công Out-Office hoặc khi server trả về `SELFIE_REQUIRED` | `AttendanceScreen.tsx:27-32` | Tích hợp gói camera / image_picker |
| **CND-01** | Bắt buộc đổi mật khẩu lần đầu | Conditional View | Sau khi đăng nhập nếu `user.mustChangePassword === true` | `App.tsx:38, 59` | Điều hướng cưỡng bức tới `ChangePasswordPage(forced: true)` |
| **CND-02** | Ca làm ngoài văn phòng (`OUT_OFFICE`) | Conditional UI Banner | `today.assignment.workplaceType === 'OUT_OFFICE'` | `AttendanceScreen.tsx:120` | Hiển thị thẻ ghi chú chấm công linh động |
| **CND-03** | Khung giờ nghỉ phép HR áp dụng | Conditional Card | `today.attendanceRequirements != null` | `AttendanceScreen.tsx:122` | Thẻ màu xanh lá hiển thị khung giờ nghỉ và giờ còn phải làm |
| **CND-04** | Đơn nghỉ phép đang chờ xử lý | Conditional Card | `today.pendingLeave != null` | `AttendanceScreen.tsx:122` | Thẻ màu vàng cảnh báo đơn đang chờ duyệt |
| **EMP-01** | Danh sách yêu cầu rỗng | Empty State Card | `rows.length === 0` trong Requests Screen | `RequestsScreen.tsx:44` | Widget `EmptyState(icon, title, description)` |
| **EMP-02** | Danh sách phiếu lương rỗng | Empty State Card | `payslips.length === 0` trong Payslips Screen | `PayslipsScreen.tsx:52` | Widget `EmptyState(icon, title, description)` |
| **EMP-03** | Lịch sử chấm công tháng rỗng | Empty State Card | `history.items.length === 0` trong Attendance Screen | `AttendanceScreen.tsx:126` | Card thông báo chưa có dữ liệu chấm công tháng |
| **ERR-01** | Lỗi kết nối toàn màn hình | Full-page Error State | `!apiBase || connectionError` | `App.tsx:71-73` | Widget `ConnectionErrorPage(message, onRetry)` |
| **ERR-02** | Lỗi tải dữ liệu màn hình con | Inline Error State | Bị lỗi mạng khi danh sách rỗng | `RequestsScreen.tsx:44`, `AttendanceScreen.tsx:114` | Widget `ErrorState(message, onRetry)` |
