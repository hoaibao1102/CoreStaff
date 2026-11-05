import '../../../../core/network/api_exception.dart';
import '../../data/attendance_repository.dart';
import '../../data/models/punch_request_payload.dart';
import '../../data/models/punch_result_dto.dart';
import '../../data/models/today_attendance_dto.dart';
import '../../data/services/camera_service.dart';
import '../../data/services/location_service.dart';
import '../../data/services/wifi_service.dart';

enum PunchWaterfallStep {
  wifiCheck,
  gpsFix,
  promptSelfie,
  submitting,
}

sealed class PunchCoordinatorResult {
  const PunchCoordinatorResult();
}

class PunchCoordinatorSuccess extends PunchCoordinatorResult {
  final PunchResultDto result;
  final String method; // 'NETWORK' | 'GPS' | 'SELFIE'

  const PunchCoordinatorSuccess({
    required this.result,
    required this.method,
  });
}

class PunchCoordinatorCancelled extends PunchCoordinatorResult {
  const PunchCoordinatorCancelled();
}

class PunchCoordinatorFailure extends PunchCoordinatorResult {
  final String message;
  final String? errorCode;
  final bool isPermissionDenied;

  const PunchCoordinatorFailure({
    required this.message,
    this.errorCode,
    this.isPermissionDenied = false,
  });
}

abstract class PunchCoordinator {
  Future<PunchCoordinatorResult> executeWaterfall({
    required TodayAttendanceDto today,
    required void Function(PunchWaterfallStep step, String statusText)
        onProgress,
  });
}

class PunchCoordinatorImpl implements PunchCoordinator {
  final WifiService wifiService;
  final LocationService locationService;
  final CameraService cameraService;
  final AttendanceRepository attendanceRepository;

  PunchCoordinatorImpl({
    required this.wifiService,
    required this.locationService,
    required this.cameraService,
    required this.attendanceRepository,
  });

  @override
  Future<PunchCoordinatorResult> executeWaterfall({
    required TodayAttendanceDto today,
    required void Function(PunchWaterfallStep step, String statusText)
        onProgress,
  }) async {
    final action = today.availableAction == 'CHECK_IN'
        ? PunchAction.checkIn
        : PunchAction.checkOut;
    final isOutOffice = today.assignment.workplaceType == 'OUT_OFFICE';

    // ─────────────────────────────────────────────────────────────
    // BRANCH A: OUT_OFFICE (Direct Selfie)
    // ─────────────────────────────────────────────────────────────
    if (isOutOffice) {
      onProgress(
        PunchWaterfallStep.promptSelfie,
        'Ca ngoài văn phòng yêu cầu chụp ảnh selfie.',
      );

      final String? selfiePath;
      try {
        selfiePath = await cameraService.captureSelfie();
      } on ApiException catch (e) {
        return PunchCoordinatorFailure(
          message: e.message,
          errorCode: e.code,
          isPermissionDenied: true,
        );
      }

      if (selfiePath == null) {
        return const PunchCoordinatorCancelled();
      }

      onProgress(
        PunchWaterfallStep.submitting,
        'Đang gửi dữ liệu chấm công...',
      );
      try {
        final result = await attendanceRepository.punch(
          action: action,
          payload: PunchRequestPayload(
            workMode: PunchWorkMode.outOffice,
            selfiePath: selfiePath,
          ),
        );
        return PunchCoordinatorSuccess(result: result, method: 'SELFIE');
      } on ApiException catch (e) {
        return PunchCoordinatorFailure(message: e.message, errorCode: e.code);
      } catch (e) {
        return PunchCoordinatorFailure(message: e.toString());
      }
    }

    // ─────────────────────────────────────────────────────────────
    // BRANCH B: IN_OFFICE (Cascade: Wi-Fi -> GPS -> Selfie)
    // ─────────────────────────────────────────────────────────────
    final wifiFirst = today.assignment.hasWifiNetworks;
    WifiInfo? wifiInfo;

    // --- TIER 1: Wi-Fi BSSID Check ---
    if (wifiFirst) {
      onProgress(
        PunchWaterfallStep.wifiCheck,
        'Đang kiểm tra kết nối Wi-Fi văn phòng...',
      );
      wifiInfo = await wifiService.getCurrentWifi();

      try {
        final result = await attendanceRepository.punch(
          action: action,
          payload: PunchRequestPayload(
            workMode: PunchWorkMode.inOffice,
            wifi: wifiInfo.isNotEmpty
                ? PunchWifiPayload(
                    ssid: wifiInfo.ssid,
                    bssid: wifiInfo.bssid,
                  )
                : null,
          ),
        );
        return PunchCoordinatorSuccess(result: result, method: 'NETWORK');
      } on ApiException catch (e) {
        if (e.code != 'SELFIE_REQUIRED') {
          return PunchCoordinatorFailure(
            message: e.message,
            errorCode: e.code,
          );
        }
        // Fall through to Tier 2 on SELFIE_REQUIRED
      } catch (e) {
        return PunchCoordinatorFailure(message: e.toString());
      }
    }

    // --- TIER 2: GPS Geofence Check ---
    onProgress(
      PunchWaterfallStep.gpsFix,
      'Chưa xác thực được Wi-Fi công ty. Đang kiểm tra vị trí GPS…',
    );
    final hasLocPermission = await locationService.hasPermission();
    if (!hasLocPermission) {
      return const PunchCoordinatorFailure(
        message:
            'Cần quyền truy cập vị trí để chấm công. Hãy bật trong Cài đặt.',
        isPermissionDenied: true,
      );
    }

    GeoPosition position;
    try {
      position = await locationService.getCurrentPosition();
    } catch (e) {
      return PunchCoordinatorFailure(message: 'Không thể lấy tọa độ vị trí: $e');
    }

    try {
      final result = await attendanceRepository.punch(
        action: action,
        payload: PunchRequestPayload(
          workMode: PunchWorkMode.inOffice,
          location: PunchLocationPayload(
            latitude: position.latitude,
            longitude: position.longitude,
            accuracyMeters: position.accuracy,
            address: position.address,
          ),
          wifi: wifiInfo != null && wifiInfo.isNotEmpty
              ? PunchWifiPayload(
                  ssid: wifiInfo.ssid,
                  bssid: wifiInfo.bssid,
                )
              : null,
        ),
      );
      return PunchCoordinatorSuccess(result: result, method: 'GPS');
    } on ApiException catch (e) {
      if (e.code != 'SELFIE_REQUIRED') {
        return PunchCoordinatorFailure(message: e.message, errorCode: e.code);
      }
      // Fall through to Tier 3 on SELFIE_REQUIRED
    } catch (e) {
      return PunchCoordinatorFailure(message: e.toString());
    }

    // --- TIER 3: Selfie Fallback Check ---
    onProgress(
      PunchWaterfallStep.promptSelfie,
      'Vị trí ngoài phạm vi công ty. Chụp ảnh selfie để gửi quản lý duyệt.',
    );

    final String? selfiePath;
    try {
      selfiePath = await cameraService.captureSelfie();
    } on ApiException catch (e) {
      return PunchCoordinatorFailure(
        message: e.message,
        errorCode: e.code,
        isPermissionDenied: true,
      );
    }

    if (selfiePath == null) {
      return const PunchCoordinatorCancelled();
    }

    onProgress(
      PunchWaterfallStep.submitting,
      'Đang gửi ảnh selfie và dữ liệu chấm công...',
    );
    try {
      final result = await attendanceRepository.punch(
        action: action,
        payload: PunchRequestPayload(
          workMode: PunchWorkMode.inOffice,
          location: PunchLocationPayload(
            latitude: position.latitude,
            longitude: position.longitude,
            accuracyMeters: position.accuracy,
            address: position.address,
          ),
          wifi: wifiInfo != null && wifiInfo.isNotEmpty
              ? PunchWifiPayload(
                  ssid: wifiInfo.ssid,
                  bssid: wifiInfo.bssid,
                )
              : null,
          selfiePath: selfiePath,
        ),
      );
      return PunchCoordinatorSuccess(result: result, method: 'SELFIE');
    } on ApiException catch (e) {
      return PunchCoordinatorFailure(message: e.message, errorCode: e.code);
    } catch (e) {
      return PunchCoordinatorFailure(message: e.toString());
    }
  }
}
