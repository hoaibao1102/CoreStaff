import 'package:geolocator/geolocator.dart';

class GeoPosition {
  final double latitude;
  final double longitude;
  final double? accuracy;
  final double? altitude;
  final DateTime? timestamp;
  final String? address;

  const GeoPosition({
    required this.latitude,
    required this.longitude,
    this.accuracy,
    this.altitude,
    this.timestamp,
    this.address,
  });

  @override
  String toString() =>
      'GeoPosition(lat: $latitude, lng: $longitude, accuracy: $accuracy)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is GeoPosition &&
          runtimeType == other.runtimeType &&
          latitude == other.latitude &&
          longitude == other.longitude &&
          accuracy == other.accuracy;

  @override
  int get hashCode =>
      latitude.hashCode ^ longitude.hashCode ^ (accuracy?.hashCode ?? 0);
}

abstract class LocationService {
  Future<bool> isLocationServiceEnabled();
  Future<LocationPermission> checkPermission();
  Future<LocationPermission> requestPermission();
  Future<bool> hasPermission();
  Future<GeoPosition> getCurrentPosition();
  double calculateDistanceMeters({
    required double startLatitude,
    required double startLongitude,
    required double endLatitude,
    required double endLongitude,
  });
}

class LocationServiceImpl implements LocationService {
  final GeolocatorPlatform _geolocatorPlatform;

  LocationServiceImpl({GeolocatorPlatform? geolocatorPlatform})
      : _geolocatorPlatform = geolocatorPlatform ?? GeolocatorPlatform.instance;

  @override
  Future<bool> isLocationServiceEnabled() async {
    return _geolocatorPlatform.isLocationServiceEnabled();
  }

  @override
  Future<LocationPermission> checkPermission() async {
    return _geolocatorPlatform.checkPermission();
  }

  @override
  Future<LocationPermission> requestPermission() async {
    return _geolocatorPlatform.requestPermission();
  }

  @override
  Future<bool> hasPermission() async {
    var permission = await checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await requestPermission();
    }
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  @override
  Future<GeoPosition> getCurrentPosition() async {
    final position = await _geolocatorPlatform.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
      ),
    );
    return GeoPosition(
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      altitude: position.altitude,
      timestamp: position.timestamp,
    );
  }

  @override
  double calculateDistanceMeters({
    required double startLatitude,
    required double startLongitude,
    required double endLatitude,
    required double endLongitude,
  }) {
    return _geolocatorPlatform.distanceBetween(
      startLatitude,
      startLongitude,
      endLatitude,
      endLongitude,
    );
  }
}
