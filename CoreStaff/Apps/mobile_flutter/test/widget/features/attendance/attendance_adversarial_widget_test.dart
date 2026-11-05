import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/features/attendance/data/attendance_repository.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_assignment_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_history_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_requirements_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_summary_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/today_attendance_dto.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/attendance_bloc.dart';
import 'package:corestaff_mobile/features/attendance/presentation/screens/attendance_screen.dart';
import 'package:corestaff_mobile/features/attendance/presentation/utils/attendance_formatters.dart';

class MockAttendanceRepository extends Mock implements AttendanceRepository {}

void main() {
  late MockAttendanceRepository mockRepository;

  const standardAssignment = AttendanceAssignmentDto(
    shiftName: 'Ca hành chính',
    shiftHours: '08:00 - 17:00',
    startTime: '08:00',
    endTime: '17:00',
    workplaceName: 'Văn phòng Bitexco',
    address: 'Q1, TP.HCM',
  );

  const outOfficeAssignment = AttendanceAssignmentDto(
    shiftName: 'Ca ngoài văn phòng',
    shiftHours: '08:30 - 17:30',
    startTime: '08:30',
    endTime: '17:30',
    workplaceName: 'Dự án Thủ Thiêm',
    workplaceType: 'OUT_OFFICE',
    address: 'TP. Thủ Đức',
  );

  final emptyHistory = AttendanceHistoryDto(
    month: AttendanceFormatters.currentMonthKey(),
    totalDays: 30,
    summary: const AttendanceSummaryDto(),
    items: const [],
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

  tearDown(() {
    final sl = GetIt.instance;
    if (sl.isRegistered<AttendanceBloc>()) {
      sl.unregister<AttendanceBloc>();
    }
    if (sl.isRegistered<AttendanceRepository>()) {
      sl.unregister<AttendanceRepository>();
    }
  });

  group('Adversarial Widget Stress Tests for Unusual Shift States', () {
    testWidgets('Renders REST_DAY with disabled punch button and empty timeline dashes', (tester) async {
      const restDayToday = TodayAttendanceDto(
        workDate: '2026-11-08',
        serverTime: '2026-11-08T03:00:00.000Z',
        attendanceStatus: 'REST_DAY',
        availableAction: 'NONE',
        assignment: standardAssignment,
      );

      when(() => mockRepository.getTodayAttendance()).thenAnswer((_) async => restDayToday);
      when(() => mockRepository.getAttendanceHistory(any())).thenAnswer((_) async => emptyHistory);

      await tester.pumpWidget(
        const MaterialApp(
          home: AttendanceScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Verify REST_DAY badge
      expect(find.text('REST_DAY'), findsOneWidget);

      // Verify disabled button
      expect(find.text('Ca làm đã hoàn tất'), findsOneWidget);

      // Timeline has '--:--' dashes
      expect(find.text('--:--'), findsNWidgets(2));

      // Metric grid shows 0
      expect(find.text('0 phút'), findsNWidgets(3));

      // Empty history card rendered
      expect(find.text('Chưa có dữ liệu chấm công trong tháng này.'), findsOneWidget);
    });

    testWidgets('Renders ON_LEAVE with multi-interval approved leaves without overflow', (tester) async {
      const onLeaveToday = TodayAttendanceDto(
        workDate: '2026-11-04',
        serverTime: '2026-11-04T02:00:00.000Z',
        attendanceStatus: 'ON_LEAVE',
        availableAction: 'NONE',
        assignment: standardAssignment,
        attendanceRequirements: AttendanceRequirementsDto(
          durationTypes: ['CUSTOM_HOURS'],
          leaveTypes: ['PAID_LEAVE'],
          approvedLeaveIntervals: [
            TimeIntervalDto(from: '08:00', to: '10:00'),
            TimeIntervalDto(from: '11:00', to: '12:00'),
            TimeIntervalDto(from: '15:00', to: '17:00'),
          ],
          requiredWorkingIntervals: [
            TimeIntervalDto(from: '10:00', to: '11:00'),
            TimeIntervalDto(from: '13:00', to: '15:00'),
          ],
          approvedLeaveMinutes: 300,
          requiredWorkingMinutes: 180,
          effectiveCheckInTime: '10:00',
          effectiveCheckOutTime: '15:00',
        ),
      );

      when(() => mockRepository.getTodayAttendance()).thenAnswer((_) async => onLeaveToday);
      when(() => mockRepository.getAttendanceHistory(any())).thenAnswer((_) async => emptyHistory);

      await tester.pumpWidget(
        const MaterialApp(
          home: AttendanceScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Đang nghỉ phép'), findsOneWidget);
      expect(find.text('Nghỉ phép đã được HR áp dụng'), findsOneWidget);
      expect(find.textContaining('08:00–10:00, 11:00–12:00, 15:00–17:00 (5g 00p)'), findsOneWidget);
      expect(find.textContaining('10:00–11:00, 13:00–15:00 (3g 00p)'), findsOneWidget);
      expect(find.textContaining('Khung chấm công hiệu lực: 10:00 – 15:00'), findsOneWidget);
    });

    testWidgets('Renders OUT_OFFICE note when workplaceType is OUT_OFFICE', (tester) async {
      const outOfficeToday = TodayAttendanceDto(
        workDate: '2026-11-04',
        serverTime: '2026-11-04T01:00:00.000Z',
        attendanceStatus: 'NOT_CHECKED_IN',
        availableAction: 'CHECK_IN',
        assignment: outOfficeAssignment,
      );

      when(() => mockRepository.getTodayAttendance()).thenAnswer((_) async => outOfficeToday);
      when(() => mockRepository.getAttendanceHistory(any())).thenAnswer((_) async => emptyHistory);

      await tester.pumpWidget(
        const MaterialApp(
          home: AttendanceScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('Ca ngoài văn phòng có thể yêu cầu vị trí hoặc selfie theo chính sách công ty.'),
        findsOneWidget,
      );
    });

    testWidgets('Month selector prevents forward navigation when at current month', (tester) async {
      final currentMonth = AttendanceFormatters.currentMonthKey();
      final pastMonth = AttendanceFormatters.shiftMonth(currentMonth, -1);

      const sampleToday = TodayAttendanceDto(
        workDate: '2026-11-04',
        serverTime: '2026-11-04T01:00:00.000Z',
        attendanceStatus: 'NOT_CHECKED_IN',
        availableAction: 'CHECK_IN',
        assignment: standardAssignment,
      );

      final pastHistory = AttendanceHistoryDto(
        month: pastMonth,
        totalDays: 31,
        summary: const AttendanceSummaryDto(),
        items: const [],
      );

      when(() => mockRepository.getTodayAttendance()).thenAnswer((_) async => sampleToday);
      when(() => mockRepository.getAttendanceHistory(currentMonth)).thenAnswer((_) async => emptyHistory);
      when(() => mockRepository.getAttendanceHistory(pastMonth)).thenAnswer((_) async => pastHistory);

      await tester.pumpWidget(
        const MaterialApp(
          home: AttendanceScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Find forward arrow '›'
      final forwardArrow = find.text('›');
      expect(forwardArrow, findsOneWidget);

      // Tap forward arrow: should NOT call getAttendanceHistory because forward is disabled
      await tester.tap(forwardArrow);
      await tester.pumpAndSettle();

      // Only the initial load of current month was called
      verify(() => mockRepository.getAttendanceHistory(currentMonth)).called(1);
      verifyNever(() => mockRepository.getAttendanceHistory(pastMonth));

      // Tap backward arrow '‹': should transition to past month
      final backwardArrow = find.text('‹');
      expect(backwardArrow, findsOneWidget);
      await tester.tap(backwardArrow);
      await tester.pumpAndSettle();

      // Past month should now be loaded
      verify(() => mockRepository.getAttendanceHistory(pastMonth)).called(1);
    });
  });
}
