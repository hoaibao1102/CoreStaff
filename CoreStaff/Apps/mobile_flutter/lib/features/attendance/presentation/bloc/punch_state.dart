import '../../data/models/punch_result_dto.dart';
import '../../domain/services/punch_coordinator.dart';

abstract class PunchState {
  const PunchState();
}

class PunchInitial extends PunchState {
  const PunchInitial();
}

class PunchDetectingEnvironment extends PunchState {
  final String message;
  final PunchWaterfallStep currentStep;

  const PunchDetectingEnvironment({
    required this.message,
    required this.currentStep,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PunchDetectingEnvironment &&
          runtimeType == other.runtimeType &&
          message == other.message &&
          currentStep == other.currentStep;

  @override
  int get hashCode => message.hashCode ^ currentStep.hashCode;
}

class PunchMethodDecided extends PunchState {
  final String method;
  final String details;

  const PunchMethodDecided({
    required this.method,
    required this.details,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PunchMethodDecided &&
          runtimeType == other.runtimeType &&
          method == other.method &&
          details == other.details;

  @override
  int get hashCode => method.hashCode ^ details.hashCode;
}

class PunchPromptSelfie extends PunchState {
  final String reason;
  final bool isOutOffice;

  const PunchPromptSelfie({
    required this.reason,
    required this.isOutOffice,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PunchPromptSelfie &&
          runtimeType == other.runtimeType &&
          reason == other.reason &&
          isOutOffice == other.isOutOffice;

  @override
  int get hashCode => reason.hashCode ^ isOutOffice.hashCode;
}

class PunchSubmitting extends PunchState {
  final String action;
  final String message;

  const PunchSubmitting({
    required this.action,
    required this.message,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PunchSubmitting &&
          runtimeType == other.runtimeType &&
          action == other.action &&
          message == other.message;

  @override
  int get hashCode => action.hashCode ^ message.hashCode;
}

class PunchSuccess extends PunchState {
  final String action;
  final String message;
  final String method;
  final PunchResultDto result;

  const PunchSuccess({
    required this.action,
    required this.message,
    required this.method,
    required this.result,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PunchSuccess &&
          runtimeType == other.runtimeType &&
          action == other.action &&
          message == other.message &&
          method == other.method;

  @override
  int get hashCode => action.hashCode ^ message.hashCode ^ method.hashCode;
}

class PunchFailure extends PunchState {
  final String message;
  final String? errorCode;
  final bool isPermissionDenied;

  const PunchFailure({
    required this.message,
    this.errorCode,
    this.isPermissionDenied = false,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PunchFailure &&
          runtimeType == other.runtimeType &&
          message == other.message &&
          errorCode == other.errorCode &&
          isPermissionDenied == other.isPermissionDenied;

  @override
  int get hashCode =>
      message.hashCode ^ errorCode.hashCode ^ isPermissionDenied.hashCode;
}
