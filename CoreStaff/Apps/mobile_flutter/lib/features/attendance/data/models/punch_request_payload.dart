enum PunchAction {
  checkIn,
  checkOut;

  String get path => this == PunchAction.checkIn
      ? '/api/attendance/check-in'
      : '/api/attendance/check-out';
}

enum PunchWorkMode {
  inOffice('IN_OFFICE'),
  outOffice('OUT_OFFICE');

  final String value;
  const PunchWorkMode(this.value);

  static PunchWorkMode fromString(String? value) {
    if (value == 'OUT_OFFICE') return PunchWorkMode.outOffice;
    return PunchWorkMode.inOffice;
  }
}

class PunchLocationPayload {
  final double latitude;
  final double longitude;
  final double? accuracyMeters;
  final String? address;

  const PunchLocationPayload({
    required this.latitude,
    required this.longitude,
    this.accuracyMeters,
    this.address,
  });

  Map<String, dynamic> toJson() {
    return {
      'latitude': latitude,
      'longitude': longitude,
      if (accuracyMeters != null) 'accuracyMeters': accuracyMeters,
      if (address != null) 'address': address,
    };
  }
}

class PunchWifiPayload {
  final String? ssid;
  final String? bssid;

  const PunchWifiPayload({this.ssid, this.bssid});

  Map<String, dynamic> toJson() {
    return {
      if (ssid != null && ssid!.isNotEmpty) 'wifiSsid': ssid,
      if (bssid != null && bssid!.isNotEmpty) 'wifiBssid': bssid,
    };
  }
}

class PunchRequestPayload {
  final PunchWorkMode? workMode;
  final PunchLocationPayload? location;
  final PunchWifiPayload? wifi;
  final String? selfiePath;
  final String? note;
  final String? idempotencyKey;

  const PunchRequestPayload({
    this.workMode,
    this.location,
    this.wifi,
    this.selfiePath,
    this.note,
    this.idempotencyKey,
  });

  bool get hasSelfie => selfiePath != null && selfiePath!.isNotEmpty;

  Map<String, dynamic> toJson({required bool isCheckIn}) {
    return {
      if (isCheckIn && workMode != null) 'workMode': workMode!.value,
      if (location != null) ...{
        'location': location!.toJson(),
        'latitude': location!.latitude,
        'longitude': location!.longitude,
        if (location!.accuracyMeters != null)
          'accuracyMeters': location!.accuracyMeters,
        if (location!.address != null) 'address': location!.address,
      },
      if (wifi?.ssid != null && wifi!.ssid!.isNotEmpty) 'wifiSsid': wifi!.ssid,
      if (wifi?.bssid != null && wifi!.bssid!.isNotEmpty)
        'wifiBssid': wifi!.bssid,
      if (note != null && note!.isNotEmpty) 'note': note,
    };
  }
}
