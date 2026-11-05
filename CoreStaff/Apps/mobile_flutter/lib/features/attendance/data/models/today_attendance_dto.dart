import 'attendance_assignment_dto.dart';
import 'attendance_event_dto.dart';
import 'attendance_requirements_dto.dart';

class TodayAttendanceDto {
  final String workDate;
  final String serverTime;
  final String attendanceStatus; // NOT_CHECKED_IN | CHECKED_IN | COMPLETED | DAY_OFF | LOCKED
  final String availableAction; // CHECK_IN | CHECK_OUT | NONE
  final String? workMode; // IN_OFFICE | OUT_OFFICE | null
  final AttendanceEventDto? checkIn;
  final AttendanceEventDto? checkOut;
  final int? workingMinutes;
  final int lateMinutes;
  final int earlyMinutes;
  final AttendanceRequirementsDto? attendanceRequirements;
  final PendingLeaveDto? pendingLeave;
  final String overallApprovalStatus;
  final String? approvalComment;
  final String? approvalReviewedAt;
  final AttendanceAssignmentDto assignment;

  const TodayAttendanceDto({
    required this.workDate,
    required this.serverTime,
    required this.attendanceStatus,
    required this.availableAction,
    this.workMode,
    this.checkIn,
    this.checkOut,
    this.workingMinutes,
    this.lateMinutes = 0,
    this.earlyMinutes = 0,
    this.attendanceRequirements,
    this.pendingLeave,
    this.overallApprovalStatus = 'NOT_REQUIRED',
    this.approvalComment,
    this.approvalReviewedAt,
    required this.assignment,
  });

  factory TodayAttendanceDto.fromJson(Map<String, dynamic> json) {
    return TodayAttendanceDto(
      workDate: json['workDate']?.toString() ?? '',
      serverTime: json['serverTime']?.toString() ?? '',
      attendanceStatus: json['attendanceStatus']?.toString() ?? 'NOT_CHECKED_IN',
      availableAction: json['availableAction']?.toString() ?? 'NONE',
      workMode: json['workMode']?.toString(),
      checkIn: json['checkIn'] != null
          ? AttendanceEventDto.fromJson(json['checkIn'] as Map<String, dynamic>)
          : null,
      checkOut: json['checkOut'] != null
          ? AttendanceEventDto.fromJson(json['checkOut'] as Map<String, dynamic>)
          : null,
      workingMinutes: (json['workingMinutes'] as num?)?.toInt(),
      lateMinutes: (json['lateMinutes'] as num?)?.toInt() ?? 0,
      earlyMinutes: (json['earlyMinutes'] as num?)?.toInt() ?? 0,
      attendanceRequirements: json['attendanceRequirements'] != null
          ? AttendanceRequirementsDto.fromJson(
              json['attendanceRequirements'] as Map<String, dynamic>)
          : null,
      pendingLeave: json['pendingLeave'] != null
          ? PendingLeaveDto.fromJson(json['pendingLeave'] as Map<String, dynamic>)
          : null,
      overallApprovalStatus: json['overallApprovalStatus']?.toString() ?? 'NOT_REQUIRED',
      approvalComment: json['approvalComment']?.toString(),
      approvalReviewedAt: json['approvalReviewedAt']?.toString(),
      assignment: AttendanceAssignmentDto.fromJson(
          json['assignment'] as Map<String, dynamic>? ?? {}),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'workDate': workDate,
      'serverTime': serverTime,
      'attendanceStatus': attendanceStatus,
      'availableAction': availableAction,
      if (workMode != null) 'workMode': workMode,
      if (checkIn != null) 'checkIn': checkIn!.toJson(),
      if (checkOut != null) 'checkOut': checkOut!.toJson(),
      if (workingMinutes != null) 'workingMinutes': workingMinutes,
      'lateMinutes': lateMinutes,
      'earlyMinutes': earlyMinutes,
      if (attendanceRequirements != null)
        'attendanceRequirements': attendanceRequirements!.toJson(),
      if (pendingLeave != null) 'pendingLeave': pendingLeave!.toJson(),
      'overallApprovalStatus': overallApprovalStatus,
      if (approvalComment != null) 'approvalComment': approvalComment,
      if (approvalReviewedAt != null) 'approvalReviewedAt': approvalReviewedAt,
      'assignment': assignment.toJson(),
    };
  }
}

