import 'attendance_event_dto.dart';
import 'attendance_requirements_dto.dart';

class PunchResultDto {
  final String workDate;
  final String attendanceStatus;
  final String availableAction;
  final String? workMode;
  final String? overallApprovalStatus;
  final AttendanceEventDto? checkIn;
  final AttendanceEventDto? checkOut;
  final int? workingMinutes;
  final int lateMinutes;
  final int earlyMinutes;
  final int? approvedLeaveMinutes;
  final int? requiredWorkingMinutes;
  final String? effectiveCheckInTime;
  final String? effectiveCheckOutTime;
  final AttendanceRequirementsDto? attendanceRequirements;

  const PunchResultDto({
    required this.workDate,
    required this.attendanceStatus,
    required this.availableAction,
    this.workMode,
    this.overallApprovalStatus,
    this.checkIn,
    this.checkOut,
    this.workingMinutes,
    this.lateMinutes = 0,
    this.earlyMinutes = 0,
    this.approvedLeaveMinutes,
    this.requiredWorkingMinutes,
    this.effectiveCheckInTime,
    this.effectiveCheckOutTime,
    this.attendanceRequirements,
  });

  factory PunchResultDto.fromJson(Map<String, dynamic> json) {
    return PunchResultDto(
      workDate: json['workDate']?.toString() ?? '',
      attendanceStatus: json['attendanceStatus']?.toString() ?? '',
      availableAction: json['availableAction']?.toString() ?? 'NONE',
      workMode: json['workMode']?.toString(),
      overallApprovalStatus: json['overallApprovalStatus']?.toString(),
      checkIn: json['checkIn'] != null
          ? AttendanceEventDto.fromJson(json['checkIn'] as Map<String, dynamic>)
          : null,
      checkOut: json['checkOut'] != null
          ? AttendanceEventDto.fromJson(json['checkOut'] as Map<String, dynamic>)
          : null,
      workingMinutes: (json['workingMinutes'] as num?)?.toInt(),
      lateMinutes: (json['lateMinutes'] as num?)?.toInt() ?? 0,
      earlyMinutes: (json['earlyMinutes'] as num?)?.toInt() ?? 0,
      approvedLeaveMinutes: (json['approvedLeaveMinutes'] as num?)?.toInt() ??
          (json['attendanceRequirements'] is Map
              ? (json['attendanceRequirements']['approvedLeaveMinutes'] as num?)?.toInt()
              : null),
      requiredWorkingMinutes: (json['requiredWorkingMinutes'] as num?)?.toInt() ??
          (json['attendanceRequirements'] is Map
              ? (json['attendanceRequirements']['requiredWorkingMinutes'] as num?)?.toInt()
              : null),
      effectiveCheckInTime: json['effectiveCheckInTime']?.toString() ??
          (json['attendanceRequirements'] is Map
              ? json['attendanceRequirements']['effectiveCheckInTime']?.toString()
              : null),
      effectiveCheckOutTime: json['effectiveCheckOutTime']?.toString() ??
          (json['attendanceRequirements'] is Map
              ? json['attendanceRequirements']['effectiveCheckOutTime']?.toString()
              : null),
      attendanceRequirements: json['attendanceRequirements'] != null &&
              json['attendanceRequirements'] is Map<String, dynamic>
          ? AttendanceRequirementsDto.fromJson(
              json['attendanceRequirements'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'workDate': workDate,
      'attendanceStatus': attendanceStatus,
      'availableAction': availableAction,
      if (workMode != null) 'workMode': workMode,
      if (overallApprovalStatus != null)
        'overallApprovalStatus': overallApprovalStatus,
      if (checkIn != null) 'checkIn': checkIn!.toJson(),
      if (checkOut != null) 'checkOut': checkOut!.toJson(),
      if (workingMinutes != null) 'workingMinutes': workingMinutes,
      'lateMinutes': lateMinutes,
      'earlyMinutes': earlyMinutes,
      if (approvedLeaveMinutes != null)
        'approvedLeaveMinutes': approvedLeaveMinutes,
      if (requiredWorkingMinutes != null)
        'requiredWorkingMinutes': requiredWorkingMinutes,
      if (effectiveCheckInTime != null)
        'effectiveCheckInTime': effectiveCheckInTime,
      if (effectiveCheckOutTime != null)
        'effectiveCheckOutTime': effectiveCheckOutTime,
      if (attendanceRequirements != null)
        'attendanceRequirements': attendanceRequirements!.toJson(),
    };
  }
}
