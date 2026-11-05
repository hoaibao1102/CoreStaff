import '../../data/models/leave_preview_dto.dart';

enum RequestFormType { leave, overtime }

enum FormSubmissionStatus { initial, submitting, success, failure }

class RequestFormState {
  final RequestFormType formType;
  final String leaveType; // 'PAID_LEAVE' | 'UNPAID_LEAVE'
  final String durationType; // 'FULL_DAY' | 'MORNING_HALF' | 'AFTERNOON_HALF' | 'CUSTOM_HOURS'
  final String startDate; // 'YYYY-MM-DD'
  final String endDate;   // 'YYYY-MM-DD'
  final String startTime; // 'HH:mm'
  final String endTime;   // 'HH:mm'
  final String reason;
  final String workDescription;
  final String retroactiveReason;

  final LeavePreviewDto? preview;
  final bool isPreviewing;
  final FormSubmissionStatus submissionStatus;
  final String? errorMessage;
  final String? successMessage;

  const RequestFormState({
    required this.formType,
    required this.leaveType,
    required this.durationType,
    required this.startDate,
    required this.endDate,
    required this.startTime,
    required this.endTime,
    required this.reason,
    required this.workDescription,
    required this.retroactiveReason,
    this.preview,
    this.isPreviewing = false,
    this.submissionStatus = FormSubmissionStatus.initial,
    this.errorMessage,
    this.successMessage,
  });

  bool get isSubmitting => submissionStatus == FormSubmissionStatus.submitting;

  RequestFormState copyWith({
    RequestFormType? formType,
    String? leaveType,
    String? durationType,
    String? startDate,
    String? endDate,
    String? startTime,
    String? endTime,
    String? reason,
    String? workDescription,
    String? retroactiveReason,
    LeavePreviewDto? Function()? preview,
    bool? isPreviewing,
    FormSubmissionStatus? submissionStatus,
    String? Function()? errorMessage,
    String? Function()? successMessage,
  }) {
    return RequestFormState(
      formType: formType ?? this.formType,
      leaveType: leaveType ?? this.leaveType,
      durationType: durationType ?? this.durationType,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      reason: reason ?? this.reason,
      workDescription: workDescription ?? this.workDescription,
      retroactiveReason: retroactiveReason ?? this.retroactiveReason,
      preview: preview != null ? preview() : this.preview,
      isPreviewing: isPreviewing ?? this.isPreviewing,
      submissionStatus: submissionStatus ?? this.submissionStatus,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
      successMessage: successMessage != null ? successMessage() : this.successMessage,
    );
  }
}
