# Flutter Mobile Design Master

> Tài liệu này là nguồn tham chiếu chuẩn duy nhất (**Single Source of Truth**) cho việc triển khai UI/UX trên ứng dụng di động Flutter của hệ thống CoreStaff.  
> **Dự án:** CoreStaff Mobile Flutter (`Apps/mobile_flutter`)  
> **Phiên bản:** 1.0 (Chuyển đổi đồng bộ từ `Apps/mobile` - React Native)  
> **Ngày lập:** 2026-11-04  
> **Phạm vi:** Ứng dụng dành cho Nhân viên (`EMPLOYEE`) và Quản lý bộ phận (`DEPARTMENT_MANAGER`)

---

## Nguồn Tham Chiếu Sử Dụng (Sources Used)

- `Apps/mobile/src/theme.ts` & `Apps/mobile/src/components/ui.tsx` — Định nghĩa Design Token và Component cơ sở của bản React Native gốc.
- `Apps/mobile/src/screens/*.tsx` — Hiện thực các màn hình Overview, Attendance, Requests, Payslips, Account.
- `Docs/MOBILE_DESIGN_MASTER.md` — Tài liệu thiết kế chuẩn của ứng dụng di động ban đầu.
- `Docs/FLUTTER_MIGRATION_ARCHITECTURE.md` & `Docs/FLUTTER_FEATURE_MAPPING.md` — Kiến trúc chuẩn BLoC + Clean Architecture của Flutter target.

---

## 1. Triết Lý Thiết Kế (Design Philosophy)

### Phong cách tổng thể
**Professional Enterprise Mobile Application.** Giao diện hiện đại, tối giản, thanh lịch, mang lại cảm giác **tin cậy, vững chắc và rõ ràng**, tối ưu cho thao tác một tay trên điện thoại di động (Android & iOS).

Khác biệt với giao diện Web Desktop, giao diện Flutter Mobile tuân thủ:
- Tối ưu cho thao tác một tay (Thumb Zone).
- Vùng chạm (Touch Target) tối thiểu **48×48 dp** theo chuẩn Material 3 & Human Interface Guidelines.
- Xử lý mượt mà vùng an toàn (`SafeArea`: Tai thỏ, Dynamic Island, Home indicator).
- Điều hướng thanh điều hướng đáy (`BottomNavigationBar`) chuyển đổi tức thì giữa các phân hệ.
- Tự động cuộn tránh bàn phím (`SingleChildScrollView` + `MediaQuery.viewInsetsOf(context)`).

### 7 Nguyên Tắc UX Cốt Lõi

| # | Nguyên tắc | Ứng dụng trong Flutter |
|---|---|---|
| 1 | **Clarity > Decoration** | Mỗi widget có mục đích rõ ràng; không dùng viền/bóng đổ/gradient lòe loẹt. |
| 2 | **Consistency > Creativity** | Sử dụng token tập trung: `AppColors`, `AppTypography`, `AppSpacing`, `AppRadius`. |
| 3 | **Feedback Always** | Mọi tương tác bất đồng bộ đều có trạng thái phản hồi: `CircularProgressIndicator`, `LoadingBlock`, `ErrorBanner`, `RefreshIndicator`. |
| 4 | **Progressive Disclosure** | Chỉ hiển thị thông tin chính yếu; chi tiết phân rã tài chính hoặc đơn từ mở ra khi chạm (`isExpanded`). |
| 5 | **Vietnamese First** | 100% nhãn tiếng Việt chuẩn nhân sự (chấm công, thực lĩnh, công chuẩn, phép năm). |
| 6 | **Zero Jumpiness** | Giữ khung hình cố định, tránh xê dịch layout khi dữ liệu load xong. |
| 7 | **Offline & Error Resilience** | Thông báo lỗi tiếng Việt thân thiện thông qua `ErrorResolver` và cho phép kéo để thử lại. |

---

## 2. Cấu Trúc Khung Màn Hình Chuẩn (Screen Layout Master)

### Cây Widget Tiêu Chuẩn

```
Scaffold (backgroundColor: AppColors.bgDefault = #F6F8FC)
└── SafeArea (bottom: false cho thanh điều hướng đáy)
    └── RefreshIndicator (color: AppColors.primary, onRefresh: ...)
        └── SingleChildScrollView (physics: AlwaysScrollableScrollPhysics())
            └── Padding (horizontal: 20–22, vertical: 24–32)
                └── Column (crossAxisAlignment: CrossAxisAlignment.start)
                    ├── Header Section (Eyebrow, Title Large, Subtitle)
                    ├── SizedBox(height: 16–20)
                    ├── Hero / Summary Card (AppCard.dark hoặc Metric Box)
                    ├── SizedBox(height: 20–24)
                    ├── Section Header (Tiêu đề mục + Badge số lượng)
                    ├── SizedBox(height: 12)
                    └── Content List / Empty State / Error Banner
```

### Kích Thước Bố Cục Chuẩn

| Thành phần | Giá trị Flutter | Ý nghĩa sử dụng |
|---|---|---|
| Nền toàn ứng dụng | `AppColors.bgDefault` (`#F6F8FC`) | Đồng bộ màu nền dịu mắt |
| Padding 2 bên màn hình | `EdgeInsets.symmetric(horizontal: 20)` | Chừa lề an toàn viền màn hình |
| Khoảng cách đầu trang (Top) | `24 dp` (Tab Screen) / `40 dp` (Auth Screen) | Khoảng thoáng phía dưới AppBar/Notch |
| Padding trong của Card | `EdgeInsets.all(16)` hoặc `20 dp` | Đảm bảo nội dung không dính sát viền card |
| Khoảng cách giữa các Section | `SizedBox(height: 20)` đến `24 dp` | Phân tách các khối thông tin độc lập |
| Khoảng cách Label -> Input | `SizedBox(height: 8)` | Gắn kết nhãn với ô nhập liệu |
| Chiều cao tối thiểu của Nút | `48–50 dp` (`AppButton`) | Vùng chạm thoải mái cho ngón cái |
| Chiều cao tối thiểu của Input | `50 dp` (`AppTextField`) | Tiêu chuẩn nhập liệu di động |

---

## 3. Hệ Thống Khoảng Cách (Spacing System)

Lớp quản trị: `AppSpacing`

```dart
class AppSpacing {
  static const double micro = 4.0;
  static const double xs    = 8.0;
  static const double sm    = 12.0;
  static const double md    = 16.0;
  static const double lg    = 20.0;
  static const double xl    = 24.0;
  static const double xxl   = 32.0;
  static const double huge  = 40.0;
}
```

---

## 4. Hệ Thống Màu Sắc & Bảng Token (Color System)

Lớp quản trị: `AppColors`

| Token Flutter | Mã Hex | Tên tương ứng trong RN | Mục đích sử dụng |
|---|---|---|---|
| `AppColors.bgDefault` | `#F6F8FC` | `colors.background` | Màu nền chính của tất cả màn hình |
| `AppColors.surface` | `#FFFFFF` | `colors.surface` | Nền thẻ Card, Modal, BottomSheet |
| `AppColors.surfaceMuted` | `#F8FAFC` | `colors.surfaceMuted` | Nền ô tìm kiếm, nền header bảng |
| `AppColors.primary` | `#2563EB` | `colors.primary` | Màu nhấn thương hiệu (Blue-600), Button chính |
| `AppColors.primaryDark` | `#1D4ED8` | `colors.primaryDark` | Nút khi nhấn, text số tiền nổi bật |
| `AppColors.primarySoft` | `#DBEAFE` | `colors.primarySoft` | Nền badge thông tin, hộp tiền thực nhận |
| `AppColors.navy` | `#172554` | `colors.navy` | Nền thẻ Summary Dark Card |
| `AppColors.navySoft` | `#93C5FD` | `colors.navySoft` | Chữ phụ trợ trên nền Dark Card |
| `AppColors.textPrimary` | `#0F172A` | `colors.ink` | Tiêu đề chính, văn bản có độ tương phản cao |
| `AppColors.textSecondary`| `#334155` | `colors.inkSoft` | Nội dung mô tả, nhãn trường nhập liệu |
| `AppColors.textMuted` | `#64748B` | `colors.muted` | Chú thích, thời gian, placeholder |
| `AppColors.border` | `#E2E8F0` | `colors.border` | Viền thẻ, đường phân cách nhẹ |
| `AppColors.divider` | `#F1F5F9` | `colors.divider` | Đường kẻ ngang chia mục trong card |
| `AppColors.success` | `#16A34A` | `colors.success` | Chấm công thành công, đơn đã duyệt, active |
| `AppColors.successSoft` | `#F0FDF4` | `colors.successSoft` | Nền Badge duyệt, nền ca làm đúng giờ |
| `AppColors.warning` | `#D97706` | `colors.warning` | Đang xử lý, cảnh báo muộn, ca kế tiếp |
| `AppColors.warningSoft` | `#FFFBEB` | `colors.warningSoft` | Nền Badge chờ duyệt, cảnh báo vị trí |
| `AppColors.danger` | `#DC2626` | `colors.danger` | Lỗi mạng, đơn từ chối, vắng mặt, trừ tiền |
| `AppColors.dangerSoft` | `#FEF2F2` | `colors.dangerSoft` | Nền banner lỗi, badge vi phạm |

---

## 5. Hệ Thống Kiểu Chữ (Typography System)

Lớp quản trị: `AppTypography`

```dart
class AppTypography {
  static const TextStyle eyebrow = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w800,
    letterSpacing: 1.1,
    color: AppColors.primary,
  );

  static const TextStyle titleLarge = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w800,
    color: AppColors.textPrimary,
    letterSpacing: -0.5,
  );

  static const TextStyle titleMedium = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  static const TextStyle titleSmall = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  static const TextStyle body = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimary,
    height: 1.45,
  );

  static const TextStyle bodySmall = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: AppColors.textMuted,
  );

  static const TextStyle caption = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AppColors.textMuted,
  );

  static const TextStyle moneyDisplay = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.5,
    color: Colors.white,
  );
}
```

---

## 6. Bo Góc & Hiệu Ứng Nổi (Border Radius & Shadow)

Lớp quản trị: `AppRadius`

| Token | Bán kính bo góc | Widget áp dụng |
|---|---|---|
| `AppRadius.sm` | `10.0` | Hộp Thực nhận phụ, ô nhập code |
| `AppRadius.md` | `12.0` | `AppButton`, `AppTextField`, Dialog |
| `AppRadius.lg` | `16.0` | `AppCard` tiêu chuẩn, `PayslipCard` |
| `AppRadius.xl` | `20.0` | Hero Card, Summary Dark Card |
| `AppRadius.pill`| `999.0` | `StatusBadge`, Circle Avatar, Nút bấm tròn |

### Shadow / Elevation Chuẩn
Flutter sử dụng danh sách `BoxShadow` nhẹ nhàng, tránh đổ bóng đậm:
```dart
static const List<BoxShadow> cardShadow = [
  BoxShadow(
    color: Color(0x0F0F172A), // #0F172A với opacity 6%
    offset: Offset(0, 6),
    blurRadius: 16,
  ),
];
```

---

## 7. Các Thành Phần Giao Diện Cốt Lõi (Core Widgets)

### 7.1. Thẻ Chứa Nội Dung (`AppCard`)
- **Card Trắng chuẩn (`AppCard`):** Nền trắng `#FFFFFF`, viền mỏng `#E2E8F0`, bo góc 16 dp, đổ bóng mờ 6%.
- **Dark Hero Card (`AppCard.dark`):** Nền xanh đậm `AppColors.navy` (`#172554`), dùng làm điểm nhấn mạnh ở đầu trang tổng quan và phiếu lương.

### 7.2. Nút Bấm (`AppButton`)
- `primary`: Nền xanh `AppColors.primary`, chữ trắng, bo góc 12 dp, chiều cao 50 dp.
- `secondary`: Nền `AppColors.surface`, viền `AppColors.border`, chữ xám đậm.
- `danger`: Nền `AppColors.dangerSoft`, chữ `AppColors.dangerText`.
- Tự động hiển thị `SizedBox(width: 20, height: 20, child: CircularProgressIndicator(...))` khi `isLoading = true`.

### 7.3. Ô Nhập Liệu (`AppTextField`)
- Chiều cao tối thiểu: `50 dp`.
- Trạng thái bình thường: Viền `AppColors.border`, nền trắng.
- Trạng thái Focus: Viền xanh `AppColors.primary`, độ dày viền 1.5 dp.
- Hỗ trợ icon đuôi (Hiện/Ẩn mật khẩu, Xóa chữ).

### 7.4. Huy Hiệu Trạng Thái (`StatusBadge`)
Tự động chuyển đổi màu nền và màu chữ theo trạng thái nghiệp vụ:
- `APPROVED` / `COMPLETED` / `VIEWED`: Nền xanh lá nhạt (`#F0FDF4`), chữ xanh lá đậm (`#166534`).
- `PENDING` / `GENERATED` / `REVIEWING`: Nền vàng nhạt (`#FFFBEB`), chữ vàng cam (`#92400E`).
- `REJECTED` / `CANCELLED` / `FAILED`: Nền đỏ nhạt (`#FEF2F2`), chữ đỏ đậm (`#B91C1C`).
- `RELEASED`: Nền xanh dương nhạt (`#DBEAFE`), chữ xanh dương đậm (`#1E40AF`).

### 7.5. Thanh Điều Hướng Đáy (`CustomBottomNavBar`)
5 Tab chuẩn tương ứng 5 phân hệ di động:
1. `overview`: Icon `dashboard_rounded` — Tổng quan
2. `requests`: Icon `description_rounded` — Đơn từ
3. `attendance`: Icon `fingerprint_rounded` — Chấm công (Nút trung tâm nổi bật)
4. `payslips`: Icon `account_balance_wallet_rounded` — Phiếu lương
5. `account`: Icon `person_rounded` — Tài khoản

---

## 8. Chi Tiết Thiết Kế Từng Màn Hình (Screen Breakdown)

### 8.1. Màn Hình Đăng Nhập (Login Screen)
- **Bố cục:** Eyebrow `ỨNG DỤNG NHÂN VIÊN` > Tiêu đề lớn `Chào mừng trở lại` > Form Card chứa ô email/mã NV và mật khẩu > Nút bấm `Đăng nhập`.
- **Validation:** Bắt lỗi rỗng tức thì, hiển thị banner đỏ `ErrorBanner` nếu sai thông tin xác thực.

### 8.2. Màn Hình Tổng Quan (Overview Screen)
- **Top Bar:** Avatar chữ cái viết tắt (`VA`), lời chào theo buổi ("Chào buổi sáng, Nam!"), ngày tháng hiện tại.
- **Hero Shift Card:** Hiển thị ca làm việc hôm nay (Thời gian vào/ra, Địa điểm văn phòng, Trạng thái chấm công hiện tại).
- **Quick Action Grid:** 4 nút tròn truy cập nhanh: Báo vắng/Nghỉ phép, Đăng ký OT, Giải trình công, Tra cứu lương.
- **Thống kê nhanh tháng:** Tổng công lũy kế, số giờ làm thêm, số ngày nghỉ phép còn lại.

### 8.3. Màn Hình Chấm Công (Attendance Screen)
- **Khối Radar Trạng Thái (GPS & Wi-Fi):**
  - Đèn xanh nếu đang trong bán kính hợp lệ của văn phòng và kết nối đúng Wi-Fi công ty.
  - Đèn vàng nếu ngoài bán kính hoặc Wi-Fi không xác định (yêu cầu chụp selfie).
- **Camera Selfie Preview:** Khung tròn/bo góc live preview trước khi bấm giờ.
- **Nút Chấm Công Siêu Lớn:** Nút tròn nổi bật `VÀO CA` (Xanh dương) hoặc `HẾT CA` (Cam đất), tương tác rung haptic.
- **Nhật ký trong ngày:** Danh sách mốc giờ check-in, check-out, đính kèm thumbnail ảnh selfie và tọa độ.

### 8.4. Màn Hình Quản Lý Đơn Từ (Requests Screen)
- **Tab Lọc Trạng Thái:** Bộ lọc thanh trượt ngang: `Tất cả`, `Chờ duyệt`, `Đã duyệt`, `Từ chối`.
- **Thẻ Đơn Từ:**
  - Tiêu đề loại đơn (Nghỉ phép năm, Làm thêm giờ, Giải trình quên chấm công).
  - Khoảng thời gian xin nghỉ / số giờ OT.
  - Lý do ngắn gọn.
  - Huy hiệu `StatusBadge` góc phải.
- **Floating Action Button (FAB):** Nút tròn `+ Tạo đơn mới` mở Modal Bottom Sheet lựa chọn loại đơn.

### 8.5. Màn Hình Phiếu Lương (Payslips Screen)
- **Thẻ Tóm Tắt Tối Màu (Dark Card):**
  - Chữ nhỏ: `KỲ GẦN NHẤT` + Tiêu đề `Tháng MM/YYYY`.
  - Huy hiệu `X mới` nền trắng nếu có phiếu lương chưa xem.
  - Số tiền `Thực nhận` cỡ chữ 28–30 dp màu trắng nổi bật kèm ngày phát hành.
- **Danh Sách Kỳ Lương (Accordion Card):**
  - Trạng thái thu gọn: Hiển thị Kỳ lương, Ngày phát hành, Badge trạng thái, Hộp tiền thực nhận, Dòng gợi ý `Chạm để xem chi tiết`.
  - Trạng thái mở rộng (`isExpanded`): Phân rã tài chính đầy đủ gồm:
    - `Tổng thu nhập (Gross)`
    - `Bảo hiểm (BHXH, BHYT, BHTN)` (chữ đỏ)
    - `Thuế TNCN` (chữ đỏ)
    - `Khấu trừ khác`
    - Đường chia tách `Divider`
    - `Thực nhận (Net)` in đậm cỡ lớn.
  - **Tự động đánh dấu đã xem:** Chuyển trạng thái tức thì từ `RELEASED` -> `VIEWED`.

### 8.6. Màn Hình Tài Khoản (Account Screen)
- **Profile Header Card:** Avatar tròn có 2 chữ cái viết tắt họ tên, Tên đầy đủ, Mã nhân viên `EMP-XXXX`, Chức danh, Phòng ban.
- **Khối Thông Tin Chi Tiết:**
  - Hợp đồng lao động, Ngày bắt đầu làm việc.
  - Quản lý trực tiếp (kèm avatar nhỏ).
  - Số điện thoại, Email công ty, Địa chỉ làm việc.
- **Menu Tiện Ích & Bảo Mật:**
  - Nút chuyển nhanh đến `Phiếu lương của tôi`.
  - Nút `Đổi mật khẩu`.
  - Nút `Đăng xuất` màu đỏ nguy hiểm (kèm Dialog xác nhận trước khi thoát).

### 8.7. Modal Tạo Đơn Xin Nghỉ Phép (Leave Request Modal)
- **Kiểu trình bày:** `showModalBottomSheet` với `isScrollControlled: true` và `shape` bo góc đỉnh 20 dp.
- **Trường nhập liệu:**
  - `SegmentedControl`: Nghỉ phép năm (Có lương) vs Nghỉ không lương.
  - Chọn khoảng ngày: `Từ ngày` - `Đến ngày`.
  - Giờ lẻ (`CUSTOM_HOURS`): `Từ giờ` - `Đến giờ`.
  - **Hộp tính công động (`ShiftPreviewBox`):** Tự động gọi API ca làm việc tính ra số phút và số ngày phép bị trừ (ví dụ: `1.0 ngày (480 phút)`).
  - Ô lý do `TextFormField` multiline tối thiểu 10 ký tự.

### 8.8. Modal Đăng Ký Làm Thêm Giờ (Overtime Request Modal)
- **Kiểu trình bày:** Bottom Sheet cuộn bàn phím an toàn.
- **Trường nhập liệu:**
  - Ngày đăng ký làm thêm.
  - Giờ bắt đầu - Giờ kết thúc.
  - Hệ số tính công dự kiến (150% ngày thường, 200% cuối tuần).
  - Mô tả chi tiết công việc thực hiện trong ca OT.
  - Lý do giải trình nếu nộp muộn sau kỳ hạn chốt.

### 8.9. Màn Hình Chụp Ảnh Selfie Xác Thực Chấm Công
- **Khung Camera Viewport:** Khung tròn quét khuôn mặt dạng live camera với đường viền nét đứt.
- **Thông tin đính kèm:** Tọa độ GPS hiện tại (Kinh độ/Vĩ độ) và khoảng cách thực tế đến tâm văn phòng.
- **Nút Chụp & Điểm danh:** Gửi đồng thời ảnh selfie base64/multipart, tọa độ GPS và thông tin BSSID Wi-Fi lên backend.

### 8.10. Màn Hình Quên Mật Khẩu (Forgot Password Screen)
- **Bố cục:** Nút quay lại đăng nhập, tiêu đề `Khôi phục tài khoản`, ô nhập Email công ty và nút `Gửi email khôi phục`.

### 8.11. Màn Hình Đổi Mật Khẩu (Change Password Screen)
- **Áp dụng:** 2 trường hợp: Bắt buộc lần đầu (`mustChangePassword: true` - không có nút Hủy) hoặc Tự nguyện từ màn hình Account.
- **Trường nhập liệu:** Mật khẩu hiện tại, Mật khẩu mới, Xác nhận mật khẩu mới, kiểm tra độ mạnh tối thiểu 8 ký tự.

### 8.12. Màn Hình Cảnh Báo Phân Quyền (Unauthorized Role Screen)
- **Đối tượng kích hoạt:** Tài khoản role `HR` hoặc `SYSTEM_ADMIN` cố gắng đăng nhập trên Mobile.
- **Giao diện:** Icon cảnh báo lớn màu cam, thông báo giải thích rõ mobile chỉ hỗ trợ Nhân viên & Quản lý, hiển thị link hướng dẫn mở Web Portal (`http://localhost:5173`) và nút Đăng xuất an toàn.

---

## 9. Bảng Đối Chiếu Thành Phần (React Native vs Flutter)

| Khái niệm UI | React Native (`Apps/mobile`) | Flutter (`Apps/mobile_flutter`) |
|---|---|---|
| Container bọc | `<View style={styles.card}>` | `AppCard(child: ...)` |
| Bo góc | `borderRadius: 16` | `BorderRadius.circular(16)` |
| Đổ bóng | `shadowColor: ..., shadowOpacity: ...` | `boxShadow: [BoxShadow(...)]` |
| Bảng mã màu | `colors.primary`, `colors.ink` | `AppColors.primary`, `AppColors.textPrimary` |
| Chữ & Phông | `<Text style={styles.title}>` | `Text('...', style: AppTypography.titleLarge)` |
| Vùng an toàn | `<SafeAreaView>` | `SafeArea(child: ...)` |
| Cuộn có thể làm mới | `<ScrollView refreshControl={...}>` | `RefreshIndicator(child: SingleChildScrollView(...))` |
| Danh sách mở rộng | `expanded === item._id ? <View> : null` | `if (isExpanded) ...[ ... ]` |
| Quản lý trạng thái UI | `useState`, `useEffect` | `BlocBuilder<FeatureBloc, FeatureState>` |
| Định dạng tiền tệ | `formatMoney(val)` | `NumberFormat.currency(locale: 'vi_VN', symbol: '₫')` |

---

## 10. Nguyên Tắc Tránh Lỗi Thiết Kế (Anti-Patterns to Avoid)

1. **Không hardcode chuỗi ký tự giao diện:** Dùng hằng số hoặc formatters chuẩn cho tiền tệ và ngày tháng.
2. **Không dùng màu ngẫu nhiên ngoài `AppColors`:** Tuyệt đối không dùng `Colors.blue` hay `Colors.grey[200]` rải rác trong code widget.
3. **Không để nút bấm nhỏ hơn 48 dp:** Đảm bảo ngón tay người dùng không bấm trượt hoặc bấm nhầm thành phần bên cạnh.
4. **Không chặn thao tác khi đang gọi API phụ:** Ví dụ thao tác bấm mở phiếu lương để đánh dấu đã xem được update lạc quan ngay lập tức, không dùng modal xoay vòng làm đơ màn hình.
5. **Không dùng layout tĩnh không có Scroll:** Mọi màn hình form hoặc dashboard phải bọc trong `SingleChildScrollView` để không bị lỗi overflow khi mở bàn phím ảo.

