import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/attendance/data/attendance_repository.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_assignment_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_history_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_summary_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/today_attendance_dto.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/attendance_bloc.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/attendance_event.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/attendance_state.dart';
import 'package:corestaff_mobile/features/attendance/presentation/utils/attendance_formatters.dart';

class MockAttendanceRepository extends Mock implements AttendanceRepository {}

void main() {
  late MockAttendanceRepository mockRepository;

  const sampleAssignment = AttendanceAssignmentDto(
    shiftName: 'Ca hành chính',
    shiftHours: '08:00 - 17:00',
    startTime: '08:00',
    endTime: '17:00',
    workplaceName: 'Bitexco',
    address: 'Q1, TP.HCM',
  );

  const sampleToday = TodayAttendanceDto(
    workDate: '2026-11-04',
    serverTime: '2026-11-04T12:00:00.000Z',
    attendanceStatus: 'CHECKED_IN',
    availableAction: 'CHECK_OUT',
    workingMinutes: 240,
    lateMinutes: 0,
    earlyMinutes: 0,
    assignment: sampleAssignment,
  );

  const sampleHistory = AttendanceHistoryDto(
    month: '2026-11',
    totalDays: 30,
    summary: AttendanceSummaryDto(
      workingDays: 15,
      totalWorkingMinutes: 7200,
      lateDays: 0,
      earlyDays: 0,
      otMinutes: 0,
      otDays: 0,
    ),
    items: [],
  );

  const sampleHistoryPast = AttendanceHistoryDto(
    month: '2026-10',
    totalDays: 31,
    summary: AttendanceSummaryDto(
      workingDays: 22,
      totalWorkingMinutes: 10560,
      lateDays: 1,
      earlyDays: 0,
      otMinutes: 60,
      otDays: 1,
    ),
    items: [],
  );

  setUp(() {
    mockRepository = MockAttendanceRepository();
  });

  group('AttendanceBloc Unit Tests', () {
    test('initial state is AttendanceInitial', () {
      final bloc = AttendanceBloc(attendanceRepository: mockRepository);
      expect(bloc.state, isA<AttendanceInitial>());
    });

    blocTest<AttendanceBloc, AttendanceState>(
      'emits [AttendanceLoading, AttendanceLoaded] on successful AttendanceStarted',
      build: () {
        when(() => mockRepository.getTodayAttendance()).thenAnswer((_) async => sampleToday);
        when(() => mockRepository.getAttendanceHistory(any())).thenAnswer((_) async => sampleHistory);
        return AttendanceBloc(attendanceRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const AttendanceStarted(targetMonth: '2026-11')),
      expect: () => [
        isA<AttendanceLoading>(),
        isA<AttendanceLoaded>()
            .having((s) => s.today.workDate, 'workDate', '2026-11-04')
            .having((s) => s.currentMonth, 'currentMonth', '2026-11')
            .having((s) => s.isRefreshing, 'isRefreshing', false),
      ],
      verify: (_) {
        verify(() => mockRepository.getTodayAttendance()).called(1);
        verify(() => mockRepository.getAttendanceHistory('2026-11')).called(1);
      },
    );

    blocTest<AttendanceBloc, AttendanceState>(
      'emits [AttendanceLoading, AttendanceError] on repository failure',
      build: () {
        when(() => mockRepository.getTodayAttendance()).thenThrow(
          const ApiException(
            message: 'Chưa có phân ca',
            statusCode: 400,
            code: 'ASSIGNMENT_NOT_CONFIGURED',
          ),
        );
        when(() => mockRepository.getAttendanceHistory(any())).thenAnswer((_) async => sampleHistory);
        return AttendanceBloc(attendanceRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const AttendanceStarted(targetMonth: '2026-11')),
      expect: () => [
        isA<AttendanceLoading>(),
        isA<AttendanceError>()
            .having((s) => s.message, 'message', contains('chưa được phân ca')),
      ],
    );

    blocTest<AttendanceBloc, AttendanceState>(
      'emits [AttendanceLoaded(isRefreshing: true), AttendanceLoaded(isRefreshing: false)] on AttendanceRefreshed',
      seed: () => const AttendanceLoaded(
        today: sampleToday,
        history: sampleHistory,
        currentMonth: '2026-11',
      ),
      build: () {
        when(() => mockRepository.getTodayAttendance()).thenAnswer((_) async => sampleToday);
        when(() => mockRepository.getAttendanceHistory('2026-11')).thenAnswer((_) async => sampleHistory);
        return AttendanceBloc(attendanceRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const AttendanceRefreshed()),
      expect: () => [
        isA<AttendanceLoaded>().having((s) => s.isRefreshing, 'isRefreshing', true),
        isA<AttendanceLoaded>().having((s) => s.isRefreshing, 'isRefreshing', false),
      ],
    );

    blocTest<AttendanceBloc, AttendanceState>(
      'updates month and fetches history on MonthChanged(-1)',
      seed: () => const AttendanceLoaded(
        today: sampleToday,
        history: sampleHistory,
        currentMonth: '2026-11',
      ),
      build: () {
        when(() => mockRepository.getAttendanceHistory('2026-10')).thenAnswer((_) async => sampleHistoryPast);
        return AttendanceBloc(attendanceRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const MonthChanged(-1)),
      expect: () => [
        isA<AttendanceLoaded>()
            .having((s) => s.isRefreshing, 'isRefreshing', true),
        isA<AttendanceLoaded>()
            .having((s) => s.currentMonth, 'currentMonth', '2026-10')
            .having((s) => s.history.month, 'history.month', '2026-10')
            .having((s) => s.isRefreshing, 'isRefreshing', false),
      ],
      verify: (_) {
        verify(() => mockRepository.getAttendanceHistory('2026-10')).called(1);
      },
    );

    blocTest<AttendanceBloc, AttendanceState>(
      'disallows navigating to future months when already at current month',
      seed: () => AttendanceLoaded(
        today: sampleToday,
        history: sampleHistory,
        currentMonth: AttendanceFormatters.currentMonthKey(),
      ),
      build: () => AttendanceBloc(attendanceRepository: mockRepository),
      act: (bloc) => bloc.add(const MonthChanged(1)),
      expect: () => [],
    );
  });
}
