import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/error/error_resolver.dart';
import '../../../../core/network/api_exception.dart';
import '../../../attendance/data/attendance_repository.dart';
import '../../../attendance/data/models/today_attendance_dto.dart';
import '../../../payslip/data/models/payslip_dto.dart';
import '../../../payslip/data/payslip_repository.dart';
import '../../../requests/data/models/leave_request_dto.dart';
import '../../../requests/data/models/overtime_request_dto.dart';
import '../../../requests/data/requests_repository.dart';
import 'overview_event.dart';
import 'overview_state.dart';

class OverviewBloc extends Bloc<OverviewEvent, OverviewState> {
  final AttendanceRepository attendanceRepository;
  final RequestsRepository requestsRepository;
  final PayslipRepository payslipRepository;

  OverviewBloc({
    required this.attendanceRepository,
    required this.requestsRepository,
    required this.payslipRepository,
  }) : super(const OverviewInitial()) {
    on<LoadOverview>(_onLoadOverview);
    on<RefreshOverview>(_onRefreshOverview);
  }

  Future<void> _onLoadOverview(
    LoadOverview event,
    Emitter<OverviewState> emit,
  ) async {
    final current = state is OverviewLoaded ? (state as OverviewLoaded) : null;

    if (event.isRefresh) {
      if (current != null) {
        emit(current.copyWith(isRefreshing: true, partialError: () => null));
      }
    } else {
      emit(const OverviewLoading());
    }

    final errors = <dynamic>[];

    Future<TodayAttendanceDto?> fetchAttendance() async {
      try {
        return await attendanceRepository.getTodayAttendance();
      } catch (e) {
        errors.add(e);
        return null;
      }
    }

    Future<List<LeaveRequestDto>?> fetchLeaves() async {
      try {
        return await requestsRepository.getMyLeaveRequests();
      } catch (e) {
        errors.add(e);
        return null;
      }
    }

    Future<List<OvertimeRequestDto>?> fetchOvertime() async {
      try {
        return await requestsRepository.getMyOvertimeRequests();
      } catch (e) {
        errors.add(e);
        return null;
      }
    }

    Future<List<PayslipDto>?> fetchPayslips() async {
      try {
        return await payslipRepository.getMyPayslips();
      } catch (e) {
        errors.add(e);
        return null;
      }
    }

    final results = await Future.wait([
      fetchAttendance(),
      fetchLeaves(),
      fetchOvertime(),
      fetchPayslips(),
    ]);

    final today = results[0] as TodayAttendanceDto?;
    final leaves = results[1] as List<LeaveRequestDto>?;
    final overtime = results[2] as List<OvertimeRequestDto>?;
    final payslips = results[3] as List<PayslipDto>?;

    final isTotalFailure =
        today == null && leaves == null && overtime == null && payslips == null;
    final resolvedError =
        errors.isNotEmpty ? _resolveError(errors.first) : null;

    if (isTotalFailure && current == null) {
      emit(OverviewError(
        message: resolvedError ?? 'Không thể tải dữ liệu bảng điều khiển.',
      ));
      return;
    }

    int pendingRequests = current?.pendingRequestsCount ?? 0;
    if (leaves != null || overtime != null) {
      final pLeaves = leaves
              ?.where((l) =>
                  l.status == 'PENDING_MANAGER' || l.status == 'PENDING')
              .length ??
          0;
      final pOt = overtime
              ?.where((o) =>
                  o.status == 'PENDING' ||
                  o.status == 'CLARIFICATION_REQUESTED')
              .length ??
          0;
      pendingRequests = pLeaves + pOt;
    }

    int newPayslips = current?.newPayslipsCount ?? 0;
    if (payslips != null) {
      newPayslips = payslips.where((p) => p.status == 'RELEASED').length;
    }

    emit(OverviewLoaded(
      todayAttendance: today ?? current?.todayAttendance,
      pendingRequestsCount: pendingRequests,
      newPayslipsCount: newPayslips,
      partialError: resolvedError,
      isRefreshing: false,
    ));
  }

  void _onRefreshOverview(RefreshOverview event, Emitter<OverviewState> emit) {
    add(const LoadOverview(isRefresh: true));
  }

  String _resolveError(dynamic error) {
    if (error is ApiException) {
      return ErrorResolver.resolveEmployeeError(error.code, error.message);
    }
    return ErrorResolver.resolve(error);
  }
}

