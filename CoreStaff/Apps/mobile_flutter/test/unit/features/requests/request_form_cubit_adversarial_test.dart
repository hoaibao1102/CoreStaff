import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/requests/data/models/leave_preview_dto.dart';
import 'package:corestaff_mobile/features/requests/data/models/request_payloads.dart';
import 'package:corestaff_mobile/features/requests/data/requests_repository.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/request_form_cubit.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/request_form_state.dart';

class MockRequestsRepository extends Mock implements RequestsRepository {}
class FakePreviewLeaveRequestPayload extends Fake implements PreviewLeaveRequestPayload {}
class FakeCreateLeaveRequestPayload extends Fake implements CreateLeaveRequestPayload {}

void main() {
  late MockRequestsRepository mockRepository;

  setUpAll(() {
    registerFallbackValue(FakePreviewLeaveRequestPayload());
    registerFallbackValue(FakeCreateLeaveRequestPayload());
  });

  setUp(() {
    mockRepository = MockRequestsRepository();
  });

  group('Adversarial Boundary Testing: Dates', () {
    test('start date > end date cancels preview and fails validation', () async {
      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setStartDate('2026-11-20');
      cubit.setEndDate('2026-11-10');

      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(cubit.state.preview, isNull);
      verifyNever(() => mockRepository.previewLeave(any()));

      cubit.setReason('Lý do xin nghỉ việc gia đình đủ mười ký tự');
      await cubit.submit();
      expect(cubit.state.errorMessage, 'Ngày kết thúc không được sớm hơn ngày bắt đầu.');
      cubit.close();
    });

    test('invalid date formats are rejected: malformed, invalid month/day, leap year', () async {
      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setReason('Lý do xin nghỉ việc gia đình đủ mười ký tự');

      final invalidDates = [
        'not-a-date',
        '2026-13-01', // month 13
        '2026-00-10', // month 0
        '2026-02-30', // Feb 30
        '2026-04-31', // April 31
        '2025-02-29', // Non-leap year Feb 29
        '2026-1-1',   // Missing leading zeros
        '2026/11/05', // Wrong separator
        '2026-11-32', // day 32
      ];

      for (final date in invalidDates) {
        cubit.setStartDate(date);
        await Future<void>.delayed(const Duration(milliseconds: 50));
        expect(cubit.state.preview, isNull, reason: 'Preview should be null for date $date');

        await cubit.submit();
        expect(cubit.state.errorMessage, 'Ngày cần theo định dạng YYYY-MM-DD và phải hợp lệ.',
            reason: 'Validation should fail for date $date');
      }

      // Valid leap year 2024-02-29
      when(() => mockRepository.previewLeave(any())).thenAnswer(
        (_) async => const LeavePreviewDto(
          durationType: 'FULL_DAY',
          calculatedMinutes: 480,
          leaveEquivalent: 1.0,
          days: [],
        ),
      );
      cubit.setStartDate('2024-02-29');
      cubit.setEndDate('2024-02-29');
      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(cubit.state.preview, isNotNull, reason: '2024-02-29 is a valid leap year date');

      cubit.close();
    });

    test('multi-month and multi-year date ranges are valid and trigger preview', () async {
      when(() => mockRepository.previewLeave(any())).thenAnswer(
        (_) async => const LeavePreviewDto(
          durationType: 'FULL_DAY',
          calculatedMinutes: 2400,
          leaveEquivalent: 5.0,
          days: [],
        ),
      );

      final cubit = RequestFormCubit(repository: mockRepository);
      // Multi-month range
      cubit.setStartDate('2026-11-28');
      cubit.setEndDate('2026-12-05');

      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(cubit.state.preview, isNotNull);
      verify(() => mockRepository.previewLeave(
            any(that: isA<PreviewLeaveRequestPayload>()
                .having((p) => p.startDate, 'startDate', '2026-11-28')
                .having((p) => p.endDate, 'endDate', '2026-12-05')),
          )).called(1);

      // Multi-year range
      cubit.setStartDate('2026-12-30');
      cubit.setEndDate('2027-01-05');
      await Future<void>.delayed(const Duration(milliseconds: 300));
      verify(() => mockRepository.previewLeave(
            any(that: isA<PreviewLeaveRequestPayload>()
                .having((p) => p.startDate, 'startDate', '2026-12-30')
                .having((p) => p.endDate, 'endDate', '2027-01-05')),
          )).called(1);

      cubit.close();
    });

    test('past dates are allowed for retroactive leave submission parity', () async {
      when(() => mockRepository.previewLeave(any())).thenAnswer(
        (_) async => const LeavePreviewDto(
          durationType: 'FULL_DAY',
          calculatedMinutes: 480,
          leaveEquivalent: 1.0,
          days: [],
        ),
      );

      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setStartDate('2020-01-15');
      cubit.setEndDate('2020-01-15');

      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(cubit.state.preview, isNotNull);

      cubit.close();
    });
  });

  group('Adversarial Testing: Partial Day Restrictions', () {
    test('switching to MORNING_HALF, AFTERNOON_HALF, or CUSTOM_HOURS resets endDate to startDate', () {
      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setStartDate('2026-11-10');
      cubit.setEndDate('2026-11-15');
      expect(cubit.state.endDate, '2026-11-15');

      // 1. MORNING_HALF
      cubit.setDurationType('MORNING_HALF');
      expect(cubit.state.endDate, '2026-11-10');

      // Set endDate to something else while in FULL_DAY
      cubit.setDurationType('FULL_DAY');
      cubit.setEndDate('2026-11-20');
      expect(cubit.state.endDate, '2026-11-20');

      // 2. AFTERNOON_HALF
      cubit.setDurationType('AFTERNOON_HALF');
      expect(cubit.state.endDate, '2026-11-10');

      // 3. CUSTOM_HOURS
      cubit.setDurationType('FULL_DAY');
      cubit.setEndDate('2026-11-25');
      cubit.setDurationType('CUSTOM_HOURS');
      expect(cubit.state.endDate, '2026-11-10');

      cubit.close();
    });

    test('updating startDate while partial day auto-syncs endDate', () {
      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setDurationType('MORNING_HALF');
      cubit.setStartDate('2026-11-12');
      expect(cubit.state.endDate, '2026-11-12');

      cubit.setStartDate('2026-11-18');
      expect(cubit.state.endDate, '2026-11-18');

      cubit.close();
    });

    test('manual modification of endDate during partial day cancels preview and blocks submission', () async {
      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setDurationType('MORNING_HALF');
      cubit.setStartDate('2026-11-10');
      cubit.setEndDate('2026-11-12'); // Deliberate mismatch

      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(cubit.state.preview, isNull);
      verifyNever(() => mockRepository.previewLeave(any()));

      cubit.setReason('Lý do xin nghỉ việc gia đình đủ mười ký tự');
      await cubit.submit();
      expect(cubit.state.errorMessage, 'Đơn nghỉ một phần ngày chỉ áp dụng cho một ngày.');

      cubit.close();
    });
  });

  group('Adversarial Testing: Custom Hours Boundaries', () {
    test('startTime == endTime cancels preview and rejects submission', () async {
      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setDurationType('CUSTOM_HOURS');
      cubit.setStartTime('10:00');
      cubit.setEndTime('10:00');

      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(cubit.state.preview, isNull);
      verifyNever(() => mockRepository.previewLeave(any()));

      cubit.setReason('Lý do xin nghỉ việc gia đình đủ mười ký tự');
      await cubit.submit();
      expect(cubit.state.errorMessage, 'Khoảng giờ xin nghỉ chưa hợp lệ.');

      cubit.close();
    });

    test('startTime > endTime cancels preview and rejects submission', () async {
      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setDurationType('CUSTOM_HOURS');
      cubit.setStartTime('16:00');
      cubit.setEndTime('14:00');

      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(cubit.state.preview, isNull);
      verifyNever(() => mockRepository.previewLeave(any()));

      cubit.setReason('Lý do xin nghỉ việc gia đình đủ mười ký tự');
      await cubit.submit();
      expect(cubit.state.errorMessage, 'Khoảng giờ xin nghỉ chưa hợp lệ.');

      cubit.close();
    });

    test('missing or malformed times cancel preview and reject submission', () async {
      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setDurationType('CUSTOM_HOURS');
      cubit.setReason('Lý do xin nghỉ việc gia đình đủ mười ký tự');

      final invalidTimes = [
        ('', '18:00'),
        ('18:00', ''),
        ('24:00', '25:00'),
        ('08:60', '09:00'),
        ('8:00', '10:00'),
        ('08:00', '10:0'),
        (' 08:00 ', '10:00'),
      ];

      for (final (start, end) in invalidTimes) {
        cubit.setStartTime(start);
        cubit.setEndTime(end);

        await Future<void>.delayed(const Duration(milliseconds: 50));
        expect(cubit.state.preview, isNull, reason: 'Preview must be null for $start - $end');

        await cubit.submit();
        expect(cubit.state.errorMessage, 'Khoảng giờ xin nghỉ chưa hợp lệ.',
            reason: 'Submit must reject $start - $end');
      }

      cubit.close();
    });
  });

  group('Adversarial Testing: Debounce Stress & Race Conditions', () {
    test('rapid sequential input changes (<250ms) cancel prior timers and make only 1 API call', () async {
      when(() => mockRepository.previewLeave(any())).thenAnswer(
        (_) async => const LeavePreviewDto(
          durationType: 'FULL_DAY',
          calculatedMinutes: 480,
          leaveEquivalent: 1.0,
          days: [],
        ),
      );

      final cubit = RequestFormCubit(repository: mockRepository);

      // Fire 10 rapid changes with 20ms gap (200ms total, all within 250ms debounce)
      for (int i = 1; i <= 10; i++) {
        cubit.setStartDate('2026-11-${i.toString().padLeft(2, '0')}');
        cubit.setEndDate('2026-11-${i.toString().padLeft(2, '0')}');
        await Future<void>.delayed(const Duration(milliseconds: 20));
      }

      // At this point, t=200ms from start, but only 20ms since last change: no call yet
      verifyNever(() => mockRepository.previewLeave(any()));

      // Wait 300ms for final debounce to fire
      await Future<void>.delayed(const Duration(milliseconds: 300));

      // Exactly 1 call made, with final values (2026-11-10)
      verify(() => mockRepository.previewLeave(
            any(that: isA<PreviewLeaveRequestPayload>()
                .having((p) => p.startDate, 'startDate', '2026-11-10')
                .having((p) => p.endDate, 'endDate', '2026-11-10')),
          )).called(1);

      cubit.close();
    });

    test('closing cubit cancels pending debounce timer without leak', () async {
      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setStartDate('2026-11-15');
      cubit.close();

      // Wait beyond debounce
      await Future<void>.delayed(const Duration(milliseconds: 300));
      verifyNever(() => mockRepository.previewLeave(any()));
    });

    test('race condition prevention: in-flight leave preview does not pollute overtime form after switching form type', () async {
      final completer = Completer<LeavePreviewDto>();
      when(() => mockRepository.previewLeave(any())).thenAnswer((_) => completer.future);

      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setStartDate('2026-11-20');
      cubit.setEndDate('2026-11-20');

      // Wait 300ms for debounce timer to fire and invoke previewLeave
      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(cubit.state.isPreviewing, isTrue);

      // User switches form type to OVERTIME while request is in-flight
      cubit.setFormType(RequestFormType.overtime);
      expect(cubit.state.formType, RequestFormType.overtime);
      expect(cubit.state.preview, isNull);

      // Now the in-flight leave preview completes
      completer.complete(const LeavePreviewDto(
        durationType: 'FULL_DAY',
        calculatedMinutes: 480,
        leaveEquivalent: 1.0,
        days: [],
      ));

      await Future<void>.delayed(const Duration(milliseconds: 50));

      // PREVENTED:
      // Leave preview must NOT be injected into the overtime state
      expect(cubit.state.formType, RequestFormType.overtime);
      expect(cubit.state.preview, isNull,
          reason: 'In-flight leave preview must be ignored and not pollute Overtime form');
      expect(cubit.state.isPreviewing, isFalse,
          reason: 'isPreviewing must remain false on overtime form');
      cubit.close();
    });

    test('race condition prevention: out-of-order network response does not overwrite newer preview with stale data', () async {
      final completerA = Completer<LeavePreviewDto>();
      final completerB = Completer<LeavePreviewDto>();

      when(() => mockRepository.previewLeave(
            any(that: isA<PreviewLeaveRequestPayload>()
                .having((p) => p.startDate, 'startDate', '2026-11-10')),
          )).thenAnswer((_) => completerA.future);

      when(() => mockRepository.previewLeave(
            any(that: isA<PreviewLeaveRequestPayload>()
                .having((p) => p.startDate, 'startDate', '2026-11-20')),
          )).thenAnswer((_) => completerB.future);

      final cubit = RequestFormCubit(repository: mockRepository);

      // 1. User enters 2026-11-10
      cubit.setStartDate('2026-11-10');
      cubit.setEndDate('2026-11-10');
      await Future<void>.delayed(const Duration(milliseconds: 300)); // fires call A

      // 2. User changes to 2026-11-20
      cubit.setStartDate('2026-11-20');
      cubit.setEndDate('2026-11-20');
      await Future<void>.delayed(const Duration(milliseconds: 300)); // fires call B

      // 3. Response B (newer input) returns FIRST
      completerB.complete(const LeavePreviewDto(
        durationType: 'FULL_DAY',
        calculatedMinutes: 960, // 2 days
        leaveEquivalent: 2.0,
        days: [],
      ));
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(cubit.state.preview?.calculatedMinutes, 960);
      expect(cubit.state.startDate, '2026-11-20');
      expect(cubit.state.isPreviewing, isFalse);

      // 4. Response A (older input) returns LATER
      completerA.complete(const LeavePreviewDto(
        durationType: 'FULL_DAY',
        calculatedMinutes: 480, // 1 day
        leaveEquivalent: 1.0,
        days: [],
      ));
      await Future<void>.delayed(const Duration(milliseconds: 50));

      // PREVENTED:
      // Slower older API response (480 min) is discarded;
      // State retains newer calculation (960 min) matching state.startDate (2026-11-20)
      expect(cubit.state.preview?.calculatedMinutes, 960,
          reason: 'Slower older API response must be discarded in favor of newer response');
      expect(cubit.state.startDate, '2026-11-20');
      expect(cubit.state.endDate, '2026-11-20');
      expect(cubit.state.isPreviewing, isFalse);

      cubit.close();
    });

    test('race condition prevention: in-flight preview does not resurrect when input date becomes invalid', () async {
      final completer = Completer<LeavePreviewDto>();
      when(() => mockRepository.previewLeave(any())).thenAnswer((_) => completer.future);

      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setStartDate('2026-11-20');
      cubit.setEndDate('2026-11-20');

      // Wait 300ms for debounce timer to fire
      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(cubit.state.isPreviewing, isTrue);

      // User enters an invalid date
      cubit.setStartDate('2026-11-99');
      expect(cubit.state.preview, isNull);
      expect(cubit.state.isPreviewing, isFalse);

      // In-flight preview for the old date completes
      completer.complete(const LeavePreviewDto(
        durationType: 'FULL_DAY',
        calculatedMinutes: 480,
        leaveEquivalent: 1.0,
        days: [],
      ));
      await Future<void>.delayed(const Duration(milliseconds: 50));

      // PREVENTED:
      // Preview must remain null because current inputs are invalid
      expect(cubit.state.startDate, '2026-11-99');
      expect(cubit.state.preview, isNull,
          reason: 'In-flight preview must NOT resurrect when input date is invalid');
      expect(cubit.state.isPreviewing, isFalse);

      cubit.close();
    });

    test('race condition prevention: in-flight leave preview error does not leak into overtime form after switching form type', () async {
      final completer = Completer<LeavePreviewDto>();
      when(() => mockRepository.previewLeave(any())).thenAnswer((_) => completer.future);

      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setStartDate('2026-11-20');
      cubit.setEndDate('2026-11-20');

      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(cubit.state.isPreviewing, isTrue);

      // Switch to Overtime
      cubit.setFormType(RequestFormType.overtime);
      expect(cubit.state.formType, RequestFormType.overtime);
      expect(cubit.state.errorMessage, isNull);

      // In-flight leave call fails
      completer.completeError(const ApiException(
        message: 'Lỗi lịch làm việc',
        code: 'SCHEDULE_ERROR',
        statusCode: 400,
      ));
      await Future<void>.delayed(const Duration(milliseconds: 50));

      // PREVENTED: Error does not leak into Overtime form
      expect(cubit.state.formType, RequestFormType.overtime);
      expect(cubit.state.errorMessage, isNull,
          reason: 'Leave preview error must NOT leak into Overtime form');
      expect(cubit.state.isPreviewing, isFalse);

      cubit.close();
    });

    test('race condition prevention: older in-flight error does not overwrite newer successful preview', () async {
      final completerA = Completer<LeavePreviewDto>();
      final completerB = Completer<LeavePreviewDto>();

      when(() => mockRepository.previewLeave(
            any(that: isA<PreviewLeaveRequestPayload>()
                .having((p) => p.startDate, 'startDate', '2026-11-10')),
          )).thenAnswer((_) => completerA.future);

      when(() => mockRepository.previewLeave(
            any(that: isA<PreviewLeaveRequestPayload>()
                .having((p) => p.startDate, 'startDate', '2026-11-20')),
          )).thenAnswer((_) => completerB.future);

      final cubit = RequestFormCubit(repository: mockRepository);

      // Call A
      cubit.setStartDate('2026-11-10');
      cubit.setEndDate('2026-11-10');
      await Future<void>.delayed(const Duration(milliseconds: 300));

      // Call B
      cubit.setStartDate('2026-11-20');
      cubit.setEndDate('2026-11-20');
      await Future<void>.delayed(const Duration(milliseconds: 300));

      // Call B succeeds first
      completerB.complete(const LeavePreviewDto(
        durationType: 'FULL_DAY',
        calculatedMinutes: 960,
        leaveEquivalent: 2.0,
        days: [],
      ));
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(cubit.state.preview?.calculatedMinutes, 960);
      expect(cubit.state.errorMessage, isNull);

      // Call A fails later
      completerA.completeError(const ApiException(
        message: 'Lỗi ngày cũ',
        code: 'LEAVE_ERROR',
        statusCode: 400,
      ));
      await Future<void>.delayed(const Duration(milliseconds: 50));

      // PREVENTED: Stale error does not overwrite newer valid preview
      expect(cubit.state.preview?.calculatedMinutes, 960,
          reason: 'Stale older error must not overwrite newer preview');
      expect(cubit.state.errorMessage, isNull);
      expect(cubit.state.startDate, '2026-11-20');
      expect(cubit.state.isPreviewing, isFalse);

      cubit.close();
    });

    test('race condition prevention: date range inversion (endDate < startDate) discards in-flight preview', () async {
      final completer = Completer<LeavePreviewDto>();
      when(() => mockRepository.previewLeave(any())).thenAnswer((_) => completer.future);

      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setStartDate('2026-11-20');
      cubit.setEndDate('2026-11-20');

      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(cubit.state.isPreviewing, isTrue);

      // User modifies endDate to earlier than startDate
      cubit.setEndDate('2026-11-10');
      expect(cubit.state.preview, isNull);
      expect(cubit.state.isPreviewing, isFalse);

      // Stale preview completes
      completer.complete(const LeavePreviewDto(
        durationType: 'FULL_DAY',
        calculatedMinutes: 480,
        leaveEquivalent: 1.0,
        days: [],
      ));
      await Future<void>.delayed(const Duration(milliseconds: 50));

      // PREVENTED: Preview remains null
      expect(cubit.state.preview, isNull,
          reason: 'In-flight preview must NOT resurrect when date range is inverted');
      expect(cubit.state.isPreviewing, isFalse);

      cubit.close();
    });
  });

  group('Adversarial Testing: Reason Length & Trimming Edge Cases', () {
    test('strictly enforces >= 10 non-whitespace characters', () async {
      final cubit = RequestFormCubit(repository: mockRepository);

      // 1. Exactly 9 chars -> rejected
      cubit.setReason('123456789');
      await cubit.submit();
      expect(cubit.state.errorMessage, 'Lý do cần có ít nhất 10 ký tự.');

      // 2. Exactly 10 chars -> passes reason check
      cubit.setReason('1234567890');
      await cubit.submit();
      // Should not be the reason error
      expect(cubit.state.errorMessage, isNot('Lý do cần có ít nhất 10 ký tự.'));

      // 3. 14 chars with leading/trailing whitespace, trimmed length is 5 -> rejected
      cubit.setReason('   short   ');
      await cubit.submit();
      expect(cubit.state.errorMessage, 'Lý do cần có ít nhất 10 ký tự.');

      // 4. 10 spaces only -> rejected
      cubit.setReason('          ');
      await cubit.submit();
      expect(cubit.state.errorMessage, 'Lý do cần có ít nhất 10 ký tự.');

      // 5. Tabs and newlines with 9 chars -> rejected
      cubit.setReason('\n\t  123456789 \n ');
      await cubit.submit();
      expect(cubit.state.errorMessage, 'Lý do cần có ít nhất 10 ký tự.');

      // 6. Tabs and newlines with 10 chars -> accepted
      cubit.setReason('\n\t  1234567890 \n ');
      await cubit.submit();
      expect(cubit.state.errorMessage, isNot('Lý do cần có ít nhất 10 ký tự.'));

      cubit.close();
    });
  });
}
