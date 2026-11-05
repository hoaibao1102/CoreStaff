import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_client.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/attendance/data/attendance_repository.dart';
import 'package:corestaff_mobile/features/attendance/data/models/punch_request_payload.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late AttendanceRepository repository;

  setUpAll(() {
    registerFallbackValue(Options());
    registerFallbackValue(FormData());
  });

  setUp(() {
    mockApiClient = MockApiClient();
    repository = AttendanceRepositoryImpl(apiClient: mockApiClient);
  });

  group('AttendanceRepository Unit Tests', () {
    test('getTodayAttendance calls GET /api/attendance/today and parses response', () async {
      when(() => mockApiClient.get<dynamic>('/api/attendance/today')).thenAnswer(
        (_) async => {
          'workDate': '2026-11-04',
          'serverTime': '2026-11-04T12:00:00.000Z',
          'attendanceStatus': 'CHECKED_IN',
          'availableAction': 'CHECK_OUT',
          'workingMinutes': 240,
          'lateMinutes': 0,
          'earlyMinutes': 0,
          'assignment': {
            'shiftName': 'Ca hành chính',
            'shiftHours': '08:00 - 17:00',
            'startTime': '08:00',
            'endTime': '17:00',
            'workplaceName': 'Bitexco Tower',
            'address': 'Quận 1, TP.HCM',
          },
        },
      );

      final result = await repository.getTodayAttendance();

      verify(() => mockApiClient.get<dynamic>('/api/attendance/today')).called(1);
      expect(result.workDate, '2026-11-04');
      expect(result.attendanceStatus, 'CHECKED_IN');
      expect(result.availableAction, 'CHECK_OUT');
      expect(result.assignment.shiftName, 'Ca hành chính');
    });

    test('getAttendanceHistory calls GET /api/attendance/history?month=YYYY-MM', () async {
      when(() => mockApiClient.get<dynamic>(
            '/api/attendance/history',
            queryParameters: {'month': '2026-11'},
          )).thenAnswer(
        (_) async => {
          'month': '2026-11',
          'totalDays': 30,
          'summary': {
            'workingDays': 10,
            'totalWorkingMinutes': 4800,
            'lateDays': 0,
            'earlyDays': 0,
            'otMinutes': 0,
            'otDays': 0,
          },
          'items': [],
        },
      );

      final result = await repository.getAttendanceHistory('2026-11');

      verify(() => mockApiClient.get<dynamic>(
            '/api/attendance/history',
            queryParameters: {'month': '2026-11'},
          )).called(1);
      expect(result.month, '2026-11');
      expect(result.totalDays, 30);
      expect(result.summary.workingDays, 10);
      expect(result.items, isEmpty);
    });

    test('checkIn sends POST /api/attendance/check-in with Idempotency-Key and JSON body', () async {
      when(() => mockApiClient.post<dynamic>(
            '/api/attendance/check-in',
            data: any(named: 'data'),
            options: any(named: 'options'),
          )).thenAnswer(
        (_) async => {
          'workDate': '2026-11-04',
          'attendanceStatus': 'CHECKED_IN',
          'availableAction': 'CHECK_OUT',
          'workMode': 'IN_OFFICE',
          'overallApprovalStatus': 'NOT_REQUIRED',
          'checkIn': {
            'eventId': 'evt_1',
            'eventType': 'CHECK_IN',
            'method': 'NETWORK',
            'recordedAt': '2026-11-04T08:00:00.000Z',
            'approvalStatus': 'NOT_REQUIRED',
          },
        },
      );

      final result = await repository.checkIn(
        const PunchRequestPayload(
          workMode: PunchWorkMode.inOffice,
          wifi: PunchWifiPayload(ssid: 'OfficeWifi', bssid: 'aa:bb:cc:dd:ee:ff'),
        ),
      );

      expect(result.attendanceStatus, 'CHECKED_IN');
      expect(result.checkIn?.method, 'NETWORK');

      final captured = verify(() => mockApiClient.post<dynamic>(
            '/api/attendance/check-in',
            data: any(named: 'data'),
            options: captureAny(named: 'options'),
          )).captured;

      final options = captured.first as Options;
      expect(options.headers?['Idempotency-Key'], isNotNull);
      expect(options.headers?['Idempotency-Key'].toString().length, 36); // UUID v4 length
    });

    test('checkOut sends POST /api/attendance/check-out with custom Idempotency-Key', () async {
      when(() => mockApiClient.post<dynamic>(
            '/api/attendance/check-out',
            data: any(named: 'data'),
            options: any(named: 'options'),
          )).thenAnswer(
        (_) async => {
          'workDate': '2026-11-04',
          'attendanceStatus': 'COMPLETED',
          'availableAction': 'NONE',
          'workingMinutes': 480,
          'checkOut': {
            'eventId': 'evt_2',
            'eventType': 'CHECK_OUT',
            'method': 'NETWORK',
            'recordedAt': '2026-11-04T17:00:00.000Z',
            'approvalStatus': 'NOT_REQUIRED',
          },
        },
      );

      const customKey = '550e8400-e29b-41d4-a716-446655440000';
      final result = await repository.checkOut(
        const PunchRequestPayload(),
        idempotencyKey: customKey,
      );

      expect(result.attendanceStatus, 'COMPLETED');
      expect(result.availableAction, 'NONE');

      final captured = verify(() => mockApiClient.post<dynamic>(
            '/api/attendance/check-out',
            data: any(named: 'data'),
            options: captureAny(named: 'options'),
          )).captured;

      final options = captured.first as Options;
      expect(options.headers?['Idempotency-Key'], customKey);
    });

    test('throws ApiException on error response from backend (e.g. SELFIE_REQUIRED)', () async {
      when(() => mockApiClient.post<dynamic>(
            '/api/attendance/check-in',
            data: any(named: 'data'),
            options: any(named: 'options'),
          )).thenThrow(
        const ApiException(
          message: 'Vui lòng chấm công bằng selfie',
          statusCode: 422,
          code: 'SELFIE_REQUIRED',
        ),
      );

      expect(
        () => repository.checkIn(
          const PunchRequestPayload(
            workMode: PunchWorkMode.inOffice,
            wifi: PunchWifiPayload(ssid: 'Guest', bssid: '11:22:33:44:55:66'),
          ),
        ),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'SELFIE_REQUIRED')),
      );
    });
  });
}
