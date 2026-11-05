# CORESTAFF — FLUTTER SHARED COMPONENT CATALOG
## Danh Mục & Đặc Tả Thành Phần Giao Diện Tái Sử Dụng

> **Tài liệu tham chiếu:** `FLUTTER_DESIGN_MASTER.md`, `FLUTTER_SCREEN_DESIGN_SPECIFICATIONS.md`  
> **Mục tiêu:** Cung cấp đặc tả chi tiết toàn bộ các Widget tái sử dụng trong `Apps/mobile_flutter` để lập trình viên có thể hiện thực hóa độc lập, đảm bảo tính nhất quán và không lặp lại mã nguồn.

---

## 1. Phân Loại Danh Mục Thành Phần

Hệ thống component được chia thành 5 nhóm kiến trúc:
1. **Foundation Widgets:** Khung chứa, phân cách, hiển thị văn bản đặc thù.
2. **Form & Input Widgets:** Các ô nhập liệu, nút bấm, bộ chọn tương tác.
3. **Feedback & State Widgets:** Banner thông báo, vòng xoay tải trang, trạng thái rỗng, lỗi.
4. **Navigation Widgets:** Thanh điều hướng đáy, tiêu đề màn hình, phân trang tháng.
5. **Domain-Specific Cards:** Các thẻ nghiệp vụ nhân sự (Ca làm, Đơn từ, Phiếu lương, Ngày công).

---

## 2. Bảng Danh Mục Thành Phần Cơ Sở (Foundation & Layout)

### 2.1 `AppCard` & `AppCard.dark`
- **Mục đích:** Khung chứa nội dung chính với viền bo tròn và bóng đổ chuẩn.
- **Biến thể:**
  - `AppCard` (Mặc định): Nền trắng `#FFFFFF`, viền `#E2E8F0`, bo góc 16 dp hoặc 20 dp.
  - `AppCard.dark`: Nền xanh đậm `AppColors.navy` (`#172554`), bo góc 20 dp, dùng cho thẻ Hero ca làm và tóm tắt lương.
- **Thông số cấu hình (Constructor Props):**
  ```dart
  const AppCard({
    Key? key,
    required Widget child,
    EdgeInsetsGeometry padding = const EdgeInsets.all(16),
    double borderRadius = 16.0,
    bool isDark = false,
    Border? border,
    VoidCallback? onTap,
  });
  ```
- **RN Mapping:** `<Card dark={...} style={...}>` in `Apps/mobile/src/components/ui.tsx:21-24`.
- **Target File:** `lib/core/widgets/app_card.dart`

---

### 2.2 `AppButton`
- **Mục đích:** Nút bấm hành động với vùng chạm chuẩn di động min 48-50 dp.
- **Biến thể:**
  - `primary`: Nền xanh `AppColors.primary`, chữ trắng đậm.
  - `secondary`: Nền trắng, viền `#CBD5E1`, chữ xám đậm `#334155`.
  - `danger`: Nền trắng/đỏ nhạt, viền `#FECACA`, chữ đỏ `#DC2626`.
- **Thông số cấu hình:**
  ```dart
  const AppButton({
    Key? key,
    required String label,
    required VoidCallback? onPressed,
    AppButtonVariant variant = AppButtonVariant.primary,
    bool isLoading = false,
    bool isDisabled = false,
    double minHeight = 50.0,
    IconData? leadingIcon,
  });
  ```
- **Hành vi:** Khi `isLoading = true`, ẩn text và hiển thị `CircularProgressIndicator` đồng màu với kích thước `20x20 dp`. Vô hiệu hóa chạm khi `isDisabled` hoặc `isLoading`.
- **RN Mapping:** `PrimaryButton`, `SecondaryButton`, `AppButton` in `App.tsx:145-147` và `ui.tsx:12-16`.
- **Target File:** `lib/core/widgets/app_button.dart`

---

### 2.3 `AppTextField`
- **Mục đích:** Ô nhập liệu văn bản với nhãn tách biệt, hỗ trợ mật khẩu và icon đuôi.
- **Thông số cấu hình:**
  ```dart
  const AppTextField({
    Key? key,
    required String label,
    String? placeholder,
    TextEditingController? controller,
    bool isPassword = false,
    bool isRequired = false,
    bool isMultiline = false,
    int maxLines = 1,
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.none,
    String? errorText,
    bool isEditable = true,
    Widget? trailing,
    ValueChanged<String>? onChanged,
  });
  ```
- **Visual Spec:** Chiều cao 50 dp (single-line), bo góc 12 dp, viền `#CBD5E1`. Trạng thái focus đổi viền sang `#2563EB` độ dày 1.5 dp.
- **RN Mapping:** `Field` in `App.tsx:144` và `ui.tsx:75-81`.
- **Target File:** `lib/core/widgets/app_text_field.dart`

---

### 2.4 `StatusBadge`
- **Mục đích:** Hiển thị trạng thái nghiệp vụ (chấm công, đơn từ, hợp đồng, phiếu lương) dạng viên thuốc (`pill`).
- **Logic màu sắc tự động:**
  - `APPROVED`, `COMPLETED`, `ACTIVE`, `VIEWED`: Nền `#F0FDF4`, chữ `#166534`.
  - `PENDING`, `PENDING_MANAGER`, `GENERATED`, `CLARIFICATION_REQUESTED`: Nền `#FFFBEB`, chữ `#92400E`.
  - `REJECTED`, `CANCELLED`, `TERMINATED`, `LOCKED`: Nền `#FEF2F2`, chữ `#B91C1C`.
  - `RELEASED`, `CHECKED_IN`: Nền `#DBEAFE`, chữ `#1E40AF`.
  - `DAY_OFF`, `NOT_CHECKED_IN`: Nền `#F1F5F9`, chữ `#64748B`.
- **RN Mapping:** `StatusBadge` in `ui.tsx:32-38`.
- **Target File:** `lib/core/widgets/status_badge.dart`

---

## 3. Bảng Danh Mục Thành Phần Thông Báo & Trạng Thái (Feedback & States)

| Tên Component | Mục Đích | Màu Sắc / Visual Spec | Tham Số (Props) | Target File |
|---|---|---|---|---|
| `ErrorBanner` | Hiển thị thông báo lỗi trên đầu form/màn hình | Nền `#FEF2F2`, viền `#FECACA`, chữ đỏ `#B91C1C`, bo góc 12 dp, padding 12 dp | `message: String` | `lib/core/widgets/error_banner.dart` |
| `SuccessBanner` | Hiển thị thông báo gửi yêu cầu thành công | Nền `#F0FDF4`, viền `#BBF7D0`, chữ xanh `#166534`, bo góc 12 dp, padding 12 dp | `message: String` | `lib/core/widgets/success_banner.dart` |
| `NoticeBanner` | Hiển thị lưu ý thông tin quan trọng | Nền `#EFF6FF`, viền `#BFDBFE`, chữ xanh `#1E40AF`, bo góc 12 dp | `message: String` | `lib/core/widgets/notice_banner.dart` |
| `LoadingBlock` | Khung xương chờ tải dữ liệu dạng khối | Nền trắng, viền `#E2E8F0`, bo góc 16 dp, chứa `CircularProgressIndicator` xoay ở giữa | `height: double (140 dp)` | `lib/core/widgets/loading_block.dart` |
| `EmptyState` | Báo danh sách rỗng (không có đơn, không có phiếu lương) | Icon vòng tròn 56 dp, tiêu đề 16 dp bold, mô tả xám 13 dp, nút hành động tùy chọn | `icon: IconData, title: String, description: String, actionLabel?: String, onAction?: VoidCallback` | `lib/core/widgets/empty_state.dart` |
| `ErrorState` | Báo lỗi tải dữ liệu toàn trang kèm nút thử lại | Icon cảnh báo đỏ, thông điệp lỗi tiếng Việt, nút "Thử tải lại" | `message: String, onRetry: VoidCallback` | `lib/core/widgets/error_state.dart` |

---

## 4. Bảng Danh Mục Thành Phần Điều Hướng (Navigation & Structure)

### 4.1 `CustomBottomNavBar`
- **Mục đích:** Thanh điều hướng đáy 5 tab với tab Chấm công (`attendance`) được làm nổi bật hình tròn nổi lên phía trên.
- **Quy cách cấu tạo:**
  - Nền trắng `#FFFFFF`, viền đỉnh `#E2E8F0`, đổ bóng ngược lên trên `Offset(0, -4)`.
  - Chiều cao `76 dp`, padding an toàn phía dưới.
  - Tab Chấm công: Vòng tròn `54x54 dp`, dịch lên trên `-26 dp`, nền `AppColors.navy` (hoặc `AppColors.primary` khi active), viền trắng 5 dp.
- **Tab Keys:** `overview`, `requests`, `attendance`, `payslips`, `account`.
- **Target File:** `lib/core/widgets/custom_bottom_nav_bar.dart`

---

### 4.2 `ScreenHeader`
- **Mục đích:** Tiêu đề chuẩn đầu trang cho 5 tab và các màn hình con.
- **Cấu trúc:**
  - Eyebrow: Text hoa nhỏ 10-11 dp, màu `AppColors.primary`, giãn chữ 1.25.
  - Title: Text 26 dp bold, màu `AppColors.textPrimary`.
  - Description: Text 14 dp muted, màu `AppColors.textMuted`.
  - Trailing Action (tùy chọn): Nút bấm thêm đơn (+) hoặc avatar.
- **Target File:** `lib/core/widgets/screen_header.dart`

---

### 4.3 `SegmentedControl`
- **Mục đích:** Thanh chuyển đổi tab ngang (ví dụ: Tất cả / Nghỉ phép / Tăng ca).
- **Quy cách:** Nền xám `#E2E8F0`, bo góc 12 dp, padding 3 dp. Tab được chọn có nền trắng, bo góc 9 dp và đổ bóng nhẹ.
- **Target File:** `lib/core/widgets/segmented_control.dart`

---

## 5. Bảng Danh Mục Thẻ Nghiệp Vụ Chuyên Sâu (Domain Cards)

### 5.1 `TodayShiftHeroCard`
- **Vị trí sử dụng:** `SCR-008` (Tổng quan) & `SCR-009` (Chấm công).
- **Quy cách:** `AppCard.dark` chứa Tên ca làm việc, Khung giờ, Địa chỉ văn phòng, Thanh timeline vào/ra ca và nút bấm chấm công nhanh.
- **Target File:** `lib/features/attendance/presentation/widgets/today_shift_hero_card.dart`

### 5.2 `TimelinePoint`
- **Vị trí sử dụng:** Bên trong `TodayShiftHeroCard`.
- **Quy cách:** Điểm chấm tròn (active = viền xanh lá, inactive = viền xám), nhãn mốc (Vào ca / Ra ca) và giờ đã ghi nhận (`HH:mm` hoặc `—`).
- **Target File:** `lib/features/attendance/presentation/widgets/timeline_point.dart`

### 5.3 `ShiftPreviewBox`
- **Vị trí sử dụng:** `SCR-011` (Modal Tạo Đơn Nghỉ Phép).
- **Quy cách:** Hộp tính toán công tự động từ backend: hiển thị khung giờ ca làm, giờ nghỉ trưa, khoảng thời gian xin nghỉ thực tế, số phút tính toán và số ngày phép tương đương bị trừ.
- **Target File:** `lib/features/requests/presentation/widgets/shift_preview_box.dart`

### 5.4 `PayslipAccordionCard`
- **Vị trí sử dụng:** `SCR-012` (Phiếu lương) & `SCR-013` (Tài khoản).
- **Quy cách:** Thẻ mở rộng chạm để xem chi tiết tài chính (Gross, Bảo hiểm, Thuế TNCN, Khấu trừ, Net) kèm cơ chế tự động đánh dấu đã xem `markPayslipViewed`.
- **Target File:** `lib/features/payslips/presentation/widgets/payslip_accordion_card.dart`

