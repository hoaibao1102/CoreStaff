import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/error/app_exception.dart';
import '../../../../core/error/error_resolver.dart';
import '../../data/models/payslip_dto.dart';
import '../../data/payslip_repository.dart';
import 'payslip_event.dart';
import 'payslip_state.dart';

export 'payslip_event.dart';
export 'payslip_state.dart';

class PayslipBloc extends Bloc<PayslipEvent, PayslipState> {
  final PayslipRepository payslipRepository;

  PayslipBloc({required this.payslipRepository}) : super(const PayslipInitial()) {
    on<PayslipsRequested>(_onPayslipsRequested);
    on<PayslipToggleExpanded>(_onToggleExpanded);
  }

  Future<void> _onPayslipsRequested(
    PayslipsRequested event,
    Emitter<PayslipState> emit,
  ) async {
    final current = state is PayslipLoaded ? (state as PayslipLoaded) : null;
    if (!event.isRefresh) {
      emit(const PayslipLoading());
    }

    try {
      final payslips = await payslipRepository.getMyPayslips();
      emit(PayslipLoaded(
        payslips: payslips,
        expandedId: current?.expandedId,
      ));
    } on ApiException catch (e) {
      final resolved = ErrorResolver.resolveEmployeeError(e.code, e.message);
      emit(PayslipError(message: resolved));
    } on NetworkException catch (e) {
      emit(PayslipError(message: e.message));
    } on AppException catch (e) {
      emit(PayslipError(message: e.message));
    } catch (e) {
      emit(PayslipError(message: 'Không thể tải phiếu lương: ${e.toString()}'));
    }
  }

  Future<void> _onToggleExpanded(
    PayslipToggleExpanded event,
    Emitter<PayslipState> emit,
  ) async {
    if (state is! PayslipLoaded) return;
    final current = state as PayslipLoaded;

    final isCurrentlyExpanded = current.expandedId == event.id;
    final newExpandedId = isCurrentlyExpanded ? null : event.id;

    // Check if item needs to be marked as viewed
    final targetIndex = current.payslips.indexWhere((p) => p.id == event.id);
    if (targetIndex != -1 && current.payslips[targetIndex].status == 'RELEASED') {
      final updatedList = List<PayslipDto>.from(current.payslips);
      updatedList[targetIndex] = updatedList[targetIndex].copyWith(status: 'VIEWED');

      emit(current.copyWith(
        payslips: updatedList,
        expandedId: () => newExpandedId,
      ));

      // Trigger background audit call without blocking UI
      try {
        await payslipRepository.markViewed(event.id);
      } catch (_) {
        // Optimistic update retained; non-blocking
      }
    } else {
      emit(current.copyWith(expandedId: () => newExpandedId));
    }
  }
}

