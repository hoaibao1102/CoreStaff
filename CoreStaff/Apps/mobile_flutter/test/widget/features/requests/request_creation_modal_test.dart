import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/features/requests/data/models/leave_preview_dto.dart';
import 'package:corestaff_mobile/features/requests/data/models/leave_request_dto.dart';
import 'package:corestaff_mobile/features/requests/data/models/request_payloads.dart';
import 'package:corestaff_mobile/features/requests/data/requests_repository.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/request_form_cubit.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/request_form_state.dart';
import 'package:corestaff_mobile/features/requests/presentation/widgets/request_creation_modal.dart';

class MockRequestsRepository extends Mock implements RequestsRepository {}
class FakePreviewLeaveRequestPayload extends Fake implements PreviewLeaveRequestPayload {}
class FakeCreateLeaveRequestPayload extends Fake implements CreateLeaveRequestPayload {}

void main() {
  late MockRequestsRepository mockRepository;

  setUpAll(() {
    registerFallbackValue(FakePreviewLeaveRequestPayload());
    registerFallbackValue(FakeCreateLeaveRequestPayload());
  });

  setUp(() {
    mockRepository = MockRequestsRepository();
  });

  group('RequestCreationModal Widget Tests', () {
    testWidgets('renders leave form with toggle, duration grid, and shift preview', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      when(() => mockRepository.previewLeave(any())).thenAnswer(
        (_) async => const LeavePreviewDto(
          durationType: 'FULL_DAY',
          calculatedMinutes: 480,
          leaveEquivalent: 1.0,
          days: [
            LeavePreviewDayDto(
              date: '2026-11-20',
              shiftStart: '08:00',
              shiftEnd: '17:00',
              breakMinutes: 60,
              breakStart: '12:00',
              breakEnd: '13:00',
              requestedStart: '08:00',
              requestedEnd: '17:00',
              calculatedMinutes: 480,
              leaveEquivalent: 1.0,
            ),
          ],
        ),
      );

      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.initialize(RequestFormType.leave);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: BlocProvider.value(
              value: cubit,
              child: RequestCreationModal(
                onSuccess: (_) {},
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('TẠO YÊU CẦU'), findsOneWidget);
      expect(find.text('Đơn nghỉ phép'), findsOneWidget);
      expect(find.text('Có lương'), findsOneWidget);
      expect(find.text('Không lương'), findsOneWidget);
      expect(find.text('Thời lượng nghỉ'), findsOneWidget);
      expect(find.text('Cả ngày'), findsOneWidget);
      expect(find.text('Buổi sáng'), findsOneWidget);
      expect(find.text('Buổi chiều'), findsOneWidget);
      expect(find.text('Theo giờ'), findsOneWidget);
      expect(find.textContaining('Từ ngày'), findsOneWidget);
      expect(find.textContaining('Đến ngày'), findsOneWidget);
      expect(find.text('Kết quả từ lịch làm việc'), findsOneWidget);
      expect(find.text('Gửi đơn nghỉ phép'), findsOneWidget);

      cubit.close();
    });

    testWidgets('shows validation error when reason is shorter than 10 characters', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.initialize(RequestFormType.leave);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: BlocProvider.value(
              value: cubit,
              child: RequestCreationModal(
                onSuccess: (_) {},
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      await tester.ensureVisible(find.text('Gửi đơn nghỉ phép'));
      await tester.tap(find.text('Gửi đơn nghỉ phép'));
      await tester.pump();

      expect(find.text('Lý do cần có ít nhất 10 ký tự.', skipOffstage: false), findsOneWidget);

      cubit.close();
    });

    testWidgets('renders overtime form when initialized with RequestFormType.overtime', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.initialize(RequestFormType.overtime);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: BlocProvider.value(
              value: cubit,
              child: RequestCreationModal(
                onSuccess: (_) {},
              ),
            ),
          ),
        ),
      );

      await tester.pump();

      expect(find.text('Đăng ký tăng ca'), findsOneWidget);
      expect(find.textContaining('Ngày tăng ca'), findsOneWidget);
      expect(find.textContaining('Bắt đầu'), findsOneWidget);
      expect(find.textContaining('Kết thúc'), findsOneWidget);
      expect(find.textContaining('Mô tả công việc'), findsOneWidget);
      expect(find.textContaining('Lý do khai báo muộn'), findsOneWidget);
      expect(find.text('Gửi đăng ký tăng ca'), findsOneWidget);

      cubit.close();
    });

    testWidgets('successful submission triggers onSuccess callback', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

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
          id: 'leave_created',
          startDate: '2026-11-20',
          endDate: '2026-11-20',
          leaveType: 'PAID_LEAVE',
          reason: 'Khám sức khỏe tổng quát định kỳ',
          status: 'PENDING_MANAGER',
        ),
      );

      String? successMsg;
      final cubit = RequestFormCubit(repository: mockRepository);
      cubit.initialize(RequestFormType.leave);
      cubit.setStartDate('2026-11-20');
      cubit.setEndDate('2026-11-20');
      cubit.setReason('Khám sức khỏe tổng quát định kỳ');

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: BlocProvider.value(
              value: cubit,
              child: RequestCreationModal(
                onSuccess: (msg) {
                  successMsg = msg;
                },
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      await tester.ensureVisible(find.text('Gửi đơn nghỉ phép'));
      await tester.tap(find.text('Gửi đơn nghỉ phép'));
      await tester.pump();

      expect(successMsg, 'Đã gửi đơn nghỉ phép.');

      cubit.close();
    });
  });
}
