import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';
import '../../../core/network/api_client.dart';
import 'models/attendance_history_dto.dart';
import 'models/punch_request_payload.dart';
import 'models/punch_result_dto.dart';
import 'models/today_attendance_dto.dart';

abstract class AttendanceRepository {
  /// Fetches today's attendance state, assignment shift, punches, and requirements.
  /// Calls GET /api/attendance/today
  Future<TodayAttendanceDto> getTodayAttendance();

  /// Fetches monthly attendance history and summary for the specified month (format: YYYY-MM).
  /// Calls GET /api/attendance/history?month=YYYY-MM
  Future<AttendanceHistoryDto> getAttendanceHistory(String month);

  /// Executes check-in with idempotency guarantee and payload formatting.
  /// Calls POST /api/attendance/check-in
  Future<PunchResultDto> checkIn(
    PunchRequestPayload payload, {
    String? idempotencyKey,
  });

  /// Executes check-out with idempotency guarantee.
  /// Calls POST /api/attendance/check-out
  Future<PunchResultDto> checkOut(
    PunchRequestPayload payload, {
    String? idempotencyKey,
  });

  /// Unified punch coordinator method.
  Future<PunchResultDto> punch({
    required PunchAction action,
    required PunchRequestPayload payload,
    String? idempotencyKey,
  });
}

class AttendanceRepositoryImpl implements AttendanceRepository {
  final ApiClient apiClient;
  final Uuid _uuid;

  AttendanceRepositoryImpl({
    required this.apiClient,
    Uuid? uuid,
  }) : _uuid = uuid ?? const Uuid();

  @override
  Future<TodayAttendanceDto> getTodayAttendance() async {
    final data = await apiClient.get<dynamic>('/api/attendance/today');
    return TodayAttendanceDto.fromJson(data as Map<String, dynamic>);
  }

  @override
  Future<AttendanceHistoryDto> getAttendanceHistory(String month) async {
    final data = await apiClient.get<dynamic>(
      '/api/attendance/history',
      queryParameters: {'month': month},
    );
    return AttendanceHistoryDto.fromJson(data as Map<String, dynamic>);
  }

  @override
  Future<PunchResultDto> checkIn(
    PunchRequestPayload payload, {
    String? idempotencyKey,
  }) {
    return punch(
      action: PunchAction.checkIn,
      payload: payload,
      idempotencyKey: idempotencyKey,
    );
  }

  @override
  Future<PunchResultDto> checkOut(
    PunchRequestPayload payload, {
    String? idempotencyKey,
  }) {
    return punch(
      action: PunchAction.checkOut,
      payload: payload,
      idempotencyKey: idempotencyKey,
    );
  }

  @override
  Future<PunchResultDto> punch({
    required PunchAction action,
    required PunchRequestPayload payload,
    String? idempotencyKey,
  }) async {
    final key = idempotencyKey ?? payload.idempotencyKey ?? _uuid.v4();
    final options = Options(headers: {'Idempotency-Key': key});
    final isCheckIn = action == PunchAction.checkIn;

    dynamic responseData;

    if (payload.hasSelfie) {
      final formData = FormData();
      if (isCheckIn && payload.workMode != null) {
        formData.fields.add(MapEntry('workMode', payload.workMode!.value));
      }
      formData.files.add(MapEntry(
        'selfie',
        await MultipartFile.fromFile(
          payload.selfiePath!,
          filename: 'selfie.jpg',
        ),
      ));
      if (payload.location != null) {
        formData.fields.add(
          MapEntry('latitude', payload.location!.latitude.toString()),
        );
        formData.fields.add(
          MapEntry('longitude', payload.location!.longitude.toString()),
        );
        if (payload.location!.accuracyMeters != null) {
          formData.fields.add(MapEntry(
            'accuracyMeters',
            payload.location!.accuracyMeters.toString(),
          ));
        }
        if (payload.location!.address != null) {
          formData.fields.add(MapEntry('address', payload.location!.address!));
        }
      }
      if (payload.wifi?.ssid != null && payload.wifi!.ssid!.isNotEmpty) {
        formData.fields.add(MapEntry('wifiSsid', payload.wifi!.ssid!));
      }
      if (payload.wifi?.bssid != null && payload.wifi!.bssid!.isNotEmpty) {
        formData.fields.add(MapEntry('wifiBssid', payload.wifi!.bssid!));
      }
      if (payload.note != null && payload.note!.isNotEmpty) {
        formData.fields.add(MapEntry('note', payload.note!));
      }

      responseData = await apiClient.postMultipart<dynamic>(
        action.path,
        formData: formData,
        options: options,
      );
    } else {
      responseData = await apiClient.post<dynamic>(
        action.path,
        data: payload.toJson(isCheckIn: isCheckIn),
        options: options,
      );
    }

    return PunchResultDto.fromJson(responseData as Map<String, dynamic>);
  }
}
