import 'attendance_event_dto.dart';
import 'attendance_requirements_dto.dart';

class AttendanceOvertimeDto {
  final String requestId;
  final String status;
  final String? requestedStart;
  final String? requestedEnd;
  final String? approvedStart;
  final String? approvedEnd;
  final String? reason;
  final String? reviewComment;
  final String? reviewedAt;
  final int otMinutes;
  final String? overtimeType;
  final int actualMinutes;

  const AttendanceOvertimeDto({
    required this.requestId,
    required this.status,
    this.requestedStart,
    this.requestedEnd,
    this.approvedStart,
    this.approvedEnd,
    this.reason,
    this.reviewComment,
    this.reviewedAt,
    this.otMinutes = 0,
    this.overtimeType,
    this.actualMinutes = 0,
  });

  factory AttendanceOvertimeDto.fromJson(Map<String, dynamic> json) {
    return AttendanceOvertimeDto(
      requestId: json['requestId']?.toString() ?? json['_id']?.toString() ?? '',
      status: json['status']?.toString() ?? 'PENDING',
      requestedStart: json['requestedStart']?.toString(),
      requestedEnd: json['requestedEnd']?.toString(),
      approvedStart: json['approvedStart']?.toString(),
      approvedEnd: json['approvedEnd']?.toString(),
      reason: json['reason']?.toString(),
      reviewComment: json['reviewComment']?.toString(),
      reviewedAt: json['reviewedAt']?.toString(),
      otMinutes: (json['otMinutes'] as num?)?.toInt() ?? 0,
      overtimeType: json['overtimeType']?.toString(),
      actualMinutes: (json['actualMinutes'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'requestId': requestId,
      'status': status,
      if (requestedStart != null) 'requestedStart': requestedStart,
      if (requestedEnd != null) 'requestedEnd': requestedEnd,
      if (approvedStart != null) 'approvedStart': approvedStart,
      if (approvedEnd != null) 'approvedEnd': approvedEnd,
      if (reason != null) 'reason': reason,
      if (reviewComment != null) 'reviewComment': reviewComment,
      if (reviewedAt != null) 'reviewedAt': reviewedAt,
      'otMinutes': otMinutes,
      if (overtimeType != null) 'overtimeType': overtimeType,
      'actualMinutes': actualMinutes,
    };
  }
}

class AttendanceDayDto {
  final String id;
  final String workDate;
  final String attendanceStatus;
  final String? workdayType;
  final int? workingMinutes;
  final int lateMinutes;
  final int earlyMinutes;
  final AttendanceEventDto? checkIn;
  final AttendanceEventDto? checkOut;
  final AttendanceOvertimeDto? overtime;
  final AttendanceRequirementsDto? attendanceRequirements;

  const AttendanceDayDto({
    required this.id,
    required this.workDate,
    required this.attendanceStatus,
    this.workdayType,
    this.workingMinutes,
    this.lateMinutes = 0,
    this.earlyMinutes = 0,
    this.checkIn,
    this.checkOut,
    this.overtime,
    this.attendanceRequirements,
  });

  factory AttendanceDayDto.fromJson(Map<String, dynamic> json) {
    return AttendanceDayDto(
      id: json['_id']?.toString() ?? json['workDate']?.toString() ?? '',
      workDate: json['workDate']?.toString() ?? '',
      attendanceStatus: json['attendanceStatus']?.toString() ?? 'NOT_CHECKED_IN',
      workdayType: json['workdayType']?.toString(),
      workingMinutes: (json['workingMinutes'] as num?)?.toInt(),
      lateMinutes: (json['lateMinutes'] as num?)?.toInt() ?? 0,
      earlyMinutes: (json['earlyMinutes'] as num?)?.toInt() ?? 0,
      checkIn: json['checkIn'] != null
          ? AttendanceEventDto.fromJson(json['checkIn'] as Map<String, dynamic>)
          : null,
      checkOut: json['checkOut'] != null
          ? AttendanceEventDto.fromJson(json['checkOut'] as Map<String, dynamic>)
          : null,
      overtime: json['overtime'] != null
          ? AttendanceOvertimeDto.fromJson(json['overtime'] as Map<String, dynamic>)
          : null,
      attendanceRequirements: json['attendanceRequirements'] != null
          ? AttendanceRequirementsDto.fromJson(
              json['attendanceRequirements'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'workDate': workDate,
      'attendanceStatus': attendanceStatus,
      if (workdayType != null) 'workdayType': workdayType,
      if (workingMinutes != null) 'workingMinutes': workingMinutes,
      'lateMinutes': lateMinutes,
      'earlyMinutes': earlyMinutes,
      if (checkIn != null) 'checkIn': checkIn!.toJson(),
      if (checkOut != null) 'checkOut': checkOut!.toJson(),
      if (overtime != null) 'overtime': overtime!.toJson(),
      if (attendanceRequirements != null)
        'attendanceRequirements': attendanceRequirements!.toJson(),
    };
  }

  // Convenient presentation getters matching React Native:
  String? get firstIn => checkIn?.recordedAt;
  String? get lastOut => checkOut?.recordedAt;
  int get workedMinutes => workingMinutes ?? 0;
  int get overtimeMinutes => overtime?.otMinutes ?? 0;
  String get status => attendanceStatus;
}

