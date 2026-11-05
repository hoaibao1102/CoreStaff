class CreateLeaveRequestPayload {
  final String startDate;
  final String endDate;
  final String leaveType; // 'PAID_LEAVE' | 'UNPAID_LEAVE'
  final String durationType; // 'FULL_DAY' | 'MORNING_HALF' | 'AFTERNOON_HALF' | 'CUSTOM_HOURS'
  final String? requestedStart;
  final String? requestedEnd;
  final String reason;

  const CreateLeaveRequestPayload({
    required this.startDate,
    required this.endDate,
    required this.leaveType,
    required this.durationType,
    this.requestedStart,
    this.requestedEnd,
    required this.reason,
  });

  Map<String, dynamic> toJson() => {
        'startDate': startDate,
        'endDate': endDate,
        'leaveType': leaveType,
        'durationType': durationType,
        if (requestedStart != null && requestedStart!.isNotEmpty) 'requestedStart': requestedStart,
        if (requestedEnd != null && requestedEnd!.isNotEmpty) 'requestedEnd': requestedEnd,
        'reason': reason.trim(),
      };
}

class PreviewLeaveRequestPayload {
  final String startDate;
  final String endDate;
  final String durationType;
  final String? requestedStart;
  final String? requestedEnd;

  const PreviewLeaveRequestPayload({
    required this.startDate,
    required this.endDate,
    required this.durationType,
    this.requestedStart,
    this.requestedEnd,
  });

  Map<String, dynamic> toJson() => {
        'startDate': startDate,
        'endDate': endDate,
        'durationType': durationType,
        if (requestedStart != null && requestedStart!.isNotEmpty) 'requestedStart': requestedStart,
        if (requestedEnd != null && requestedEnd!.isNotEmpty) 'requestedEnd': requestedEnd,
      };
}

class CreateOvertimeRequestPayload {
  final String workDate;
  final String requestedStart; // ISO 8601 with timezone (e.g. 2026-11-04T18:00:00+07:00)
  final String requestedEnd;   // ISO 8601 with timezone (e.g. 2026-11-04T20:00:00+07:00)
  final String reason;
  final String? workDescription;
  final String? retroactiveReason;

  const CreateOvertimeRequestPayload({
    required this.workDate,
    required this.requestedStart,
    required this.requestedEnd,
    required this.reason,
    this.workDescription,
    this.retroactiveReason,
  });

  Map<String, dynamic> toJson() => {
        'workDate': workDate,
        'requestedStart': requestedStart,
        'requestedEnd': requestedEnd,
        'reason': reason.trim(),
        if (workDescription != null && workDescription!.trim().isNotEmpty)
          'workDescription': workDescription!.trim(),
        if (retroactiveReason != null && retroactiveReason!.trim().isNotEmpty)
          'retroactiveReason': retroactiveReason!.trim(),
      };
}
