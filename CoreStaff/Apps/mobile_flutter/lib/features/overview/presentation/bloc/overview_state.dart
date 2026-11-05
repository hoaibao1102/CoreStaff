import '../../../attendance/data/models/today_attendance_dto.dart';

abstract class OverviewState {
  const OverviewState();
}

class OverviewInitial extends OverviewState {
  const OverviewInitial();
}

class OverviewLoading extends OverviewState {
  const OverviewLoading();
}

class OverviewLoaded extends OverviewState {
  final TodayAttendanceDto? todayAttendance;
  final int pendingRequestsCount;
  final int newPayslipsCount;
  final String? partialError;
  final bool isRefreshing;

  const OverviewLoaded({
    this.todayAttendance,
    required this.pendingRequestsCount,
    required this.newPayslipsCount,
    this.partialError,
    this.isRefreshing = false,
  });

  OverviewLoaded copyWith({
    TodayAttendanceDto? Function()? todayAttendance,
    int? pendingRequestsCount,
    int? newPayslipsCount,
    String? Function()? partialError,
    bool? isRefreshing,
  }) {
    return OverviewLoaded(
      todayAttendance:
          todayAttendance != null ? todayAttendance() : this.todayAttendance,
      pendingRequestsCount:
          pendingRequestsCount ?? this.pendingRequestsCount,
      newPayslipsCount: newPayslipsCount ?? this.newPayslipsCount,
      partialError:
          partialError != null ? partialError() : this.partialError,
      isRefreshing: isRefreshing ?? this.isRefreshing,
    );
  }
}

class OverviewError extends OverviewState {
  final String message;

  const OverviewError({required this.message});
}

