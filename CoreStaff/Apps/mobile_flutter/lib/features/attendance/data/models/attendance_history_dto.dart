import 'attendance_day_dto.dart';
import 'attendance_summary_dto.dart';

class AttendanceHistoryDto {
  final String month;
  final int totalDays;
  final AttendanceSummaryDto summary;
  final List<AttendanceDayDto> items;

  const AttendanceHistoryDto({
    required this.month,
    required this.totalDays,
    required this.summary,
    required this.items,
  });

  factory AttendanceHistoryDto.fromJson(Map<String, dynamic> json) {
    return AttendanceHistoryDto(
      month: json['month']?.toString() ?? '',
      totalDays: (json['totalDays'] as num?)?.toInt() ?? 0,
      summary: json['summary'] != null
          ? AttendanceSummaryDto.fromJson(json['summary'] as Map<String, dynamic>)
          : const AttendanceSummaryDto(),
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => AttendanceDayDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'month': month,
      'totalDays': totalDays,
      'summary': summary.toJson(),
      'items': items.map((e) => e.toJson()).toList(),
    };
  }
}

