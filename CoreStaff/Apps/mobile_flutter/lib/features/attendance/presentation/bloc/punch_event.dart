import '../../data/models/today_attendance_dto.dart';

abstract class PunchEvent {
  const PunchEvent();
}

class PunchSubmitted extends PunchEvent {
  final TodayAttendanceDto today;
  const PunchSubmitted({required this.today});
}

class PunchReset extends PunchEvent {
  const PunchReset();
}
