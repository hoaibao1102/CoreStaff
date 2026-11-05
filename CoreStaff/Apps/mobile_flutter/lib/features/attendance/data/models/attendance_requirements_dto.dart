class TimeIntervalDto {
  final String from;
  final String to;

  const TimeIntervalDto({required this.from, required this.to});

  factory TimeIntervalDto.fromJson(Map<String, dynamic> json) {
    return TimeIntervalDto(
      from: json['from']?.toString() ?? '',
      to: json['to']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() => {'from': from, 'to': to};
}

class AttendanceRequirementsDto {
  final List<String> durationTypes;
  final List<String> leaveTypes;
  final List<TimeIntervalDto> approvedLeaveIntervals;
  final List<TimeIntervalDto> requiredWorkingIntervals;
  final int approvedLeaveMinutes;
  final int requiredWorkingMinutes;
  final String? effectiveCheckInTime;
  final String? effectiveCheckOutTime;

  const AttendanceRequirementsDto({
    this.durationTypes = const [],
    this.leaveTypes = const [],
    this.approvedLeaveIntervals = const [],
    this.requiredWorkingIntervals = const [],
    this.approvedLeaveMinutes = 0,
    this.requiredWorkingMinutes = 0,
    this.effectiveCheckInTime,
    this.effectiveCheckOutTime,
  });

  factory AttendanceRequirementsDto.fromJson(Map<String, dynamic> json) {
    return AttendanceRequirementsDto(
      durationTypes: (json['durationTypes'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      leaveTypes: (json['leaveTypes'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      approvedLeaveIntervals: (json['approvedLeaveIntervals'] as List<dynamic>?)
              ?.map((e) => TimeIntervalDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      requiredWorkingIntervals: (json['requiredWorkingIntervals'] as List<dynamic>?)
              ?.map((e) => TimeIntervalDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      approvedLeaveMinutes: (json['approvedLeaveMinutes'] as num?)?.toInt() ?? 0,
      requiredWorkingMinutes: (json['requiredWorkingMinutes'] as num?)?.toInt() ?? 0,
      effectiveCheckInTime: json['effectiveCheckInTime']?.toString(),
      effectiveCheckOutTime: json['effectiveCheckOutTime']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'durationTypes': durationTypes,
      'leaveTypes': leaveTypes,
      'approvedLeaveIntervals': approvedLeaveIntervals.map((e) => e.toJson()).toList(),
      'requiredWorkingIntervals': requiredWorkingIntervals.map((e) => e.toJson()).toList(),
      'approvedLeaveMinutes': approvedLeaveMinutes,
      'requiredWorkingMinutes': requiredWorkingMinutes,
      if (effectiveCheckInTime != null) 'effectiveCheckInTime': effectiveCheckInTime,
      if (effectiveCheckOutTime != null) 'effectiveCheckOutTime': effectiveCheckOutTime,
    };
  }
}

class PendingLeaveDto {
  final String durationType;
  final String? requestedStart;
  final String? requestedEnd;

  const PendingLeaveDto({
    required this.durationType,
    this.requestedStart,
    this.requestedEnd,
  });

  factory PendingLeaveDto.fromJson(Map<String, dynamic> json) {
    return PendingLeaveDto(
      durationType: json['durationType']?.toString() ?? 'FULL_DAY',
      requestedStart: json['requestedStart']?.toString(),
      requestedEnd: json['requestedEnd']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'durationType': durationType,
      if (requestedStart != null) 'requestedStart': requestedStart,
      if (requestedEnd != null) 'requestedEnd': requestedEnd,
    };
  }
}

