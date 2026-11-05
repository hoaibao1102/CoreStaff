import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_client.dart';
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
import 'package:corestaff_mobile/features/attendance/presentation/bloc/punch_bloc.dart';

// Mocks
class MockWifiService extends Mock implements WifiService {}

class MockLocationService extends Mock implements LocationService {}

class MockCameraService extends Mock implements CameraService {}

class MockAttendanceRepository extends Mock implements AttendanceRepository {}

class MockApiClient extends Mock implements ApiClient {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // Strict RFC 4122 v4 UUID regex: version 4 in 3rd segment, variant (8, 9, a, b) in 4th
  final uuidV4Regex = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    caseSensitive: false,
  );

  const inOfficeToday = TodayAttendanceDto(
    workDate: '2026-11-04',
    serverTime: '2026-11-04T08:00:00.000Z',
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

  const inOfficeTodayCheckOut = TodayAttendanceDto(
    workDate: '2026-11-04',
    serverTime: '2026-11-04T17:00:00.000Z',
    attendanceStatus: 'CHECKED_IN',
    availableAction: 'CHECK_OUT',
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

  const inOfficeNoWifiToday = TodayAttendanceDto(
    workDate: '2026-11-04',
    serverTime: '2026-11-04T08:00:00.000Z',
    attendanceStatus: 'NOT_CHECKED_IN',
    availableAction: 'CHECK_IN',
    assignment: AttendanceAssignmentDto(
      shiftName: 'Ca công trình',
      shiftHours: '08:00 - 17:00',
      startTime: '08:00',
      endTime: '17:00',
      address: 'Khu công nghiệp Tân Bình',
      workplaceName: 'Kho Tân Bình',
      workplaceType: 'IN_OFFICE',
      hasWifiNetworks: false,
      allowWifiAttendance: false,
      allowGpsAttendance: true,
      allowSelfieFallback: true,
    ),
  );

  const outOfficeToday = TodayAttendanceDto(
    workDate: '2026-11-04',
    serverTime: '2026-11-04T08:00:00.000Z',
    attendanceStatus: 'NOT_CHECKED_IN',
    availableAction: 'CHECK_IN',
    assignment: AttendanceAssignmentDto(
      shiftName: 'Ca thị trường',
      shiftHours: '08:00 - 17:00',
      startTime: '08:00',
      endTime: '17:00',
      address: 'TP. Thủ Đức',
      workplaceName: 'Giao hàng ngoại thành',
      workplaceType: 'OUT_OFFICE',
      hasWifiNetworks: false,
      allowWifiAttendance: false,
      allowGpsAttendance: false,
      allowSelfieFallback: true,
    ),
  );

  const networkPunchResult = PunchResultDto(
    workDate: '2026-11-04',
    attendanceStatus: 'CHECKED_IN',
    availableAction: 'CHECK_OUT',
    checkIn: AttendanceEventDto(
      eventId: 'evt_wifi_1',
      eventType: 'CHECK_IN',
      method: 'NETWORK',
      recordedAt: '2026-11-04T08:00:00.000Z',
      approvalStatus: 'NOT_REQUIRED',
    ),
  );

  const gpsPunchResult = PunchResultDto(
    workDate: '2026-11-04',
    attendanceStatus: 'CHECKED_IN',
    availableAction: 'CHECK_OUT',
    checkIn: AttendanceEventDto(
      eventId: 'evt_gps_1',
      eventType: 'CHECK_IN',
      method: 'GPS',
      recordedAt: '2026-11-04T08:01:00.000Z',
      approvalStatus: 'NOT_REQUIRED',
    ),
  );

  const selfiePunchResult = PunchResultDto(
    workDate: '2026-11-04',
    attendanceStatus: 'CHECKED_IN',
    availableAction: 'CHECK_OUT',
    checkIn: AttendanceEventDto(
      eventId: 'evt_selfie_1',
      eventType: 'CHECK_IN',
      method: 'SELFIE',
      recordedAt: '2026-11-04T08:02:00.000Z',
      approvalStatus: 'PENDING',
    ),
  );

  const checkOutResult = PunchResultDto(
    workDate: '2026-11-04',
    attendanceStatus: 'COMPLETED',
    availableAction: 'NONE',
    workingMinutes: 540,
    checkOut: AttendanceEventDto(
      eventId: 'evt_out_1',
      eventType: 'CHECK_OUT',
      method: 'NETWORK',
      recordedAt: '2026-11-04T17:00:00.000Z',
      approvalStatus: 'NOT_REQUIRED',
    ),
  );

  setUpAll(() {
    registerFallbackValue(PunchAction.checkIn);
    registerFallbackValue(const PunchRequestPayload());
    registerFallbackValue(Options());
    registerFallbackValue(FormData());
  });

  group('Adversarial Waterfall Cascade Permutations & Isolation', () {
    late MockWifiService mockWifi;
    late MockLocationService mockLocation;
    late MockCameraService mockCamera;
    late MockAttendanceRepository mockRepo;
    late PunchCoordinator coordinator;

    setUp(() {
      mockWifi = MockWifiService();
      mockLocation = MockLocationService();
      mockCamera = MockCameraService();
      mockRepo = MockAttendanceRepository();

      coordinator = PunchCoordinatorImpl(
        wifiService: mockWifi,
        locationService: mockLocation,
        cameraService: mockCamera,
        attendanceRepository: mockRepo,
      );

      when(() => mockLocation.hasPermission()).thenAnswer((_) async => true);
    });

    test('Permutation 1: Wi-Fi accepted on first attempt -> Bypasses GPS and Camera completely', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'Bitexco_Official', bssid: '00:14:22:01:23:45'));
      when(() => mockRepo.punch(
            action: PunchAction.checkIn,
            payload: any(named: 'payload'),
          )).thenAnswer((_) async => networkPunchResult);

      final steps = <PunchWaterfallStep>[];
      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (step, _) => steps.add(step),
      );

      expect(result, isA<PunchCoordinatorSuccess>());
      final success = result as PunchCoordinatorSuccess;
      expect(success.method, 'NETWORK');
      expect(success.result.checkIn?.eventId, 'evt_wifi_1');
      expect(steps, [PunchWaterfallStep.wifiCheck]);

      verify(() => mockWifi.getCurrentWifi()).called(1);
      verify(() => mockRepo.punch(
            action: PunchAction.checkIn,
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>()
                  .having((p) => p.workMode, 'workMode', PunchWorkMode.inOffice)
                  .having((p) => p.wifi?.bssid, 'bssid', '00:14:22:01:23:45')
                  .having((p) => p.location, 'location', isNull)
                  .having((p) => p.selfiePath, 'selfiePath', isNull),
            ),
          )).called(1);

      // CRITICAL ASSERTION: Zero interactions with location and camera hardware
      verifyZeroInteractions(mockLocation);
      verifyZeroInteractions(mockCamera);
    });

    test('Permutation 2: Wi-Fi 422 SELFIE_REQUIRED -> Cascades to GPS accepted -> Bypasses Camera', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'WrongOfficeWifi', bssid: '11:22:33:44:55:66'));

      // Attempt 1 (Wi-Fi) returns 422 SELFIE_REQUIRED
      when(() => mockRepo.punch(
            action: PunchAction.checkIn,
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.location, 'location', isNull),
            ),
          )).thenThrow(const ApiException(
        statusCode: 422,
        code: 'SELFIE_REQUIRED',
        message: 'BSSID không thuộc văn phòng chỉ định',
      ));

      // Attempt 2 (GPS) succeeds
      when(() => mockLocation.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(
          latitude: 10.7719,
          longitude: 106.7044,
          accuracy: 8.5,
          address: '2 Hải Triều, Bến Nghé, Quận 1',
        ),
      );
      when(() => mockRepo.punch(
            action: PunchAction.checkIn,
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.location, 'location', isNotNull),
            ),
          )).thenAnswer((_) async => gpsPunchResult);

      final steps = <PunchWaterfallStep>[];
      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (step, _) => steps.add(step),
      );

      expect(result, isA<PunchCoordinatorSuccess>());
      final success = result as PunchCoordinatorSuccess;
      expect(success.method, 'GPS');
      expect(steps, [PunchWaterfallStep.wifiCheck, PunchWaterfallStep.gpsFix]);

      verify(() => mockWifi.getCurrentWifi()).called(1);
      verify(() => mockLocation.getCurrentPosition()).called(1);
      verify(() => mockRepo.punch(action: PunchAction.checkIn, payload: any(named: 'payload'))).called(2);

      // CRITICAL ASSERTION: Camera hardware never queried or initialized
      verifyZeroInteractions(mockCamera);
    });

    test('Permutation 3: Full 3-tier cascade (Wi-Fi 422 -> GPS 422 -> Selfie upload accepted)', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'CoffeeShopWifi', bssid: '99:88:77:66:55:44'));

      when(() => mockLocation.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(
          latitude: 10.8200,
          longitude: 106.6800,
          accuracy: 15.0,
          address: 'Gò Vấp, TP.HCM',
        ),
      );

      // Attempt 1 (Wi-Fi) throws 422 SELFIE_REQUIRED
      when(() => mockRepo.punch(
            action: PunchAction.checkIn,
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.location, 'location', isNull),
            ),
          )).thenThrow(const ApiException(
        statusCode: 422,
        code: 'SELFIE_REQUIRED',
        message: 'Wi-Fi ngoài văn phòng',
      ));

      // Attempt 2 (GPS) throws 422 SELFIE_REQUIRED
      when(() => mockRepo.punch(
            action: PunchAction.checkIn,
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>()
                  .having((p) => p.location, 'location', isNotNull)
                  .having((p) => p.selfiePath, 'selfiePath', isNull),
            ),
          )).thenThrow(const ApiException(
        statusCode: 422,
        code: 'SELFIE_REQUIRED',
        message: 'Vị trí ngoài bán kính cho phép. Cần chụp ảnh selfie.',
      ));

      // Attempt 3 (Selfie) succeeds
      when(() => mockCamera.captureSelfie()).thenAnswer((_) async => '/tmp/captured_selfie_proof.jpg');
      when(() => mockRepo.punch(
            action: PunchAction.checkIn,
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.selfiePath, 'selfiePath', isNotNull),
            ),
          )).thenAnswer((_) async => selfiePunchResult);

      final steps = <PunchWaterfallStep>[];
      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (step, _) => steps.add(step),
      );

      expect(result, isA<PunchCoordinatorSuccess>());
      final success = result as PunchCoordinatorSuccess;
      expect(success.method, 'SELFIE');
      expect(steps, [
        PunchWaterfallStep.wifiCheck,
        PunchWaterfallStep.gpsFix,
        PunchWaterfallStep.promptSelfie,
        PunchWaterfallStep.submitting,
      ]);

      verify(() => mockWifi.getCurrentWifi()).called(1);
      verify(() => mockLocation.getCurrentPosition()).called(1);
      verify(() => mockCamera.captureSelfie()).called(1);
      verify(() => mockRepo.punch(action: PunchAction.checkIn, payload: any(named: 'payload'))).called(3);
    });

    test('Permutation 4: OUT_OFFICE work mode strictly isolates flow (zero Wi-Fi and zero GPS access)', () async {
      when(() => mockCamera.captureSelfie()).thenAnswer((_) async => '/tmp/out_office_selfie.jpg');
      when(() => mockRepo.punch(
            action: PunchAction.checkIn,
            payload: any(named: 'payload'),
          )).thenAnswer((_) async => selfiePunchResult);

      final steps = <PunchWaterfallStep>[];
      final result = await coordinator.executeWaterfall(
        today: outOfficeToday,
        onProgress: (step, _) => steps.add(step),
      );

      expect(result, isA<PunchCoordinatorSuccess>());
      expect((result as PunchCoordinatorSuccess).method, 'SELFIE');
      expect(steps, [PunchWaterfallStep.promptSelfie, PunchWaterfallStep.submitting]);

      // CRITICAL ASSERTION: Zero interaction with Wi-Fi and GPS hardware for OUT_OFFICE
      verifyZeroInteractions(mockWifi);
      verifyZeroInteractions(mockLocation);
      verify(() => mockCamera.captureSelfie()).called(1);
      verify(() => mockRepo.punch(
            action: PunchAction.checkIn,
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>()
                  .having((p) => p.workMode, 'workMode', PunchWorkMode.outOffice)
                  .having((p) => p.selfiePath, 'selfiePath', '/tmp/out_office_selfie.jpg')
                  .having((p) => p.location, 'location', isNull)
                  .having((p) => p.wifi, 'wifi', isNull),
            ),
          )).called(1);
    });

    test('Permutation 5: CHECK_OUT cascade routes to checkOut action without workMode', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'Bitexco_Official', bssid: '00:14:22:01:23:45'));
      when(() => mockRepo.punch(
            action: PunchAction.checkOut,
            payload: any(named: 'payload'),
          )).thenAnswer((_) async => checkOutResult);

      final result = await coordinator.executeWaterfall(
        today: inOfficeTodayCheckOut,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorSuccess>());
      final success = result as PunchCoordinatorSuccess;
      expect(success.method, 'NETWORK');
      expect(success.result.availableAction, 'NONE');

      verify(() => mockRepo.punch(
            action: PunchAction.checkOut,
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.workMode, 'workMode', PunchWorkMode.inOffice),
            ),
          )).called(1);
    });

    test('Permutation 6: Workplace without Wi-Fi assignment skips Tier 1 and starts directly at GPS', () async {
      when(() => mockLocation.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(
          latitude: 10.8000,
          longitude: 106.6500,
          accuracy: 10.0,
        ),
      );
      when(() => mockRepo.punch(
            action: PunchAction.checkIn,
            payload: any(named: 'payload'),
          )).thenAnswer((_) async => gpsPunchResult);

      final steps = <PunchWaterfallStep>[];
      final result = await coordinator.executeWaterfall(
        today: inOfficeNoWifiToday,
        onProgress: (step, _) => steps.add(step),
      );

      expect(result, isA<PunchCoordinatorSuccess>());
      expect((result as PunchCoordinatorSuccess).method, 'GPS');
      expect(steps, [PunchWaterfallStep.gpsFix]);

      // Wi-Fi was not configured, so mockWifi must never be called
      verifyZeroInteractions(mockWifi);
      verify(() => mockLocation.getCurrentPosition()).called(1);
    });
  });

  group('Adversarial Cascade Halting: Non-Waterfall Error Handlers', () {
    late MockWifiService mockWifi;
    late MockLocationService mockLocation;
    late MockCameraService mockCamera;
    late MockAttendanceRepository mockRepo;
    late PunchCoordinator coordinator;

    setUp(() {
      mockWifi = MockWifiService();
      mockLocation = MockLocationService();
      mockCamera = MockCameraService();
      mockRepo = MockAttendanceRepository();

      coordinator = PunchCoordinatorImpl(
        wifiService: mockWifi,
        locationService: mockLocation,
        cameraService: mockCamera,
        attendanceRepository: mockRepo,
      );

      when(() => mockLocation.hasPermission()).thenAnswer((_) async => true);
    });

    test('Tier 1 ALREADY_CHECKED_IN (409) halts cascade immediately without GPS or Camera', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'OfficeWifi', bssid: 'aa:bb:cc:dd:ee:ff'));

      when(() => mockRepo.punch(
            action: any(named: 'action'),
            payload: any(named: 'payload'),
          )).thenThrow(const ApiException(
        statusCode: 409,
        code: 'ALREADY_CHECKED_IN',
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

      verifyZeroInteractions(mockLocation);
      verifyZeroInteractions(mockCamera);
    });

    test('Tier 1 ATTENDANCE_LOCKED (403) halts cascade immediately', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'OfficeWifi', bssid: 'aa:bb:cc:dd:ee:ff'));

      when(() => mockRepo.punch(
            action: any(named: 'action'),
            payload: any(named: 'payload'),
          )).thenThrow(const ApiException(
        statusCode: 403,
        code: 'ATTENDANCE_LOCKED',
        message: 'Kỳ công này đã bị khóa bởi người quản lý.',
      ));

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      final failure = result as PunchCoordinatorFailure;
      expect(failure.errorCode, 'ATTENDANCE_LOCKED');

      verifyZeroInteractions(mockLocation);
      verifyZeroInteractions(mockCamera);
    });

    test('Tier 1 IDEMPOTENCY_KEY_REUSED (409) halts cascade immediately', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'OfficeWifi', bssid: 'aa:bb:cc:dd:ee:ff'));

      when(() => mockRepo.punch(
            action: any(named: 'action'),
            payload: any(named: 'payload'),
          )).thenThrow(const ApiException(
        statusCode: 409,
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'Yêu cầu điểm danh bị trùng lặp.',
      ));

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      expect((result as PunchCoordinatorFailure).errorCode, 'IDEMPOTENCY_KEY_REUSED');
      verifyZeroInteractions(mockLocation);
      verifyZeroInteractions(mockCamera);
    });

    test('Tier 1 Network/Generic Exception halts cascade without attempting GPS or Camera', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'OfficeWifi', bssid: 'aa:bb:cc:dd:ee:ff'));

      when(() => mockRepo.punch(
            action: any(named: 'action'),
            payload: any(named: 'payload'),
          )).thenThrow(Exception('Socket closed abruptly'));

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      final failure = result as PunchCoordinatorFailure;
      expect(failure.message, contains('Socket closed abruptly'));
      verifyZeroInteractions(mockLocation);
      verifyZeroInteractions(mockCamera);
    });

    test('Tier 2 LOW_LOCATION_ACCURACY (422) halts cascade immediately (does NOT fall through to Selfie)', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'GuestWifi', bssid: '11:22:33:44:55:66'));

      // Tier 1 fails with 422 SELFIE_REQUIRED -> enters Tier 2
      when(() => mockRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.location, 'location', isNull),
            ),
          )).thenThrow(const ApiException(
        statusCode: 422,
        code: 'SELFIE_REQUIRED',
        message: 'Cần xác thực vị trí hoặc selfie',
      ));

      // Tier 2 (GPS) throws LOW_LOCATION_ACCURACY
      when(() => mockLocation.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(
          latitude: 10.7700,
          longitude: 106.7000,
          accuracy: 150.0, // High uncertainty
        ),
      );

      when(() => mockRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.location, 'location', isNotNull),
            ),
          )).thenThrow(const ApiException(
        statusCode: 422,
        code: 'LOW_LOCATION_ACCURACY',
        message: 'Độ chính xác GPS quá thấp (> 80m). Vui lòng ra nơi thoáng đãng.',
      ));

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      // CRITICAL ASSERTION: LOW_LOCATION_ACCURACY must NOT cascade to Selfie
      expect(result, isA<PunchCoordinatorFailure>());
      final failure = result as PunchCoordinatorFailure;
      expect(failure.errorCode, 'LOW_LOCATION_ACCURACY');
      expect(failure.message, contains('Độ chính xác GPS quá thấp'));

      verifyZeroInteractions(mockCamera);
    });

    test('Tier 2 ATTENDANCE_LOCKED (403) halts cascade immediately without falling through to Selfie', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'GuestWifi', bssid: '11:22:33:44:55:66'));

      when(() => mockRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.location, 'location', isNull),
            ),
          )).thenThrow(const ApiException(
        statusCode: 422,
        code: 'SELFIE_REQUIRED',
        message: 'Cần vị trí',
      ));

      when(() => mockLocation.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(latitude: 10.77, longitude: 106.70, accuracy: 10.0),
      );

      when(() => mockRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.location, 'location', isNotNull),
            ),
          )).thenThrow(const ApiException(
        statusCode: 403,
        code: 'ATTENDANCE_LOCKED',
        message: 'Kỳ công đã khóa.',
      ));

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      expect((result as PunchCoordinatorFailure).errorCode, 'ATTENDANCE_LOCKED');
      verifyZeroInteractions(mockCamera);
    });

    test('Tier 2 Location hardware platform exception halts cascade gracefully', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'GuestWifi', bssid: '11:22:33:44:55:66'));

      when(() => mockRepo.punch(
            action: any(named: 'action'),
            payload: any(named: 'payload'),
          )).thenThrow(const ApiException(
        statusCode: 422,
        code: 'SELFIE_REQUIRED',
        message: 'Cần selfie',
      ));

      when(() => mockLocation.getCurrentPosition())
          .thenThrow(Exception('Location service timed out after 10000ms'));

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      final failure = result as PunchCoordinatorFailure;
      expect(failure.message, contains('Không thể lấy tọa độ vị trí'));
      verifyZeroInteractions(mockCamera);
    });

    test('Tier 2 Location permission denied returns failure without attempting GPS or Camera', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'GuestWifi', bssid: '11:22:33:44:55:66'));

      when(() => mockRepo.punch(
            action: any(named: 'action'),
            payload: any(named: 'payload'),
          )).thenThrow(const ApiException(
        statusCode: 422,
        code: 'SELFIE_REQUIRED',
        message: 'Cần selfie',
      ));

      when(() => mockLocation.hasPermission()).thenAnswer((_) async => false);

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      final failure = result as PunchCoordinatorFailure;
      expect(failure.isPermissionDenied, isTrue);
      expect(failure.message, contains('quyền truy cập vị trí'));

      verifyNever(() => mockLocation.getCurrentPosition());
      verifyZeroInteractions(mockCamera);
    });

    test('Tier 3 Camera permission denied halts cascade without attempting 3rd API punch', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async => const WifiInfo());
      when(() => mockLocation.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(latitude: 10.77, longitude: 106.70, accuracy: 10.0),
      );

      when(() => mockRepo.punch(action: any(named: 'action'), payload: any(named: 'payload'))).thenThrow(
        const ApiException(
          statusCode: 422,
          code: 'SELFIE_REQUIRED',
          message: 'Cần selfie',
        ),
      );

      when(() => mockCamera.captureSelfie()).thenThrow(
        const ApiException(
          statusCode: 403,
          code: 'CAMERA_PERMISSION_DENIED',
          message: 'Cần quyền camera để chụp ảnh chấm công.',
        ),
      );

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      final failure = result as PunchCoordinatorFailure;
      expect(failure.isPermissionDenied, isTrue);
      expect(failure.message, contains('quyền camera'));

      verify(() => mockCamera.captureSelfie()).called(1);
      // Repository called exactly 2 times (Wi-Fi and GPS), never for selfie
      verify(() => mockRepo.punch(action: any(named: 'action'), payload: any(named: 'payload'))).called(2);
    });

    test('Tier 3 Camera dismissal returns PunchCoordinatorCancelled cleanly', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async => const WifiInfo());
      when(() => mockLocation.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(latitude: 10.77, longitude: 106.70, accuracy: 10.0),
      );

      when(() => mockRepo.punch(action: any(named: 'action'), payload: any(named: 'payload'))).thenThrow(
        const ApiException(
          statusCode: 422,
          code: 'SELFIE_REQUIRED',
          message: 'Cần selfie',
        ),
      );

      when(() => mockCamera.captureSelfie()).thenAnswer((_) async => null);

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorCancelled>());
      // Exactly 2 punch calls, 3rd selfie punch was never called
      verify(() => mockRepo.punch(action: any(named: 'action'), payload: any(named: 'payload'))).called(2);
    });
  });

  group('Adversarial Idempotency-Key Integrity & UUID v4 Oracles', () {
    late MockApiClient mockApiClient;
    late AttendanceRepository realRepository;

    setUp(() {
      mockApiClient = MockApiClient();
      realRepository = AttendanceRepositoryImpl(apiClient: mockApiClient);
    });

    test('Every distinct check-in attempt sends a valid RFC 4122 UUID v4 Idempotency-Key header', () async {
      when(() => mockApiClient.post<dynamic>(
            '/api/attendance/check-in',
            data: any(named: 'data'),
            options: any(named: 'options'),
          )).thenAnswer(
        (_) async => {
          'workDate': '2026-11-04',
          'attendanceStatus': 'CHECKED_IN',
          'availableAction': 'CHECK_OUT',
        },
      );

      await realRepository.checkIn(
        const PunchRequestPayload(workMode: PunchWorkMode.inOffice),
      );

      final captured = verify(() => mockApiClient.post<dynamic>(
            '/api/attendance/check-in',
            data: any(named: 'data'),
            options: captureAny(named: 'options'),
          )).captured;

      final options = captured.first as Options;
      final key = options.headers?['Idempotency-Key'] as String?;

      expect(key, isNotNull);
      expect(uuidV4Regex.hasMatch(key!), isTrue,
          reason: 'Generated Idempotency-Key "$key" must conform strictly to RFC 4122 UUID v4 regex');
      // Substring check: version bit 4
      expect(key[14], '4', reason: '15th character of UUID v4 must be 4');
      // Variant bit: 8, 9, a, or b
      expect(['8', '9', 'a', 'b', 'A', 'B'].contains(key[19]), isTrue);
    });

    test('100 consecutive punch calls produce 100% unique Idempotency-Keys (zero collision)', () async {
      final keys = <String>{};

      when(() => mockApiClient.post<dynamic>(
            any(),
            data: any(named: 'data'),
            options: any(named: 'options'),
          )).thenAnswer(
        (_) async => {
          'workDate': '2026-11-04',
          'attendanceStatus': 'CHECKED_IN',
          'availableAction': 'CHECK_OUT',
        },
      );

      for (int i = 0; i < 100; i++) {
        await realRepository.punch(
          action: PunchAction.checkIn,
          payload: const PunchRequestPayload(workMode: PunchWorkMode.inOffice),
        );
      }

      final captured = verify(() => mockApiClient.post<dynamic>(
            any(),
            data: any(named: 'data'),
            options: captureAny(named: 'options'),
          )).captured;

      for (final option in captured) {
        final key = (option as Options).headers?['Idempotency-Key'] as String;
        expect(uuidV4Regex.hasMatch(key), isTrue);
        keys.add(key);
      }

      expect(keys.length, 100, reason: 'All 100 requests must have unique UUID v4 Idempotency-Keys');
    });

    test('Cascading retries (Wi-Fi -> GPS -> Selfie) use distinct fresh UUID v4 keys per attempt', () async {
      final mockWifi = MockWifiService();
      final mockLocation = MockLocationService();
      final mockCamera = MockCameraService();
      final capturedKeys = <String>[];

      final testDir = await Directory.systemTemp.createTemp('punch_test_');
      final testSelfieFile = File('${testDir.path}/selfie.jpg');
      await testSelfieFile.writeAsBytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]); // minimal JPEG header

      addTearDown(() async {
        if (await testDir.exists()) {
          await testDir.delete(recursive: true);
        }
      });

      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'OfficeWifi', bssid: 'aa:bb:cc:dd:ee:ff'));
      when(() => mockLocation.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(latitude: 10.77, longitude: 106.70, accuracy: 10.0),
      );
      when(() => mockCamera.captureSelfie()).thenAnswer((_) async => testSelfieFile.path);
      when(() => mockLocation.hasPermission()).thenAnswer((_) async => true);

      // ApiClient returns 422 SELFIE_REQUIRED on first 2 calls, then succeeds on multipart
      when(() => mockApiClient.post<dynamic>(
            '/api/attendance/check-in',
            data: any(named: 'data'),
            options: any(named: 'options'),
          )).thenAnswer((inv) {
        final opts = inv.namedArguments[const Symbol('options')] as Options?;
        final key = opts?.headers?['Idempotency-Key'] as String?;
        if (key != null) capturedKeys.add(key);
        throw const ApiException(
          statusCode: 422,
          code: 'SELFIE_REQUIRED',
          message: 'Cần xác thực tiếp theo',
        );
      });

      when(() => mockApiClient.postMultipart<dynamic>(
            '/api/attendance/check-in',
            formData: any(named: 'formData'),
            options: any(named: 'options'),
          )).thenAnswer((inv) async {
        final opts = inv.namedArguments[const Symbol('options')] as Options?;
        final key = opts?.headers?['Idempotency-Key'] as String?;
        if (key != null) capturedKeys.add(key);
        return {
          'workDate': '2026-11-04',
          'attendanceStatus': 'CHECKED_IN',
          'availableAction': 'CHECK_OUT',
          'checkIn': {
            'eventId': 'evt_cascade_selfie',
            'eventType': 'CHECK_IN',
            'method': 'SELFIE',
            'recordedAt': '2026-11-04T08:00:00.000Z',
          },
        };
      });

      final cascadeCoordinator = PunchCoordinatorImpl(
        wifiService: mockWifi,
        locationService: mockLocation,
        cameraService: mockCamera,
        attendanceRepository: realRepository,
      );

      final result = await cascadeCoordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorSuccess>());
      expect((result as PunchCoordinatorSuccess).method, 'SELFIE');

      // CRITICAL ASSERTION: Exactly 3 keys captured, all valid UUID v4, and all pairwise distinct!
      expect(capturedKeys.length, 3, reason: 'Three distinct attempts must generate three keys');
      expect(uuidV4Regex.hasMatch(capturedKeys[0]), isTrue);
      expect(uuidV4Regex.hasMatch(capturedKeys[1]), isTrue);
      expect(uuidV4Regex.hasMatch(capturedKeys[2]), isTrue);

      expect(capturedKeys[0], isNot(equals(capturedKeys[1])),
          reason: 'Wi-Fi attempt key must not equal GPS attempt key');
      expect(capturedKeys[1], isNot(equals(capturedKeys[2])),
          reason: 'GPS attempt key must not equal Selfie attempt key');
      expect(capturedKeys[0], isNot(equals(capturedKeys[2])),
          reason: 'Wi-Fi attempt key must not equal Selfie attempt key');
    });

    test('Custom caller-supplied idempotency key is preserved faithfully without overwrite', () async {
      const explicitKey = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

      when(() => mockApiClient.post<dynamic>(
            any(),
            data: any(named: 'data'),
            options: any(named: 'options'),
          )).thenAnswer(
        (_) async => {
          'workDate': '2026-11-04',
          'attendanceStatus': 'CHECKED_IN',
          'availableAction': 'CHECK_OUT',
        },
      );

      await realRepository.checkIn(
        const PunchRequestPayload(
          workMode: PunchWorkMode.inOffice,
          idempotencyKey: explicitKey,
        ),
      );

      final captured = verify(() => mockApiClient.post<dynamic>(
            any(),
            data: any(named: 'data'),
            options: captureAny(named: 'options'),
          )).captured;

      final options = captured.first as Options;
      expect(options.headers?['Idempotency-Key'], explicitKey);
    });
  });

  group('PunchBloc Complete State Traversal Stress Tests', () {
    late MockWifiService mockWifi;
    late MockLocationService mockLocation;
    late MockCameraService mockCamera;
    late MockAttendanceRepository mockRepo;
    late PunchCoordinator coordinator;

    setUp(() {
      mockWifi = MockWifiService();
      mockLocation = MockLocationService();
      mockCamera = MockCameraService();
      mockRepo = MockAttendanceRepository();

      coordinator = PunchCoordinatorImpl(
        wifiService: mockWifi,
        locationService: mockLocation,
        cameraService: mockCamera,
        attendanceRepository: mockRepo,
      );

      when(() => mockLocation.hasPermission()).thenAnswer((_) async => true);
    });

    test('PunchBloc full 3-tier cascade state sequence matches exact specification', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'PublicWifi', bssid: '22:33:44:55:66:77'));
      when(() => mockLocation.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(latitude: 10.8, longitude: 106.7, accuracy: 12.0),
      );
      when(() => mockCamera.captureSelfie()).thenAnswer((_) async => '/tmp/selfie.jpg');

      when(() => mockRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.selfiePath, 'selfiePath', isNull),
            ),
          )).thenThrow(const ApiException(
        statusCode: 422,
        code: 'SELFIE_REQUIRED',
        message: 'Need selfie',
      ));

      when(() => mockRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.selfiePath, 'selfiePath', isNotNull),
            ),
          )).thenAnswer((_) async => selfiePunchResult);

      final bloc = PunchBloc(punchCoordinator: coordinator);
      final emittedStates = <PunchState>[];
      final subscription = bloc.stream.listen(emittedStates.add);

      bloc.add(const PunchSubmitted(today: inOfficeToday));

      // Allow async waterfall completion
      await Future<void>.delayed(const Duration(milliseconds: 150));
      await subscription.cancel();
      await bloc.close();

      expect(emittedStates.length, 7);
      expect(emittedStates[0], isA<PunchDetectingEnvironment>());
      expect((emittedStates[0] as PunchDetectingEnvironment).message, 'Đang khởi động quá trình xác thực...');
      expect((emittedStates[0] as PunchDetectingEnvironment).currentStep, PunchWaterfallStep.wifiCheck);

      expect(emittedStates[1], isA<PunchDetectingEnvironment>());
      expect((emittedStates[1] as PunchDetectingEnvironment).message, 'Đang kiểm tra kết nối Wi-Fi văn phòng...');
      expect((emittedStates[1] as PunchDetectingEnvironment).currentStep, PunchWaterfallStep.wifiCheck);

      expect(emittedStates[2], isA<PunchDetectingEnvironment>());
      expect((emittedStates[2] as PunchDetectingEnvironment).currentStep, PunchWaterfallStep.gpsFix);

      expect(emittedStates[3], isA<PunchPromptSelfie>());
      expect((emittedStates[3] as PunchPromptSelfie).isOutOffice, isFalse);

      expect(emittedStates[4], isA<PunchSubmitting>());
      expect((emittedStates[4] as PunchSubmitting).action, 'CHECK_IN');

      expect(emittedStates[5], isA<PunchMethodDecided>());
      expect((emittedStates[5] as PunchMethodDecided).method, 'SELFIE');

      expect(emittedStates[6], isA<PunchSuccess>());
      expect((emittedStates[6] as PunchSuccess).method, 'SELFIE');
      expect((emittedStates[6] as PunchSuccess).action, 'CHECK_IN');
    });

    test('PunchBloc OUT_OFFICE emits PunchPromptSelfie with isOutOffice true', () async {
      when(() => mockCamera.captureSelfie()).thenAnswer((_) async => '/tmp/out_selfie.jpg');
      when(() => mockRepo.punch(action: any(named: 'action'), payload: any(named: 'payload')))
          .thenAnswer((_) async => selfiePunchResult);

      final bloc = PunchBloc(punchCoordinator: coordinator);
      final emittedStates = <PunchState>[];
      final subscription = bloc.stream.listen(emittedStates.add);

      bloc.add(const PunchSubmitted(today: outOfficeToday));

      await Future<void>.delayed(const Duration(milliseconds: 100));
      await subscription.cancel();
      await bloc.close();

      expect(emittedStates.any((s) => s is PunchPromptSelfie && s.isOutOffice == true), isTrue);
      expect(emittedStates.any((s) => s is PunchSuccess && s.method == 'SELFIE'), isTrue);
    });

    test('PunchBloc resolves known employee error codes to user-friendly Vietnamese text', () async {
      when(() => mockWifi.getCurrentWifi()).thenAnswer((_) async =>
          const WifiInfo(ssid: 'OfficeWifi', bssid: 'aa:bb:cc:dd:ee:ff'));

      when(() => mockRepo.punch(action: any(named: 'action'), payload: any(named: 'payload')))
          .thenThrow(const ApiException(
        statusCode: 409,
        code: 'ALREADY_CHECKED_IN',
        message: 'Raw backend message',
      ));

      final bloc = PunchBloc(punchCoordinator: coordinator);
      final emittedStates = <PunchState>[];
      final subscription = bloc.stream.listen(emittedStates.add);

      bloc.add(const PunchSubmitted(today: inOfficeToday));

      await Future<void>.delayed(const Duration(milliseconds: 100));
      await subscription.cancel();
      await bloc.close();

      final failureState = emittedStates.whereType<PunchFailure>().firstOrNull;
      expect(failureState, isNotNull);
      expect(failureState!.errorCode, 'ALREADY_CHECKED_IN');
      // Resolved via ErrorResolver.resolveEmployeeError
      expect(failureState.message, 'Bạn đã điểm danh vào ca hôm nay rồi.');
    });
  });
}
