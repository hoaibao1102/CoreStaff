import '../../data/models/attendance_history_dto.dart';
import '../../data/models/today_attendance_dto.dart';
import '../utils/attendance_formatters.dart';

abstract class AttendanceState {
  const AttendanceState();
}

class AttendanceInitial extends AttendanceState {
  const AttendanceInitial();
}

class AttendanceLoading extends AttendanceState {
  const AttendanceLoading();
}

class AttendanceLoaded extends AttendanceState {
  final TodayAttendanceDto today;
  final AttendanceHistoryDto history;
  final String currentMonth; // Format YYYY-MM
  final bool isRefreshing;
  final String? bannerError;
  final String? bannerSuccess;

  const AttendanceLoaded({
    required this.today,
    required this.history,
    required this.currentMonth,
    this.isRefreshing = false,
    this.bannerError,
    this.bannerSuccess,
  });

  /// Returns true if navigation to the next month is permitted (< current Vietnam month).
  bool get canMoveNext => AttendanceFormatters.canMoveNext(currentMonth);

  /// Formatted label, e.g., 'Tháng 11/2026'
  String get monthLabel => AttendanceFormatters.formatMonthLabel(currentMonth);

  AttendanceLoaded copyWith({
    TodayAttendanceDto? today,
    AttendanceHistoryDto? history,
    String? currentMonth,
    bool? isRefreshing,
    String? Function()? bannerError,
    String? Function()? bannerSuccess,
  }) {
    return AttendanceLoaded(
      today: today ?? this.today,
      history: history ?? this.history,
      currentMonth: currentMonth ?? this.currentMonth,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      bannerError: bannerError != null ? bannerError() : this.bannerError,
      bannerSuccess: bannerSuccess != null ? bannerSuccess() : this.bannerSuccess,
    );
  }
}

class AttendanceError extends AttendanceState {
  final String message;

  const AttendanceError({required this.message});
}

