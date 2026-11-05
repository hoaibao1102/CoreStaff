import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/features/account/data/account_repository.dart';
import 'package:corestaff_mobile/features/account/data/models/employee_profile_dto.dart';
import 'package:corestaff_mobile/features/account/presentation/bloc/account_bloc.dart';
import 'package:corestaff_mobile/features/attendance/data/attendance_repository.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_assignment_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_history_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_summary_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/today_attendance_dto.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/attendance_bloc.dart';
import 'package:corestaff_mobile/features/attendance/presentation/screens/attendance_screen.dart';
import 'package:corestaff_mobile/features/auth/data/models/auth_user_dto.dart';
import 'package:corestaff_mobile/features/overview/presentation/bloc/overview_bloc.dart';
import 'package:corestaff_mobile/features/overview/presentation/screens/overview_screen.dart';
import 'package:corestaff_mobile/features/payslip/data/payslip_repository.dart';
import 'package:corestaff_mobile/features/payslip/presentation/bloc/payslip_bloc.dart';
import 'package:corestaff_mobile/features/attendance/data/models/punch_result_dto.dart';
import 'package:corestaff_mobile/features/attendance/domain/services/punch_coordinator.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/punch_bloc.dart';
import 'package:corestaff_mobile/features/requests/data/requests_repository.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/requests_bloc.dart';
import 'package:corestaff_mobile/features/shell/presentation/screens/main_shell_screen.dart';

class MockAttendanceRepository extends Mock implements AttendanceRepository {}

class MockRequestsRepository extends Mock implements RequestsRepository {}

class MockPayslipRepository extends Mock implements PayslipRepository {}

class MockAccountRepository extends Mock implements AccountRepository {}

class MockPunchCoordinator extends Mock implements PunchCoordinator {}

void main() {
  late MockAttendanceRepository mockAttendance;
  late MockRequestsRepository mockRequests;
  late MockPayslipRepository mockPayslips;
  late MockAccountRepository mockAccount;

  const sampleUser = AuthUser(
    id: 'u1',
    email: 'nam.nv@anphat.com',
    fullName: 'Nguyễn Văn Nam',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
  );

  const sampleToday = TodayAttendanceDto(
    workDate: '2026-11-04',
    serverTime: '2026-11-04T12:00:00.000Z',
    attendanceStatus: 'CHECKED_IN',
    availableAction: 'CHECK_OUT',
    workingMinutes: 240,
    lateMinutes: 0,
    earlyMinutes: 0,
    assignment: AttendanceAssignmentDto(
      shiftName: 'Ca hành chính',
      shiftHours: '08:00 - 17:00',
      startTime: '08:00',
      endTime: '17:00',
      workplaceName: 'Bitexco',
      address: 'Hồ Chí Minh',
    ),
  );

  const sampleHistory = AttendanceHistoryDto(
    month: '2026-11',
    totalDays: 30,
    summary: AttendanceSummaryDto(),
    items: [],
  );

  const sampleProfile = EmployeeProfileDto(
    id: 'u1',
    email: 'nam.nv@anphat.com',
    fullName: 'Nguyễn Văn Nam',
    employeeCode: 'EMP001',
    employmentType: 'FULL_TIME',
    employmentStatus: 'ACTIVE',
  );

  setUp(() {
    mockAttendance = MockAttendanceRepository();
    mockRequests = MockRequestsRepository();
    mockPayslips = MockPayslipRepository();
    mockAccount = MockAccountRepository();

    when(() => mockAttendance.getTodayAttendance()).thenAnswer((_) async => sampleToday);
    when(() => mockAttendance.getAttendanceHistory(any())).thenAnswer((_) async => sampleHistory);
    when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => []);
    when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => []);
    when(() => mockPayslips.getMyPayslips()).thenAnswer((_) async => []);
    when(() => mockAccount.getMyProfile()).thenAnswer((_) async => sampleProfile);

    final sl = GetIt.instance;
    if (sl.isRegistered<OverviewBloc>()) sl.unregister<OverviewBloc>();
    if (sl.isRegistered<AttendanceBloc>()) sl.unregister<AttendanceBloc>();
    if (sl.isRegistered<RequestsBloc>()) sl.unregister<RequestsBloc>();
    if (sl.isRegistered<PayslipBloc>()) sl.unregister<PayslipBloc>();
    if (sl.isRegistered<AccountBloc>()) sl.unregister<AccountBloc>();

    sl.registerFactory<OverviewBloc>(
      () => OverviewBloc(
        attendanceRepository: mockAttendance,
        requestsRepository: mockRequests,
        payslipRepository: mockPayslips,
      ),
    );
    sl.registerFactory<AttendanceBloc>(
      () => AttendanceBloc(attendanceRepository: mockAttendance),
    );
    sl.registerFactory<RequestsBloc>(
      () => RequestsBloc(requestsRepository: mockRequests),
    );
    sl.registerFactory<PayslipBloc>(
      () => PayslipBloc(payslipRepository: mockPayslips),
    );
    sl.registerFactory<AccountBloc>(
      () => AccountBloc(accountRepository: mockAccount),
    );
  });

  setUpAll(() {
    registerFallbackValue(sampleToday);
  });

  tearDown(() {
    final sl = GetIt.instance;
    if (sl.isRegistered<PunchBloc>()) sl.unregister<PunchBloc>();
    if (sl.isRegistered<OverviewBloc>()) sl.unregister<OverviewBloc>();
    if (sl.isRegistered<AttendanceBloc>()) sl.unregister<AttendanceBloc>();
    if (sl.isRegistered<RequestsBloc>()) sl.unregister<RequestsBloc>();
    if (sl.isRegistered<PayslipBloc>()) sl.unregister<PayslipBloc>();
    if (sl.isRegistered<AccountBloc>()) sl.unregister<AccountBloc>();
  });

  group('MainShellScreen Sprint 4 Integration Tests', () {
    testWidgets('renders OverviewScreen on initial tab 0', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: MainShellScreen(
            user: sampleUser,
            onChangePassword: () {},
            onLogout: () {},
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(OverviewScreen), findsOneWidget);
      expect(find.text('KHÔNG GIAN CÁ NHÂN'), findsOneWidget);
      expect(find.text('Nguyễn Văn Nam'), findsOneWidget);
    });

    testWidgets('switches to AttendanceScreen when tapping Attendance tab item', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: MainShellScreen(
            user: sampleUser,
            onChangePassword: () {},
            onLogout: () {},
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap attendance bottom nav tab
      await tester.tap(find.text('Chấm công'));
      await tester.pumpAndSettle();

      expect(find.byType(AttendanceScreen), findsOneWidget);
      expect(find.text('CHẤM CÔNG'), findsOneWidget);
      expect(find.text('Ngày làm việc'), findsOneWidget);
    });

    testWidgets('overview quick shortcut switches to Attendance tab', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: MainShellScreen(
            user: sampleUser,
            onChangePassword: () {},
            onLogout: () {},
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap action link in today shift card
      await tester.tap(find.text('Mở chấm công để ra ca'));
      await tester.pumpAndSettle();

      expect(find.byType(AttendanceScreen), findsOneWidget);
      expect(find.text('CHẤM CÔNG'), findsOneWidget);
    });

    testWidgets('cross-tab refresh: successful punch in Attendance refreshes OverviewBloc and AttendanceBloc', (tester) async {
      final mockCoordinator = MockPunchCoordinator();
      when(() => mockCoordinator.executeWaterfall(
            today: any(named: 'today'),
            onProgress: any(named: 'onProgress'),
          )).thenAnswer((_) async => const PunchCoordinatorSuccess(
            result: PunchResultDto(
              workDate: '2026-11-04',
              attendanceStatus: 'COMPLETED',
              availableAction: 'NONE',
            ),
            method: 'NETWORK',
          ));

      final sl = GetIt.instance;
      sl.registerFactory<PunchBloc>(
        () => PunchBloc(punchCoordinator: mockCoordinator),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: MainShellScreen(
            user: sampleUser,
            onChangePassword: () {},
            onLogout: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Reset mock invocation counts after initial tab load
      clearInteractions(mockAttendance);
      clearInteractions(mockRequests);

      // Switch to Attendance tab
      await tester.tap(find.text('Chấm công'));
      await tester.pumpAndSettle();

      // Tap punch action button
      final punchButton = find.text('Xác nhận ra ca');
      expect(punchButton, findsOneWidget);
      await tester.tap(punchButton);
      await tester.pumpAndSettle();

      // Dialog confirmation
      expect(find.text('Ghi nhận kết thúc ca làm việc hôm nay?'), findsOneWidget);
      final confirmBtn = find.widgetWithText(ElevatedButton, 'Ra ca');
      expect(confirmBtn, findsOneWidget);
      await tester.tap(confirmBtn);
      await tester.pumpAndSettle();

      // SnackBar and Banner displayed
      expect(find.text('Đã ghi nhận thời gian ra ca.'), findsNWidgets(2));
      expect(find.byType(SnackBar), findsOneWidget);

      // Verify cross-tab refresh: mockAttendance.getTodayAttendance called by both AttendanceBloc and OverviewBloc
      verify(() => mockAttendance.getTodayAttendance()).called(greaterThanOrEqualTo(2));
      // Verify OverviewBloc also refreshed other endpoints
      verify(() => mockRequests.getMyLeaveRequests()).called(1);
    });
  });
}
