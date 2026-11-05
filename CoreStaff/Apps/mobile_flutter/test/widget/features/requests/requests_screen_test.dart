import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/requests/data/models/leave_request_dto.dart';
import 'package:corestaff_mobile/features/requests/data/models/overtime_request_dto.dart';
import 'package:corestaff_mobile/features/requests/data/requests_repository.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/request_form_cubit.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/requests_bloc.dart';
import 'package:corestaff_mobile/features/requests/presentation/screens/requests_screen.dart';

class MockRequestsRepository extends Mock implements RequestsRepository {}

void main() {
  late MockRequestsRepository mockRepository;

  const sampleLeave = LeaveRequestDto(
    id: 'leave_101',
    startDate: '2026-11-10',
    endDate: '2026-11-10',
    leaveType: 'PAID_LEAVE',
    durationType: 'CUSTOM_HOURS',
    requestedStart: '08:00',
    requestedEnd: '12:00',
    calculatedMinutes: 240,
    leaveEquivalent: 0.5,
    reason: 'Khám sức khỏe định kỳ',
    status: 'PENDING_MANAGER',
    createdAt: '2026-11-04T10:00:00.000Z',
  );

  const sampleOvertime = OvertimeRequestDto(
    id: 'ot_101',
    workDate: '2026-11-05',
    requestedStart: '2026-11-05T18:00:00+07:00',
    requestedEnd: '2026-11-05T20:00:00+07:00',
    reason: 'Kiểm thử ứng dụng mobile sprint 3',
    status: 'APPROVED',
    createdAt: '2026-11-04T12:00:00.000Z',
    overtimeResult: OvertimeResultSummaryDto(
      eligibleMinutes: 120,
      overtimeType: 'WORKING_DAY',
    ),
  );

  setUp(() {
    mockRepository = MockRequestsRepository();
    final sl = GetIt.instance;
    if (sl.isRegistered<RequestsRepository>()) sl.unregister<RequestsRepository>();
    if (sl.isRegistered<RequestsBloc>()) sl.unregister<RequestsBloc>();
    if (sl.isRegistered<RequestFormCubit>()) sl.unregister<RequestFormCubit>();

    sl.registerLazySingleton<RequestsRepository>(() => mockRepository);
    sl.registerFactory<RequestsBloc>(() => RequestsBloc(requestsRepository: mockRepository));
    sl.registerFactory<RequestFormCubit>(() => RequestFormCubit(repository: mockRepository));
  });

  tearDown(() {
    final sl = GetIt.instance;
    if (sl.isRegistered<RequestsRepository>()) sl.unregister<RequestsRepository>();
    if (sl.isRegistered<RequestsBloc>()) sl.unregister<RequestsBloc>();
    if (sl.isRegistered<RequestFormCubit>()) sl.unregister<RequestFormCubit>();
  });

  group('RequestsScreen Widget Tests', () {
    testWidgets('renders header, action cards, and loaded requests', (tester) async {
      when(() => mockRepository.getMyLeaveRequests()).thenAnswer((_) async => [sampleLeave]);
      when(() => mockRepository.getMyOvertimeRequests()).thenAnswer((_) async => [sampleOvertime]);

      await tester.pumpWidget(
        const MaterialApp(
          home: RequestsScreen(),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Header checks
      expect(find.text('ĐƠN TỪ'), findsOneWidget);
      expect(find.text('Yêu cầu của tôi'), findsOneWidget);
      expect(find.text('Tạo và theo dõi phê duyệt nghỉ phép, tăng ca.'), findsOneWidget);
      expect(find.byIcon(Icons.add_rounded), findsOneWidget);

      // Action cards
      expect(find.text('Xin nghỉ phép'), findsOneWidget);
      expect(find.text('Đăng ký tăng ca'), findsOneWidget);

      // Segmented control tabs
      expect(find.text('Tất cả'), findsOneWidget);
      expect(find.text('Nghỉ phép'), findsOneWidget);
      expect(find.text('Tăng ca'), findsOneWidget);

      // Activity list
      expect(find.text('Hoạt động gần đây'), findsOneWidget);
      expect(find.text('2 yêu cầu'), findsOneWidget);

      // Cards content
      expect(find.text('Nghỉ phép có lương'), findsOneWidget);
      expect(find.text('Theo giờ · 08:00–12:00'), findsOneWidget);
      expect(find.text('Chờ duyệt'), findsOneWidget); // StatusBadge
      expect(find.text('Tăng ca ngày 05/11/2026'), findsOneWidget);
      expect(find.text('Đã duyệt'), findsOneWidget); // StatusBadge
      expect(find.text('Đủ điều kiện: 120 phút'), findsOneWidget);
    });

    testWidgets('filters items when switching segment tabs', (tester) async {
      when(() => mockRepository.getMyLeaveRequests()).thenAnswer((_) async => [sampleLeave]);
      when(() => mockRepository.getMyOvertimeRequests()).thenAnswer((_) async => [sampleOvertime]);

      await tester.pumpWidget(
        const MaterialApp(
          home: RequestsScreen(),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('2 yêu cầu'), findsOneWidget);

      // Tap 'Nghỉ phép' tab
      await tester.tap(find.text('Nghỉ phép'));
      await tester.pumpAndSettle();

      expect(find.text('1 yêu cầu'), findsOneWidget);
      expect(find.text('Nghỉ phép có lương'), findsOneWidget);
      expect(find.text('Tăng ca ngày 05/11/2026'), findsNothing);

      // Tap 'Tăng ca' tab
      await tester.tap(find.text('Tăng ca'));
      await tester.pumpAndSettle();

      expect(find.text('1 yêu cầu'), findsOneWidget);
      expect(find.text('Nghỉ phép có lương'), findsNothing);
      expect(find.text('Tăng ca ngày 05/11/2026'), findsOneWidget);
    });

    testWidgets('shows empty state when no requests are found', (tester) async {
      when(() => mockRepository.getMyLeaveRequests()).thenAnswer((_) async => []);
      when(() => mockRepository.getMyOvertimeRequests()).thenAnswer((_) async => []);

      await tester.pumpWidget(
        const MaterialApp(
          home: RequestsScreen(),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Chưa có yêu cầu'), findsOneWidget);
      expect(find.text('Đơn nghỉ phép và đăng ký tăng ca sẽ xuất hiện tại đây.'), findsOneWidget);
      expect(find.text('0 yêu cầu'), findsOneWidget);
    });

    testWidgets('shows error state when initial load fails', (tester) async {
      when(() => mockRepository.getMyLeaveRequests()).thenThrow(
        const ApiException(
          message: 'Không tìm thấy đơn nghỉ phép',
          code: 'LEAVE_REQUEST_NOT_FOUND',
          statusCode: 404,
        ),
      );
      when(() => mockRepository.getMyOvertimeRequests()).thenAnswer((_) async => []);

      await tester.pumpWidget(
        const MaterialApp(
          home: RequestsScreen(),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Không tìm thấy đơn nghỉ phép.'), findsOneWidget);
    });

    testWidgets('opens request creation modal when tapping Add button or action card', (tester) async {
      when(() => mockRepository.getMyLeaveRequests()).thenAnswer((_) async => []);
      when(() => mockRepository.getMyOvertimeRequests()).thenAnswer((_) async => []);

      await tester.pumpWidget(
        const MaterialApp(
          home: RequestsScreen(),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Tap '+' button
      await tester.tap(find.byIcon(Icons.add_rounded));
      await tester.pumpAndSettle();

      // Modal is visible
      expect(find.text('Đơn nghỉ phép'), findsWidgets);
      expect(find.text('Gửi đơn nghỉ phép'), findsOneWidget);
    });
  });
}
