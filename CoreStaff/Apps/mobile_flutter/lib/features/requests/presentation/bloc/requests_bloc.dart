import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/error/error_resolver.dart';
import '../../../../core/network/api_exception.dart';
import '../../data/models/leave_request_dto.dart';
import '../../data/models/overtime_request_dto.dart';
import '../../data/requests_repository.dart';
import 'requests_event.dart';
import 'requests_state.dart';

class RequestsBloc extends Bloc<RequestsEvent, RequestsState> {
  final RequestsRepository requestsRepository;

  RequestsBloc({required this.requestsRepository}) : super(const RequestsInitial()) {
    on<RequestsLoadStarted>(_onLoadStarted);
    on<RequestsRefreshed>(_onRefreshed);
    on<RequestsFilterChanged>(_onFilterChanged);
    on<RequestsCancelRequested>(_onCancelRequested);
  }

  Future<void> _onLoadStarted(
    RequestsLoadStarted event,
    Emitter<RequestsState> emit,
  ) async {
    final current = state is RequestsLoaded ? (state as RequestsLoaded) : null;

    if (event.isRefresh) {
      if (current != null) {
        emit(current.copyWith(isRefreshing: true, bannerError: () => null));
      }
    } else {
      emit(const RequestsLoading());
    }

    try {
      final results = await Future.wait([
        requestsRepository.getMyLeaveRequests(),
        requestsRepository.getMyOvertimeRequests(),
      ]);

      final leaves = results[0] as List<LeaveRequestDto>;
      final overtime = results[1] as List<OvertimeRequestDto>;

      emit(RequestsLoaded(
        leaves: leaves,
        overtime: overtime,
        filter: current?.filter ?? RequestsFilter.all,
        isRefreshing: false,
        bannerError: null,
        bannerSuccess: event.successMessage,
      ));
    } catch (e) {
      final message = _resolveErrorMessage(e);
      if (current != null && (current.leaves.isNotEmpty || current.overtime.isNotEmpty)) {
        emit(current.copyWith(isRefreshing: false, bannerError: () => message));
      } else {
        emit(RequestsError(message: message));
      }
    }
  }

  void _onRefreshed(
    RequestsRefreshed event,
    Emitter<RequestsState> emit,
  ) {
    add(RequestsLoadStarted(isRefresh: true, successMessage: event.successMessage));
  }

  void _onFilterChanged(
    RequestsFilterChanged event,
    Emitter<RequestsState> emit,
  ) {
    if (state is RequestsLoaded) {
      emit((state as RequestsLoaded).copyWith(filter: event.filter));
    }
  }

  Future<void> _onCancelRequested(
    RequestsCancelRequested event,
    Emitter<RequestsState> emit,
  ) async {
    if (state is! RequestsLoaded) return;
    final current = state as RequestsLoaded;

    try {
      await requestsRepository.cancelLeaveRequest(event.id);
      final updatedLeaves = current.leaves.map((l) {
        return l.id == event.id ? l.copyWith(status: 'CANCELLED') : l;
      }).toList();

      emit(current.copyWith(
        leaves: updatedLeaves,
        bannerSuccess: () => 'Đã hủy đơn nghỉ phép thành công.',
        bannerError: () => null,
      ));
    } catch (e) {
      final message = _resolveErrorMessage(e);
      emit(current.copyWith(bannerError: () => message));
    }
  }

  String _resolveErrorMessage(dynamic error) {
    if (error is ApiException) {
      return ErrorResolver.resolveEmployeeError(error.code, error.message);
    }
    return ErrorResolver.resolve(error);
  }
}
