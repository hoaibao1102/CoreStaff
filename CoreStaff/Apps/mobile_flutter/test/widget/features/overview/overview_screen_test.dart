import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/attendance/data/attendance_repository.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_assignment_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_event_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/today_attendance_dto.dart';
import 'package:corestaff_mobile/features/auth/data/models/auth_user_dto.dart';
import 'package:corestaff_mobile/features/overview/presentation/bloc/overview_bloc.dart';
import 'package:corestaff_mobile/features/overview/presentation/screens/overview_screen.dart';
import 'package:corestaff_mobile/features/payslip/data/models/payslip_dto.dart';
import 'package:corestaff_mobile/features/payslip/data/payslip_repository.dart';
import 'package:corestaff_mobile/features/requests/data/models/leave_request_dto.dart';
import 'package:corestaff_mobile/features/requests/data/models/overtime_request_dto.dart';
import 'package:corestaff_mobile/features/requests/data/requests_repository.dart';
import 'package:corestaff_mobile/features/shell/presentation/widgets/custom_bottom_nav_bar.dart';

class MockAttendanceRepository extends Mock implements AttendanceRepository {}

class MockRequestsRepository extends Mock implements RequestsRepository {}

class MockPayslipRepository extends Mock implements PayslipRepository {}

void main() {
  late MockAttendanceRepository mockAttendance;
  late MockRequestsRepository mockRequests;
  late MockPayslipRepository mockPayslips;

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
    checkIn: AttendanceEventDto(
      eventId: 'evt_1',
      eventType: 'CHECK_IN',
      method: 'NETWORK',
      recordedAt: '2026-11-04T01:00:00.000Z', // 08:00 VN
      approvalStatus: 'NOT_REQUIRED',
    ),
    assignment: AttendanceAssignmentDto(
      shiftName: 'Ca hành chính',
      shiftHours: '08:00 - 17:00',
      startTime: '08:00',
      endTime: '17:00',
      workplaceName: 'Bitexco Tower',
      address: 'Hồ Chí Minh',
    ),
  );

  const sampleLeaves = [
    LeaveRequestDto(
      id: 'l1',
      startDate: '2026-11-10',
      endDate: '2026-11-10',
      leaveType: 'PAID_LEAVE',
      durationType: 'FULL_DAY',
      reason: 'Bận việc riêng gia đình',
      status: 'PENDING_MANAGER',
    ),
  ];

  const sampleOvertime = [
    OvertimeRequestDto(
      id: 'o1',
      workDate: '2026-11-05',
      reason: 'Hoàn thành báo cáo quý',
      status: 'PENDING',
    ),
  ];

  const samplePayslips = [
    PayslipDto(
      id: 'p1',
      periodLabel: '10/2026',
      status: 'RELEASED',
      grossEarnings: 20000000,
      netSalary: 18000000,
      socialInsurance: 1600000,
      healthInsurance: 300000,
      unemploymentInsurance: 100000,
      pitAmount: 0,
      otherDeductions: 0,
    ),
  ];

  setUp(() {
    mockAttendance = MockAttendanceRepository();
    mockRequests = MockRequestsRepository();
    mockPayslips = MockPayslipRepository();

    final sl = GetIt.instance;
    if (sl.isRegistered<OverviewBloc>()) {
      sl.unregister<OverviewBloc>();
    }
    sl.registerFactory<OverviewBloc>(
      () => OverviewBloc(
        attendanceRepository: mockAttendance,
        requestsRepository: mockRequests,
        payslipRepository: mockPayslips,
      ),
    );
  });

  tearDown(() {
    final sl = GetIt.instance;
    if (sl.isRegistered<OverviewBloc>()) {
      sl.unregister<OverviewBloc>();
    }
  });

  group('OverviewScreen Widget Tests', () {
    testWidgets('renders header, shift card, attention metrics, and quick access rows', (tester) async {
      when(() => mockAttendance.getTodayAttendance()).thenAnswer((_) async => sampleToday);
      when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => sampleLeaves);
      when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => sampleOvertime);
      when(() => mockPayslips.getMyPayslips()).thenAnswer((_) async => samplePayslips);

      ShellTab? navigatedTab;

      await tester.pumpWidget(
        MaterialApp(
          home: OverviewScreen(
            user: sampleUser,
            onNavigate: (tab) => navigatedTab = tab,
          ),
        ),
      );

      // Loading state
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      await tester.pumpAndSettle();

      // Header verification
      expect(find.text('KHÔNG GIAN CÁ NHÂN'), findsOneWidget);
      expect(find.text('Chào bạn,'), findsOneWidget);
      expect(find.text('Nguyễn Văn Nam'), findsOneWidget);
      expect(find.text('VN'), findsOneWidget); // 2-letter initials for 'Nguyễn Văn Nam'

      // Shift Card verification
      expect(find.text('CA LÀM HÔM NAY'), findsOneWidget);
      expect(find.text('Ca hành chính'), findsOneWidget);
      expect(find.textContaining('08:00 - 17:00'), findsOneWidget);
      expect(find.text('08:00'), findsOneWidget); // Vào ca
      expect(find.text('--:--'), findsOneWidget); // Ra ca
      expect(find.text('Mở chấm công để ra ca'), findsOneWidget);

      // Attention Counters verification
      expect(find.text('Cần bạn chú ý'), findsOneWidget);
      expect(find.text('Đơn đang chờ'), findsOneWidget);
      expect(find.text('Phiếu lương mới'), findsOneWidget);
      // Pending requests = 1 leave + 1 ot = 2
      expect(find.text('2'), findsOneWidget);
      // New payslips = 1 RELEASED = 1
      expect(find.text('1'), findsOneWidget);

      // Quick access rows verification
      expect(find.text('Truy cập nhanh'), findsOneWidget);
      expect(find.text('Chấm công & lịch sử'), findsOneWidget);
      expect(find.text('Nghỉ phép & tăng ca'), findsOneWidget);
      expect(find.text('Phiếu lương & thu nhập'), findsOneWidget);

      // Navigation via Shift Card action tap
      await tester.tap(find.text('Mở chấm công để ra ca'));
      expect(navigatedTab, ShellTab.attendance);

      // Navigation via "Đơn đang chờ" tap
      await tester.tap(find.text('Đơn đang chờ'));
      expect(navigatedTab, ShellTab.requests);

      // Navigation via "Phiếu lương mới" tap
      await tester.tap(find.text('Phiếu lương mới'));
      expect(navigatedTab, ShellTab.payslips);

      // Navigation via QuickAccessRow tap
      await tester.tap(find.text('Chấm công & lịch sử'));
      expect(navigatedTab, ShellTab.attendance);
    });

    testWidgets('renders ErrorBanner on partial service failure without blanking screen', (tester) async {
      when(() => mockAttendance.getTodayAttendance()).thenAnswer((_) async => sampleToday);
      when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => sampleLeaves);
      when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => sampleOvertime);
      when(() => mockPayslips.getMyPayslips()).thenThrow(
        const ApiException(
          code: 'INTERNAL_ERROR',
          statusCode: 500,
          message: 'Dịch vụ phiếu lương tạm ngưng bảo trì',
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: OverviewScreen(
            user: sampleUser,
            onNavigate: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Error banner is present
      expect(find.text('Dịch vụ phiếu lương tạm ngưng bảo trì'), findsOneWidget);

      // Other cards are still rendered gracefully
      expect(find.text('Ca hành chính'), findsOneWidget);
      expect(find.text('Đơn đang chờ'), findsOneWidget);
      expect(find.text('2'), findsOneWidget); // 1 leave + 1 ot
      expect(find.text('Phiếu lương mới'), findsOneWidget);
      expect(find.text('0'), findsOneWidget); // fallback 0 for failed payslips
    });
  });
}
