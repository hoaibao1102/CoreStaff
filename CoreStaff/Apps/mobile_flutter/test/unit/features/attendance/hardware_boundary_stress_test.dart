import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mocktail/mocktail.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/attendance/data/attendance_repository.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_assignment_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/punch_request_payload.dart';
import 'package:corestaff_mobile/features/attendance/data/models/today_attendance_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/services/camera_service.dart';
import 'package:corestaff_mobile/features/attendance/data/services/location_service.dart';
import 'package:corestaff_mobile/features/attendance/data/services/wifi_service.dart';
import 'package:corestaff_mobile/features/attendance/domain/services/punch_coordinator.dart';

class MockNetworkInfo extends Mock implements NetworkInfo {}

class MockGeolocatorPlatform extends Mock implements GeolocatorPlatform {}

class MockImagePicker extends Mock implements ImagePicker {}

class MockAttendanceRepository extends Mock implements AttendanceRepository {}

class MockCameraService extends Mock implements CameraService {}

class MockLocationService extends Mock implements LocationService {}

class MockWifiService extends Mock implements WifiService {}

void main() {
  setUpAll(() {
    registerFallbackValue(const LocationSettings());
    registerFallbackValue(PunchAction.checkIn);
    registerFallbackValue(const PunchRequestPayload());
  });

  group('WifiService Boundary & Adversarial Stress Tests', () {
    late MockNetworkInfo mockNetworkInfo;
    late WifiService wifiService;

    setUp(() {
      mockNetworkInfo = MockNetworkInfo();
      wifiService = WifiServiceImpl(networkInfo: mockNetworkInfo);
    });

    test('cleanWifiValue handles dirty quotes and whitespace variants correctly', () {
      // Basic quoted strings
      expect(WifiServiceImpl.cleanWifiValue('"MyOffice"'), 'MyOffice');
      expect(WifiServiceImpl.cleanWifiValue('"Office-WiFi"'), 'Office-WiFi');
      expect(WifiServiceImpl.cleanWifiValue('  "Office-WiFi"  '), 'Office-WiFi');
      expect(WifiServiceImpl.cleanWifiValue('"Bitexco Guest WiFi"'), 'Bitexco Guest WiFi');

      // Unquoted strings
      expect(WifiServiceImpl.cleanWifiValue('MyOffice'), 'MyOffice');
      expect(WifiServiceImpl.cleanWifiValue('  MyOffice  '), 'MyOffice');

      // Edge cases: single quotes, empty strings, whitespace only
      expect(WifiServiceImpl.cleanWifiValue('""'), isNull);
      expect(WifiServiceImpl.cleanWifiValue('   '), isNull);
      expect(WifiServiceImpl.cleanWifiValue(''), isNull);
      expect(WifiServiceImpl.cleanWifiValue(null), isNull);
      expect(WifiServiceImpl.cleanWifiValue('"   "'), isNull);
    });

    test('cleanWifiValue strips known sentinels regardless of quotes or whitespace', () {
      expect(WifiServiceImpl.cleanWifiValue('<unknown ssid>'), isNull);
      expect(WifiServiceImpl.cleanWifiValue('"<unknown ssid>"'), isNull);
      expect(WifiServiceImpl.cleanWifiValue('  <unknown ssid>  '), isNull);
      expect(WifiServiceImpl.cleanWifiValue('  "<unknown ssid>"  '), isNull);

      expect(WifiServiceImpl.cleanWifiValue('00:00:00:00:00:00'), isNull);
      expect(WifiServiceImpl.cleanWifiValue('"00:00:00:00:00:00"'), isNull);
      expect(WifiServiceImpl.cleanWifiValue('  00:00:00:00:00:00  '), isNull);
      expect(WifiServiceImpl.cleanWifiValue('  "00:00:00:00:00:00"  '), isNull);
    });

    test('cleanBssid normalizes uppercase, lowercase, and mixed MAC addresses', () {
      expect(
        WifiServiceImpl.cleanBssid('AA:BB:CC:DD:EE:FF'),
        'aa:bb:cc:dd:ee:ff',
      );
      expect(
        WifiServiceImpl.cleanBssid('"AA:BB:CC:DD:EE:FF"'),
        'aa:bb:cc:dd:ee:ff',
      );
      expect(
        WifiServiceImpl.cleanBssid('aa:bb:cc:dd:ee:ff'),
        'aa:bb:cc:dd:ee:ff',
      );
      expect(
        WifiServiceImpl.cleanBssid('00:1A:2B:3C:4D:5E'),
        '00:1a:2b:3c:4d:5e',
      );
      expect(
        WifiServiceImpl.cleanBssid('  "00:1a:2B:3c:4D:5E"  '),
        '00:1a:2b:3c:4d:5e',
      );
      expect(WifiServiceImpl.cleanBssid('00:00:00:00:00:00'), isNull);
      expect(WifiServiceImpl.cleanBssid('"00:00:00:00:00:00"'), isNull);
      expect(WifiServiceImpl.cleanBssid(null), isNull);
      expect(WifiServiceImpl.cleanBssid(''), isNull);
    });

    test('WifiService handles platform exceptions without throwing unhandled errors', () async {
      when(() => mockNetworkInfo.getWifiName())
          .thenThrow(PlatformException(code: 'PERMISSION_DENIED', message: 'No location permission'));
      when(() => mockNetworkInfo.getWifiBSSID())
          .thenThrow(PlatformException(code: 'PERMISSION_DENIED', message: 'No location permission'));

      final ssid = await wifiService.getWifiName();
      final bssid = await wifiService.getWifiBssid();
      final current = await wifiService.getCurrentWifi();

      expect(ssid, isNull);
      expect(bssid, isNull);
      expect(current.isEmpty, isTrue);
      expect(current.isNotEmpty, isFalse);
    });

    test('WifiService handles sentinel values returned from native bridge', () async {
      when(() => mockNetworkInfo.getWifiName())
          .thenAnswer((_) async => '"<unknown ssid>"');
      when(() => mockNetworkInfo.getWifiBSSID())
          .thenAnswer((_) async => '"00:00:00:00:00:00"');

      final current = await wifiService.getCurrentWifi();

      expect(current.ssid, isNull);
      expect(current.bssid, isNull);
      expect(current.isEmpty, isTrue);
    });
  });

  group('LocationService Boundary & Adversarial Stress Tests', () {
    late MockGeolocatorPlatform mockPlatform;
    late LocationService locationService;

    setUp(() {
      mockPlatform = MockGeolocatorPlatform();
      locationService = LocationServiceImpl(geolocatorPlatform: mockPlatform);
    });

    test('hasPermission returns false when permission is denied and re-request is denied', () async {
      when(() => mockPlatform.checkPermission())
          .thenAnswer((_) async => LocationPermission.denied);
      when(() => mockPlatform.requestPermission())
          .thenAnswer((_) async => LocationPermission.denied);

      final hasPerm = await locationService.hasPermission();

      expect(hasPerm, isFalse);
      verify(() => mockPlatform.checkPermission()).called(1);
      verify(() => mockPlatform.requestPermission()).called(1);
    });

    test('hasPermission returns false when permission is permanently denied without re-requesting', () async {
      when(() => mockPlatform.checkPermission())
          .thenAnswer((_) async => LocationPermission.deniedForever);

      final hasPerm = await locationService.hasPermission();

      expect(hasPerm, isFalse);
      verify(() => mockPlatform.checkPermission()).called(1);
      verifyNever(() => mockPlatform.requestPermission());
    });

    test('isLocationServiceEnabled reports false when location hardware/toggle is off', () async {
      when(() => mockPlatform.isLocationServiceEnabled())
          .thenAnswer((_) async => false);

      final isEnabled = await locationService.isLocationServiceEnabled();

      expect(isEnabled, isFalse);
      verify(() => mockPlatform.isLocationServiceEnabled()).called(1);
    });

    test('getCurrentPosition propagates LocationServiceDisabledException when service is off', () async {
      when(() => mockPlatform.getCurrentPosition(
            locationSettings: any(named: 'locationSettings'),
          )).thenThrow(const LocationServiceDisabledException());

      expect(
        () => locationService.getCurrentPosition(),
        throwsA(isA<LocationServiceDisabledException>()),
      );
    });

    test('getCurrentPosition faithfully preserves high accuracy and degraded accuracy metrics', () async {
      final now = DateTime.now();
      // Degraded accuracy position (e.g. 500 meters accuracy radius due to poor GPS fix)
      final degradedPosition = Position(
        latitude: 10.7719,
        longitude: 106.7044,
        timestamp: now,
        accuracy: 500.0,
        altitude: 0.0,
        altitudeAccuracy: 0.0,
        heading: 0.0,
        headingAccuracy: 0.0,
        speed: 0.0,
        speedAccuracy: 0.0,
      );

      when(() => mockPlatform.getCurrentPosition(
            locationSettings: any(named: 'locationSettings'),
          )).thenAnswer((_) async => degradedPosition);

      final pos = await locationService.getCurrentPosition();

      expect(pos.latitude, 10.7719);
      expect(pos.longitude, 106.7044);
      expect(pos.accuracy, 500.0);
    });
  });

  group('CameraService Boundary & Adversarial Stress Tests', () {
    late MockImagePicker mockPicker;
    late CameraService cameraService;

    setUp(() {
      mockPicker = MockImagePicker();
      cameraService = CameraServiceImpl(picker: mockPicker);
    });

    test('user cancelled photo capture (pickImage returns null) aborts cleanly without exception', () async {
      when(() => mockPicker.pickImage(
            source: ImageSource.camera,
            preferredCameraDevice: CameraDevice.front,
            imageQuality: 60,
          )).thenAnswer((_) async => null);

      final path = await cameraService.captureSelfie();

      expect(path, isNull);
    });

    test('OS camera permission denied throws ApiException with CAMERA_PERMISSION_DENIED and code 403', () async {
      when(() => mockPicker.pickImage(
            source: ImageSource.camera,
            preferredCameraDevice: CameraDevice.front,
            imageQuality: 60,
          )).thenThrow(PlatformException(code: 'camera_access_denied'));

      expect(
        () => cameraService.captureSelfie(),
        throwsA(
          isA<ApiException>()
              .having((e) => e.code, 'code', 'CAMERA_PERMISSION_DENIED')
              .having((e) => e.statusCode, 'statusCode', 403)
              .having((e) => e.message, 'message', contains('Cần quyền camera')),
        ),
      );
    });

    test('OS photo permission denied also throws ApiException with CAMERA_PERMISSION_DENIED', () async {
      when(() => mockPicker.pickImage(
            source: ImageSource.camera,
            preferredCameraDevice: CameraDevice.front,
            imageQuality: 60,
          )).thenThrow(PlatformException(code: 'photo_access_denied'));

      expect(
        () => cameraService.captureSelfie(),
        throwsA(
          isA<ApiException>()
              .having((e) => e.code, 'code', 'CAMERA_PERMISSION_DENIED')
              .having((e) => e.statusCode, 'statusCode', 403),
        ),
      );
    });

    test('Unexpected hardware error returns null without unhandled exception', () async {
      when(() => mockPicker.pickImage(
            source: ImageSource.camera,
            preferredCameraDevice: CameraDevice.front,
            imageQuality: 60,
          )).thenThrow(Exception('Camera sensor hardware malfunction'));

      final path = await cameraService.captureSelfie();

      expect(path, isNull);
    });
  });

  group('PunchCoordinator Integration with Hardware Boundary Conditions', () {
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
        address: 'Bitexco Financial Tower',
        workplaceName: 'Văn phòng Bitexco',
        workplaceType: 'IN_OFFICE',
        hasWifiNetworks: true,
        allowWifiAttendance: true,
        allowGpsAttendance: true,
        allowSelfieFallback: true,
      ),
    );

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

    test('accuracy threshold violation (LOW_LOCATION_ACCURACY) halts cascade without fallback to selfie', () async {
      when(() => mockWifiService.getCurrentWifi()).thenAnswer((_) async => const WifiInfo());

      // Wi-Fi punch fails with SELFIE_REQUIRED (not in office wifi)
      when(() => mockAttendanceRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.location, 'location', isNull),
            ),
          )).thenThrow(const ApiException(
        code: 'SELFIE_REQUIRED',
        statusCode: 422,
        message: 'Cần GPS hoặc Selfie',
      ));

      // Device returns degraded GPS fix (e.g. 500m accuracy radius)
      when(() => mockLocationService.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(
          latitude: 10.7719,
          longitude: 106.7044,
          accuracy: 500.0,
        ),
      );

      // Backend rejects due to poor accuracy (maximumAccuracyMeters exceeded)
      when(() => mockAttendanceRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.location, 'location', isNotNull),
            ),
          )).thenThrow(const ApiException(
        code: 'LOW_LOCATION_ACCURACY',
        statusCode: 422,
        message: 'Độ chính xác GPS quá thấp (500m > 80m). Vui lòng di chuyển ra nơi thoáng hơn.',
      ));

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      final failure = result as PunchCoordinatorFailure;
      expect(failure.errorCode, 'LOW_LOCATION_ACCURACY');
      expect(failure.message, contains('GPS quá thấp'));

      // Crucial verification: Must NOT cascade to selfie when rejected for accuracy
      verifyNever(() => mockCameraService.captureSelfie());
    });

    test('location service disabled on device aborts with graceful failure message', () async {
      when(() => mockWifiService.getCurrentWifi()).thenAnswer((_) async => const WifiInfo());

      when(() => mockAttendanceRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.location, 'location', isNull),
            ),
          )).thenThrow(const ApiException(
        code: 'SELFIE_REQUIRED',
        statusCode: 422,
        message: 'Cần GPS',
      ));

      when(() => mockLocationService.getCurrentPosition())
          .thenThrow(const LocationServiceDisabledException());

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      final failure = result as PunchCoordinatorFailure;
      expect(failure.message, contains('Không thể lấy tọa độ vị trí'));
      verifyNever(() => mockCameraService.captureSelfie());
    });

    test('user cancelling camera during Tier 3 selfie fallback returns PunchCoordinatorCancelled', () async {
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
        message: 'Vị trí ngoài phạm vi. Chụp selfie để duyệt.',
      ));

      when(() => mockLocationService.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(
          latitude: 10.8000,
          longitude: 106.7500,
          accuracy: 10.0,
        ),
      );

      // User hits cancel/back in camera UI
      when(() => mockCameraService.captureSelfie()).thenAnswer((_) async => null);

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorCancelled>());
      verify(() => mockCameraService.captureSelfie()).called(1);
    });

    test('camera permission denied thrown during captureSelfie in Tier 3 fallback', () async {
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
        message: 'Vị trí ngoài phạm vi. Chụp selfie để duyệt.',
      ));

      when(() => mockLocationService.getCurrentPosition()).thenAnswer(
        (_) async => const GeoPosition(
          latitude: 10.8000,
          longitude: 106.7500,
          accuracy: 10.0,
        ),
      );

      when(() => mockCameraService.captureSelfie()).thenThrow(const ApiException(
        code: 'CAMERA_PERMISSION_DENIED',
        statusCode: 403,
        message: 'Cần quyền camera để chụp ảnh chấm công.',
      ));

      final result = await coordinator.executeWaterfall(
        today: inOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      final failure = result as PunchCoordinatorFailure;
      expect(failure.isPermissionDenied, isTrue);
      expect(failure.errorCode, 'CAMERA_PERMISSION_DENIED');
      expect(failure.message, 'Cần quyền camera để chụp ảnh chấm công.');

      verify(() => mockCameraService.captureSelfie()).called(1);
      verifyNever(() => mockAttendanceRepo.punch(
            action: any(named: 'action'),
            payload: any(
              named: 'payload',
              that: isA<PunchRequestPayload>().having((p) => p.selfiePath, 'selfiePath', isNotNull),
            ),
          ));
    });

    test('camera permission denied thrown during captureSelfie in OUT_OFFICE returns PunchCoordinatorFailure with isPermissionDenied', () async {
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

      when(() => mockCameraService.captureSelfie()).thenThrow(const ApiException(
        code: 'CAMERA_PERMISSION_DENIED',
        statusCode: 403,
        message: 'Cần quyền camera để chụp ảnh chấm công.',
      ));

      final result = await coordinator.executeWaterfall(
        today: outOfficeToday,
        onProgress: (_, _) {},
      );

      expect(result, isA<PunchCoordinatorFailure>());
      final failure = result as PunchCoordinatorFailure;
      expect(failure.isPermissionDenied, isTrue);
      expect(failure.errorCode, 'CAMERA_PERMISSION_DENIED');
      expect(failure.message, 'Cần quyền camera để chụp ảnh chấm công.');

      verify(() => mockCameraService.captureSelfie()).called(1);
      verifyZeroInteractions(mockAttendanceRepo);
    });
  });
}
