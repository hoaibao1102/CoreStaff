class OvertimeResultSummaryDto {
  final int? eligibleMinutes;
  final String? overtimeType;
  final int? actualMinutes;
  final String? classificationStatus;
  final String? calculationNote;

  const OvertimeResultSummaryDto({
    this.eligibleMinutes,
    this.overtimeType,
    this.actualMinutes,
    this.classificationStatus,
    this.calculationNote,
  });

  factory OvertimeResultSummaryDto.fromJson(Map<String, dynamic> json) {
    return OvertimeResultSummaryDto(
      eligibleMinutes: (json['eligibleMinutes'] as num?)?.toInt(),
      overtimeType: json['overtimeType']?.toString(),
      actualMinutes: (json['actualMinutes'] as num?)?.toInt(),
      classificationStatus: json['classificationStatus']?.toString(),
      calculationNote: json['calculationNote']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        if (eligibleMinutes != null) 'eligibleMinutes': eligibleMinutes,
        if (overtimeType != null) 'overtimeType': overtimeType,
        if (actualMinutes != null) 'actualMinutes': actualMinutes,
        if (classificationStatus != null) 'classificationStatus': classificationStatus,
        if (calculationNote != null) 'calculationNote': calculationNote,
      };
}

class OvertimeRequestDto {
  final String id;
  final String workDate;
  final String? requestedStart;
  final String? requestedEnd;
  final String? approvedStart;
  final String? approvedEnd;
  final String reason;
  final String? workDescription;
  final String? retroactiveReason;
  final bool isRetroactive;
  final String status; // 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLARIFICATION_REQUESTED'
  final String? reviewComment;
  final String? reviewedBy;
  final OvertimeResultSummaryDto? overtimeResult;
  final String? createdAt;
  final String? updatedAt;

  const OvertimeRequestDto({
    required this.id,
    required this.workDate,
    this.requestedStart,
    this.requestedEnd,
    this.approvedStart,
    this.approvedEnd,
    required this.reason,
    this.workDescription,
    this.retroactiveReason,
    this.isRetroactive = false,
    required this.status,
    this.reviewComment,
    this.reviewedBy,
    this.overtimeResult,
    this.createdAt,
    this.updatedAt,
  });

  int? get eligibleMinutes => overtimeResult?.eligibleMinutes;

  factory OvertimeRequestDto.fromJson(Map<String, dynamic> json) {
    final nestedResult = json['overtimeResult'] is Map<String, dynamic>
        ? OvertimeResultSummaryDto.fromJson(json['overtimeResult'] as Map<String, dynamic>)
        : (json.containsKey('eligibleMinutes') || json.containsKey('overtimeType'))
            ? OvertimeResultSummaryDto.fromJson(json)
            : null;

    String parsedWorkDate = json['workDate']?.toString() ?? '';
    if (parsedWorkDate.length > 10 && parsedWorkDate.contains('T')) {
      parsedWorkDate = parsedWorkDate.split('T')[0];
    }

    return OvertimeRequestDto(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      workDate: parsedWorkDate,
      requestedStart: json['requestedStart']?.toString(),
      requestedEnd: json['requestedEnd']?.toString(),
      approvedStart: json['approvedStart']?.toString(),
      approvedEnd: json['approvedEnd']?.toString(),
      reason: json['reason']?.toString() ?? '',
      workDescription: json['workDescription']?.toString(),
      retroactiveReason: json['retroactiveReason']?.toString(),
      isRetroactive: json['isRetroactive'] == true,
      status: json['status']?.toString() ?? 'PENDING',
      reviewComment: json['reviewComment']?.toString(),
      reviewedBy: json['reviewedBy']?.toString(),
      overtimeResult: nestedResult,
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'workDate': workDate,
        if (requestedStart != null) 'requestedStart': requestedStart,
        if (requestedEnd != null) 'requestedEnd': requestedEnd,
        if (approvedStart != null) 'approvedStart': approvedStart,
        if (approvedEnd != null) 'approvedEnd': approvedEnd,
        'reason': reason,
        if (workDescription != null) 'workDescription': workDescription,
        if (retroactiveReason != null) 'retroactiveReason': retroactiveReason,
        'isRetroactive': isRetroactive,
        'status': status,
        if (reviewComment != null) 'reviewComment': reviewComment,
        if (reviewedBy != null) 'reviewedBy': reviewedBy,
        if (overtimeResult != null) 'overtimeResult': overtimeResult!.toJson(),
        if (createdAt != null) 'createdAt': createdAt,
        if (updatedAt != null) 'updatedAt': updatedAt,
      };
}
