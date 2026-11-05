import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/services/realtime_sync_coordinator.dart';
import 'package:corestaff_mobile/core/services/socket_service.dart';
import 'package:corestaff_mobile/features/account/presentation/bloc/account_bloc.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/attendance_bloc.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/attendance_event.dart';
import 'package:corestaff_mobile/features/overview/presentation/bloc/overview_bloc.dart';
import 'package:corestaff_mobile/features/overview/presentation/bloc/overview_event.dart';
import 'package:corestaff_mobile/features/payslip/presentation/bloc/payslip_bloc.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/requests_bloc.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/requests_event.dart';

class MockSocketService extends Mock implements SocketService {}
class MockOverviewBloc extends Mock implements OverviewBloc {}
class MockAttendanceBloc extends Mock implements AttendanceBloc {}
class MockRequestsBloc extends Mock implements RequestsBloc {}
class MockPayslipBloc extends Mock implements PayslipBloc {}
class MockAccountBloc extends Mock implements AccountBloc {}

void main() {
  late MockSocketService mockSocket;
  late StreamController<RealtimeEvent> eventController;
  late MockOverviewBloc mockOverview;
  late MockAttendanceBloc mockAttendance;
  late MockRequestsBloc mockRequests;
  late MockPayslipBloc mockPayslip;
  late MockAccountBloc mockAccount;
  late RealtimeSyncCoordinator coordinator;

  setUpAll(() {
    registerFallbackValue(const RefreshOverview());
    registerFallbackValue(const AttendanceStarted(isRefresh: true));
    registerFallbackValue(const RequestsLoadStarted(isRefresh: true));
    registerFallbackValue(const PayslipsRequested(isRefresh: true));
    registerFallbackValue(const AccountProfileRequested(isRefresh: true));
  });

  setUp(() {
    mockSocket = MockSocketService();
    eventController = StreamController<RealtimeEvent>.broadcast();
    when(() => mockSocket.eventStream).thenAnswer((_) => eventController.stream);

    mockOverview = MockOverviewBloc();
    mockAttendance = MockAttendanceBloc();
    mockRequests = MockRequestsBloc();
    mockPayslip = MockPayslipBloc();
    mockAccount = MockAccountBloc();

    coordinator = RealtimeSyncCoordinator(
      socketService: mockSocket,
      overviewBloc: mockOverview,
      attendanceBloc: mockAttendance,
      requestsBloc: mockRequests,
      payslipBloc: mockPayslip,
      accountBloc: mockAccount,
      debounceDuration: const Duration(milliseconds: 50), // shorter for fast test execution
    );
  });

  tearDown(() {
    coordinator.dispose();
    eventController.close();
  });

  group('RealtimeSyncCoordinator Debounce and Batching', () {
    test('batches multiple rapid events into a single refresh per affected BLoC', () async {
      // Send 3 rapid events within the debounce window
      eventController.add(RealtimeEvent(
        event: 'attendance:changed',
        data: {'userId': 'u1'},
        timestamp: DateTime.now(),
      ));
      eventController.add(RealtimeEvent(
        event: 'attendance:changed',
        data: {'userId': 'u1'},
        timestamp: DateTime.now(),
      ));
      eventController.add(RealtimeEvent(
        event: 'payslip:released',
        data: {'period': '11/2026'},
        timestamp: DateTime.now(),
      ));

      // Before debounce window elapses, no bloc events should be fired
      verifyNever(() => mockAttendance.add(any()));
      verifyNever(() => mockPayslip.add(any()));
      verifyNever(() => mockOverview.add(any()));

      // Wait for debounce window (50ms + margin)
      await Future.delayed(const Duration(milliseconds: 70));

      // After debounce window, each affected BLoC is called exactly once
      verify(() => mockAttendance.add(const AttendanceStarted(isRefresh: true))).called(1);
      verify(() => mockPayslip.add(const PayslipsRequested(isRefresh: true))).called(1);
      verify(() => mockOverview.add(const RefreshOverview())).called(1);
      verifyNever(() => mockRequests.add(any()));
    });

    test('routes request:decided and leave:changed to RequestsBloc and OverviewBloc', () async {
      eventController.add(RealtimeEvent(
        event: 'request:decided',
        data: {'id': 'r1'},
        timestamp: DateTime.now(),
      ));
      eventController.add(RealtimeEvent(
        event: 'leave:changed',
        data: {'id': 'l1'},
        timestamp: DateTime.now(),
      ));

      await Future.delayed(const Duration(milliseconds: 70));

      verify(() => mockRequests.add(const RequestsLoadStarted(isRefresh: true))).called(1);
      verify(() => mockOverview.add(const RefreshOverview())).called(1);
      verifyNever(() => mockAttendance.add(any()));
      verifyNever(() => mockPayslip.add(any()));
    });

    test('ignores connection lifecycle events (connect, disconnect, connect_error)', () async {
      eventController.add(RealtimeEvent(
        event: 'connect',
        data: null,
        timestamp: DateTime.now(),
      ));
      eventController.add(RealtimeEvent(
        event: 'disconnect',
        data: null,
        timestamp: DateTime.now(),
      ));

      await Future.delayed(const Duration(milliseconds: 70));

      verifyNever(() => mockOverview.add(any()));
      verifyNever(() => mockAttendance.add(any()));
      verifyNever(() => mockRequests.add(any()));
      verifyNever(() => mockPayslip.add(any()));
    });
  });

  group('RealtimeSyncCoordinator triggerFullRefresh', () {
    test('triggerFullRefresh immediately dispatches silent refresh to all 5 BLoCs', () {
      coordinator.triggerFullRefresh();

      verify(() => mockOverview.add(const RefreshOverview())).called(1);
      verify(() => mockAttendance.add(const AttendanceStarted(isRefresh: true))).called(1);
      verify(() => mockRequests.add(const RequestsLoadStarted(isRefresh: true))).called(1);
      verify(() => mockPayslip.add(const PayslipsRequested(isRefresh: true))).called(1);
      verify(() => mockAccount.add(const AccountProfileRequested(isRefresh: true))).called(1);
    });
  });
}
