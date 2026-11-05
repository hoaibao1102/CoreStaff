import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_client.dart';
import 'package:corestaff_mobile/features/requests/data/models/request_payloads.dart';
import 'package:corestaff_mobile/features/requests/data/requests_repository.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late RequestsRepository repository;

  setUp(() {
    mockApiClient = MockApiClient();
    repository = RequestsRepositoryImpl(apiClient: mockApiClient);
  });

  group('RequestsRepository Tests', () {
    test('getMyLeaveRequests calls GET /api/leave-requests/mine and returns List<LeaveRequestDto>', () async {
      when(() => mockApiClient.get<dynamic>('/api/leave-requests/mine')).thenAnswer(
        (_) async => [
          {
            '_id': 'l_1',
            'startDate': '2026-11-10',
            'endDate': '2026-11-10',
            'leaveType': 'PAID_LEAVE',
            'reason': 'Nghỉ khám sức khỏe định kỳ',
            'status': 'APPROVED',
          },
        ],
      );

      final result = await repository.getMyLeaveRequests();

      expect(result.length, 1);
      expect(result[0].id, 'l_1');
      expect(result[0].startDate, '2026-11-10');
      expect(result[0].status, 'APPROVED');
      verify(() => mockApiClient.get<dynamic>('/api/leave-requests/mine')).called(1);
    });

    test('getMyLeaveRequests returns empty list if response is not a list', () async {
      when(() => mockApiClient.get<dynamic>('/api/leave-requests/mine')).thenAnswer(
        (_) async => null,
      );

      final result = await repository.getMyLeaveRequests();

      expect(result, isEmpty);
      verify(() => mockApiClient.get<dynamic>('/api/leave-requests/mine')).called(1);
    });

    test('getMyOvertimeRequests calls GET /api/overtime/mine with optional month query', () async {
      when(() => mockApiClient.get<dynamic>('/api/overtime/mine', queryParameters: {'month': '2026-11'})).thenAnswer(
        (_) async => [
          {
            '_id': 'ot_1',
            'workDate': '2026-11-04',
            'reason': 'Làm thêm hoàn thành sprint',
            'status': 'PENDING',
          },
        ],
      );

      final result = await repository.getMyOvertimeRequests(month: '2026-11');

      expect(result.length, 1);
      expect(result[0].id, 'ot_1');
      expect(result[0].workDate, '2026-11-04');
      verify(() => mockApiClient.get<dynamic>('/api/overtime/mine', queryParameters: {'month': '2026-11'})).called(1);
    });

    test('previewLeave calls POST /api/leave-requests/preview with serialized payload', () async {
      const payload = PreviewLeaveRequestPayload(
        startDate: '2026-11-10',
        endDate: '2026-11-10',
        durationType: 'CUSTOM_HOURS',
        requestedStart: '08:00',
        requestedEnd: '12:00',
      );

      when(() => mockApiClient.post<dynamic>(
            '/api/leave-requests/preview',
            data: payload.toJson(),
          )).thenAnswer(
        (_) async => {
          'durationType': 'CUSTOM_HOURS',
          'calculatedMinutes': 240,
          'leaveEquivalent': 0.5,
          'days': [],
        },
      );

      final result = await repository.previewLeave(payload);

      expect(result.durationType, 'CUSTOM_HOURS');
      expect(result.calculatedMinutes, 240);
      expect(result.leaveEquivalent, 0.5);
      verify(() => mockApiClient.post<dynamic>(
            '/api/leave-requests/preview',
            data: payload.toJson(),
          )).called(1);
    });

    test('createLeaveRequest calls POST /api/leave-requests with serialized payload', () async {
      const payload = CreateLeaveRequestPayload(
        startDate: '2026-11-10',
        endDate: '2026-11-10',
        leaveType: 'PAID_LEAVE',
        durationType: 'FULL_DAY',
        reason: 'Nghỉ giải quyết việc gia đình',
      );

      when(() => mockApiClient.post<dynamic>(
            '/api/leave-requests',
            data: payload.toJson(),
          )).thenAnswer(
        (_) async => {
          '_id': 'leave_new',
          'startDate': '2026-11-10',
          'endDate': '2026-11-10',
          'leaveType': 'PAID_LEAVE',
          'durationType': 'FULL_DAY',
          'reason': 'Nghỉ giải quyết việc gia đình',
          'status': 'PENDING_MANAGER',
        },
      );

      final result = await repository.createLeaveRequest(payload);

      expect(result.id, 'leave_new');
      expect(result.status, 'PENDING_MANAGER');
      verify(() => mockApiClient.post<dynamic>(
            '/api/leave-requests',
            data: payload.toJson(),
          )).called(1);
    });

    test('cancelLeaveRequest calls POST /api/leave-requests/mine/:id/cancel', () async {
      when(() => mockApiClient.post<dynamic>('/api/leave-requests/mine/leave_123/cancel')).thenAnswer(
        (_) async => {
          '_id': 'leave_123',
          'startDate': '2026-11-10',
          'endDate': '2026-11-10',
          'leaveType': 'PAID_LEAVE',
          'reason': 'Lý do xin nghỉ',
          'status': 'CANCELLED',
        },
      );

      final result = await repository.cancelLeaveRequest('leave_123');

      expect(result.id, 'leave_123');
      expect(result.status, 'CANCELLED');
      verify(() => mockApiClient.post<dynamic>('/api/leave-requests/mine/leave_123/cancel')).called(1);
    });

    test('createOvertimeRequest calls POST /api/overtime with serialized payload', () async {
      const payload = CreateOvertimeRequestPayload(
        workDate: '2026-11-04',
        requestedStart: '2026-11-04T18:00:00+07:00',
        requestedEnd: '2026-11-04T20:00:00+07:00',
        reason: 'Hoàn thành tiến độ dự án',
        workDescription: 'Kiểm thử ứng dụng',
      );

      when(() => mockApiClient.post<dynamic>(
            '/api/overtime',
            data: payload.toJson(),
          )).thenAnswer(
        (_) async => {
          '_id': 'ot_new',
          'workDate': '2026-11-04',
          'requestedStart': '2026-11-04T18:00:00+07:00',
          'requestedEnd': '2026-11-04T20:00:00+07:00',
          'reason': 'Hoàn thành tiến độ dự án',
          'status': 'PENDING',
        },
      );

      final result = await repository.createOvertimeRequest(payload);

      expect(result.id, 'ot_new');
      expect(result.status, 'PENDING');
      verify(() => mockApiClient.post<dynamic>(
            '/api/overtime',
            data: payload.toJson(),
          )).called(1);
    });
  });
}
