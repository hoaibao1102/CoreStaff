import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/requests/data/models/leave_request_dto.dart';
import 'package:corestaff_mobile/features/requests/data/models/overtime_request_dto.dart';
import 'package:corestaff_mobile/features/requests/data/requests_repository.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/requests_bloc.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/requests_event.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/requests_state.dart';

class MockRequestsRepository extends Mock implements RequestsRepository {}

void main() {
  late MockRequestsRepository mockRepository;

  const sampleLeave1 = LeaveRequestDto(
    id: 'leave_01',
    startDate: '2026-11-08',
    endDate: '2026-11-08',
    leaveType: 'PAID_LEAVE',
    reason: 'Khám sức khỏe tổng quát',
    status: 'PENDING_MANAGER',
    createdAt: '2026-11-04T10:00:00.000Z',
  );

  const sampleOvertime1 = OvertimeRequestDto(
    id: 'ot_01',
    workDate: '2026-11-05',
    requestedStart: '2026-11-05T18:00:00+07:00',
    requestedEnd: '2026-11-05T20:00:00+07:00',
    reason: 'Kiểm thử ứng dụng mobile',
    status: 'PENDING',
    createdAt: '2026-11-04T12:00:00.000Z',
  );

  setUp(() {
    mockRepository = MockRequestsRepository();
  });

  group('RequestsBloc Tests', () {
    test('initial state is RequestsInitial', () {
      final bloc = RequestsBloc(requestsRepository: mockRepository);
      expect(bloc.state, isA<RequestsInitial>());
    });

    blocTest<RequestsBloc, RequestsState>(
      'emits [RequestsLoading, RequestsLoaded] on successful RequestsLoadStarted with descending sort',
      build: () {
        when(() => mockRepository.getMyLeaveRequests()).thenAnswer(
          (_) async => [sampleLeave1],
        );
        when(() => mockRepository.getMyOvertimeRequests()).thenAnswer(
          (_) async => [sampleOvertime1],
        );
        return RequestsBloc(requestsRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const RequestsLoadStarted()),
      expect: () => [
        isA<RequestsLoading>(),
        isA<RequestsLoaded>()
            .having((s) => s.leaves.length, 'leaves length', 1)
            .having((s) => s.overtime.length, 'overtime length', 1)
            .having((s) => s.filteredItems.length, 'filtered length', 2)
            .having((s) => s.filteredItems.first.id, 'newest is ot', 'ot-ot_01')
            .having((s) => s.filteredItems.last.id, 'oldest is leave', 'leave-leave_01'),
      ],
    );

    blocTest<RequestsBloc, RequestsState>(
      'emits [RequestsLoaded(isRefreshing: true), RequestsLoaded(isRefreshing: false)] when isRefresh is true',
      build: () {
        when(() => mockRepository.getMyLeaveRequests()).thenAnswer(
          (_) async => [sampleLeave1],
        );
        when(() => mockRepository.getMyOvertimeRequests()).thenAnswer(
          (_) async => [sampleOvertime1],
        );
        return RequestsBloc(requestsRepository: mockRepository);
      },
      seed: () => const RequestsLoaded(
        leaves: [sampleLeave1],
        overtime: [],
      ),
      act: (bloc) => bloc.add(const RequestsRefreshed(successMessage: 'Đã cập nhật')),
      expect: () => [
        isA<RequestsLoaded>().having((s) => s.isRefreshing, 'isRefreshing', isTrue),
        isA<RequestsLoaded>()
            .having((s) => s.isRefreshing, 'isRefreshing', isFalse)
            .having((s) => s.bannerSuccess, 'bannerSuccess', 'Đã cập nhật')
            .having((s) => s.overtime.length, 'overtime length', 1),
      ],
    );

    blocTest<RequestsBloc, RequestsState>(
      'Filters items properly when active filter changes',
      build: () => RequestsBloc(requestsRepository: mockRepository),
      seed: () => const RequestsLoaded(
        leaves: [sampleLeave1],
        overtime: [sampleOvertime1],
        filter: RequestsFilter.all,
      ),
      act: (bloc) {
        bloc.add(const RequestsFilterChanged(RequestsFilter.leave));
        bloc.add(const RequestsFilterChanged(RequestsFilter.overtime));
        bloc.add(const RequestsFilterChanged(RequestsFilter.all));
      },
      expect: () => [
        isA<RequestsLoaded>()
            .having((s) => s.filter, 'filter', RequestsFilter.leave)
            .having((s) => s.filteredItems.length, 'leave count', 1)
            .having((s) => s.filteredItems.first.id, 'id', 'leave-leave_01'),
        isA<RequestsLoaded>()
            .having((s) => s.filter, 'filter', RequestsFilter.overtime)
            .having((s) => s.filteredItems.length, 'ot count', 1)
            .having((s) => s.filteredItems.first.id, 'id', 'ot-ot_01'),
        isA<RequestsLoaded>()
            .having((s) => s.filter, 'filter', RequestsFilter.all)
            .having((s) => s.filteredItems.length, 'all count', 2),
      ],
    );

    blocTest<RequestsBloc, RequestsState>(
      'RequestsCancelRequested cancels leave optimistically and sets success banner',
      build: () {
        when(() => mockRepository.cancelLeaveRequest('leave_01')).thenAnswer(
          (_) async => sampleLeave1.copyWith(status: 'CANCELLED'),
        );
        return RequestsBloc(requestsRepository: mockRepository);
      },
      seed: () => const RequestsLoaded(
        leaves: [sampleLeave1],
        overtime: [],
      ),
      act: (bloc) => bloc.add(const RequestsCancelRequested('leave_01')),
      expect: () => [
        isA<RequestsLoaded>()
            .having((s) => s.leaves.first.status, 'status', 'CANCELLED')
            .having((s) => s.bannerSuccess, 'bannerSuccess', 'Đã hủy đơn nghỉ phép thành công.')
            .having((s) => s.bannerError, 'bannerError', isNull),
      ],
      verify: (_) {
        verify(() => mockRepository.cancelLeaveRequest('leave_01')).called(1);
      },
    );

    blocTest<RequestsBloc, RequestsState>(
      'RequestsCancelRequested sets bannerError on failure without losing existing items',
      build: () {
        when(() => mockRepository.cancelLeaveRequest('leave_01')).thenThrow(
          const ApiException(
            message: 'Đơn nghỉ phép đã được xử lý',
            code: 'LEAVE_REQUEST_CANNOT_CANCEL',
            statusCode: 409,
          ),
        );
        return RequestsBloc(requestsRepository: mockRepository);
      },
      seed: () => const RequestsLoaded(
        leaves: [sampleLeave1],
        overtime: [],
      ),
      act: (bloc) => bloc.add(const RequestsCancelRequested('leave_01')),
      expect: () => [
        isA<RequestsLoaded>()
            .having((s) => s.leaves.first.status, 'status', 'PENDING_MANAGER')
            .having((s) => s.bannerError, 'bannerError', 'Đơn nghỉ phép đã được xử lý, không thể hủy.'),
      ],
    );

    blocTest<RequestsBloc, RequestsState>(
      'emits [RequestsLoading, RequestsError] when initial load fails',
      build: () {
        when(() => mockRepository.getMyLeaveRequests()).thenThrow(
          const ApiException(
            message: 'Không tìm thấy dữ liệu',
            code: 'LEAVE_REQUEST_NOT_FOUND',
            statusCode: 404,
          ),
        );
        when(() => mockRepository.getMyOvertimeRequests()).thenAnswer((_) async => []);
        return RequestsBloc(requestsRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const RequestsLoadStarted()),
      expect: () => [
        isA<RequestsLoading>(),
        isA<RequestsError>().having(
          (s) => s.message,
          'message',
          'Không tìm thấy đơn nghỉ phép.',
        ),
      ],
    );
  });
}
