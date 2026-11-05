import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:corestaff_mobile/features/attendance/data/services/wifi_service.dart';

class MockNetworkInfo extends Mock implements NetworkInfo {}

void main() {
  late MockNetworkInfo mockNetworkInfo;
  late WifiService wifiService;

  setUp(() {
    mockNetworkInfo = MockNetworkInfo();
    wifiService = WifiServiceImpl(networkInfo: mockNetworkInfo);
  });

  group('WifiService Unit Tests', () {
    test('cleanWifiValue strips quotes, trims whitespace, and rejects sentinels', () {
      expect(WifiServiceImpl.cleanWifiValue('"Bitexco-Staff"'), 'Bitexco-Staff');
      expect(WifiServiceImpl.cleanWifiValue('  "Office_5G"  '), 'Office_5G');
      expect(WifiServiceImpl.cleanWifiValue('CleanSSID'), 'CleanSSID');
      expect(WifiServiceImpl.cleanWifiValue('""'), isNull);
      expect(WifiServiceImpl.cleanWifiValue('   '), isNull);
      expect(WifiServiceImpl.cleanWifiValue(null), isNull);
      expect(WifiServiceImpl.cleanWifiValue('<unknown ssid>'), isNull);
      expect(WifiServiceImpl.cleanWifiValue('"<unknown ssid>"'), isNull);
      expect(WifiServiceImpl.cleanWifiValue('00:00:00:00:00:00'), isNull);
      expect(WifiServiceImpl.cleanWifiValue('"00:00:00:00:00:00"'), isNull);
    });

    test('cleanBssid normalizes MAC address to lowercase', () {
      expect(
        WifiServiceImpl.cleanBssid('AA:BB:CC:DD:EE:FF'),
        'aa:bb:cc:dd:ee:ff',
      );
      expect(
        WifiServiceImpl.cleanBssid('"00:1A:2B:3C:4D:5E"'),
        '00:1a:2b:3c:4d:5e',
      );
    });

    test('getWifiName returns sanitized SSID from NetworkInfo', () async {
      when(() => mockNetworkInfo.getWifiName())
          .thenAnswer((_) async => '"Corp-Wifi"');

      final result = await wifiService.getWifiName();

      expect(result, 'Corp-Wifi');
      verify(() => mockNetworkInfo.getWifiName()).called(1);
    });

    test('getWifiName returns null when NetworkInfo throws exception', () async {
      when(() => mockNetworkInfo.getWifiName())
          .thenThrow(Exception('Platform permission missing'));

      final result = await wifiService.getWifiName();

      expect(result, isNull);
    });

    test('getWifiBssid returns sanitized, lowercase BSSID from NetworkInfo', () async {
      when(() => mockNetworkInfo.getWifiBSSID())
          .thenAnswer((_) async => '"AA:11:BB:22:CC:33"');

      final result = await wifiService.getWifiBssid();

      expect(result, 'aa:11:bb:22:cc:33');
      verify(() => mockNetworkInfo.getWifiBSSID()).called(1);
    });

    test('getCurrentWifi bundles sanitized SSID and BSSID', () async {
      when(() => mockNetworkInfo.getWifiName())
          .thenAnswer((_) async => '"CoreStaff-Guest"');
      when(() => mockNetworkInfo.getWifiBSSID())
          .thenAnswer((_) async => 'F0:9F:C2:11:22:33');

      final wifi = await wifiService.getCurrentWifi();

      expect(wifi.ssid, 'CoreStaff-Guest');
      expect(wifi.bssid, 'f0:9f:c2:11:22:33');
      expect(wifi.isNotEmpty, isTrue);
      expect(wifi.isEmpty, isFalse);
    });

    test('getCurrentWifi returns empty WifiInfo when both values are null or error', () async {
      when(() => mockNetworkInfo.getWifiName())
          .thenThrow(Exception('Network error'));
      when(() => mockNetworkInfo.getWifiBSSID())
          .thenThrow(Exception('Network error'));

      final wifi = await wifiService.getCurrentWifi();

      expect(wifi.ssid, isNull);
      expect(wifi.bssid, isNull);
      expect(wifi.isEmpty, isTrue);
      expect(wifi.isNotEmpty, isFalse);
    });
  });
}
