class AttendanceAssignmentDto {
  final String shiftName;
  final String shiftHours;
  final String startTime;
  final String endTime;
  final int breakMinutes;
  final int gracePeriodMinutes;
  final String? workplaceId;
  final String workplaceName;
  final String workplaceType; // IN_OFFICE | OUT_OFFICE
  final String address;
  final double? latitude;
  final double? longitude;
  final double? allowedRadiusMeters;
  final double? maximumAccuracyMeters;
  final bool allowWifiAttendance;
  final bool allowGpsAttendance;
  final bool allowSelfieFallback;
  final bool hasWifiNetworks;

  const AttendanceAssignmentDto({
    required this.shiftName,
    required this.shiftHours,
    required this.startTime,
    required this.endTime,
    this.breakMinutes = 60,
    this.gracePeriodMinutes = 15,
    this.workplaceId,
    required this.workplaceName,
    this.workplaceType = 'IN_OFFICE',
    required this.address,
    this.latitude,
    this.longitude,
    this.allowedRadiusMeters = 100.0,
    this.maximumAccuracyMeters = 80.0,
    this.allowWifiAttendance = true,
    this.allowGpsAttendance = true,
    this.allowSelfieFallback = true,
    this.hasWifiNetworks = true,
  });

  factory AttendanceAssignmentDto.fromJson(Map<String, dynamic> json) {
    return AttendanceAssignmentDto(
      shiftName: json['shiftName']?.toString() ?? 'Ca hành chính',
      shiftHours: json['shiftHours']?.toString() ?? '08:00 - 17:00',
      startTime: json['startTime']?.toString() ?? '08:00',
      endTime: json['endTime']?.toString() ?? '17:00',
      breakMinutes: (json['breakMinutes'] as num?)?.toInt() ?? 60,
      gracePeriodMinutes: (json['gracePeriodMinutes'] as num?)?.toInt() ?? 15,
      workplaceId: json['workplaceId']?.toString(),
      workplaceName: json['workplaceName']?.toString() ?? 'Văn phòng chính',
      workplaceType: json['workplaceType']?.toString() ?? 'IN_OFFICE',
      address: json['address']?.toString() ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 10.7769,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 106.7009,
      allowedRadiusMeters: (json['allowedRadiusMeters'] as num?)?.toDouble() ?? 100.0,
      maximumAccuracyMeters: (json['maximumAccuracyMeters'] as num?)?.toDouble() ?? 80.0,
      allowWifiAttendance: json['allowWifiAttendance'] as bool? ?? true,
      allowGpsAttendance: json['allowGpsAttendance'] as bool? ?? true,
      allowSelfieFallback: json['allowSelfieFallback'] as bool? ?? true,
      hasWifiNetworks: json['hasWifiNetworks'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'shiftName': shiftName,
      'shiftHours': shiftHours,
      'startTime': startTime,
      'endTime': endTime,
      'breakMinutes': breakMinutes,
      'gracePeriodMinutes': gracePeriodMinutes,
      if (workplaceId != null) 'workplaceId': workplaceId,
      'workplaceName': workplaceName,
      'workplaceType': workplaceType,
      'address': address,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (allowedRadiusMeters != null) 'allowedRadiusMeters': allowedRadiusMeters,
      if (maximumAccuracyMeters != null) 'maximumAccuracyMeters': maximumAccuracyMeters,
      'allowWifiAttendance': allowWifiAttendance,
      'allowGpsAttendance': allowGpsAttendance,
      'allowSelfieFallback': allowSelfieFallback,
      'hasWifiNetworks': hasWifiNetworks,
    };
  }
}

