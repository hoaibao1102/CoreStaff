import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/error/error_resolver.dart';
import '../../../../core/network/api_exception.dart';
import '../../data/attendance_repository.dart';
import '../../data/models/attendance_history_dto.dart';
import '../../data/models/today_attendance_dto.dart';
import '../utils/attendance_formatters.dart';
import 'attendance_event.dart';
import 'attendance_state.dart';

class AttendanceBloc extends Bloc<AttendanceEvent, AttendanceState> {
  final AttendanceRepository attendanceRepository;

  AttendanceBloc({required this.attendanceRepository})
      : super(const AttendanceInitial()) {
    on<AttendanceStarted>(_onStarted);
    on<AttendanceRefreshed>(_onRefreshed);
    on<MonthChanged>(_onMonthChanged);
  }

  Future<void> _onStarted(
    AttendanceStarted event,
    Emitter<AttendanceState> emit,
  ) async {
    final current = state is AttendanceLoaded ? (state as AttendanceLoaded) : null;
    final targetMonth = event.targetMonth ??
        current?.currentMonth ??
        AttendanceFormatters.currentMonthKey();

    if (event.isRefresh) {
      if (current != null) {
        emit(current.copyWith(isRefreshing: true, bannerError: () => null));
      }
    } else {
      emit(const AttendanceLoading());
    }

    try {
      final results = await Future.wait([
        attendanceRepository.getTodayAttendance(),
        attendanceRepository.getAttendanceHistory(targetMonth),
      ]);

      final today = results[0] as TodayAttendanceDto;
      final history = results[1] as AttendanceHistoryDto;

      emit(AttendanceLoaded(
        today: today,
        history: history,
        currentMonth: targetMonth,
        isRefreshing: false,
      ));
    } catch (e) {
      final message = _resolveErrorMessage(e);
      if (current != null) {
        emit(current.copyWith(isRefreshing: false, bannerError: () => message));
      } else {
        emit(AttendanceError(message: message));
      }
    }
  }

  void _onRefreshed(
    AttendanceRefreshed event,
    Emitter<AttendanceState> emit,
  ) {
    add(const AttendanceStarted(isRefresh: true));
  }

  Future<void> _onMonthChanged(
    MonthChanged event,
    Emitter<AttendanceState> emit,
  ) async {
    if (state is! AttendanceLoaded) return;
    final current = state as AttendanceLoaded;

    final nextMonth = AttendanceFormatters.shiftMonth(current.currentMonth, event.offset);
    if (nextMonth == current.currentMonth) return; // Disallow moving past current month

    emit(current.copyWith(isRefreshing: true, bannerError: () => null));

    try {
      final history = await attendanceRepository.getAttendanceHistory(nextMonth);
      emit(current.copyWith(
        history: history,
        currentMonth: nextMonth,
        isRefreshing: false,
      ));
    } catch (e) {
      final message = _resolveErrorMessage(e);
      emit(current.copyWith(isRefreshing: false, bannerError: () => message));
    }
  }

  String _resolveErrorMessage(dynamic error) {
    if (error is ApiException) {
      return ErrorResolver.resolveEmployeeError(error.code, error.message);
    }
    return ErrorResolver.resolve(error);
  }
}

