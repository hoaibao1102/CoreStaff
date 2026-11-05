import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/requests/data/models/leave_preview_dto.dart';
import 'package:corestaff_mobile/features/requests/data/models/leave_request_dto.dart';
import 'package:corestaff_mobile/features/requests/data/models/overtime_request_dto.dart';
import 'package:corestaff_mobile/features/requests/data/models/request_payloads.dart';
import 'package:corestaff_mobile/features/requests/data/requests_repository.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/request_form_cubit.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/request_form_state.dart';

class MockRequestsRepository extends Mock implements RequestsRepository {}
class FakePreviewLeaveRequestPayload extends Fake implements PreviewLeaveRequestPayload {}
class FakeCreateLeaveRequestPayload extends Fake implements CreateLeaveRequestPayload {}
class FakeCreateOvertimeRequestPayload extends Fake implements CreateOvertimeRequestPayload {}

void main() {
  late MockRequestsRepository mockRepository;

  setUpAll(() {
    registerFallbackValue(FakePreviewLeaveRequestPayload());
    registerFallbackValue(FakeCreateLeaveRequestPayload());
    registerFallbackValue(FakeCreateOvertimeRequestPayload());
  });

  setUp(() {
    mockRepository = MockRequestsRepository();
  });

  group('RequestFormCubit Tests', () {
    test('initial state has default values and triggers preview for leave', () {
      final cubit = RequestFormCubit(repository: mockRepository);

      expect(cubit.state.formType, RequestFormType.leave);
      expect(cubit.state.leaveType, 'PAID_LEAVE');
      expect(cubit.state.durationType, 'FULL_DAY');
      expect(cubit.state.startTime, '18:00');
      expect(cubit.state.endTime, '20:00');
      expect(cubit.state.reason, isEmpty);
      expect(cubit.state.submissionStatus, FormSubmissionStatus.initial);

      cubit.close();
    });

    test('setting durationType to partial day auto-syncs endDate to startDate', () {
      final cubit = RequestFormCubit(repository: mockRepository);

      cubit.setStartDate('2026-11-15');
      cubit.setEndDate('2026-11-20');
      expect(cubit.state.endDate, '2026-11-20');

      cubit.setDurationType('MORNING_HALF');
      expect(cubit.state.durationType, 'MORNING_HALF');
      expect(cubit.state.endDate, '2026-11-15');

      cubit.close();
    });

    test('debounced preview fires after 250ms when valid inputs are present', () async {
      when(() => mockRepository.previewLeave(any())).thenAnswer(
        (_) async => const LeavePreviewDto(
          durationType: 'FULL_DAY',
          calculatedMinutes: 480,
          leaveEquivalent: 1.0,
          days: [],
        ),
      );

      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setStartDate('2026-11-18');
      cubit.setEndDate('2026-11-18');

      // Before timer fires
      expect(cubit.state.preview, isNull);

      // Wait 300ms for 250ms debounce
      await Future<void>.delayed(const Duration(milliseconds: 300));

      expect(cubit.state.preview, isNotNull);
      expect(cubit.state.preview?.calculatedMinutes, 480);
      expect(cubit.state.isPreviewing, isFalse);

      verify(() => mockRepository.previewLeave(any())).called(greaterThanOrEqualTo(1));
      cubit.close();
    });

    test('invalid dates or ranges cancel and clear preview without calling API', () async {
      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setStartDate('2026-11-25');
      cubit.setEndDate('2026-11-20'); // endDate < startDate

      await Future<void>.delayed(const Duration(milliseconds: 300));

      expect(cubit.state.preview, isNull);
      verifyNever(() => mockRepository.previewLeave(any()));

      cubit.close();
    });

    test('validates form fields and rejects invalid submissions', () async {
      final cubit = RequestFormCubit(repository: mockRepository);

      // 1. Reason < 10 chars
      cubit.setReason('Ngắn');
      await cubit.submit();
      expect(cubit.state.errorMessage, 'Lý do cần có ít nhất 10 ký tự.');

      // 2. Invalid date format
      cubit.setReason('Lý do xin nghỉ việc gia đình dài hơn 10 ký tự');
      cubit.setStartDate('invalid-date');
      await cubit.submit();
      expect(cubit.state.errorMessage, 'Ngày cần theo định dạng YYYY-MM-DD và phải hợp lệ.');

      // 3. endDate < startDate
      cubit.setStartDate('2026-11-25');
      cubit.setEndDate('2026-11-20');
      await cubit.submit();
      expect(cubit.state.errorMessage, 'Ngày kết thúc không được sớm hơn ngày bắt đầu.');

      // 4. Missing preview
      cubit.setStartDate('2026-11-20');
      cubit.setEndDate('2026-11-20');
      await cubit.submit();
      expect(cubit.state.errorMessage, 'Cần có kết quả tính từ lịch làm việc trước khi gửi đơn.');

      // Switch to overtime
      cubit.setFormType(RequestFormType.overtime);
      cubit.setStartDate('2026-11-20');
      cubit.setReason('Làm thêm hoàn thành kiểm thử sprint');

      // 5. Overtime endTime <= startTime
      cubit.setStartTime('20:00');
      cubit.setEndTime('18:00');
      await cubit.submit();
      expect(cubit.state.errorMessage, 'Giờ kết thúc phải muộn hơn giờ bắt đầu.');

      // 6. Overtime description < 3 chars
      cubit.setStartTime('18:00');
      cubit.setEndTime('20:00');
      cubit.setWorkDescription('AB');
      await cubit.submit();
      expect(cubit.state.errorMessage, 'Mô tả công việc cần ít nhất 3 ký tự hoặc để trống.');

      cubit.close();
    });

    test('successful leave submission emits success status and message', () async {
      when(() => mockRepository.previewLeave(any())).thenAnswer(
        (_) async => const LeavePreviewDto(
          durationType: 'FULL_DAY',
          calculatedMinutes: 480,
          leaveEquivalent: 1.0,
          days: [],
        ),
      );

      when(() => mockRepository.createLeaveRequest(any())).thenAnswer(
        (_) async => const LeaveRequestDto(
          id: 'l_new',
          startDate: '2026-11-20',
          endDate: '2026-11-20',
          leaveType: 'PAID_LEAVE',
          reason: 'Khám sức khỏe tổng quát định kỳ',
          status: 'PENDING_MANAGER',
        ),
      );

      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setStartDate('2026-11-20');
      cubit.setEndDate('2026-11-20');
      cubit.setReason('Khám sức khỏe tổng quát định kỳ');

      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(cubit.state.preview, isNotNull);

      await cubit.submit();

      expect(cubit.state.submissionStatus, FormSubmissionStatus.success);
      expect(cubit.state.successMessage, 'Đã gửi đơn nghỉ phép.');
      verify(() => mockRepository.createLeaveRequest(any())).called(1);

      cubit.close();
    });

    test('successful overtime submission emits success status and includes +07:00 timezone', () async {
      when(() => mockRepository.createOvertimeRequest(any())).thenAnswer(
        (_) async => const OvertimeRequestDto(
          id: 'ot_new',
          workDate: '2026-11-20',
          reason: 'Làm thêm hoàn thành kiểm thử sprint',
          status: 'PENDING',
        ),
      );

      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setFormType(RequestFormType.overtime);
      cubit.setStartDate('2026-11-20');
      cubit.setStartTime('18:30');
      cubit.setEndTime('21:00');
      cubit.setReason('Làm thêm hoàn thành kiểm thử sprint');
      cubit.setWorkDescription('Kiểm thử giao diện mobile');

      await cubit.submit();

      expect(cubit.state.submissionStatus, FormSubmissionStatus.success);
      expect(cubit.state.successMessage, 'Đã gửi đăng ký tăng ca.');

      verify(() => mockRepository.createOvertimeRequest(
            any(that: isA<CreateOvertimeRequestPayload>()
                .having((p) => p.workDate, 'workDate', '2026-11-20')
                .having((p) => p.requestedStart, 'start', '2026-11-20T18:30:00+07:00')
                .having((p) => p.requestedEnd, 'end', '2026-11-20T21:00:00+07:00')
                .having((p) => p.reason, 'reason', 'Làm thêm hoàn thành kiểm thử sprint')
                .having((p) => p.workDescription, 'desc', 'Kiểm thử giao diện mobile')),
          )).called(1);

      cubit.close();
    });

    test('handles API submission failure gracefully', () async {
      when(() => mockRepository.createOvertimeRequest(any())).thenThrow(
        const ApiException(
          message: 'Khung giờ này trùng với đăng ký khác',
          code: 'OVERTIME_OVERLAP',
          statusCode: 409,
        ),
      );

      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.setFormType(RequestFormType.overtime);
      cubit.setStartDate('2026-11-20');
      cubit.setStartTime('18:30');
      cubit.setEndTime('21:00');
      cubit.setReason('Làm thêm hoàn thành kiểm thử sprint');

      await cubit.submit();

      expect(cubit.state.submissionStatus, FormSubmissionStatus.failure);
      expect(cubit.state.errorMessage, 'Khung giờ này đang trùng với một đăng ký tăng ca khác.');

      cubit.close();
    });
  });
}
