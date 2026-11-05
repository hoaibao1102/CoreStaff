import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/attendance/data/attendance_repository.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_assignment_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_day_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_history_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_requirements_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_summary_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/today_attendance_dto.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/attendance_bloc.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/attendance_event.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/attendance_state.dart';
import 'package:corestaff_mobile/features/attendance/presentation/utils/attendance_formatters.dart';

class MockAttendanceRepository extends Mock implements AttendanceRepository {}

void main() {
  late MockAttendanceRepository mockRepository;

  setUp(() {
    mockRepository = MockAttendanceRepository();
  });

  group('Adversarial Stress Test: Timezone & Month Navigation Across Boundaries', () {
    test('nowVn is exactly UTC+7 hours', () {
      final utcNow = DateTime.now().toUtc();
      final vnNow = AttendanceFormatters.nowVn;
      final diff = vnNow.difference(utcNow).inMinutes;
      // Allow slight clock progression jitter (<2 seconds)
      expect(diff, closeTo(7 * 60, 1));
    });

    test('currentMonthKey formats as YYYY-MM in Vietnam time', () {
      final key = AttendanceFormatters.currentMonthKey();
      expect(RegExp(r'^\d{4}-(0[1-9]|1[0-2])$').hasMatch(key), isTrue);
    });

    test('shiftMonth: transition backward across year boundaries (2026-01 to 2025-12)', () {
      final shifted = AttendanceFormatters.shiftMonth('2026-01', -1);
      expect(shifted, equals('2025-12'));
    });

    test('shiftMonth: multi-month backward jump across multiple years (2026-01 to 2023-11)', () {
      final shifted = AttendanceFormatters.shiftMonth('2026-01', -26);
      expect(shifted, equals('2023-11'));
    });

    test('shiftMonth: leap year February transitions (2024 leap year vs 2025 normal year)', () {
      // 2024 is a leap year (Feb 29 days)
      expect(AttendanceFormatters.shiftMonth('2024-01', 1), equals('2024-02'));
      expect(AttendanceFormatters.shiftMonth('2024-02', 1), equals('2024-03'));
      expect(AttendanceFormatters.shiftMonth('2024-03', -1), equals('2024-02'));

      // 2025 is a non-leap year (Feb 28 days)
      expect(AttendanceFormatters.shiftMonth('2025-01', 1), equals('2025-02'));
      expect(AttendanceFormatters.shiftMonth('2025-02', 1), equals('2025-03'));
      expect(AttendanceFormatters.shiftMonth('2025-03', -1), equals('2025-02'));
    });

    test('shiftMonth: future ceiling guard strictly clamps to currentMonthKey', () {
      final currentMonth = AttendanceFormatters.currentMonthKey();
      // Forward offset beyond ceiling must clamp to currentMonthKey
      final clamped = AttendanceFormatters.shiftMonth(currentMonth, 1);
      expect(clamped, equals(currentMonth));

      final clampedLarge = AttendanceFormatters.shiftMonth(currentMonth, 12);
      expect(clampedLarge, equals(currentMonth));
    });

    test('shiftMonth: handles corrupted or invalid month keys gracefully without crash', () {
      expect(AttendanceFormatters.shiftMonth('', 1), equals(''));
      expect(AttendanceFormatters.shiftMonth('invalid', -1), equals('invalid'));
      expect(AttendanceFormatters.shiftMonth('2025', 1), equals('2025'));
    });

    test('canMoveNext: strictly enforces future ceiling guard', () {
      final currentMonth = AttendanceFormatters.currentMonthKey();
      // Current month cannot move next
      expect(AttendanceFormatters.canMoveNext(currentMonth), isFalse);

      // Future month cannot move next
      expect(AttendanceFormatters.canMoveNext('2099-12'), isFalse);

      // Past month CAN move next
      final pastMonth = AttendanceFormatters.shiftMonth(currentMonth, -1);
      expect(AttendanceFormatters.canMoveNext(pastMonth), isTrue);
    });

    test('formatMonthLabel: formats standard and boundary year months', () {
      expect(AttendanceFormatters.formatMonthLabel('2026-11'), equals('Tháng 11/2026'));
      expect(AttendanceFormatters.formatMonthLabel('2026-01'), equals('Tháng 1/2026'));
      expect(AttendanceFormatters.formatMonthLabel('2025-12'), equals('Tháng 12/2025'));
      expect(AttendanceFormatters.formatMonthLabel('corrupt'), equals('corrupt'));
    });
  });

  group('Adversarial Stress Test: Date and Time Formatter Edge Cases', () {
    test('formatTime: ISO timestamp UTC converts correctly to Vietnam (+07:00)', () {
      // 01:00 UTC -> 08:00 VN
      expect(AttendanceFormatters.formatTime('2026-11-04T01:00:00.000Z'), equals('08:00'));

      // 17:30 UTC -> 00:30 VN (crosses midnight)
      expect(AttendanceFormatters.formatTime('2026-11-04T17:30:00.000Z'), equals('00:30'));

      // Empty and null inputs
      expect(AttendanceFormatters.formatTime(null), equals('--:--'));
      expect(AttendanceFormatters.formatTime(''), equals('--:--'));
      expect(AttendanceFormatters.formatTime('not-a-date'), equals('--:--'));
    });

    test('formatDate: null and empty fallbacks', () {
      expect(AttendanceFormatters.formatDate(null), equals('-'));
      expect(AttendanceFormatters.formatDate(''), equals('-'));
    });

    test('formatDate: pure date string YYYY-MM-DD formatting', () {
      // Vietnam workDate is formatted as dd/MM/yyyy
      final formatted = AttendanceFormatters.formatDate('2026-11-04');
      // If run on local machine or fallback, check day representation
      expect(formatted, contains('2026'));
      expect(formatted.split('/').length, equals(3));
    });

    test('formatMinutes: boundary and negative values', () {
      expect(AttendanceFormatters.formatMinutes(null), equals('0 phút'));
      expect(AttendanceFormatters.formatMinutes(-10), equals('0 phút'));
      expect(AttendanceFormatters.formatMinutes(0), equals('0 phút'));
      expect(AttendanceFormatters.formatMinutes(45), equals('45 phút'));
      expect(AttendanceFormatters.formatMinutes(60), equals('1g 00p'));
      expect(AttendanceFormatters.formatMinutes(495), equals('8g 15p'));
      expect(AttendanceFormatters.formatMinutes(1440), equals('24g 00p'));
    });

    test('intervalText: formats single, multiple, and empty intervals', () {
      expect(AttendanceFormatters.intervalText([]), equals('Không có'));
      expect(
        AttendanceFormatters.intervalText([
          const TimeIntervalDto(from: '08:00', to: '12:00'),
        ]),
        equals('08:00–12:00'),
      );
      expect(
        AttendanceFormatters.intervalText([
          const TimeIntervalDto(from: '08:00', to: '10:00'),
          const TimeIntervalDto(from: '14:00', to: '16:00'),
        ]),
        equals('08:00–10:00, 14:00–16:00'),
      );
    });

    test('pendingLeaveText: formats all duration types and handles null hours', () {
      expect(
        AttendanceFormatters.pendingLeaveText('MORNING_HALF', null, null),
        equals('Nghỉ buổi sáng'),
      );
      expect(
        AttendanceFormatters.pendingLeaveText('AFTERNOON_HALF', null, null),
        equals('Nghỉ buổi chiều'),
      );
      expect(
        AttendanceFormatters.pendingLeaveText('FULL_DAY', null, null),
        equals('Nghỉ cả ngày'),
      );
      expect(
        AttendanceFormatters.pendingLeaveText('CUSTOM_HOURS', '09:00', '11:00'),
        equals('Nghỉ theo giờ (09:00–11:00)'),
      );
      expect(
        AttendanceFormatters.pendingLeaveText('CUSTOM_HOURS', null, null),
        equals('Nghỉ theo giờ'),
      );
    });
  });

  group('Adversarial Stress Test: Unusual Shift States & DTO Resilience', () {
    test('TodayAttendanceDto.fromJson handles empty assignment and null fields without crash', () {
      final json = <String, dynamic>{
        'workDate': '2026-11-04',
        'serverTime': '2026-11-04T12:00:00Z',
        'attendanceStatus': 'REST_DAY',
        'availableAction': 'NONE',
        // assignment completely missing or empty
        'assignment': <String, dynamic>{},
      };

      final dto = TodayAttendanceDto.fromJson(json);
      expect(dto.workDate, equals('2026-11-04'));
      expect(dto.attendanceStatus, equals('REST_DAY'));
      expect(dto.availableAction, equals('NONE'));
      expect(dto.checkIn, isNull);
      expect(dto.checkOut, isNull);
      expect(dto.workingMinutes, isNull);
      expect(dto.lateMinutes, equals(0));
      expect(dto.earlyMinutes, equals(0));
      expect(dto.pendingLeave, isNull);
      expect(dto.attendanceRequirements, isNull);

      // Verify default fallbacks in assignment
      expect(dto.assignment.shiftName, isNotEmpty);
      expect(dto.assignment.workplaceName, isNotEmpty);
      expect(dto.assignment.breakMinutes, equals(60));
      expect(dto.assignment.latitude, isNotNull);
      expect(dto.assignment.longitude, isNotNull);
    });

    test('TodayAttendanceDto handles ON_LEAVE with multi-interval approved leaves', () {
      final json = {
        'workDate': '2026-11-04',
        'serverTime': '2026-11-04T12:00:00Z',
        'attendanceStatus': 'ON_LEAVE',
        'availableAction': 'NONE',
        'assignment': {
          'shiftName': 'Ca sáng',
          'shiftHours': '08:00 - 12:00',
          'workplaceName': 'Trụ sở',
          'address': 'TP.HCM',
        },
        'attendanceRequirements': {
          'durationTypes': ['MORNING_HALF', 'AFTERNOON_HALF'],
          'leaveTypes': ['PAID_LEAVE'],
          'approvedLeaveIntervals': [
            {'from': '08:00', 'to': '10:00'},
            {'from': '10:00', 'to': '12:00'},
          ],
          'requiredWorkingIntervals': [
            {'from': '13:00', 'to': '17:00'},
          ],
          'approvedLeaveMinutes': 240,
          'requiredWorkingMinutes': 240,
          'effectiveCheckInTime': '13:00',
          'effectiveCheckOutTime': '17:00',
        },
      };

      final dto = TodayAttendanceDto.fromJson(json);
      expect(dto.attendanceStatus, equals('ON_LEAVE'));
      expect(dto.attendanceRequirements, isNotNull);
      final req = dto.attendanceRequirements!;
      expect(req.approvedLeaveIntervals.length, equals(2));
      expect(req.approvedLeaveMinutes, equals(240));
      expect(req.effectiveCheckInTime, equals('13:00'));

      // Round-trip serialization
      final reencoded = TodayAttendanceDto.fromJson(dto.toJson());
      expect(reencoded.attendanceRequirements!.approvedLeaveIntervals.length, equals(2));
      expect(reencoded.attendanceRequirements!.approvedLeaveMinutes, equals(240));
    });

    test('TodayAttendanceDto handles missing punches, rest days, holidays, absent', () {
      for (final status in ['REST_DAY', 'DAY_OFF', 'HOLIDAY', 'ABSENT', 'LOCKED']) {
        final json = {
          'workDate': '2026-11-04',
          'serverTime': '2026-11-04T12:00:00Z',
          'attendanceStatus': status,
          'availableAction': 'NONE',
          'assignment': {'shiftName': 'Ca nghỉ'},
        };
        final dto = TodayAttendanceDto.fromJson(json);
        expect(dto.attendanceStatus, equals(status));
        expect(dto.availableAction, equals('NONE'));
        expect(dto.checkIn, isNull);
        expect(dto.checkOut, isNull);
      }
    });

    test('AttendanceDayDto handles null checkIn, null checkOut, and overtime DTO safely', () {
      final json = {
        '_id': 'day-1',
        'workDate': '2026-11-01',
        'attendanceStatus': 'DAY_OFF',
        'checkIn': null,
        'checkOut': null,
        'workingMinutes': null,
        'lateMinutes': 0,
        'earlyMinutes': 0,
        'overtime': {
          'requestId': 'ot-1',
          'status': 'APPROVED',
          'otMinutes': 120,
        },
      };

      final day = AttendanceDayDto.fromJson(json);
      expect(day.id, equals('day-1'));
      expect(day.firstIn, isNull);
      expect(day.lastOut, isNull);
      expect(day.workedMinutes, equals(0));
      expect(day.overtimeMinutes, equals(120));
      expect(day.status, equals('DAY_OFF'));
    });
  });

  group('Adversarial Stress Test: AttendanceBloc State Boundaries & Concurrency', () {
    const sampleAssignment = AttendanceAssignmentDto(
      shiftName: 'Ca hành chính',
      shiftHours: '08:00 - 17:00',
      startTime: '08:00',
      endTime: '17:00',
      workplaceName: 'Văn phòng chính',
      address: 'Bitexco TP.HCM',
    );

    const sampleToday = TodayAttendanceDto(
      workDate: '2026-11-04',
      serverTime: '2026-11-04T12:00:00.000Z',
      attendanceStatus: 'REST_DAY',
      availableAction: 'NONE',
      assignment: sampleAssignment,
    );

    const sampleHistoryCurrent = AttendanceHistoryDto(
      month: '2026-11',
      totalDays: 30,
      summary: AttendanceSummaryDto(workingDays: 0, lateDays: 0, otMinutes: 0),
      items: [],
    );

    const sampleHistory202512 = AttendanceHistoryDto(
      month: '2025-12',
      totalDays: 31,
      summary: AttendanceSummaryDto(workingDays: 20, lateDays: 1, otMinutes: 120),
      items: [],
    );

    blocTest<AttendanceBloc, AttendanceState>(
      'Month transition across year boundary (from 2026-01 to 2025-12)',
      seed: () => const AttendanceLoaded(
        today: sampleToday,
        history: sampleHistoryCurrent,
        currentMonth: '2026-01',
      ),
      build: () {
        when(() => mockRepository.getAttendanceHistory('2025-12'))
            .thenAnswer((_) async => sampleHistory202512);
        return AttendanceBloc(attendanceRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const MonthChanged(-1)),
      expect: () => [
        isA<AttendanceLoaded>()
            .having((s) => s.isRefreshing, 'isRefreshing', true),
        isA<AttendanceLoaded>()
            .having((s) => s.currentMonth, 'currentMonth', '2025-12')
            .having((s) => s.history.month, 'history.month', '2025-12')
            .having((s) => s.isRefreshing, 'isRefreshing', false),
      ],
      verify: (_) {
        verify(() => mockRepository.getAttendanceHistory('2025-12')).called(1);
      },
    );

    blocTest<AttendanceBloc, AttendanceState>(
      'Ceiling guard: MonthChanged(+1) when already at currentMonthKey emits nothing and calls no API',
      seed: () => AttendanceLoaded(
        today: sampleToday,
        history: sampleHistoryCurrent,
        currentMonth: AttendanceFormatters.currentMonthKey(),
      ),
      build: () => AttendanceBloc(attendanceRepository: mockRepository),
      act: (bloc) => bloc.add(const MonthChanged(1)),
      expect: () => [],
      verify: (_) {
        verifyNever(() => mockRepository.getAttendanceHistory(any()));
      },
    );

    blocTest<AttendanceBloc, AttendanceState>(
      'MonthChanged with repository failure emits bannerError on loaded state without losing previous data',
      seed: () => const AttendanceLoaded(
        today: sampleToday,
        history: sampleHistoryCurrent,
        currentMonth: '2026-05',
      ),
      build: () {
        when(() => mockRepository.getAttendanceHistory('2026-04'))
            .thenThrow(const ApiException(message: 'Network gateway timeout', statusCode: 504));
        return AttendanceBloc(attendanceRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const MonthChanged(-1)),
      expect: () => [
        isA<AttendanceLoaded>()
            .having((s) => s.isRefreshing, 'isRefreshing', true)
            .having((s) => s.bannerError, 'bannerError', isNull),
        isA<AttendanceLoaded>()
            .having((s) => s.isRefreshing, 'isRefreshing', false)
            .having((s) => s.bannerError, 'bannerError', contains('Network gateway timeout'))
            .having((s) => s.currentMonth, 'currentMonth', '2026-05') // Unchanged month
            .having((s) => s.today.attendanceStatus, 'status', 'REST_DAY'),
      ],
    );

    blocTest<AttendanceBloc, AttendanceState>(
      'Consecutive month changes transition state sequentially',
      seed: () => const AttendanceLoaded(
        today: sampleToday,
        history: sampleHistoryCurrent,
        currentMonth: '2026-05',
      ),
      build: () {
        when(() => mockRepository.getAttendanceHistory('2026-04'))
            .thenAnswer((_) async => const AttendanceHistoryDto(
                  month: '2026-04',
                  totalDays: 30,
                  summary: AttendanceSummaryDto(),
                  items: [],
                ));
        when(() => mockRepository.getAttendanceHistory('2026-03'))
            .thenAnswer((_) async => const AttendanceHistoryDto(
                  month: '2026-03',
                  totalDays: 31,
                  summary: AttendanceSummaryDto(),
                  items: [],
                ));
        return AttendanceBloc(attendanceRepository: mockRepository);
      },
      act: (bloc) async {
        bloc.add(const MonthChanged(-1));
        await Future<void>.delayed(const Duration(milliseconds: 50));
        bloc.add(const MonthChanged(-1));
      },
      expect: () => [
        isA<AttendanceLoaded>()
            .having((s) => s.isRefreshing, 'isRefreshing', true),
        isA<AttendanceLoaded>()
            .having((s) => s.currentMonth, 'currentMonth', '2026-04')
            .having((s) => s.isRefreshing, 'isRefreshing', false),
        isA<AttendanceLoaded>()
            .having((s) => s.isRefreshing, 'isRefreshing', true),
        isA<AttendanceLoaded>()
            .having((s) => s.currentMonth, 'currentMonth', '2026-03')
            .having((s) => s.isRefreshing, 'isRefreshing', false),
      ],
    );
  });
}
