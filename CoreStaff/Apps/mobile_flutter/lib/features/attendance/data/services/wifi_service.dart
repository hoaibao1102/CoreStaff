import 'package:network_info_plus/network_info_plus.dart';

class WifiInfo {
  final String? ssid;
  final String? bssid;

  const WifiInfo({this.ssid, this.bssid});

  bool get isEmpty =>
      (ssid == null || ssid!.isEmpty) && (bssid == null || bssid!.isEmpty);
  bool get isNotEmpty => !isEmpty;

  @override
  String toString() => 'WifiInfo(ssid: $ssid, bssid: $bssid)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is WifiInfo &&
          runtimeType == other.runtimeType &&
          ssid == other.ssid &&
          bssid == other.bssid;

  @override
  int get hashCode => ssid.hashCode ^ bssid.hashCode;
}

abstract class WifiService {
  Future<String?> getWifiName();
  Future<String?> getWifiBssid();
  Future<WifiInfo> getCurrentWifi();
}

class WifiServiceImpl implements WifiService {
  final NetworkInfo _networkInfo;

  WifiServiceImpl({NetworkInfo? networkInfo})
      : _networkInfo = networkInfo ?? NetworkInfo();

  static String? cleanWifiValue(String? value) {
    if (value == null) return null;
    var text = value.trim();
    if (text.startsWith('"')) {
      text = text.substring(1);
    }
    if (text.endsWith('"')) {
      text = text.substring(0, text.length - 1);
    }
    text = text.trim();
    if (text.isEmpty ||
        text == '<unknown ssid>' ||
        text == '00:00:00:00:00:00') {
      return null;
    }
    return text;
  }

  static String? cleanBssid(String? value) {
    final cleaned = cleanWifiValue(value);
    return cleaned?.toLowerCase();
  }

  @override
  Future<String?> getWifiName() async {
    try {
      final name = await _networkInfo.getWifiName();
      return cleanWifiValue(name);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<String?> getWifiBssid() async {
    try {
      final bssid = await _networkInfo.getWifiBSSID();
      return cleanBssid(bssid);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<WifiInfo> getCurrentWifi() async {
    String? ssid;
    String? bssid;
    try {
      ssid = await getWifiName();
    } catch (_) {
      ssid = null;
    }
    try {
      bssid = await getWifiBssid();
    } catch (_) {
      bssid = null;
    }
    return WifiInfo(ssid: ssid, bssid: bssid);
  }
}
