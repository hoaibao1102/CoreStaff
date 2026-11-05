import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/error/error_resolver.dart';
import '../../../../core/network/api_exception.dart';
import '../../domain/services/punch_coordinator.dart';
import 'punch_event.dart';
import 'punch_state.dart';

export 'punch_event.dart';
export 'punch_state.dart';

class PunchBloc extends Bloc<PunchEvent, PunchState> {
  final PunchCoordinator punchCoordinator;

  PunchBloc({required this.punchCoordinator}) : super(const PunchInitial()) {
    on<PunchSubmitted>(_onPunchSubmitted);
    on<PunchReset>((event, emit) => emit(const PunchInitial()));
  }

  Future<void> _onPunchSubmitted(
    PunchSubmitted event,
    Emitter<PunchState> emit,
  ) async {
    final action = event.today.availableAction;
    final isCheckIn = action == 'CHECK_IN';

    emit(const PunchDetectingEnvironment(
      message: 'Đang khởi động quá trình xác thực...',
      currentStep: PunchWaterfallStep.wifiCheck,
    ));

    try {
      final result = await punchCoordinator.executeWaterfall(
        today: event.today,
        onProgress: (step, statusText) {
          if (!isClosed) {
            switch (step) {
              case PunchWaterfallStep.wifiCheck:
              case PunchWaterfallStep.gpsFix:
                emit(PunchDetectingEnvironment(
                  message: statusText,
                  currentStep: step,
                ));
                break;
              case PunchWaterfallStep.promptSelfie:
                emit(PunchPromptSelfie(
                  reason: statusText,
                  isOutOffice:
                      event.today.assignment.workplaceType == 'OUT_OFFICE',
                ));
                break;
              case PunchWaterfallStep.submitting:
                emit(PunchSubmitting(
                  action: action,
                  message: statusText,
                ));
                break;
            }
          }
        },
      );

      if (isClosed) return;

      switch (result) {
        case PunchCoordinatorSuccess(:final result, :final method):
          emit(PunchMethodDecided(
            method: method,
            details: 'Xác thực thành công qua $method',
          ));
          emit(PunchSuccess(
            action: action,
            message: isCheckIn
                ? 'Đã ghi nhận thời gian vào ca.'
                : 'Đã ghi nhận thời gian ra ca.',
            method: method,
            result: result,
          ));
          break;
        case PunchCoordinatorCancelled():
          emit(const PunchInitial());
          break;
        case PunchCoordinatorFailure(
            :final message,
            :final errorCode,
            :final isPermissionDenied
          ):
          final resolvedMessage =
              ErrorResolver.resolveEmployeeError(errorCode, message);
          emit(PunchFailure(
            message: resolvedMessage,
            errorCode: errorCode,
            isPermissionDenied: isPermissionDenied,
          ));
          break;
      }
    } on ApiException catch (e) {
      if (isClosed) return;
      final resolvedMessage =
          ErrorResolver.resolveEmployeeError(e.code, e.message);
      emit(PunchFailure(
        message: resolvedMessage,
        errorCode: e.code,
        isPermissionDenied: e.code == 'CAMERA_PERMISSION_DENIED' ||
            e.code == 'LOCATION_PERMISSION_DENIED',
      ));
    } catch (e) {
      if (isClosed) return;
      final message = e is Exception
          ? e.toString().replaceFirst(RegExp(r'^Exception:\s*'), '')
          : e.toString();
      emit(PunchFailure(
        message: message,
      ));
    }
  }
}
