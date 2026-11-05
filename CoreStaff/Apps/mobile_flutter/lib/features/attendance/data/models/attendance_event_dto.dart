class AttendanceEventDto {
  final String eventId;
  final String eventType; // CHECK_IN | CHECK_OUT
  final String method; // NETWORK | GPS | SELFIE
  final String recordedAt; // ISO timestamp
  final String? address;
  final num? distanceMeters;
  final num? accuracyMeters;
  final num? latitude;
  final num? longitude;
  final String approvalStatus; // NOT_REQUIRED | PENDING | APPROVED | REJECTED
  final String? evidenceUrl;

  const AttendanceEventDto({
    required this.eventId,
    required this.eventType,
    required this.method,
    required this.recordedAt,
    this.address,
    this.distanceMeters,
    this.accuracyMeters,
    this.latitude,
    this.longitude,
    required this.approvalStatus,
    this.evidenceUrl,
  });

  factory AttendanceEventDto.fromJson(Map<String, dynamic> json) {
    return AttendanceEventDto(
      eventId: json['eventId']?.toString() ?? json['_id']?.toString() ?? '',
      eventType: json['eventType']?.toString() ?? '',
      method: json['method']?.toString() ?? 'NETWORK',
      recordedAt: json['recordedAt']?.toString() ?? '',
      address: json['address']?.toString(),
      distanceMeters: json['distanceMeters'] as num?,
      accuracyMeters: json['accuracyMeters'] as num?,
      latitude: json['latitude'] as num?,
      longitude: json['longitude'] as num?,
      approvalStatus: json['approvalStatus']?.toString() ?? 'NOT_REQUIRED',
      evidenceUrl: json['evidenceUrl']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'eventId': eventId,
      'eventType': eventType,
      'method': method,
      'recordedAt': recordedAt,
      if (address != null) 'address': address,
      if (distanceMeters != null) 'distanceMeters': distanceMeters,
      if (accuracyMeters != null) 'accuracyMeters': accuracyMeters,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      'approvalStatus': approvalStatus,
      if (evidenceUrl != null) 'evidenceUrl': evidenceUrl,
    };
  }
}

