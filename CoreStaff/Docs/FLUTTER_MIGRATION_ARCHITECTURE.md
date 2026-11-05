# CORESTAFF MOBILE — FLUTTER TARGET ARCHITECTURE DESIGN

> **Document Version:** 1.0.0  
> **Date:** 2026-11-03  
> **Status:** APPROVED BASELINE — PENDING IMPLEMENTATION AUTHORIZATION  
> **Target Scope:** Production Flutter application architecture replacing `Apps/mobile`.

---

## 1. Evaluation of Existing Flutter Skeleton (`Apps/mobile_flutter`)

Before proposing architectural specifications, the pre-existing skeleton in `Apps/mobile_flutter` was subjected to a thorough architectural audit against `Docs/FLUTTER_MIGRATION_AUDIT.md`.

### 1.1 Assets to Retain & Extend
- **Visual Design System & Tokens:**
  - `lib/core/theme/app_colors.dart`: Accurately maps the palette defined in `Docs/MOBILE_DESIGN_MASTER.md` (`primary: #2563EB`, `navy: #172554`, `background: #F6F8FC`, `surface: #FFFFFF`).
  - `lib/core/theme/app_typography.dart`: Consistent type scale and weights matching the design tokens.
  - `lib/widgets/buttons.dart` & `fields.dart`: Clean, accessible touch targets (min 48–50px) with custom state styling.
- **Authentication Presentation Screens:**
  - `lib/screens/auth/login_screen.dart`, `forgot_password_screen.dart`, `reset_password_screen.dart`, `change_password_screen.dart`: Form validation, layout, and UX feedback are structurally sound and can be preserved with minimal refactoring to bind to a reactive state manager.

### 1.2 Flaws Requiring Structural Replacement
1. **Network Engine (`api_client.dart`):**
   - Uses basic `package:http`. Lacks support for `multipart/form-data` file streaming needed by selfie check-ins.
   - Parses the combined `Set-Cookie` header using fragile regular expressions (`RegExp(r',(?=\s*[a-zA-Z0-9_-]+=)')`), which breaks when cookie expiration attributes contain commas (`Expires=Wed, 21 Oct 2026...`).
2. **Insecure Storage:**
   - Persists sensitive HttpOnly session cookies (`sid`, `rt`) as plaintext in `SharedPreferences` (unencrypted XML on Android, plist on iOS). Must be replaced with hardware-backed encryption (`flutter_secure_storage`).
3. **Absence of State Management & Dependency Injection:**
   - Relies exclusively on static singleton access (`AuthService.instance`, `ApiClient.instance`) and localized `setState`. Lacks dependency injection, test mocks, or cross-tab synchronization.
4. **Shell Navigation Mismatch:**
   - `main_shell_screen.dart` implements only 4 tabs, completely omitting `Payslips`. Tab icons use Unicode text characters (`⌂`, `◷`, `▤`, `○`) rather than vector icons, and the center raised action button for attendance is missing.
5. **Missing Hardware & Native Bridges:**
   - Lacks packages and manifest permissions for camera, GPS, and Wi-Fi BSSID extraction.

---

## 2. Target Architecture Overview

The target Flutter architecture adopts a **Feature-Driven Clean Architecture** combined with the **BLoC (Business Logic Component)** pattern. This delivers strict separation of concerns, testability, predictable unidirectional data flow, and resilience against concurrency races during session rotation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                              │
│  Widgets  ──(Events)──>  BLoC / Cubit  ──(States)──>  UI Builders      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Calls
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           Domain Layer                                 │
│         Entities / Models   ◄───►   Repository Interfaces             │
│            Use Cases / Orchestrators (e.g., Punch Verification)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Implements
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            Data Layer                                  │
│   Repository Implementations  ───►  Data Sources (Remote & Local)      │
│   DTOs & JSON Serializers     ───►  Network Interceptors & Cookie Jar  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Bridges
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Core & Platform Layer                           │
│  Dio HTTP Client │ Secure Storage │ Native Bridges (GPS, Wi-Fi, Camera)│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Structure

```text
lib/
├── app.dart                        # Root MaterialApp configuration, theme & top-level BlocProviders
├── main.dart                       # Entrypoint: initializes bindings, TZ, and DI container
├── core/
│   ├── config/
│   │   ├── api_config.dart         # Base URL resolver (remote sslip.io vs local fallback 10.0.2.2)
│   │   └── app_constants.dart      # Application constants, TTLs, and hardcoded UTC+7 rules
│   ├── di/
│   │   └── injection.dart          # GetIt service locator registry
│   ├── error/
│   │   ├── app_exception.dart      # Strongly-typed domain & API exceptions
│   │   └── error_resolver.dart     # Vietnamese friendly error mapper (mirrors friendlyEmployeeError)
│   ├── network/
│   │   ├── api_client.dart         # Configured Dio instance with timeout and retry policies
│   │   ├── auth_interceptor.dart   # QueuedInterceptor for transparent 401 refresh serialization
│   │   ├── cookie_manager.dart     # RFC 6265 cookie jar wrapper backed by SecureStorage
│   │   └── realtime_service.dart   # Socket.io client for /events namespace
│   ├── services/
│   │   ├── camera_service.dart     # image_picker wrapper with quality & dimension compression
│   │   ├── location_service.dart   # geolocator wrapper with accuracy verification
│   │   ├── permission_service.dart # Unified permission_handler orchestrator
│   │   ├── secure_storage_service.dart # flutter_secure_storage interface (Keystore / Keychain)
│   │   └── wifi_service.dart       # network_info_plus wrapper with BSSID sanitization
│   └── theme/
│       ├── app_colors.dart         # Color palette matching MOBILE_DESIGN_MASTER.md
│       ├── app_theme.dart          # ThemeData configuration for Material 3
│       └── app_typography.dart     # Font scales, weights, and line heights
├── features/
│   ├── account/
│   │   ├── data/
│   │   │   ├── models/employee_profile_dto.dart
│   │   │   └── account_repository.dart
│   │   └── presentation/
│   │       ├── bloc/account_bloc.dart
│   │       └── screens/account_screen.dart
│   ├── attendance/
│   │   ├── data/
│   │   │   ├── models/attendance_day_dto.dart
│   │   │   ├── models/today_attendance_dto.dart
│   │   │   └── attendance_repository.dart
│   │   ├── domain/
│   │   │   └── punch_orchestrator.dart # Multi-tier verification pipeline (Wi-Fi → GPS → Selfie)
│   │   └── presentation/
│   │       ├── bloc/attendance_bloc.dart
│   │       ├── screens/attendance_screen.dart
│   │       └── widgets/
│   │           ├── history_card.dart
│   │           ├── punch_timeline.dart
│   │           └── shift_hero_card.dart
│   ├── auth/
│   │   ├── data/
│   │   │   ├── models/auth_user_dto.dart
│   │   │   └── auth_repository.dart
│   │   └── presentation/
│   │       ├── bloc/auth_bloc.dart
│   │       └── screens/
│   │           ├── change_password_screen.dart
│   │           ├── forgot_password_screen.dart
│   │           ├── login_screen.dart
│   │           └── reset_password_screen.dart
│   ├── overview/
│   │   ├── presentation/
│   │   │   ├── bloc/overview_bloc.dart
│   │   │   ├── screens/overview_screen.dart
│   │   │   └── widgets/
│   │   │       ├── attention_metrics_card.dart
│   │   │       └── quick_action_card.dart
│   ├── payslip/
│   │   ├── data/
│   │   │   ├── models/payslip_dto.dart
│   │   │   └── payslip_repository.dart
│   │   └── presentation/
│   │       ├── bloc/payslip_bloc.dart
│   │       ├── screens/payslips_screen.dart
│   │       └── widgets/payslip_expandable_card.dart
│   ├── requests/
│   │   ├── data/
│   │   │   ├── models/leave_request_dto.dart
│   │   │   ├── models/overtime_request_dto.dart
│   │   │   └── requests_repository.dart
│   │   └── presentation/
│   │       ├── bloc/requests_bloc.dart
│   │       ├── screens/requests_screen.dart
│   │       └── widgets/
│   │           ├── leave_form_modal.dart
│   │           ├── overtime_form_modal.dart
│   │           └── request_item_card.dart
│   └── shell/
│       └── presentation/
│           ├── screens/main_shell_screen.dart
│           ├── screens/unauthorized_role_screen.dart
│           └── widgets/bottom_navigation_bar.dart
└── shared/
    ├── extensions/date_formatter_extension.dart
    ├── extensions/number_formatter_extension.dart
    └── widgets/
        ├── app_button.dart
        ├── app_card.dart
        ├── app_text_field.dart
        ├── banners.dart
        ├── empty_state.dart
        ├── loading_indicator.dart
        └── status_badge.dart
```

---

## 4. State Management Strategy

### 4.1 Technology Selection: Flutter BLoC (`flutter_bloc`)
**Choice:** `flutter_bloc` (v8.1.x) with immutable Freezed or equatable states.

**Justification:**
1. **Unidirectional Data Flow:** Strictly decouples UI widgets from business logic. State transitions can only occur in response to explicit, typed events (`AttendancePunchRequested`, `LeavePreviewDebounced`).
2. **Transparent Cross-Tab Refreshing:** When the WebSocket gateway emits an invalidation event (`attendance:changed`, `payslip:released`), or when the app resumes from the background, a single dispatch (`RefreshDomainData`) triggers seamless background re-fetching across relevant BLoCs without state corruption.
3. **Testability:** BLoCs operate with standard Dart streams and can be unit-tested without inflating the Flutter widget tree using `bloc_test`.

### 4.2 State Machine Topology

```
                  ┌─────────────────┐
                  │    App Boot     │
                  └────────┬────────┘
                           │ Check Stored Session
                           ▼
                  ┌─────────────────┐
       ┌──────────┤   AuthBloc      ├──────────┐
       │          └─────────────────┘          │
       │ No Session/Expired                    │ Authenticated
       ▼                                       ▼
┌──────────────┐                       ┌──────────────┐
│  Login Flow  │                       │ Must Change? │
└──────────────┘                       └───┬──────┬───┘
                                       Yes │      │ No
                                           │      ▼
                                           │   Role Blocked? (HR/ADMIN)
                                           │   ├── Yes ──► UnauthorizedRoleScreen
                                           │   └── No  ──► MainShellScreen (5 Tabs)
                                           ▼
                                 ChangePasswordScreen
```

---

## 5. Network & Session Management Architecture

### 5.1 HTTP Engine: Dio (`dio`)
**Choice:** `Dio` (v5.4.x) configured with custom timeouts (connect: 8000ms, receive: 15000ms) and response interceptors.

**Why Dio over `http`:**
- Native support for `QueuedInterceptor`, enabling serialization of 401 refresh locks.
- Out-of-the-box `FormData` multipart streaming for photo selfie uploads with automatic MIME boundary formatting.
- Clean hook for RFC 6265 cookie persistence.

### 5.2 Session Management & Concurrency Interceptor
The application utilizes a `QueuedInterceptor` to handle the dual-token cookie session lifecycle:

```mermaid
sequenceDiagram
    autonumber
    participant App as BLoC / UI Callers
    participant Dio as Dio HTTP Client
    participant Queue as QueuedInterceptor
    participant API as NestJS Backend (/api)
    participant Jar as SecureStorage CookieJar

    App->>Dio: Request A (GET /attendance/today)
    App->>Dio: Request B (GET /leave-requests/mine)
    Dio->>API: Send Request A (Expired sid)
    Dio->>API: Send Request B (Expired sid)
    API-->>Dio: 401 AUTH_SESSION_EXPIRED (Req A)
    API-->>Dio: 401 AUTH_SESSION_EXPIRED (Req B)
    
    rect rgb(240, 248, 255)
    note over Queue: Interceptor locks queue; buffers Request B
    Queue->>API: POST /api/auth/refresh (Cookie: rt=...)
    API-->>Queue: Set-Cookie: sid=new_sid... (200 OK)
    Queue->>Jar: Save new sid securely in Keystore/Keychain
    Queue->>Dio: Replay Request A with new sid
    Queue->>Dio: Replay Request B with new sid
    note over Queue: Queue unlocked
    end

    API-->>Dio: 200 OK (Req A)
    API-->>Dio: 200 OK (Req B)
    Dio-->>App: Deliver payload to BLoCs
```

**Implementation Invariants:**
1. Endpoints in `NO_REFRESH_PATHS` (`/api/auth/login`, `/api/auth/refresh`, `/api/auth/forgot-password`, `/api/auth/reset-password`) are strictly bypassed by the refresh interceptor.
2. If `POST /api/auth/refresh` fails (HTTP 401/403 or network timeout), the cookie jar is wiped and an `AuthSessionExpired` event is broadcast, instantly kicking the application back to `LoginScreen`.

### 5.3 Secure Storage Layer
Session cookies (`sid`, `rt`) are stored using `flutter_secure_storage`:
- **Android:** EncryptedSharedPreferences backed by hardware Android Keystore (AES-256 GCM).
- **iOS:** Keychain with `kSecAttrAccessibleAfterFirstUnlock`.

---

## 6. Dependency Injection & Service Locator

**Choice:** `get_it` (v7.6.x) with lazy singleton registration.

```dart
final sl = GetIt.instance;

void initServiceLocator() {
  // Core Services
  sl.registerLazySingleton<SecureStorageService>(() => SecureStorageServiceImpl());
  sl.registerLazySingleton<CookieJar>(() => SecureCookieJar(sl()));
  sl.registerLazySingleton<Dio>(() => createDioInstance(sl()));
  sl.registerLazySingleton<LocationService>(() => LocationServiceImpl());
  sl.registerLazySingleton<WifiService>(() => WifiServiceImpl());
  sl.registerLazySingleton<CameraService>(() => CameraServiceImpl());
  sl.registerLazySingleton<RealtimeService>(() => RealtimeServiceImpl(sl()));

  // Repositories
  sl.registerLazySingleton<AuthRepository>(() => AuthRepositoryImpl(sl(), sl()));
  sl.registerLazySingleton<AttendanceRepository>(() => AttendanceRepositoryImpl(sl()));
  sl.registerLazySingleton<RequestsRepository>(() => RequestsRepositoryImpl(sl()));
  sl.registerLazySingleton<PayslipRepository>(() => PayslipRepositoryImpl(sl()));
  sl.registerLazySingleton<AccountRepository>(() => AccountRepositoryImpl(sl()));

  // Domain Orchestrators
  sl.registerFactory<PunchOrchestrator>(() => PunchOrchestrator(sl(), sl(), sl(), sl()));

  // Presentation BLoCs
  sl.registerFactory<AuthBloc>(() => AuthBloc(sl()));
  sl.registerFactory<AttendanceBloc>(() => AttendanceBloc(sl(), sl()));
  sl.registerFactory<RequestsBloc>(() => RequestsBloc(sl()));
  sl.registerFactory<PayslipBloc>(() => PayslipBloc(sl()));
  sl.registerFactory<AccountBloc>(() => AccountBloc(sl()));
  sl.registerFactory<OverviewBloc>(() => OverviewBloc(sl(), sl(), sl(), sl()));
}
```

---

## 7. Native Hardware Integrations

### 7.1 Multi-Factor Attendance Punch Pipeline
The `PunchOrchestrator` implements the exact 3-tier fallback sequence established in React Native:

```dart
class PunchOrchestrator {
  final AttendanceRepository repository;
  final WifiService wifiService;
  final LocationService locationService;
  final CameraService cameraService;

  Future<PunchResult> executePunch({
    required PunchAction action, // CHECK_IN or CHECK_OUT
    required TodayAttendance today,
  }) async {
    final isOutOffice = today.assignment.workplaceType == WorkplaceType.outOffice;

    // Direct Selfie if OUT_OFFICE
    if (isOutOffice) {
      final imagePath = await cameraService.captureSelfie();
      if (imagePath == null) return PunchResult.cancelled();
      return await repository.punch(action: action, workMode: 'OUT_OFFICE', selfiePath: imagePath);
    }

    // Tier 1: Hardware Wi-Fi BSSID matching
    if (today.assignment.hasWifiNetworks != false) {
      final wifi = await wifiService.getCurrentWifi();
      if (wifi.bssid != null) {
        try {
          return await repository.punch(action: action, workMode: 'IN_OFFICE', wifiBssid: wifi.bssid, wifiSsid: wifi.ssid);
        } on ApiException catch (e) {
          if (e.code != 'SELFIE_REQUIRED') rethrow;
        }
      }
    }

    // Tier 2: High-accuracy GPS Geofencing
    final position = await locationService.getCurrentLocation();
    try {
      return await repository.punch(
        action: action,
        workMode: 'IN_OFFICE',
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyMeters: position.accuracy,
      );
    } on ApiException catch (e) {
      if (e.code != 'SELFIE_REQUIRED') rethrow;
    }

    // Tier 3: Manager Approval Selfie Fallback
    final imagePath = await cameraService.captureSelfie();
    if (imagePath == null) return PunchResult.cancelled();
    return await repository.punch(
      action: action,
      workMode: 'IN_OFFICE',
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyMeters: position.accuracy,
      selfiePath: imagePath,
    );
  }
}
```

### 7.2 Native Packages & Permissions Configuration

1. **Wi-Fi Extraction (`network_info_plus: ^5.0.0`):**
   - Android: `ACCESS_FINE_LOCATION`, `ACCESS_WIFI_STATE`, `NEARBY_WIFI_DEVICES`.
   - iOS: `NSLocationWhenInUseUsageDescription` + Entitlement `com.apple.developer.networking.wifi-info`.
2. **GPS Geolocation (`geolocator: ^13.0.0`):**
   - Configured with `LocationAccuracy.high` and timeout of 10 seconds.
3. **Camera Selfie (`image_picker: ^1.1.0`):**
   - Configured with `preferredCameraDevice: CameraDevice.front`, `imageQuality: 60`, `maxWidth: 1200`.

---

## 8. Error Handling & Localization

All exceptions are parsed into typed `AppException` instances and transformed into clear, professional Vietnamese text matching `friendlyEmployeeError` and `friendlyAuthError`:

```dart
class ErrorResolver {
  static String resolve(dynamic error) {
    if (error is ApiException) {
      switch (error.code) {
        case 'ASSIGNMENT_NOT_CONFIGURED':
          return 'Bạn chưa được phân ca hoặc nơi làm việc. Vui lòng liên hệ HR.';
        case 'ALREADY_CHECKED_IN':
          return 'Bạn đã vào ca hôm nay.';
        case 'ALREADY_CHECKED_OUT':
          return 'Bạn đã hoàn thành ca hôm nay.';
        case 'SELFIE_REQUIRED':
          return 'Không xác thực được vị trí công ty. Vui lòng chấm công bằng ảnh selfie.';
        case 'LOW_LOCATION_ACCURACY':
          return 'Tín hiệu GPS chưa đủ chính xác. Hãy ra nơi thoáng hơn và thử lại.';
        case 'OVERTIME_OVERLAPS_SCHEDULE':
          return 'Khung giờ OT đang trùng với ca làm chính.';
        case 'OVERTIME_RETROACTIVE_REASON_REQUIRED':
          return 'Đăng ký tăng ca muộn cần nêu rõ lý do khai báo muộn.';
        case 'AUTH_INVALID_CREDENTIALS':
          return 'Tài khoản hoặc mật khẩu không đúng.';
        case 'AUTH_PASSWORD_POLICY_FAILED':
          return 'Mật khẩu mới cần ít nhất 8 ký tự, gồm chữ và số, và không trùng mật khẩu hiện tại.';
      }
      return error.message ?? 'Không thể xử lý yêu cầu.';
    }
    return 'Lỗi kết nối máy chủ. Vui lòng thử lại sau.';
  }
}
```

---

## 9. Testing & Quality Assurance Architecture

```
Apps/mobile_flutter/test/
├── unit/
│   ├── core/network/auth_interceptor_test.dart   # Tests 401 queued token refresh & concurrent lock
│   ├── core/network/cookie_manager_test.dart      # Tests cookie expiration & serialization
│   ├── features/attendance/punch_orchestrator_test.dart # Tests 3-tier fallback execution
│   └── features/requests/leave_bloc_test.dart    # Tests live preview debouncing
├── widget/
│   ├── shared/app_button_test.dart               # Tests button states (loading, disabled, danger)
│   ├── shared/status_badge_test.dart             # Tests domain status mapping
│   └── features/auth/login_screen_test.dart      # Tests validation triggers & error banners
└── integration/
    └── full_login_and_punch_flow_test.dart       # End-to-end integration with mock server
```

*(End of Target Architecture Specification)*

