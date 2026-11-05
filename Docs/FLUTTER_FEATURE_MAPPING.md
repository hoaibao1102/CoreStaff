# CORESTAFF MOBILE — FLUTTER FEATURE MIGRATION MAPPING

> **Document Version:** 1.0.0  
> **Date:** 2026-11-03  
> **Status:** APPROVED BASELINE — PENDING IMPLEMENTATION AUTHORIZATION  
> **Scope:** Scope A — Employee/Manager self-service mobile functionality verified in `Apps/mobile`. Excludes web-only administrative operations.

---

## 1. Scope Definition & Boundary Rules

### 1.1 In-Scope (Scope A Baseline)
Scope A strictly encompasses the features, screens, and background services that currently exist in the production React Native mobile client (`Apps/mobile`):
- **Core Platform & Network Discovery:** Dynamic API base resolution with fallback failover to local emulator environments, system health check probes (`/api/healthz`), app lifecycle state resumption.
- **Authentication & Security:** Email/employee code login with dual-token HttpOnly cookies (`sid`, `rt`), transparent session rotation on HTTP 401, logout/session revocation, self-service password reset (forgot password email token request and token consumption), forced temporary password change, and voluntary password change.
- **Role Isolation Guard:** Client-level restriction barring `HR` and `SYSTEM_ADMIN` personas from mobile workspace tabs with explicit web redirect guidance.
- **Navigation Shell:** 5-tab persistent bottom navigation bar (`Overview`, `Attendance`, `Requests`, `Payslips`, `Account`) featuring a raised center primary action button for attendance.
- **Overview Dashboard:** Greeting, user avatar initials, live shift card, real-time working hours and location metadata, pending approval counter badge, unread payslip counter badge, and quick access navigation shortcuts.
- **Multi-Factor Attendance Engine:** Real-time clock, today's punch state timeline (check-in / check-out), daily working minutes, late/early duration counters, 3-tier attendance verification pipeline (Hardware Wi-Fi BSSID matching → High-accuracy GPS geofencing → Front-camera photo selfie fallback with S3 upload and manager notification), and monthly punch history calendar.
- **Leave Request Management:** Paginated/filterable list of personal leave requests, real-time working interval calculation preview against shift schedules and break times (`/api/leave-requests/preview`), multi-duration submission (`FULL_DAY`, `MORNING_HALF`, `AFTERNOON_HALF`, `CUSTOM_HOURS`), and pending request cancellation.
- **Overtime Request Management:** Paginated list of personal overtime registrations, overtime request creation with schedule overlap prevention, retroactive reason enforcement, and backend auto-classification compliance projection.
- **Payslip & Compensation Self-Service:** Overview of latest released net salary, historical payslip listing, expandable earning and statutory deduction breakdown (BHXH, BHYT, BHTN, progressive PIT, allowances), and read-receipt audit logging (`/api/payslips/me/:id/viewed`).
- **Account & Master Profile:** Employee master profile inspection (department, job position, workplace, reporting manager, join date, contact details), status pill, and secure session sign-out dialog.
- **Real-Time Synchronization:** Socket.io client listening on namespace `/events` for tenant/user invalidation events (`attendance:changed`, `leave:changed`, `payslip:released`, `request:decided`, `compliance:warning`).

### 1.2 Explicitly Out-of-Scope (Web-Only Functionality)
The following capabilities exist in `Apps/web` and `Apps/api`, but do NOT exist in `Apps/mobile` and are strictly excluded from the mobile Flutter migration:
- Platform administration, organization provisioning, subscription management (`/platform/*`).
- HR workforce management: creating departments, job positions, shift templates, workplaces, geofences (`/hr/*`).
- Employee master import via Excel, dependent tax verification, contract file uploads.
- Department Manager approval queue for reviewing team selfies, approving team overtime, or evaluating employee KPIs (`/api/manager/*`).
- Timesheet period blocker reconciliation, department confirmations, and atomic period closure (`/api/hr/timesheet-periods/*`).
- Statutory payroll run configuration, proration calculation, and salary release (`/api/payroll-runs/*`).
- Excel export of payroll reports or attendance summaries.

---

## 2. Priority Ranking Methodology

Migration priority is calculated using an objective weighted scoring formula across five dimensions:

$$\text{Priority Score} = (\text{Dependency} \times 0.30) + (\text{Business Value} \times 0.25) + (\text{Technical Risk} \times 0.20) + (\text{Reusability} \times 0.15) - (\text{Complexity} \times 0.10)$$

| Priority Tier | Score Range | Strategy & Focus |
|---|---|---|
| **P0 (Foundational)** | 8.5 – 10.0 | Core networking, secure storage, authentication, shell navigation, and common design system primitives. Without P0, no other feature can function or be tested. |
| **P1 (Core Value)** | 7.0 – 8.4 | Daily high-frequency employee touchpoints: Profile inspection, Payslip viewing, Leave & Overtime requests. Low native hardware risk, immediate business value. |
| **P2 (Complex Hardware)** | 5.5 – 6.9 | Multi-factor attendance punch verification pipeline (Wi-Fi BSSID, GPS geofencing, Camera selfie multipart upload). Highest platform permission complexity. |
| **P3 (Enhancements)** | < 5.5 | Real-time push updates via WebSockets and app lifecycle foreground invalidation. |

---

## 3. Comprehensive Feature Mapping Table

| # | RN Feature Description | RN Source Files | Proposed Flutter Target Files | API Dependencies | Priority Tier | Rationale |
|---|---|---|---|---|---|---|
| **01** | **API Base Resolution & Health Probe** | `Apps/mobile/src/config.ts:65-74`<br>`Apps/mobile/App.tsx:29-43` | `lib/core/config/api_config.dart`<br>`lib/core/network/health_service.dart` | `GET /api/healthz` | **P0** | Prerequisite for all network traffic. Verifies backend reachability and timezone compatibility (`Asia/Ho_Chi_Minh`). |
| **02** | **Design System & UI Primitives** | `Apps/mobile/src/theme.ts`<br>`Apps/mobile/src/components/ui.tsx`<br>`Apps/mobile/src/components/AppIcon.tsx` | `lib/core/theme/app_colors.dart`<br>`lib/core/theme/app_typography.dart`<br>`lib/core/theme/app_theme.dart`<br>`lib/shared/widgets/app_button.dart`<br>`lib/shared/widgets/app_card.dart`<br>`lib/shared/widgets/app_text_field.dart`<br>`lib/shared/widgets/status_badge.dart`<br>`lib/shared/widgets/banners.dart`<br>`lib/shared/widgets/states.dart` | None (UI Primitives) | **P0** | Visual foundation. Reusable across all form and dashboard screens to guarantee 100% visual parity with `MOBILE_DESIGN_MASTER.md`. |
| **03** | **Secure Cookie Session & Networking Engine** | `Apps/mobile/src/auth.ts:46-91` | `lib/core/network/api_client.dart`<br>`lib/core/network/cookie_manager.dart`<br>`lib/core/network/auth_interceptor.dart`<br>`lib/core/storage/secure_storage_service.dart` | `POST /api/auth/refresh` | **P0** | Architectural core. Manages HttpOnly cookies (`sid`, `rt`), serializes concurrent 401 refresh requests, prevents race conditions. |
| **04** | **User Login & Credential Authentication** | `Apps/mobile/App.tsx:83-92`<br>`Apps/mobile/src/auth.ts:93-95` | `lib/features/auth/presentation/screens/login_screen.dart`<br>`lib/features/auth/data/auth_repository.dart`<br>`lib/features/auth/presentation/bloc/auth_bloc.dart` | `POST /api/auth/login`<br>`GET /api/auth/me` | **P0** | Primary entry barrier. Authenticates user and retrieves role and `mustChangePassword` status. |
| **05** | **Password Management (Forgot & Reset)** | `Apps/mobile/App.tsx:94-104`<br>`Apps/mobile/src/auth.ts:100-105` | `lib/features/auth/presentation/screens/forgot_password_screen.dart`<br>`lib/features/auth/presentation/screens/reset_password_screen.dart` | `POST /api/auth/forgot-password`<br>`POST /api/auth/reset-password` | **P0** | Essential account recovery self-service, eliminating administrative support overhead. |
| **06** | **Mandatory & Voluntary Password Change** | `Apps/mobile/App.tsx:106-110`<br>`Apps/mobile/src/auth.ts:97-99` | `lib/features/auth/presentation/screens/change_password_screen.dart` | `POST /api/auth/change-password` | **P0** | Security compliance rule: users with temporary passwords are hard-locked until password update succeeds. |
| **07** | **Role-Based Web Redirection Screen** | `Apps/mobile/App.tsx:117, 129` | `lib/features/shell/presentation/screens/unauthorized_role_screen.dart` | None (Client RBAC) | **P0** | Prevents `HR` and `SYSTEM_ADMIN` users from executing invalid employee workflows. |
| **08** | **5-Tab Navigation Shell with Raised Action FAB** | `Apps/mobile/App.tsx:112-138`<br>`Apps/mobile/src/components/BottomTabBar.tsx` | `lib/features/shell/presentation/screens/main_shell_screen.dart`<br>`lib/features/shell/presentation/widgets/custom_bottom_nav_bar.dart` | None (Navigation) | **P0** | Container for all five primary tabs: Overview, Requests, Attendance (Raised center FAB), Payslips, Account. |
| **09** | **Employee Master Profile & Account Overview** | `Apps/mobile/src/screens/AccountScreen.tsx`<br>`Apps/mobile/src/employee-api.ts:245-247` | `lib/features/account/presentation/screens/account_screen.dart`<br>`lib/features/account/data/account_repository.dart`<br>`lib/features/account/presentation/bloc/account_bloc.dart` | `GET /api/hr/employees/me`<br>`POST /api/auth/logout` | **P1** | Low complexity, establishes data fetching patterns and displays employment contract context. |
| **10** | **Payslip History & Read-Receipt Audit** | `Apps/mobile/src/screens/PayslipsScreen.tsx`<br>`Apps/mobile/src/employee-api.ts:249-253` | `lib/features/payslip/presentation/screens/payslips_screen.dart`<br>`lib/features/payslip/data/payslip_repository.dart`<br>`lib/features/payslip/presentation/bloc/payslip_bloc.dart`<br>`lib/features/payslip/presentation/widgets/payslip_card.dart` | `GET /api/payslips/me`<br>`POST /api/payslips/me/:id/viewed` | **P1** | High employee value. Pure REST query with expandable deduction details and audit receipt updates. |
| **11** | **Leave Request Management & Shift Preview** | `Apps/mobile/src/screens/RequestsScreen.tsx:54-137`<br>`Apps/mobile/src/employee-api.ts:224-238` | `lib/features/requests/presentation/screens/requests_screen.dart`<br>`lib/features/requests/presentation/widgets/leave_modal.dart`<br>`lib/features/requests/data/leave_repository.dart`<br>`lib/features/requests/presentation/bloc/leave_bloc.dart` | `GET /api/leave-requests/mine`<br>`POST /api/leave-requests/preview`<br>`POST /api/leave-requests`<br>`POST /api/leave-requests/mine/:id/cancel` | **P1** | High operational usage. Features debounced live calculation preview of working hours against shift templates. |
| **12** | **Overtime Request Submission & History** | `Apps/mobile/src/screens/RequestsScreen.tsx:54-137`<br>`Apps/mobile/src/employee-api.ts:239-244` | `lib/features/requests/presentation/widgets/overtime_modal.dart`<br>`lib/features/requests/data/overtime_repository.dart`<br>`lib/features/requests/presentation/bloc/overtime_bloc.dart` | `GET /api/overtime/mine`<br>`POST /api/overtime` | **P1** | Critical compliance workflow. Backend Derives OT type autonomously; mobile enforces shift non-overlap. |
| **13** | **Overview Screen Live Dashboard** | `Apps/mobile/src/screens/OverviewScreen.tsx`<br>`Apps/mobile/src/employee-api.ts:169-171` | `lib/features/overview/presentation/screens/overview_screen.dart`<br>`lib/features/overview/presentation/bloc/overview_bloc.dart` | `GET /api/attendance/today`<br>`GET /api/leave-requests/mine`<br>`GET /api/overtime/mine`<br>`GET /api/payslips/me` | **P1** | Combines shift overview, action triggers, and aggregated status badges from multiple domain repositories. |
| **14** | **Attendance Live State & Monthly History** | `Apps/mobile/src/screens/AttendanceScreen.tsx`<br>`Apps/mobile/src/employee-api.ts:169-174` | `lib/features/attendance/presentation/screens/attendance_screen.dart`<br>`lib/features/attendance/data/attendance_repository.dart`<br>`lib/features/attendance/presentation/bloc/attendance_bloc.dart`<br>`lib/features/attendance/presentation/widgets/history_calendar.dart` | `GET /api/attendance/today`<br>`GET /api/attendance/history` | **P1** | Read-only presentation of today's schedule, timeline milestones, working minutes, and monthly historical punch cards. |
| **15** | **Hardware Permissions & Device Services** | `Apps/mobile/src/wifi.ts`<br>`Apps/mobile/src/screens/AttendanceScreen.tsx:15-33` | `lib/core/services/location_service.dart`<br>`lib/core/services/wifi_service.dart`<br>`lib/core/services/camera_service.dart`<br>`lib/core/services/permission_service.dart` | None (Platform Hardware) | **P2** | Native bridges for Location, Wi-Fi BSSID extraction, and Camera capture with unified runtime permission handling. |
| **16** | **Attendance Multi-Tier Verification Punch Engine** | `Apps/mobile/src/screens/AttendanceScreen.tsx:58-97`<br>`Apps/mobile/src/employee-api.ts:187-222` | `lib/features/attendance/domain/punch_verification_orchestrator.dart`<br>`lib/features/attendance/presentation/widgets/punch_action_button.dart` | `POST /api/attendance/check-in`<br>`POST /api/attendance/check-out` | **P2** | Complex 3-tier fallback pipeline (BSSID → GPS → Selfie Multipart). Requires high precision, timeout handling, and idempotency keys. |
| **17** | **Socket.io Real-Time Push Invalidation** | `Apps/mobile/src/realtime.ts:18-44`<br>`Apps/mobile/App.tsx:118-128` | `lib/core/network/realtime_service.dart` | WebSocket `/events` namespace | **P3** | Listens for server domain mutations (`attendance:changed`, `payslip:released`) and triggers reactive state reload. |
| **18** | **App Lifecycle Foreground Resumption** | `Apps/mobile/App.tsx:123-128` | `lib/core/services/app_lifecycle_manager.dart` | None (Platform Events) | **P3** | Subscribes to `WidgetsBindingObserver` to re-synchronize active screen data when app returns from background. |

---

## 4. Architectural Cross-Cutting Dependencies

The following matrix visualizes cross-feature coupling to guarantee that prerequisites are fully constructed before higher-level features are scheduled:

```
[01 API Config & Health] 
       ↓
[02 Design Tokens & UI Primitives] 
       ↓
[03 Secure Storage & Dio Cookie Client] 
       ↓
[04 Auth Repository & Login Flow]
       ↓
[06 Enforced Password Change] → [07 Role Guard] → [08 5-Tab Navigation Shell]
                                                        ↓
         ┌──────────────────────────────┬───────────────┴──────────────┬──────────────────────────────┐
         ↓                              ↓                              ↓                              ↓
[09 Account Profile]           [10 Payslip Module]          [11 Leave Requests]            [12 Overtime Requests]
         │                              │                              │                              │
         └──────────────────────────────┼──────────────────────────────┴──────────────────────────────┘
                                        ↓
                         [13 Overview Unified Dashboard]
                                        ↓
                         [14 Attendance State & History]
                                        ↓
                         [15 Hardware Native Services]
                                        ↓
                         [16 Attendance Punch Pipeline]
                                        ↓
                         [17 Realtime WebSocket Push]
                                        ↓
                         [18 App Lifecycle Resumption]
```

*(End of Feature Mapping Specification)*

