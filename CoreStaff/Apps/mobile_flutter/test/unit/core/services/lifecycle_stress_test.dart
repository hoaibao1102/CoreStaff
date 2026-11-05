import 'dart:async';
import 'dart:ui';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/services/lifecycle_listener.dart';
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
  late DateTime fakeNow;

  setUp(() {
    mockSocket = MockSocketService();
    fakeNow = DateTime(2026, 11, 4, 12, 0, 0);
  });

  AppLifecycleCoordinator createCoordinator({
    required VoidCallback onForegroundResume,
    bool isConnected = true,
    Duration resumeThreshold = const Duration(seconds: 15),
    Duration throttleInterval = const Duration(seconds: 5),
  }) {
    when(() => mockSocket.isConnected).thenReturn(isConnected);
    when(() => mockSocket.connect()).thenAnswer((_) {});

    return AppLifecycleCoordinator(
      socketService: mockSocket,
      resumeThreshold: resumeThreshold,
      throttleInterval: throttleInterval,
      onForegroundResume: onForegroundResume,
      clock: () => fakeNow,
      autoStart: false,
    );
  }

  group('Adversarial Stress Test: Millisecond Threshold Boundaries', () {
    test('14,999 ms background duration does NOT trigger resume (strict < 15s)', () {
      int triggers = 0;
      final coordinator = createCoordinator(
        onForegroundResume: () => triggers++,
        isConnected: true,
      );

      coordinator.handlePause(fakeNow);
      fakeNow = fakeNow.add(const Duration(milliseconds: 14999));
      coordinator.handleResume(fakeNow);

      expect(triggers, 0, reason: '14,999ms must not satisfy 15s threshold');
      verifyNever(() => mockSocket.connect());
      coordinator.dispose();
    });

    test('15,000 ms background duration DOES trigger resume (boundary >= 15s)', () {
      int triggers = 0;
      final coordinator = createCoordinator(
        onForegroundResume: () => triggers++,
        isConnected: true,
      );

      coordinator.handlePause(fakeNow);
      fakeNow = fakeNow.add(const Duration(milliseconds: 15000));
      coordinator.handleResume(fakeNow);

      expect(triggers, 1, reason: '15,000ms exactly satisfies 15s threshold');
      verifyNever(() => mockSocket.connect());
      coordinator.dispose();
    });

    test('15,001 ms background duration DOES trigger resume', () {
      int triggers = 0;
      final coordinator = createCoordinator(
        onForegroundResume: () => triggers++,
        isConnected: true,
      );

      coordinator.handlePause(fakeNow);
      fakeNow = fakeNow.add(const Duration(milliseconds: 15001));
      coordinator.handleResume(fakeNow);

      expect(triggers, 1);
      coordinator.dispose();
    });
  });

  group('Adversarial Stress Test: Throttle Boundaries', () {
    test('Secondary resume at 4,999 ms is throttled; at 5,000 ms is permitted', () {
      int triggers = 0;
      final coordinator = createCoordinator(
        onForegroundResume: () => triggers++,
        isConnected: true,
      );

      // Initial pause of 20s
      coordinator.handlePause(fakeNow);
      fakeNow = fakeNow.add(const Duration(seconds: 20));
      coordinator.handleResume(fakeNow);
      expect(triggers, 1, reason: 'First resume after 20s should execute');

      // Attempt second resume at 4,999ms after first resume
      fakeNow = fakeNow.add(const Duration(milliseconds: 4999));
      coordinator.handleResume(fakeNow);
      expect(triggers, 1, reason: '4,999ms is strictly less than 5s throttle interval');

      // Advance by another 1ms (reaching 5,000ms after first resume)
      // Note: _pausedAt was at t=0, so current (t=25s) - _pausedAt (t=0) = 25s >= 15s
      fakeNow = fakeNow.add(const Duration(milliseconds: 1));
      coordinator.handleResume(fakeNow);
      expect(triggers, 2, reason: '5,000ms difference satisfies throttle interval');

      coordinator.dispose();
    });

    test('Throttle suppresses duplicate socket reconnect when rapid bounce occurs', () {
      int triggers = 0;
      when(() => mockSocket.isConnected).thenReturn(false);
      when(() => mockSocket.connect()).thenAnswer((_) {});

      final coordinator = AppLifecycleCoordinator(
        socketService: mockSocket,
        resumeThreshold: const Duration(seconds: 15),
        throttleInterval: const Duration(seconds: 5),
        onForegroundResume: () => triggers++,
        clock: () => fakeNow,
        autoStart: false,
      );

      // First resume with disconnected socket
      coordinator.handleResume(fakeNow);
      expect(triggers, 1);
      verify(() => mockSocket.connect()).called(1);

      // Rapid second resume 100ms later while still disconnected
      fakeNow = fakeNow.add(const Duration(milliseconds: 100));
      coordinator.handleResume(fakeNow);
      expect(triggers, 1, reason: 'Throttle must block duplicate reconnect flood');
      verifyNever(() => mockSocket.connect());

      // Advance past throttle window (5.1s)
      fakeNow = fakeNow.add(const Duration(milliseconds: 5000));
      coordinator.handleResume(fakeNow);
      expect(triggers, 2, reason: 'Allowed after throttle window expires');
      verify(() => mockSocket.connect()).called(1);

      coordinator.dispose();
    });
  });

  group('Adversarial Stress Test: Rapid Pause/Resume Bouncing (Camera Selfie Simulation)', () {
    test('Simulate 20 rapid camera selfie pauses (3-8 seconds each) -> 0 refreshes', () {
      int triggers = 0;
      final coordinator = createCoordinator(
        onForegroundResume: () => triggers++,
        isConnected: true,
      );

      // Simulate 20 consecutive camera selfie cycles
      // In each cycle: pause, wait between 3 and 10 seconds, resume, stay active for 2 seconds
      for (int i = 0; i < 20; i++) {
        coordinator.handlePause(fakeNow);
        final selfieDuration = Duration(seconds: 3 + (i % 8)); // 3 to 10 seconds, always < 15s
        fakeNow = fakeNow.add(selfieDuration);
        coordinator.handleResume(fakeNow);

        expect(triggers, 0, reason: 'Cycle $i: selfie duration $selfieDuration should not trigger refresh');

        // Stay active for 2 seconds before next selfie
        fakeNow = fakeNow.add(const Duration(seconds: 2));
      }

      verifyNever(() => mockSocket.connect());
      coordinator.dispose();
    });

    test('Camera selfie where network dropped -> immediate reconnect even if pause was 4s', () {
      int triggers = 0;
      bool socketConnected = true;
      when(() => mockSocket.isConnected).thenAnswer((_) => socketConnected);
      when(() => mockSocket.connect()).thenAnswer((_) {
        socketConnected = true;
      });

      final coordinator = AppLifecycleCoordinator(
        socketService: mockSocket,
        resumeThreshold: const Duration(seconds: 15),
        throttleInterval: const Duration(seconds: 5),
        onForegroundResume: () => triggers++,
        clock: () => fakeNow,
        autoStart: false,
      );

      // Normal selfie 1: socket connected, 4s pause -> no refresh
      coordinator.handlePause(fakeNow);
      fakeNow = fakeNow.add(const Duration(seconds: 4));
      coordinator.handleResume(fakeNow);
      expect(triggers, 0);

      fakeNow = fakeNow.add(const Duration(seconds: 10));

      // Selfie 2: OS killed socket while camera was open (4s pause)
      socketConnected = false;
      coordinator.handlePause(fakeNow);
      fakeNow = fakeNow.add(const Duration(seconds: 4));
      coordinator.handleResume(fakeNow);

      expect(triggers, 1, reason: 'Disconnected socket overrides 15s threshold');
      expect(socketConnected, isTrue, reason: 'Socket must be reconnected');

      coordinator.dispose();
    });
  });

  group('Adversarial Stress Test: RealtimeSyncCoordinator Full Refresh Fan-Out', () {
    test('Full refresh triggers silent background refresh on all 5 BLoCs', () {
      final mockStreamController = StreamController<RealtimeEvent>.broadcast();
      when(() => mockSocket.eventStream).thenAnswer((_) => mockStreamController.stream);

      final mockOverview = MockOverviewBloc();
      final mockAttendance = MockAttendanceBloc();
      final mockRequests = MockRequestsBloc();
      final mockPayslip = MockPayslipBloc();
      final mockAccount = MockAccountBloc();

      final coordinator = RealtimeSyncCoordinator(
        socketService: mockSocket,
        overviewBloc: mockOverview,
        attendanceBloc: mockAttendance,
        requestsBloc: mockRequests,
        payslipBloc: mockPayslip,
        accountBloc: mockAccount,
      );

      coordinator.triggerFullRefresh();

      verify(() => mockOverview.add(const RefreshOverview())).called(1);
      verify(() => mockAttendance.add(const AttendanceStarted(isRefresh: true))).called(1);
      verify(() => mockRequests.add(const RequestsLoadStarted(isRefresh: true))).called(1);
      verify(() => mockPayslip.add(const PayslipsRequested(isRefresh: true))).called(1);
      verify(() => mockAccount.add(const AccountProfileRequested(isRefresh: true))).called(1);

      coordinator.dispose();
      mockStreamController.close();
    });

    test('Full refresh handles null BLoCs gracefully without throwing', () {
      final mockStreamController = StreamController<RealtimeEvent>.broadcast();
      when(() => mockSocket.eventStream).thenAnswer((_) => mockStreamController.stream);

      final coordinator = RealtimeSyncCoordinator(
        socketService: mockSocket,
        // No BLoCs attached
      );

      expect(() => coordinator.triggerFullRefresh(), returnsNormally);
      coordinator.dispose();
      mockStreamController.close();
    });
  });

  group('Adversarial Stress Test: Native Flutter AppLifecycleListener Binding', () {
    testWidgets('AppLifecycleCoordinator responds to native Flutter lifecycle transitions', (tester) async {
      int triggers = 0;
      when(() => mockSocket.isConnected).thenReturn(false);
      when(() => mockSocket.connect()).thenAnswer((_) {});

      final coordinator = AppLifecycleCoordinator(
        socketService: mockSocket,
        resumeThreshold: const Duration(seconds: 15),
        throttleInterval: const Duration(seconds: 5),
        onForegroundResume: () => triggers++,
        autoStart: true,
      );

      // Flutter 3.13+ lifecycle state sequence:
      // resumed -> inactive -> hidden -> paused
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();
      expect(coordinator.pausedAt, isNotNull);

      // paused -> hidden -> inactive -> resumed
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();

      // Since socket was disconnected, it should immediately trigger resume & connect
      expect(triggers, 1);
      verify(() => mockSocket.connect()).called(1);

      coordinator.dispose();
    });
  });
}

