class LeaveIntervalDto {
  final String from;
  final String to;

  const LeaveIntervalDto({
    required this.from,
    required this.to,
  });

  factory LeaveIntervalDto.fromJson(Map<String, dynamic> json) => LeaveIntervalDto(
        from: json['from']?.toString() ?? '',
        to: json['to']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {'from': from, 'to': to};
}

class LeaveRequestDto {
  final String id;
  final String startDate;
  final String endDate;
  final String leaveType; // 'PAID_LEAVE' | 'UNPAID_LEAVE'
  final String durationType; // 'FULL_DAY' | 'MORNING_HALF' | 'AFTERNOON_HALF' | 'CUSTOM_HOURS'
  final String? requestedStart;
  final String? requestedEnd;
  final int? calculatedMinutes;
  final num? leaveEquivalent;
  final List<LeaveIntervalDto> approvedLeaveIntervals;
  final List<LeaveIntervalDto> requiredWorkingIntervals;
  final String reason;
  final String status; // 'PENDING_MANAGER' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'HR_APPLIED'
  final String? reviewComment;
  final String? reviewedBy;
  final String? createdAt;
  final String? updatedAt;

  const LeaveRequestDto({
    required this.id,
    required this.startDate,
    required this.endDate,
    required this.leaveType,
    this.durationType = 'FULL_DAY',
    this.requestedStart,
    this.requestedEnd,
    this.calculatedMinutes,
    this.leaveEquivalent,
    this.approvedLeaveIntervals = const [],
    this.requiredWorkingIntervals = const [],
    required this.reason,
    required this.status,
    this.reviewComment,
    this.reviewedBy,
    this.createdAt,
    this.updatedAt,
  });

  bool get isPaidLeave => leaveType == 'PAID_LEAVE';
  bool get isCancellable => status == 'PENDING_MANAGER' || status == 'PENDING';

  String get leaveTypeLabel => isPaidLeave ? 'Nghỉ phép có lương' : 'Nghỉ không lương';

  String get durationLabel {
    switch (durationType) {
      case 'MORNING_HALF':
        return 'Buổi sáng';
      case 'AFTERNOON_HALF':
        return 'Buổi chiều';
      case 'CUSTOM_HOURS':
        return 'Theo giờ';
      case 'FULL_DAY':
      default:
        return 'Cả ngày';
    }
  }

  String get formattedDuration {
    if (calculatedMinutes == null) return '';
    final mins = calculatedMinutes!;
    final h = mins ~/ 60;
    final m = mins % 60;
    if (h > 0) {
      return m > 0 ? '$h giờ $m phút' : '$h giờ';
    }
    return '$m phút';
  }

  String get formattedDays {
    if (leaveEquivalent == null) return '';
    final formatted = leaveEquivalent!.toDouble().toStringAsFixed(3).replaceAll(RegExp(r'\.?0+$'), '');
    return '$formatted ngày phép';
  }

  LeaveRequestDto copyWith({
    String? status,
    String? reviewComment,
    String? updatedAt,
  }) {
    return LeaveRequestDto(
      id: id,
      startDate: startDate,
      endDate: endDate,
      leaveType: leaveType,
      durationType: durationType,
      requestedStart: requestedStart,
      requestedEnd: requestedEnd,
      calculatedMinutes: calculatedMinutes,
      leaveEquivalent: leaveEquivalent,
      approvedLeaveIntervals: approvedLeaveIntervals,
      requiredWorkingIntervals: requiredWorkingIntervals,
      reason: reason,
      status: status ?? this.status,
      reviewComment: reviewComment ?? this.reviewComment,
      reviewedBy: reviewedBy,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  factory LeaveRequestDto.fromJson(Map<String, dynamic> json) {
    return LeaveRequestDto(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      startDate: json['startDate']?.toString() ?? '',
      endDate: json['endDate']?.toString() ?? '',
      leaveType: json['leaveType']?.toString() ?? 'PAID_LEAVE',
      durationType: json['durationType']?.toString() ?? 'FULL_DAY',
      requestedStart: json['requestedStart']?.toString(),
      requestedEnd: json['requestedEnd']?.toString(),
      calculatedMinutes: (json['calculatedMinutes'] as num?)?.toInt(),
      leaveEquivalent: json['leaveEquivalent'] as num?,
      approvedLeaveIntervals: (json['approvedLeaveIntervals'] as List<dynamic>?)
              ?.map((e) => LeaveIntervalDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      requiredWorkingIntervals: (json['requiredWorkingIntervals'] as List<dynamic>?)
              ?.map((e) => LeaveIntervalDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      reason: json['reason']?.toString() ?? '',
      status: json['status']?.toString() ?? 'PENDING_MANAGER',
      reviewComment: json['reviewComment']?.toString(),
      reviewedBy: json['reviewedBy']?.toString(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'startDate': startDate,
        'endDate': endDate,
        'leaveType': leaveType,
        'durationType': durationType,
        if (requestedStart != null) 'requestedStart': requestedStart,
        if (requestedEnd != null) 'requestedEnd': requestedEnd,
        if (calculatedMinutes != null) 'calculatedMinutes': calculatedMinutes,
        if (leaveEquivalent != null) 'leaveEquivalent': leaveEquivalent,
        'approvedLeaveIntervals': approvedLeaveIntervals.map((e) => e.toJson()).toList(),
        'requiredWorkingIntervals': requiredWorkingIntervals.map((e) => e.toJson()).toList(),
        'reason': reason,
        'status': status,
        if (reviewComment != null) 'reviewComment': reviewComment,
        if (reviewedBy != null) 'reviewedBy': reviewedBy,
        if (createdAt != null) 'createdAt': createdAt,
        if (updatedAt != null) 'updatedAt': updatedAt,
      };
}
