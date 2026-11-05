import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/error/error_resolver.dart';
import '../../../../core/network/api_exception.dart';
import '../../data/models/request_payloads.dart';
import '../../data/requests_repository.dart';
import 'request_form_state.dart';

class RequestFormCubit extends Cubit<RequestFormState> {
  final RequestsRepository repository;
  Timer? _debounceTimer;
  int _previewRequestId = 0;

  RequestFormCubit({required this.repository}) : super(_createInitialState(RequestFormType.leave));

  static RequestFormState _createInitialState(RequestFormType type) {
    final now = DateTime.now().toUtc().add(const Duration(hours: 7));
    final todayStr = '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

    return RequestFormState(
      formType: type,
      leaveType: 'PAID_LEAVE',
      durationType: 'FULL_DAY',
      startDate: todayStr,
      endDate: todayStr,
      startTime: '18:00',
      endTime: '20:00',
      reason: '',
      workDescription: '',
      retroactiveReason: '',
    );
  }

  void initialize(RequestFormType type) {
    _debounceTimer?.cancel();
    _previewRequestId++;
    emit(_createInitialState(type));
    if (type == RequestFormType.leave) {
      _triggerDebouncedPreview();
    }
  }

  void setFormType(RequestFormType type) {
    _debounceTimer?.cancel();
    _previewRequestId++;
    emit(_createInitialState(type));
    if (type == RequestFormType.leave) {
      _triggerDebouncedPreview();
    }
  }

  void setLeaveType(String leaveType) {
    emit(state.copyWith(leaveType: leaveType, errorMessage: () => null));
  }

  void setDurationType(String durationType) {
    final newEndDate = durationType != 'FULL_DAY' ? state.startDate : state.endDate;
    emit(state.copyWith(
      durationType: durationType,
      endDate: newEndDate,
      errorMessage: () => null,
    ));
    if (state.formType == RequestFormType.leave) {
      _triggerDebouncedPreview();
    }
  }

  void setStartDate(String date) {
    final newEndDate = state.durationType != 'FULL_DAY' ? date : state.endDate;
    emit(state.copyWith(
      startDate: date,
      endDate: newEndDate,
      errorMessage: () => null,
    ));
    if (state.formType == RequestFormType.leave) {
      _triggerDebouncedPreview();
    }
  }

  void setEndDate(String date) {
    emit(state.copyWith(endDate: date, errorMessage: () => null));
    if (state.formType == RequestFormType.leave) {
      _triggerDebouncedPreview();
    }
  }

  void setStartTime(String time) {
    emit(state.copyWith(startTime: time, errorMessage: () => null));
    if (state.formType == RequestFormType.leave && state.durationType == 'CUSTOM_HOURS') {
      _triggerDebouncedPreview();
    }
  }

  void setEndTime(String time) {
    emit(state.copyWith(endTime: time, errorMessage: () => null));
    if (state.formType == RequestFormType.leave && state.durationType == 'CUSTOM_HOURS') {
      _triggerDebouncedPreview();
    }
  }

  void setReason(String reason) {
    emit(state.copyWith(reason: reason, errorMessage: () => null));
  }

  void setWorkDescription(String desc) {
    emit(state.copyWith(workDescription: desc, errorMessage: () => null));
  }

  void setRetroactiveReason(String retro) {
    emit(state.copyWith(retroactiveReason: retro, errorMessage: () => null));
  }

  void _triggerDebouncedPreview() {
    _debounceTimer?.cancel();
    final requestId = ++_previewRequestId;

    if (state.formType != RequestFormType.leave ||
        !_isValidDateKey(state.startDate) ||
        !_isValidDateKey(state.endDate) ||
        state.endDate.compareTo(state.startDate) < 0 ||
        (state.durationType != 'FULL_DAY' && state.startDate != state.endDate) ||
        (state.durationType == 'CUSTOM_HOURS' &&
            (!_isValidTime(state.startTime) ||
                !_isValidTime(state.endTime) ||
                _timeMinutes(state.endTime) <= _timeMinutes(state.startTime)))) {
      emit(state.copyWith(preview: () => null, isPreviewing: false));
      return;
    }

    _debounceTimer = Timer(const Duration(milliseconds: 250), () async {
      if (isClosed || requestId != _previewRequestId || state.formType != RequestFormType.leave) {
        return;
      }
      emit(state.copyWith(isPreviewing: true, errorMessage: () => null));
      try {
        final preview = await repository.previewLeave(
          PreviewLeaveRequestPayload(
            startDate: state.startDate,
            endDate: state.endDate,
            durationType: state.durationType,
            requestedStart: state.durationType == 'CUSTOM_HOURS' ? state.startTime : null,
            requestedEnd: state.durationType == 'CUSTOM_HOURS' ? state.endTime : null,
          ),
        );
        if (!isClosed && requestId == _previewRequestId && state.formType == RequestFormType.leave) {
          emit(state.copyWith(preview: () => preview, isPreviewing: false));
        }
      } catch (e) {
        if (!isClosed && requestId == _previewRequestId && state.formType == RequestFormType.leave) {
          final message = _resolveErrorMessage(e);
          emit(state.copyWith(
            preview: () => null,
            isPreviewing: false,
            errorMessage: () => message,
          ));
        }
      }
    });
  }

  Future<void> submit() async {
    final validationError = _validateForm();
    if (validationError != null) {
      emit(state.copyWith(errorMessage: () => validationError));
      return;
    }

    emit(state.copyWith(
      submissionStatus: FormSubmissionStatus.submitting,
      errorMessage: () => null,
    ));

    try {
      if (state.formType == RequestFormType.leave) {
        await repository.createLeaveRequest(
          CreateLeaveRequestPayload(
            startDate: state.startDate,
            endDate: state.endDate,
            leaveType: state.leaveType,
            durationType: state.durationType,
            requestedStart: state.durationType == 'CUSTOM_HOURS' ? state.startTime : null,
            requestedEnd: state.durationType == 'CUSTOM_HOURS' ? state.endTime : null,
            reason: state.reason.trim(),
          ),
        );
        emit(state.copyWith(
          submissionStatus: FormSubmissionStatus.success,
          successMessage: () => 'Đã gửi đơn nghỉ phép.',
        ));
      } else {
        final startIso = '${state.startDate}T${state.startTime}:00+07:00';
        final endIso = '${state.startDate}T${state.endTime}:00+07:00';
        await repository.createOvertimeRequest(
          CreateOvertimeRequestPayload(
            workDate: state.startDate,
            requestedStart: startIso,
            requestedEnd: endIso,
            reason: state.reason.trim(),
            workDescription: state.workDescription.trim().isNotEmpty
                ? state.workDescription.trim()
                : null,
            retroactiveReason: state.retroactiveReason.trim().isNotEmpty
                ? state.retroactiveReason.trim()
                : null,
          ),
        );
        emit(state.copyWith(
          submissionStatus: FormSubmissionStatus.success,
          successMessage: () => 'Đã gửi đăng ký tăng ca.',
        ));
      }
    } catch (e) {
      final message = _resolveErrorMessage(e);
      emit(state.copyWith(
        submissionStatus: FormSubmissionStatus.failure,
        errorMessage: () => message,
      ));
    }
  }

  String? _validateForm() {
    if (state.reason.trim().length < 10) {
      return 'Lý do cần có ít nhất 10 ký tự.';
    }
    if (!_isValidDateKey(state.startDate) ||
        (state.formType == RequestFormType.leave && !_isValidDateKey(state.endDate))) {
      return 'Ngày cần theo định dạng YYYY-MM-DD và phải hợp lệ.';
    }
    if (state.formType == RequestFormType.leave &&
        state.endDate.compareTo(state.startDate) < 0) {
      return 'Ngày kết thúc không được sớm hơn ngày bắt đầu.';
    }
    if (state.formType == RequestFormType.leave &&
        state.durationType != 'FULL_DAY' &&
        state.startDate != state.endDate) {
      return 'Đơn nghỉ một phần ngày chỉ áp dụng cho một ngày.';
    }
    if (state.formType == RequestFormType.leave &&
        state.durationType == 'CUSTOM_HOURS' &&
        (!_isValidTime(state.startTime) ||
            !_isValidTime(state.endTime) ||
            _timeMinutes(state.endTime) <= _timeMinutes(state.startTime))) {
      return 'Khoảng giờ xin nghỉ chưa hợp lệ.';
    }
    if (state.formType == RequestFormType.leave && state.preview == null) {
      return 'Cần có kết quả tính từ lịch làm việc trước khi gửi đơn.';
    }
    if (state.formType == RequestFormType.overtime &&
        (!_isValidTime(state.startTime) || !_isValidTime(state.endTime))) {
      return 'Giờ cần theo định dạng HH:mm và nằm trong 00:00-23:59.';
    }
    if (state.formType == RequestFormType.overtime &&
        _timeMinutes(state.endTime) <= _timeMinutes(state.startTime)) {
      return 'Giờ kết thúc phải muộn hơn giờ bắt đầu.';
    }
    if (state.formType == RequestFormType.overtime &&
        state.workDescription.trim().isNotEmpty &&
        state.workDescription.trim().length < 3) {
      return 'Mô tả công việc cần ít nhất 3 ký tự hoặc để trống.';
    }
    return null;
  }

  static bool _isValidDateKey(String value) {
    final reg = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$');
    final match = reg.firstMatch(value);
    if (match == null) return false;
    final year = int.tryParse(match.group(1)!);
    final month = int.tryParse(match.group(2)!);
    final day = int.tryParse(match.group(3)!);
    if (year == null || month == null || day == null) return false;
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    final parsed = DateTime.utc(year, month, day);
    return parsed.year == year && parsed.month == month && parsed.day == day;
  }

  static bool _isValidTime(String value) {
    final reg = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$');
    return reg.hasMatch(value);
  }

  static int _timeMinutes(String value) {
    final parts = value.split(':');
    return int.parse(parts[0]) * 60 + int.parse(parts[1]);
  }

  String _resolveErrorMessage(dynamic error) {
    if (error is ApiException) {
      return ErrorResolver.resolveEmployeeError(error.code, error.message);
    }
    return ErrorResolver.resolve(error);
  }

  @override
  Future<void> close() {
    _debounceTimer?.cancel();
    _previewRequestId++;
    return super.close();
  }
}
