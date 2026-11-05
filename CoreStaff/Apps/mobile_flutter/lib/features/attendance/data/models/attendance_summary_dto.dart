class AttendanceSummaryDto {
  final int workingDays;
  final int totalWorkingMinutes;
  final int lateDays;
  final int earlyDays;
  final int otMinutes;
  final int otDays;

  const AttendanceSummaryDto({
    this.workingDays = 0,
    this.totalWorkingMinutes = 0,
    this.lateDays = 0,
    this.earlyDays = 0,
    this.otMinutes = 0,
    this.otDays = 0,
  });

  factory AttendanceSummaryDto.fromJson(Map<String, dynamic> json) {
    return AttendanceSummaryDto(
      workingDays: (json['workingDays'] as num?)?.toInt() ?? 0,
      totalWorkingMinutes: (json['totalWorkingMinutes'] as num?)?.toInt() ?? 0,
      lateDays: (json['lateDays'] as num?)?.toInt() ?? 0,
      earlyDays: (json['earlyDays'] as num?)?.toInt() ?? 0,
      otMinutes: (json['otMinutes'] as num?)?.toInt() ?? 0,
      otDays: (json['otDays'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'workingDays': workingDays,
      'totalWorkingMinutes': totalWorkingMinutes,
      'lateDays': lateDays,
      'earlyDays': earlyDays,
      'otMinutes': otMinutes,
      'otDays': otDays,
    };
  }
}

