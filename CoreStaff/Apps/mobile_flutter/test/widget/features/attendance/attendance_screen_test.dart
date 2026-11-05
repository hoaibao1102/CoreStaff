import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/attendance/data/attendance_repository.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_assignment_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_day_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_event_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_history_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_requirements_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_summary_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/today_attendance_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/punch_result_dto.dart';
import 'package:corestaff_mobile/features/attendance/domain/services/punch_coordinator.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/attendance_bloc.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/punch_bloc.dart';
import 'package:corestaff_mobile/features/attendance/presentation/screens/attendance_screen.dart';

class MockAttendanceRepository extends Mock implements AttendanceRepository {}

class MockPunchCoordinator extends Mock implements PunchCoordinator {}

void main() {
  late MockAttendanceRepository mockRepository;

  const sampleAssignment = AttendanceAssignmentDto(
    shiftName: 'Ca hành chính',
    shiftHours: '08:00 - 17:00',
    startTime: '08:00',
    endTime: '17:00',
    workplaceName: 'Văn phòng Bitexco',
    address: 'Hồ Chí Minh',
  );

  const sampleToday = TodayAttendanceDto(
    workDate: '2026-11-04',
    serverTime: '2026-11-04T12:00:00.000Z',
    attendanceStatus: 'CHECKED_IN',
    availableAction: 'CHECK_OUT',
    workingMinutes: 240,
    lateMinutes: 10,
    earlyMinutes: 0,
    checkIn: AttendanceEventDto(
      eventId: 'evt_1',
      eventType: 'CHECK_IN',
      method: 'NETWORK',
      recordedAt: '2026-11-04T01:10:00.000Z', // 08:10 VN
      approvalStatus: 'NOT_REQUIRED',
    ),
    assignment: sampleAssignment,
  );

  const sampleHistory = AttendanceHistoryDto(
    month: '2026-11',
    totalDays: 30,
    summary: AttendanceSummaryDto(
      workingDays: 4,
      totalWorkingMinutes: 1920,
      lateDays: 1,
      earlyDays: 0,
      otMinutes: 0,
      otDays: 0,
    ),
    items: [
      AttendanceDayDto(
        id: 'd1',
        workDate: '2026-11-03',
        attendanceStatus: 'COMPLETED',
        workingMinutes: 480,
        lateMinutes: 0,
        earlyMinutes: 0,
        checkIn: AttendanceEventDto(
          eventId: 'in1',
          eventType: 'CHECK_IN',
          method: 'NETWORK',
          recordedAt: '2026-11-03T01:00:00.000Z',
          approvalStatus: 'NOT_REQUIRED',
        ),
        checkOut: AttendanceEventDto(
          eventId: 'out1',
          eventType: 'CHECK_OUT',
          method: 'NETWORK',
          recordedAt: '2026-11-03T10:00:00.000Z',
          approvalStatus: 'NOT_REQUIRED',
        ),
      ),
    ],
  );

  setUp(() {
    mockRepository = MockAttendanceRepository();
    final sl = GetIt.instance;
    if (sl.isRegistered<AttendanceBloc>()) {
      sl.unregister<AttendanceBloc>();
    }
    if (sl.isRegistered<AttendanceRepository>()) {
      sl.unregister<AttendanceRepository>();
    }

    sl.registerLazySingleton<AttendanceRepository>(() => mockRepository);
    sl.registerFactory<AttendanceBloc>(
      () => AttendanceBloc(attendanceRepository: sl<AttendanceRepository>()),
    );
  });

  setUpAll(() {
    registerFallbackValue(sampleToday);
  });

  tearDown(() {
    final sl = GetIt.instance;
    if (sl.isRegistered<PunchBloc>()) {
      sl.unregister<PunchBloc>();
    }
    if (sl.isRegistered<AttendanceBloc>()) {
      sl.unregister<AttendanceBloc>();
    }
    if (sl.isRegistered<AttendanceRepository>()) {
      sl.unregister<AttendanceRepository>();
    }
  });

  group('AttendanceScreen Widget Tests', () {
    testWidgets('renders hero card, timeline points, metric grid, and day cards', (tester) async {
      when(() => mockRepository.getTodayAttendance()).thenAnswer((_) async => sampleToday);
      when(() => mockRepository.getAttendanceHistory(any())).thenAnswer((_) async => sampleHistory);

      await tester.pumpWidget(
        const MaterialApp(
          home: AttendanceScreen(),
        ),
      );

      // Initial loading
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      await tester.pumpAndSettle();

      // Header
      expect(find.text('CHẤM CÔNG'), findsOneWidget);
      expect(find.text('Ngày làm việc'), findsOneWidget);

      // Hero Card elements
      expect(find.text('CA HÀNH CHÍNH'), findsOneWidget);
      expect(find.text('08:00 - 17:00'), findsNWidgets(2)); // in hero card and in day card
      expect(find.text('VĂN PHÒNG BITEXCO - HỒ CHÍ MINH'), findsNothing);
      expect(find.textContaining('Bitexco'), findsOneWidget);
      expect(find.text('Xác nhận ra ca'), findsOneWidget);

      // Timeline labels
      expect(find.text('VÀO CA'), findsOneWidget);
      expect(find.text('RA CA'), findsOneWidget);

      // Metric grid labels
      expect(find.text('Giờ làm'), findsOneWidget);
      expect(find.text('Đi muộn'), findsNWidgets(2)); // in grid and in summary row
      expect(find.text('Về sớm'), findsOneWidget);

      // Day card
      expect(find.text('03/11/2026'), findsOneWidget);
    });

    testWidgets('renders LeaveIntervalCard when attendanceRequirements is present', (tester) async {
      const todayWithLeave = TodayAttendanceDto(
        workDate: '2026-11-04',
        serverTime: '2026-11-04T12:00:00.000Z',
        attendanceStatus: 'NOT_CHECKED_IN',
        availableAction: 'CHECK_IN',
        assignment: sampleAssignment,
        attendanceRequirements: AttendanceRequirementsDto(
          approvedLeaveIntervals: [TimeIntervalDto(from: '08:00', to: '12:00')],
          requiredWorkingIntervals: [TimeIntervalDto(from: '13:00', to: '17:00')],
          approvedLeaveMinutes: 240,
          requiredWorkingMinutes: 240,
        ),
      );

      when(() => mockRepository.getTodayAttendance()).thenAnswer((_) async => todayWithLeave);
      when(() => mockRepository.getAttendanceHistory(any())).thenAnswer((_) async => sampleHistory);

      await tester.pumpWidget(
        const MaterialApp(
          home: AttendanceScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Nghỉ phép đã được HR áp dụng'), findsOneWidget);
      expect(find.textContaining('08:00–12:00'), findsOneWidget);
      expect(find.textContaining('13:00–17:00'), findsOneWidget);
    });

    testWidgets('renders PendingLeaveNoticeCard when pendingLeave is present', (tester) async {
      const todayWithPending = TodayAttendanceDto(
        workDate: '2026-11-04',
        serverTime: '2026-11-04T12:00:00.000Z',
        attendanceStatus: 'NOT_CHECKED_IN',
        availableAction: 'CHECK_IN',
        assignment: sampleAssignment,
        pendingLeave: PendingLeaveDto(
          durationType: 'MORNING_HALF',
        ),
      );

      when(() => mockRepository.getTodayAttendance()).thenAnswer((_) async => todayWithPending);
      when(() => mockRepository.getAttendanceHistory(any())).thenAnswer((_) async => sampleHistory);

      await tester.pumpWidget(
        const MaterialApp(
          home: AttendanceScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Đơn nghỉ đang chờ xử lý'), findsOneWidget);
      expect(find.textContaining('Nghỉ buổi sáng'), findsOneWidget);
    });

    testWidgets('tapping punch button shows preview dialog', (tester) async {
      when(() => mockRepository.getTodayAttendance()).thenAnswer((_) async => sampleToday);
      when(() => mockRepository.getAttendanceHistory(any())).thenAnswer((_) async => sampleHistory);

      await tester.pumpWidget(
        const MaterialApp(
          home: AttendanceScreen(),
        ),
      );
      await tester.pumpAndSettle();

      final punchBtn = find.text('Xác nhận ra ca');
      expect(punchBtn, findsOneWidget);
      await tester.tap(punchBtn);
      await tester.pumpAndSettle();

      expect(find.text('Xác nhận ra ca'), findsNWidgets(2)); // button and dialog title
      expect(find.textContaining('Sprint 5'), findsOneWidget);
      expect(find.text('Đóng'), findsOneWidget);

      await tester.tap(find.text('Đóng'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Sprint 5'), findsNothing);
    });

    testWidgets('tapping punch button shows Sprint 5 confirmation dialog and submits when PunchBloc registered', (tester) async {
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

      when(() => mockRepository.getTodayAttendance()).thenAnswer((_) async => sampleToday);
      when(() => mockRepository.getAttendanceHistory(any())).thenAnswer((_) async => sampleHistory);

      await tester.pumpWidget(
        const MaterialApp(
          home: AttendanceScreen(),
        ),
      );
      await tester.pumpAndSettle();

      final punchBtn = find.text('Xác nhận ra ca');
      expect(punchBtn, findsOneWidget);
      await tester.tap(punchBtn);
      await tester.pumpAndSettle();

      expect(find.text('Ghi nhận kết thúc ca làm việc hôm nay?'), findsOneWidget);
      final confirmBtn = find.widgetWithText(ElevatedButton, 'Ra ca');
      expect(confirmBtn, findsOneWidget);

      await tester.tap(confirmBtn);
      await tester.pumpAndSettle();

      expect(find.text('Đã ghi nhận thời gian ra ca.'), findsNWidgets(2));
      expect(find.byType(SnackBar), findsOneWidget);
      verify(() => mockCoordinator.executeWaterfall(
            today: any(named: 'today'),
            onProgress: any(named: 'onProgress'),
          )).called(1);
    });

    testWidgets('renders ErrorState with retry button when load fails', (tester) async {
      when(() => mockRepository.getTodayAttendance()).thenThrow(
        const ApiException(
          code: 'INTERNAL_ERROR',
          statusCode: 500,
          message: 'Lỗi tải dữ liệu chấm công',
        ),
      );
      when(() => mockRepository.getAttendanceHistory(any())).thenAnswer((_) async => sampleHistory);

      await tester.pumpWidget(
        const MaterialApp(
          home: AttendanceScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Lỗi tải dữ liệu chấm công'), findsOneWidget);
      expect(find.text('Thử lại'), findsOneWidget);
    });
  });
}
