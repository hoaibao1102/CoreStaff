import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/attendance/data/attendance_repository.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_assignment_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_event_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/punch_request_payload.dart';
import 'package:corestaff_mobile/features/attendance/data/models/punch_result_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/today_attendance_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/services/camera_service.dart';
import 'package:corestaff_mobile/features/attendance/data/services/location_service.dart';
import 'package:corestaff_mobile/features/attendance/data/services/wifi_service.dart';
import 'package:corestaff_mobile/features/attendance/domain/services/punch_coordinator.dart';

class MockWifiService extends Mock implements WifiService {}

class MockLocationService extends Mock implements LocationService {}

class MockCameraService extends Mock implements CameraService {}

class MockAttendanceRepository extends Mock implements AttendanceRepository {}

void main() {
  late MockWifiService mockWifiService;
  late MockLocationService mockLocationService;
  late MockCameraService mockCameraService;
  late MockAttendanceRepository mockAttendanceRepo;
  late PunchCoordinator coordinator;

  const inOfficeToday = TodayAttendanceDto(
    workDate: '2026-11-04',
    serverTime: '2026-11-04T12:00:00.000Z',
    attendanceStatus: 'NOT_CHECKED_IN',
    availableAction: 'CHECK_IN',
    assignment: AttendanceAssignmentDto(
      shiftName: 'Ca hành chính',
      shiftHours: '08:00 - 17:00',
      startTime: '08:00',
      endTime: '17:00',
      address: 'Quận 1, TP.HCM',
      workplaceName: 'Văn phòng Bitexco',
      workplaceType: 'IN_OFFICE',
      hasWifiNetworks: true,
      allowWifiAttendance: true,
      allowGpsAttendance: true,
      allowSelfieFallback: true,
    ),
  );

  const outOfficeToday = TodayAttendanceDto(
    workDate: '2026-11-04',
    serverTime: '2026-11-04T12:00:00.000Z',
    attendanceStatus: 'NOT_CHECKED_IN',
    availableAction: 'CHECK_IN',
    assignment: AttendanceAssignmentDto(
      shiftName: 'Ca thực địa',
      shiftHours: '08:00 - 17:00',
      startTime: '08:00',
      endTime: '17:00',
      address: 'TP. Thủ Đức',
      workplaceName: 'Dự án Thủ Thiêm',
      workplaceType: 'OUT_OFFICE',
    ),
  );

  const samplePunchResult = PunchResultDto(
    workDate: '2026-11-04',
    attendanceStatus: 'CHECKED_IN',
    availableAction: 'CHECK_OUT',
    checkIn: AttendanceEventDto(
      eventId: 'evt_1',
      eventType: 'CHECK_IN',
      method: 'NETWORK',
      recordedAt: '2026-11-04T08:00:00.000Z',
      approvalStatus: 'NOT_REQUIRED',
    ),
  );

  setUpAll(() {
    registerFallbackValue(PunchAction.checkIn);
    registerFallbackValue(const PunchRequestPayload());
  });

  setUp(() {
    mockWifiService = MockWifiService();
    mockLocationService = MockLocationService();
    mockCameraService = MockCameraService();
    mockAttendanceRepo = MockAttendanceRepository();

    coordinator = PunchCoordinatorImpl(
      wifiService: mockWifiService,
      locationService: mockLocationService,
      cameraService: mockCameraService,
      attendanceRepository: mockAttendanceRepo,
    );

    when(() => mockLocationService.hasPermission()).thenAnswer((_) async => true);
  });

  group('PunchCoordinator Waterfall Cascade Tests', () {
    test('OUT_OFFICE workplace directly triggers camera selfie and submits without wifi/gps', () async {
      when(() => mockCameraService.captureSelfie())
          .thenAnswer((_) async => '/cache/selfie_out_office.jpg');
      when(() => mockAttendanceRepo.punch(
            action: any(named: 'action'),
            payload: any(named: 'payload'),
          )).thenAnswer((_) async => samplePunchResult);

      final steps = <PunchWaterfallStep>[];
      final result = await coordinator.executeWaterfall(
        today: outOfficeToday,
        onProgress: (step, _) => steps.add(step),
      );

      expect(result, isA<PunchCoordinatorSuccess>());
      expect((result as PunchCoordinatorSuccess).method, 'SELFIE');
      expect(steps, [PunchWaterfallStep.promptSelfie, PunchWaterfallStep.submitting]);

      verify(() => mockCameraService.captureSelfie()).called(1);
      verify(() => mockAttendanceRepo.punch(
            action: PunchAction.checkIn,
            payload: any(named: 'payload'),
          )).called(1);
      verifyZeroInteractions(mockWifiService);
      verifyZeroInteractions(mockLocationService);
    });

    test('OUT_OFFICE camera dismissal returns PunchCoordinatorCancelled cleanly', () async {
      when(() => mockCameraService.captureSelfie()).thenAnswer((_) async => null);

      final result = await coordinator.executeWaterfall(
        today: outOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorCancelled>());
      verifyNever(() => mockAttendanceRepo.punch(
            action: any(named: 'action'),
            payload: any(named: 'payload'),
          ));
    });

    test('IN_OFFICE Tier 1: Wi-Fi match succeeds immediately and skips GPS & camera', () async {
      when(() => mockWifiService.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'Bitexco_Corp', bssid: 'aa:bb:cc:dd:ee:ff'));
      when(() => mockAttendanceRepo.punch(
            action: any(named: 'action'),
            payload: any(named: 'payload'),
          )).thenAnswer((_) async => samplePunchResult);

      final steps = <PunchWaterfallStep>[];
      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (step, _) => steps.add(step),
      );

      expect(result, isA<PunchCoordinatorSuccess>());
      expect((result as PunchCoordinatorSuccess).method, 'NETWORK');
      expect(steps, [PunchWaterfallStep.wifiCheck]);

      verify(() => mockWifiService.getCurrentWifi()).called(1);
      verifyZeroInteractions(mockLocationService);
      verifyZeroInteractions(mockCameraService);
    });

    test('IN_OFFICE Tier 2: Wi-Fi fails with SELFIE_REQUIRED, cascades to GPS and succeeds', () async {
      when(() => mockWifiService.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'GuestWifi', bssid: '11:22:33:44:55:66'));

      // First punch call (Wi-Fi) throws SELFIE_REQUIRED
      when(() => mockAttendanceRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.location, 'location', isNull),
            ),
          )).thenThrow(const ApiException(
        code: 'SELFIE_REQUIRED',
        statusCode: 422,
        message: 'Cần xác thực vị trí hoặc selfie',
      ));

      // Second punch call (GPS) succeeds
      when(() => mockLocationService.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(
          latitude: 10.7719,
          longitude: 106.7044,
          accuracy: 10.0,
        ),
      );
      when(() => mockAttendanceRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.location, 'location', isNotNull),
            ),
          )).thenAnswer((_) async => samplePunchResult);

      final steps = <PunchWaterfallStep>[];
      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (step, _) => steps.add(step),
      );

      expect(result, isA<PunchCoordinatorSuccess>());
      expect((result as PunchCoordinatorSuccess).method, 'GPS');
      expect(steps, [PunchWaterfallStep.wifiCheck, PunchWaterfallStep.gpsFix]);

      verify(() => mockWifiService.getCurrentWifi()).called(1);
      verify(() => mockLocationService.getCurrentPosition()).called(1);
      verifyZeroInteractions(mockCameraService);
    });

    test('IN_OFFICE Tier 3: GPS also fails with SELFIE_REQUIRED, cascades to selfie fallback', () async {
      when(() => mockWifiService.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'GuestWifi', bssid: '11:22:33:44:55:66'));

      when(() => mockLocationService.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(
          latitude: 10.8000,
          longitude: 106.7500,
          accuracy: 12.0,
        ),
      );

      // Both Wi-Fi and GPS punches throw SELFIE_REQUIRED
      when(() => mockAttendanceRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.selfiePath, 'selfiePath', isNull),
            ),
          )).thenThrow(const ApiException(
        code: 'SELFIE_REQUIRED',
        statusCode: 422,
        message: 'Vị trí ngoài phạm vi. Chụp ảnh selfie để gửi duyệt.',
      ));

      // Third punch call (Selfie) succeeds
      when(() => mockCameraService.captureSelfie())
          .thenAnswer((_) async => '/cache/selfie_fallback.jpg');
      when(() => mockAttendanceRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.selfiePath, 'selfiePath', isNotNull),
            ),
          )).thenAnswer((_) async => samplePunchResult);

      final steps = <PunchWaterfallStep>[];
      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (step, _) => steps.add(step),
      );

      expect(result, isA<PunchCoordinatorSuccess>());
      expect((result as PunchCoordinatorSuccess).method, 'SELFIE');
      expect(steps, [
        PunchWaterfallStep.wifiCheck,
        PunchWaterfallStep.gpsFix,
        PunchWaterfallStep.promptSelfie,
        PunchWaterfallStep.submitting,
      ]);

      verify(() => mockWifiService.getCurrentWifi()).called(1);
      verify(() => mockLocationService.getCurrentPosition()).called(1);
      verify(() => mockCameraService.captureSelfie()).called(1);
    });

    test('IN_OFFICE stops cascade immediately on non-fallback error code (e.g. ALREADY_CHECKED_IN)', () async {
      when(() => mockWifiService.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'OfficeWifi', bssid: 'aa:bb:cc:dd:ee:ff'));

      when(() => mockAttendanceRepo.punch(
            action: any(named: 'action'),
            payload: any(named: 'payload'),
          )).thenThrow(const ApiException(
        code: 'ALREADY_CHECKED_IN',
        statusCode: 409,
        message: 'Bạn đã điểm danh vào ca hôm nay rồi.',
      ));

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      final failure = result as PunchCoordinatorFailure;
      expect(failure.errorCode, 'ALREADY_CHECKED_IN');
      expect(failure.message, 'Bạn đã điểm danh vào ca hôm nay rồi.');

      verifyZeroInteractions(mockLocationService);
      verifyZeroInteractions(mockCameraService);
    });

    test('Location permission denied returns failure without attempting GPS fix', () async {
      when(() => mockWifiService.getCurrentWifi()).thenAnswer((_) async => const WifiInfo());
      when(() => mockAttendanceRepo.punch(
            action: any(named: 'action'),
            payload: any(named: 'payload'),
          )).thenThrow(const ApiException(
        code: 'SELFIE_REQUIRED',
        statusCode: 422,
        message: 'Need GPS',
      ));
      when(() => mockLocationService.hasPermission()).thenAnswer((_) async => false);

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      final failure = result as PunchCoordinatorFailure;
      expect(failure.isPermissionDenied, isTrue);
      expect(failure.message, contains('quyền truy cập vị trí'));

      verifyNever(() => mockLocationService.getCurrentPosition());
    });

    test('OUT_OFFICE captureSelfie throwing CAMERA_PERMISSION_DENIED returns PunchCoordinatorFailure with isPermissionDenied true', () async {
      when(() => mockCameraService.captureSelfie()).thenThrow(const ApiException(
        code: 'CAMERA_PERMISSION_DENIED',
        statusCode: 403,
        message: 'Cần quyền camera để chụp ảnh chấm công. Hãy bật trong Cài đặt.',
      ));

      final result = await coordinator.executeWaterfall(
        today: outOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      final failure = result as PunchCoordinatorFailure;
      expect(failure.isPermissionDenied, isTrue);
      expect(failure.errorCode, 'CAMERA_PERMISSION_DENIED');
      expect(failure.message, 'Cần quyền camera để chụp ảnh chấm công. Hãy bật trong Cài đặt.');

      verify(() => mockCameraService.captureSelfie()).called(1);
      verifyZeroInteractions(mockAttendanceRepo);
    });

    test('IN_OFFICE Tier 3 captureSelfie throwing CAMERA_PERMISSION_DENIED returns PunchCoordinatorFailure with isPermissionDenied true', () async {
      when(() => mockWifiService.getCurrentWifi()).thenAnswer((_) async => const WifiInfo());

      when(() => mockAttendanceRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.selfiePath, 'selfiePath', isNull),
            ),
          )).thenThrow(const ApiException(
        code: 'SELFIE_REQUIRED',
        statusCode: 422,
        message: 'Vị trí ngoài phạm vi. Chụp ảnh selfie để gửi duyệt.',
      ));

      when(() => mockLocationService.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(
          latitude: 10.8000,
          longitude: 106.7500,
          accuracy: 12.0,
        ),
      );

      when(() => mockCameraService.captureSelfie()).thenThrow(const ApiException(
        code: 'CAMERA_PERMISSION_DENIED',
        statusCode: 403,
        message: 'Cần quyền camera để chụp ảnh chấm công. Hãy bật trong Cài đặt.',
      ));

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      final failure = result as PunchCoordinatorFailure;
      expect(failure.isPermissionDenied, isTrue);
      expect(failure.errorCode, 'CAMERA_PERMISSION_DENIED');
      expect(failure.message, 'Cần quyền camera để chụp ảnh chấm công. Hãy bật trong Cài đặt.');

      verify(() => mockWifiService.getCurrentWifi()).called(1);
      verify(() => mockLocationService.getCurrentPosition()).called(1);
      verify(() => mockCameraService.captureSelfie()).called(1);
      verify(() => mockAttendanceRepo.punch(action: any(named: 'action'), payload: any(named: 'payload'))).called(2);
    });
  });
}
