import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/requests/data/models/leave_request_dto.dart';
import 'package:corestaff_mobile/features/requests/data/models/overtime_request_dto.dart';
import 'package:corestaff_mobile/features/requests/data/models/request_payloads.dart';
import 'package:corestaff_mobile/features/requests/data/requests_repository.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/request_form_cubit.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/request_form_state.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/requests_bloc.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/requests_event.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/requests_state.dart';

class MockRequestsRepository extends Mock implements RequestsRepository {}
class FakeCreateOvertimeRequestPayload extends Fake implements CreateOvertimeRequestPayload {}

void main() {
  late MockRequestsRepository mockRepo;

  setUpAll(() {
    registerFallbackValue(FakeCreateOvertimeRequestPayload());
  });

  setUp(() {
    mockRepo = MockRequestsRepository();
  });

  group('Adversarial Challenge 1: BR-OT-01 Overtime Payload Rules & Forbidden Fields', () {
    test('CreateOvertimeRequestPayload.toJson() NEVER includes overtimeType or multiplier', () {
      const payload = CreateOvertimeRequestPayload(
        workDate: '2026-11-04',
        requestedStart: '2026-11-04T18:00:00+07:00',
        requestedEnd: '2026-11-04T20:00:00+07:00',
        reason: 'Làm thêm kiểm thử hệ thống',
        workDescription: 'Kiểm thử module đơn từ',
        retroactiveReason: 'Đăng ký sau giờ làm do mạng chậm',
      );

      final json = payload.toJson();

      // BR-OT-01 & CLIENT_TRUSTED_OT_FIELDS strict checks
      expect(json.containsKey('overtimeType'), isFalse,
          reason: 'BR-OT-01 violation: client must never supply overtimeType');
      expect(json.containsKey('multiplier'), isFalse,
          reason: 'BR-OT-01 violation: client must never supply multiplier');
      expect(json.containsKey('eligibleMinutes'), isFalse,
          reason: 'Client must never supply eligibleMinutes');
      expect(json.containsKey('actualMinutes'), isFalse,
          reason: 'Client must never supply actualMinutes');
      expect(json.containsKey('status'), isFalse,
          reason: 'Client must never supply status');
      expect(json.containsKey('managerId'), isFalse,
          reason: 'Client must never supply managerId');

      // Valid keys check
      expect(json['workDate'], '2026-11-04');
      expect(json['requestedStart'], '2026-11-04T18:00:00+07:00');
      expect(json['requestedEnd'], '2026-11-04T20:00:00+07:00');
      expect(json['reason'], 'Làm thêm kiểm thử hệ thống');
      expect(json['workDescription'], 'Kiểm thử module đơn từ');
      expect(json['retroactiveReason'], 'Đăng ký sau giờ làm do mạng chậm');
    });

    test('CreateOvertimeRequestPayload strips empty or whitespace-only optional fields', () {
      const payloadWithBlanks = CreateOvertimeRequestPayload(
        workDate: '2026-11-04',
        requestedStart: '2026-11-04T18:00:00+07:00',
        requestedEnd: '2026-11-04T20:00:00+07:00',
        reason: '   Lý do có khoảng trắng ở hai đầu   ',
        workDescription: '    ',
        retroactiveReason: '',
      );

      final json = payloadWithBlanks.toJson();

      expect(json['reason'], 'Lý do có khoảng trắng ở hai đầu',
          reason: 'Reason must be trimmed');
      expect(json.containsKey('workDescription'), isFalse,
          reason: 'Whitespace-only workDescription must be omitted');
      expect(json.containsKey('retroactiveReason'), isFalse,
          reason: 'Empty retroactiveReason must be omitted');
    });

    test('RequestFormCubit submission produces clean payload with no forbidden fields', () async {
      CreateOvertimeRequestPayload? capturedPayload;

      when(() => mockRepo.createOvertimeRequest(any())).thenAnswer((invocation) async {
        capturedPayload = invocation.positionalArguments.first as CreateOvertimeRequestPayload;
        return const OvertimeRequestDto(
          id: 'ot_adv_01',
          workDate: '2026-11-04',
          reason: 'Làm thêm kiểm thử tải',
          status: 'PENDING',
        );
      });

      final cubit = RequestFormCubit(repository: mockRepo);
      cubit.setFormType(RequestFormType.overtime);
      cubit.setStartDate('2026-11-04');
      cubit.setStartTime('18:00');
      cubit.setEndTime('21:00');
      cubit.setReason('Làm thêm kiểm thử tải lớn với nhiều kết nối đồng thời');
      cubit.setWorkDescription('Chạy benchmark tải API');

      await cubit.submit();

      expect(capturedPayload, isNotNull);
      final json = capturedPayload!.toJson();
      expect(json.containsKey('overtimeType'), isFalse);
      expect(json.containsKey('multiplier'), isFalse);
      expect(json.containsKey('eligibleMinutes'), isFalse);
      expect(json['requestedStart'], '2026-11-04T18:00:00+07:00');
      expect(json['requestedEnd'], '2026-11-04T21:00:00+07:00');

      cubit.close();
    });
  });

  group('Adversarial Challenge 2: +07:00 Timezone Offset & UTC Skew Resistance', () {
    test('Constructed ISO strings strictly follow YYYY-MM-DDTHH:mm:00+07:00 pattern', () async {
      final edgeCases = [
        {'start': '00:00', 'end': '01:00', 'date': '2026-01-01'},
        {'start': '09:05', 'end': '17:45', 'date': '2026-02-28'}, // Leap/Non-leap boundary
        {'start': '22:30', 'end': '23:59', 'date': '2026-12-31'}, // Year end boundary
      ];

      for (final tc in edgeCases) {
        CreateOvertimeRequestPayload? captured;
        when(() => mockRepo.createOvertimeRequest(any())).thenAnswer((inv) async {
          captured = inv.positionalArguments.first as CreateOvertimeRequestPayload;
          return OvertimeRequestDto(
            id: 'ot_tc',
            workDate: tc['date']!,
            reason: 'Kiểm tra múi giờ chính xác',
            status: 'PENDING',
          );
        });

        final cubit = RequestFormCubit(repository: mockRepo);
        cubit.setFormType(RequestFormType.overtime);
        cubit.setStartDate(tc['date']!);
        cubit.setStartTime(tc['start']!);
        cubit.setEndTime(tc['end']!);
        cubit.setReason('Kiểm tra múi giờ chính xác đủ 10 ký tự');

        await cubit.submit();

        expect(captured, isNotNull);
        final startIso = captured!.requestedStart;
        final endIso = captured!.requestedEnd;

        // Strict regex verification for +07:00 offset
        final isoWithOffsetRegex = RegExp(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+07:00$');
        expect(isoWithOffsetRegex.hasMatch(startIso), isTrue,
            reason: 'Start ISO "$startIso" must end with +07:00 and standard format');
        expect(isoWithOffsetRegex.hasMatch(endIso), isTrue,
            reason: 'End ISO "$endIso" must end with +07:00 and standard format');

        // Parse into DateTime to verify absolute UTC instant matches -7h exactly
        final parsedStartUtc = DateTime.parse(startIso).toUtc();
        final startHour = int.parse(tc['start']!.split(':')[0]);
        final startMin = int.parse(tc['start']!.split(':')[1]);

        // Expected UTC hour: (startHour - 7) mod 24
        final expectedUtcHour = (startHour - 7) < 0 ? startHour - 7 + 24 : startHour - 7;
        expect(parsedStartUtc.hour, expectedUtcHour,
            reason: 'UTC hour should be exactly startHour - 7');
        expect(parsedStartUtc.minute, startMin);

        cubit.close();
      }
    });

    test('Initial date in RequestFormCubit accounts for UTC+7 offset', () {
      final nowUtc = DateTime.now().toUtc();
      final expectedVnDate = nowUtc.add(const Duration(hours: 7));
      final expectedVnStr =
          '${expectedVnDate.year.toString().padLeft(4, '0')}-${expectedVnDate.month.toString().padLeft(2, '0')}-${expectedVnDate.day.toString().padLeft(2, '0')}';

      final cubit = RequestFormCubit(repository: mockRepo);
      expect(cubit.state.startDate, expectedVnStr,
          reason: 'Initial form date should represent Vietnam date (UTC+7), not raw machine local or UTC date');

      cubit.close();
    });
  });

  group('Adversarial Challenge 3: Unified Feed Sorting & Filtering In-Memory Stability', () {
    const leave1 = LeaveRequestDto(
      id: 'l_old',
      startDate: '2026-11-01',
      endDate: '2026-11-01',
      leaveType: 'PAID_LEAVE',
      reason: 'Nghỉ phép việc riêng',
      status: 'APPROVED',
      createdAt: '2026-11-01T08:00:00.000Z',
    );

    const leave2WithoutCreatedAt = LeaveRequestDto(
      id: 'l_fallback',
      startDate: '2026-11-04',
      endDate: '2026-11-04',
      leaveType: 'PAID_LEAVE',
      reason: 'Nghỉ phép không có createdAt',
      status: 'PENDING',
      createdAt: null,
    );

    const ot1 = OvertimeRequestDto(
      id: 'ot_new',
      workDate: '2026-11-06',
      requestedStart: '2026-11-06T18:00:00+07:00',
      requestedEnd: '2026-11-06T20:00:00+07:00',
      reason: 'Tăng ca kiểm thử tải',
      status: 'PENDING',
      createdAt: '2026-11-05T12:00:00.000Z',
    );

    const ot2WithoutCreatedAt = OvertimeRequestDto(
      id: 'ot_fallback',
      workDate: '2026-11-03',
      reason: 'Tăng ca fallback workDate',
      status: 'PENDING',
      createdAt: null,
    );

    test('Descending sort accurately orders mixed items with and without createdAt', () {
      final loadedState = RequestsLoaded(
        leaves: const [leave1, leave2WithoutCreatedAt],
        overtime: const [ot1, ot2WithoutCreatedAt],
      );

      final items = loadedState.filteredItems;
      expect(items.length, 4);

      // Dates:
      // ot1: createdAt = '2026-11-05T12:00:00.000Z'
      // leave2WithoutCreatedAt: startDate = '2026-11-04'
      // ot2WithoutCreatedAt: workDate = '2026-11-03'
      // leave1: createdAt = '2026-11-01T08:00:00.000Z'
      expect(items[0].id, 'ot-ot_new');
      expect(items[1].id, 'leave-l_fallback');
      expect(items[2].id, 'ot-ot_fallback');
      expect(items[3].id, 'leave-l_old');
    });

    test('Toggling tabs preserves underlying collections and filters cleanly without throwing', () {
      var state = const RequestsLoaded(
        leaves: [leave1, leave2WithoutCreatedAt],
        overtime: [ot1, ot2WithoutCreatedAt],
        filter: RequestsFilter.all,
      );

      // Initial 'all'
      expect(state.filteredItems.length, 4);
      expect(state.totalCount, 4);
      expect(state.filteredCount, 4);

      // Switch to 'leave'
      state = state.copyWith(filter: RequestsFilter.leave);
      expect(state.filteredItems.length, 2);
      expect(state.filteredItems.every((item) => item is LeaveFeedItem), isTrue);
      expect(state.totalCount, 4);
      expect(state.filteredCount, 2);

      // Switch to 'overtime'
      state = state.copyWith(filter: RequestsFilter.overtime);
      expect(state.filteredItems.length, 2);
      expect(state.filteredItems.every((item) => item is OvertimeFeedItem), isTrue);
      expect(state.totalCount, 4);
      expect(state.filteredCount, 2);

      // Switch back to 'all'
      state = state.copyWith(filter: RequestsFilter.all);
      expect(state.filteredItems.length, 4);
      expect(state.leaves.length, 2, reason: 'leaves collection must remain intact');
      expect(state.overtime.length, 2, reason: 'overtime collection must remain intact');
    });

    test('Stress test: 2,000 items sorting completes rapidly without mutation side-effects', () {
      final bigLeaves = List.generate(
        1000,
        (i) => LeaveRequestDto(
          id: 'l_$i',
          startDate: '2026-11-01',
          endDate: '2026-11-01',
          leaveType: 'PAID_LEAVE',
          reason: 'Lý do $i',
          status: 'APPROVED',
          createdAt: '2026-11-01T${(i % 24).toString().padLeft(2, '0')}:00:00.000Z',
        ),
      );

      final bigOt = List.generate(
        1000,
        (i) => OvertimeRequestDto(
          id: 'ot_$i',
          workDate: '2026-11-02',
          reason: 'Tăng ca $i',
          status: 'PENDING',
          createdAt: '2026-11-02T${(i % 24).toString().padLeft(2, '0')}:00:00.000Z',
        ),
      );

      final stopwatch = Stopwatch()..start();
      final state = RequestsLoaded(leaves: bigLeaves, overtime: bigOt);
      final sorted = state.filteredItems;
      stopwatch.stop();

      expect(sorted.length, 2000);
      expect(stopwatch.elapsedMilliseconds, lessThan(500),
          reason: 'Sorting 2,000 items should take well under 500ms');

      // Check first item has '2026-11-02' date (from overtime) and last has '2026-11-01'
      expect(sorted.first.date.startsWith('2026-11-02'), isTrue);
      expect(sorted.last.date.startsWith('2026-11-01'), isTrue);
    });

    test('Empty leaves and empty overtime edge cases produce empty feed without error', () {
      const emptyState = RequestsLoaded(leaves: [], overtime: []);
      expect(emptyState.filteredItems, isEmpty);
      expect(emptyState.totalCount, 0);
      expect(emptyState.filteredCount, 0);

      final onlyLeaves = const RequestsLoaded(leaves: [leave1], overtime: [])
          .copyWith(filter: RequestsFilter.overtime);
      expect(onlyLeaves.filteredItems, isEmpty);
      expect(onlyLeaves.totalCount, 1);
      expect(onlyLeaves.filteredCount, 0);
    });
  });

  group('Adversarial Challenge 4: Optimistic Cancellation & Error Banner Retention', () {
    const activeLeave = LeaveRequestDto(
      id: 'leave_active_01',
      startDate: '2026-11-10',
      endDate: '2026-11-10',
      leaveType: 'PAID_LEAVE',
      reason: 'Nghỉ khám sức khỏe định kỳ',
      status: 'PENDING_MANAGER',
    );

    const activeOvertime = OvertimeRequestDto(
      id: 'ot_active_01',
      workDate: '2026-11-05',
      reason: 'Làm thêm báo cáo tuần',
      status: 'PENDING',
    );

    blocTest<RequestsBloc, RequestsState>(
      'Cancellation success immutably updates status to CANCELLED and preserves other items',
      build: () {
        when(() => mockRepo.cancelLeaveRequest('leave_active_01')).thenAnswer(
          (_) async => activeLeave.copyWith(status: 'CANCELLED'),
        );
        return RequestsBloc(requestsRepository: mockRepo);
      },
      seed: () => const RequestsLoaded(
        leaves: [activeLeave],
        overtime: [activeOvertime],
      ),
      act: (bloc) => bloc.add(const RequestsCancelRequested('leave_active_01')),
      expect: () => [
        isA<RequestsLoaded>()
            .having((s) => s.leaves.first.status, 'status', 'CANCELLED')
            .having((s) => s.overtime.length, 'overtime count unchanged', 1)
            .having((s) => s.bannerSuccess, 'bannerSuccess', 'Đã hủy đơn nghỉ phép thành công.')
            .having((s) => s.bannerError, 'bannerError is null', isNull),
      ],
      verify: (_) {
        verify(() => mockRepo.cancelLeaveRequest('leave_active_01')).called(1);
      },
    );

    blocTest<RequestsBloc, RequestsState>(
      'Cancellation failure retains existing items, does not mutate status, and surfaces bannerError',
      build: () {
        when(() => mockRepo.cancelLeaveRequest('leave_active_01')).thenThrow(
          const ApiException(
            message: 'Đơn nghỉ phép đã được xử lý',
            code: 'LEAVE_REQUEST_CANNOT_CANCEL',
            statusCode: 400,
          ),
        );
        return RequestsBloc(requestsRepository: mockRepo);
      },
      seed: () => const RequestsLoaded(
        leaves: [activeLeave],
        overtime: [activeOvertime],
      ),
      act: (bloc) => bloc.add(const RequestsCancelRequested('leave_active_01')),
      expect: () => [
        isA<RequestsLoaded>()
            .having((s) => s.leaves.first.status, 'status remained PENDING_MANAGER', 'PENDING_MANAGER')
            .having((s) => s.overtime.length, 'overtime unchanged', 1)
            .having((s) => s.bannerError, 'bannerError surfaced', 'Đơn nghỉ phép đã được xử lý, không thể hủy.'),
      ],
    );

    blocTest<RequestsBloc, RequestsState>(
      'Pull-to-refresh failure with existing items retains items and emits bannerError (never blows away items)',
      build: () {
        when(() => mockRepo.getMyLeaveRequests()).thenThrow(
          const ApiException(
            message: 'Không thể kết nối đến máy chủ',
            code: 'CONNECTION_ERROR',
            statusCode: 503,
          ),
        );
        when(() => mockRepo.getMyOvertimeRequests()).thenAnswer((_) async => []);
        return RequestsBloc(requestsRepository: mockRepo);
      },
      seed: () => const RequestsLoaded(
        leaves: [activeLeave],
        overtime: [activeOvertime],
      ),
      act: (bloc) => bloc.add(const RequestsRefreshed()),
      expect: () => [
        isA<RequestsLoaded>()
            .having((s) => s.isRefreshing, 'isRefreshing', isTrue)
            .having((s) => s.bannerError, 'clears previous error', isNull),
        isA<RequestsLoaded>()
            .having((s) => s.isRefreshing, 'isRefreshing', isFalse)
            .having((s) => s.leaves.length, 'leaves preserved', 1)
            .having((s) => s.overtime.length, 'overtime preserved', 1)
            .having((s) => s.bannerError, 'bannerError set on failure', 'Không thể kết nối đến máy chủ'),
      ],
    );

    blocTest<RequestsBloc, RequestsState>(
      'Subsequent successful refresh clears bannerError and updates data',
      build: () {
        when(() => mockRepo.getMyLeaveRequests()).thenAnswer(
          (_) async => [activeLeave.copyWith(status: 'APPROVED')],
        );
        when(() => mockRepo.getMyOvertimeRequests()).thenAnswer((_) async => [activeOvertime]);
        return RequestsBloc(requestsRepository: mockRepo);
      },
      seed: () => const RequestsLoaded(
        leaves: [activeLeave],
        overtime: [activeOvertime],
        bannerError: 'Lỗi cũ cần được xóa khi làm mới',
      ),
      act: (bloc) => bloc.add(const RequestsRefreshed(successMessage: 'Làm mới thành công')),
      expect: () => [
        isA<RequestsLoaded>()
            .having((s) => s.isRefreshing, 'isRefreshing', isTrue)
            .having((s) => s.bannerError, 'bannerError cleared on start of refresh', isNull),
        isA<RequestsLoaded>()
            .having((s) => s.isRefreshing, 'isRefreshing', isFalse)
            .having((s) => s.leaves.first.status, 'status updated', 'APPROVED')
            .having((s) => s.bannerSuccess, 'bannerSuccess set', 'Làm mới thành công')
            .having((s) => s.bannerError, 'bannerError remains null', isNull),
      ],
    );
  });
}
