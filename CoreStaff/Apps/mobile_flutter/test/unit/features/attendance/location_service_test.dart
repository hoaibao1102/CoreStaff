import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/features/attendance/data/services/location_service.dart';

class MockGeolocatorPlatform extends Mock implements GeolocatorPlatform {}

void main() {
  late MockGeolocatorPlatform mockPlatform;
  late LocationService locationService;

  setUpAll(() {
    registerFallbackValue(const LocationSettings());
  });

  setUp(() {
    mockPlatform = MockGeolocatorPlatform();
    locationService = LocationServiceImpl(geolocatorPlatform: mockPlatform);
  });

  group('LocationService Unit Tests', () {
    test('isLocationServiceEnabled delegates to platform', () async {
      when(() => mockPlatform.isLocationServiceEnabled())
          .thenAnswer((_) async => true);

      final isEnabled = await locationService.isLocationServiceEnabled();

      expect(isEnabled, isTrue);
      verify(() => mockPlatform.isLocationServiceEnabled()).called(1);
    });

    test('checkPermission delegates to platform', () async {
      when(() => mockPlatform.checkPermission())
          .thenAnswer((_) async => LocationPermission.whileInUse);

      final perm = await locationService.checkPermission();

      expect(perm, LocationPermission.whileInUse);
      verify(() => mockPlatform.checkPermission()).called(1);
    });

    test('hasPermission returns true when permission is always or whileInUse', () async {
      when(() => mockPlatform.checkPermission())
          .thenAnswer((_) async => LocationPermission.always);

      final hasPerm = await locationService.hasPermission();

      expect(hasPerm, isTrue);
    });

    test('hasPermission requests permission when initially denied and returns result', () async {
      when(() => mockPlatform.checkPermission())
          .thenAnswer((_) async => LocationPermission.denied);
      when(() => mockPlatform.requestPermission())
          .thenAnswer((_) async => LocationPermission.whileInUse);

      final hasPerm = await locationService.hasPermission();

      expect(hasPerm, isTrue);
      verify(() => mockPlatform.checkPermission()).called(1);
      verify(() => mockPlatform.requestPermission()).called(1);
    });

    test('hasPermission returns false when permission is deniedForever', () async {
      when(() => mockPlatform.checkPermission())
          .thenAnswer((_) async => LocationPermission.deniedForever);

      final hasPerm = await locationService.hasPermission();

      expect(hasPerm, isFalse);
    });

    test('getCurrentPosition returns GeoPosition with accurate coordinates', () async {
      final now = DateTime.now();
      final mockPosition = Position(
        latitude: 10.7719,
        longitude: 106.7044,
        timestamp: now,
        accuracy: 15.0,
        altitude: 10.0,
        altitudeAccuracy: 5.0,
        heading: 0.0,
        headingAccuracy: 0.0,
        speed: 0.0,
        speedAccuracy: 0.0,
      );

      when(() => mockPlatform.getCurrentPosition(
            locationSettings: any(named: 'locationSettings'),
          )).thenAnswer((_) async => mockPosition);

      final pos = await locationService.getCurrentPosition();

      expect(pos.latitude, 10.7719);
      expect(pos.longitude, 106.7044);
      expect(pos.accuracy, 15.0);
      expect(pos.timestamp, now);
    });

    test('calculateDistanceMeters delegates to platform distanceBetween', () {
      when(() => mockPlatform.distanceBetween(
            any(),
            any(),
            any(),
            any(),
          )).thenReturn(150.5);

      final distance = locationService.calculateDistanceMeters(
        startLatitude: 10.7719,
        startLongitude: 106.7044,
        endLatitude: 10.7725,
        endLongitude: 106.7050,
      );

      expect(distance, 150.5);
      verify(() => mockPlatform.distanceBetween(
            10.7719,
            106.7044,
            10.7725,
            106.7050,
          )).called(1);
    });
  });
}
