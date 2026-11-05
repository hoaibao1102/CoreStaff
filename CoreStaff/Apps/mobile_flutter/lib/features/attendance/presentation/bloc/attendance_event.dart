abstract class AttendanceEvent {
  const AttendanceEvent();
}

/// Initial load or reload of today attendance and specified month history.
class AttendanceStarted extends AttendanceEvent {
  final bool isRefresh;
  final String? targetMonth;

  const AttendanceStarted({
    this.isRefresh = false,
    this.targetMonth,
  });
}

/// Pull-to-refresh trigger on Attendance Screen.
class AttendanceRefreshed extends AttendanceEvent {
  const AttendanceRefreshed();
}

/// Dispatched when the user navigates months using the [‹] and [›] buttons.
class MonthChanged extends AttendanceEvent {
  final int offset; // -1 for previous month, +1 for next month

  const MonthChanged(this.offset);
}

