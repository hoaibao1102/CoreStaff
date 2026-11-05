import 'leave_request_dto.dart';

class LeavePreviewDayDto {
  final String date;
  final String shiftStart;
  final String shiftEnd;
  final int breakMinutes;
  final String breakStart;
  final String breakEnd;
  final String requestedStart;
  final String requestedEnd;
  final int calculatedMinutes;
  final num leaveEquivalent;
  final List<LeaveIntervalDto> approvedLeaveIntervals;
  final List<LeaveIntervalDto> requiredWorkingIntervals;

  const LeavePreviewDayDto({
    required this.date,
    required this.shiftStart,
    required this.shiftEnd,
    required this.breakMinutes,
    required this.breakStart,
    required this.breakEnd,
    required this.requestedStart,
    required this.requestedEnd,
    required this.calculatedMinutes,
    required this.leaveEquivalent,
    this.approvedLeaveIntervals = const [],
    this.requiredWorkingIntervals = const [],
  });

  factory LeavePreviewDayDto.fromJson(Map<String, dynamic> json) {
    return LeavePreviewDayDto(
      date: json['date']?.toString() ?? '',
      shiftStart: json['shiftStart']?.toString() ?? '',
      shiftEnd: json['shiftEnd']?.toString() ?? '',
      breakMinutes: (json['breakMinutes'] as num?)?.toInt() ?? 0,
      breakStart: json['breakStart']?.toString() ?? '',
      breakEnd: json['breakEnd']?.toString() ?? '',
      requestedStart: json['requestedStart']?.toString() ?? '',
      requestedEnd: json['requestedEnd']?.toString() ?? '',
      calculatedMinutes: (json['calculatedMinutes'] as num?)?.toInt() ?? 0,
      leaveEquivalent: json['leaveEquivalent'] as num? ?? 0,
      approvedLeaveIntervals: (json['approvedLeaveIntervals'] as List<dynamic>?)
              ?.map((e) => LeaveIntervalDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      requiredWorkingIntervals: (json['requiredWorkingIntervals'] as List<dynamic>?)
              ?.map((e) => LeaveIntervalDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  Map<String, dynamic> toJson() => {
        'date': date,
        'shiftStart': shiftStart,
        'shiftEnd': shiftEnd,
        'breakMinutes': breakMinutes,
        'breakStart': breakStart,
        'breakEnd': breakEnd,
        'requestedStart': requestedStart,
        'requestedEnd': requestedEnd,
        'calculatedMinutes': calculatedMinutes,
        'leaveEquivalent': leaveEquivalent,
        'approvedLeaveIntervals': approvedLeaveIntervals.map((e) => e.toJson()).toList(),
        'requiredWorkingIntervals': requiredWorkingIntervals.map((e) => e.toJson()).toList(),
      };
}

class LeavePreviewDto {
  final String durationType;
  final String? requestedStart;
  final String? requestedEnd;
  final int calculatedMinutes;
  final num leaveEquivalent;
  final List<LeavePreviewDayDto> days;

  const LeavePreviewDto({
    required this.durationType,
    this.requestedStart,
    this.requestedEnd,
    required this.calculatedMinutes,
    required this.leaveEquivalent,
    this.days = const [],
  });

  String get formattedDuration {
    final h = calculatedMinutes ~/ 60;
    final m = calculatedMinutes % 60;
    if (h > 0) {
      return m > 0 ? '$h giờ $m phút' : '$h giờ';
    }
    return '$m phút';
  }

  String get formattedDays {
    final formatted = leaveEquivalent.toDouble().toStringAsFixed(3).replaceAll(RegExp(r'\.?0+$'), '');
    return '$formatted ngày phép';
  }

  factory LeavePreviewDto.fromJson(Map<String, dynamic> json) {
    return LeavePreviewDto(
      durationType: json['durationType']?.toString() ?? 'FULL_DAY',
      requestedStart: json['requestedStart']?.toString(),
      requestedEnd: json['requestedEnd']?.toString(),
      calculatedMinutes: (json['calculatedMinutes'] as num?)?.toInt() ?? 0,
      leaveEquivalent: json['leaveEquivalent'] as num? ?? 0,
      days: (json['days'] as List<dynamic>?)
              ?.map((e) => LeavePreviewDayDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  Map<String, dynamic> toJson() => {
        'durationType': durationType,
        if (requestedStart != null) 'requestedStart': requestedStart,
        if (requestedEnd != null) 'requestedEnd': requestedEnd,
        'calculatedMinutes': calculatedMinutes,
        'leaveEquivalent': leaveEquivalent,
        'days': days.map((e) => e.toJson()).toList(),
      };
}
