import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:corestaff_mobile/core/network/cookie_manager.dart';
import 'package:corestaff_mobile/core/services/lifecycle_listener.dart';
import 'package:corestaff_mobile/core/services/realtime_sync_coordinator.dart';
import 'package:corestaff_mobile/core/services/socket_service.dart';
import 'package:corestaff_mobile/core/storage/secure_storage_service.dart';
import 'package:corestaff_mobile/features/account/presentation/bloc/account_bloc.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/attendance_bloc.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/attendance_event.dart';
import 'package:corestaff_mobile/features/overview/presentation/bloc/overview_bloc.dart';
import 'package:corestaff_mobile/features/overview/presentation/bloc/overview_event.dart';
import 'package:corestaff_mobile/features/payslip/presentation/bloc/payslip_bloc.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/requests_bloc.dart';
import 'package:corestaff_mobile/features/requests/presentation/bloc/requests_event.dart';

class MockSecureStorageService extends Mock implements SecureStorageService {}
class MockSocket extends Mock implements io.Socket {}
class MockSocketService extends Mock implements SocketService {}
class MockOverviewBloc extends Mock implements OverviewBloc {}
class MockAttendanceBloc extends Mock implements AttendanceBloc {}
class MockRequestsBloc extends Mock implements RequestsBloc {}
class MockPayslipBloc extends Mock implements PayslipBloc {}
class MockAccountBloc extends Mock implements AccountBloc {}

void main() {
  setUpAll(() {
    registerFallbackValue(const RefreshOverview());
    registerFallbackValue(const AttendanceStarted(isRefresh: true));
    registerFallbackValue(const RequestsLoadStarted(isRefresh: true));
    registerFallbackValue(const PayslipsRequested(isRefresh: true));
    registerFallbackValue(const AccountProfileRequested(isRefresh: true));
  });

  group('STRESS HARNESS 1: Burst Socket Events Batching & Debounce', () {
    late MockSocketService mockSocketService;
    late StreamController<RealtimeEvent> eventController;
    late MockOverviewBloc mockOverview;
    late MockAttendanceBloc mockAttendance;
    late MockRequestsBloc mockRequests;
    late MockPayslipBloc mockPayslip;
    late MockAccountBloc mockAccount;
    late RealtimeSyncCoordinator coordinator;

    setUp(() {
      mockSocketService = MockSocketService();
      eventController = StreamController<RealtimeEvent>.broadcast();
      when(() => mockSocketService.eventStream).thenAnswer((_) => eventController.stream);

      mockOverview = MockOverviewBloc();
      mockAttendance = MockAttendanceBloc();
      mockRequests = MockRequestsBloc();
      mockPayslip = MockPayslipBloc();
      mockAccount = MockAccountBloc();

      coordinator = RealtimeSyncCoordinator(
        socketService: mockSocketService,
        overviewBloc: mockOverview,
        attendanceBloc: mockAttendance,
        requestsBloc: mockRequests,
        payslipBloc: mockPayslip,
        accountBloc: mockAccount,
        debounceDuration: const Duration(milliseconds: 60),
      );
    });

    tearDown(() {
      coordinator.dispose();
      eventController.close();
    });

    test('avalanche of 100 mixed burst events collapses into exactly 1 refresh per affected BLoC', () async {
      final now = DateTime.now();

      // Fire 100 events in rapid succession (simulating 100 concurrent socket bursts in <5ms)
      for (int i = 0; i < 25; i++) {
        eventController.add(RealtimeEvent(event: 'attendance:changed', data: {'seq': i}, timestamp: now));
        eventController.add(RealtimeEvent(event: 'request:decided', data: {'seq': i}, timestamp: now));
        eventController.add(RealtimeEvent(event: 'payslip:released', data: {'seq': i}, timestamp: now));
        eventController.add(RealtimeEvent(event: 'leave:changed', data: {'seq': i}, timestamp: now));
      }

      // At t=10ms, within the 60ms debounce window, zero refreshes must be dispatched
      await Future.delayed(const Duration(milliseconds: 10));
      verifyNever(() => mockAttendance.add(any()));
      verifyNever(() => mockRequests.add(any()));
      verifyNever(() => mockPayslip.add(any()));
      verifyNever(() => mockOverview.add(any()));
      verifyNever(() => mockAccount.add(any()));

      // Wait until debounce window expires (60ms + 40ms safety buffer)
      await Future.delayed(const Duration(milliseconds: 90));

      // Exactly 1 silent refresh per affected BLoC
      verify(() => mockAttendance.add(const AttendanceStarted(isRefresh: true))).called(1);
      verify(() => mockRequests.add(const RequestsLoadStarted(isRefresh: true))).called(1);
      verify(() => mockPayslip.add(const PayslipsRequested(isRefresh: true))).called(1);
      verify(() => mockOverview.add(const RefreshOverview())).called(1);

      // AccountBloc is NOT a domain event target and must remain untouched
      verifyNever(() => mockAccount.add(any()));
    });

    test('sliding-window resets timer on each incoming event and flushes once quiet', () async {
      final now = DateTime.now();

      // Fire 5 events spaced by 30ms (total duration 120ms, each interval < 60ms debounce)
      for (int i = 0; i < 5; i++) {
        eventController.add(RealtimeEvent(event: 'attendance:changed', data: {'seq': i}, timestamp: now));
        await Future.delayed(const Duration(milliseconds: 30));
        // Still within sliding window: no flush should have occurred yet
        verifyNever(() => mockAttendance.add(any()));
      }

      // Now stop emitting and allow debounce window (60ms + 40ms) to elapse
      await Future.delayed(const Duration(milliseconds: 90));

      // After the stream goes quiet, exactly 1 flush occurs
      verify(() => mockAttendance.add(const AttendanceStarted(isRefresh: true))).called(1);
      verify(() => mockOverview.add(const RefreshOverview())).called(1);
    });

    test('triggerFullRefresh clears pending debounce queue and immediately refreshes all BLoCs', () {
      // Add a debounced event
      eventController.add(RealtimeEvent(event: 'attendance:changed', data: null, timestamp: DateTime.now()));

      // Immediately trigger full refresh
      coordinator.triggerFullRefresh();

      // All 5 BLoCs must be called immediately
      verify(() => mockOverview.add(const RefreshOverview())).called(1);
      verify(() => mockAttendance.add(const AttendanceStarted(isRefresh: true))).called(1);
      verify(() => mockRequests.add(const RequestsLoadStarted(isRefresh: true))).called(1);
      verify(() => mockPayslip.add(const PayslipsRequested(isRefresh: true))).called(1);
      verify(() => mockAccount.add(const AccountProfileRequested(isRefresh: true))).called(1);
    });
  });

  group('STRESS HARNESS 2: Unrecognized Events & Malformed Payloads Resilience', () {
    late MockSecureStorageService mockStorage;
    late AppCookieManager cookieManager;
    late MockSocket mockSocket;
    late Map<String, Function> socketHandlers;
    late SocketServiceImpl socketService;

    setUp(() {
      mockStorage = MockSecureStorageService();
      when(() => mockStorage.getSid()).thenAnswer((_) async => 'sid_123');
      when(() => mockStorage.getRt()).thenAnswer((_) async => 'rt_123');
      cookieManager = AppCookieManager(mockStorage);
      mockSocket = MockSocket();
      socketHandlers = {};

      when(() => mockSocket.connected).thenReturn(true);
      when(() => mockSocket.on(any(), any())).thenAnswer((inv) {
        final event = inv.positionalArguments[0] as String;
        final handler = inv.positionalArguments[1] as Function;
        socketHandlers[event] = handler;
        return () {};
      });
      when(() => mockSocket.connect()).thenAnswer((_) => mockSocket);
      when(() => mockSocket.disconnect()).thenAnswer((_) => mockSocket);
      when(() => mockSocket.dispose()).thenAnswer((_) {});

      socketService = SocketServiceImpl(
        cookieManager: cookieManager,
        baseUrlProvider: () => 'https://test.example.com',
        socketFactory: (uri, opts) => mockSocket,
      );
      socketService.connect();
    });

    tearDown(() {
      socketService.dispose();
    });

    test('handles extreme / corrupt data payloads across registered domain events without stream failure', () async {
      final receivedEvents = <RealtimeEvent>[];
      final receivedRevisions = <int>[];
      final sub1 = socketService.eventStream.listen(receivedEvents.add);
      final sub2 = socketService.revisionStream.listen(receivedRevisions.add);

      // Corrupt payload types: null, empty string, raw integer, deeply nested array, broken types
      final malformedPayloads = [
        null,
        '',
        12345,
        -999.99,
        true,
        false,
        <dynamic>[],
        [1, 2, 'corrupt', {'nested': null}],
        {'invalid_key': null, 'deep': {'level2': [false, null]}},
        double.nan,
        double.infinity,
      ];

      for (final payload in malformedPayloads) {
        socketHandlers['attendance:changed']?.call(payload);
        socketHandlers['request:decided']?.call(payload);
        socketHandlers['leave:changed']?.call(payload);
        socketHandlers['payslip:released']?.call(payload);
      }

      await Future.delayed(const Duration(milliseconds: 20));

      // 11 payloads * 4 domain events = 44 events successfully piped into eventStream
      expect(receivedEvents.length, 44);
      expect(receivedRevisions.length, 44);
      expect(receivedRevisions.last, 44);

      await sub1.cancel();
      await sub2.cancel();
    });

    test('coordinator ignores unknown event strings without crashing or dispatching invalid refreshes', () async {
      final mockOverview = MockOverviewBloc();
      final mockAttendance = MockAttendanceBloc();
      final mockRequests = MockRequestsBloc();
      final mockPayslip = MockPayslipBloc();
      final mockAccount = MockAccountBloc();

      final coordinator = RealtimeSyncCoordinator(
        socketService: socketService,
        overviewBloc: mockOverview,
        attendanceBloc: mockAttendance,
        requestsBloc: mockRequests,
        payslipBloc: mockPayslip,
        accountBloc: mockAccount,
        debounceDuration: const Duration(milliseconds: 40),
      );

      // Send connection lifecycle noise
      socketHandlers['connect']?.call(null);
      socketHandlers['disconnect']?.call('transport close');
      socketHandlers['connect_error']?.call('timeout');

      await Future.delayed(const Duration(milliseconds: 60));

      // Connection noise must not trigger any BLoC calls
      verifyNever(() => mockOverview.add(any()));
      verifyNever(() => mockAttendance.add(any()));
      verifyNever(() => mockRequests.add(any()));
      verifyNever(() => mockPayslip.add(any()));
      verifyNever(() => mockAccount.add(any()));

      coordinator.dispose();
    });
  });

  group('STRESS HARNESS 3: Rapid Disconnect / Reconnect & Lifecycle Throttling', () {
    late MockSecureStorageService mockStorage;
    late AppCookieManager cookieManager;
    late MockSocket mockSocket;
    late Map<String, Function> socketHandlers;
    late SocketServiceImpl socketService;
    bool isConnected = false;

    setUp(() {
      mockStorage = MockSecureStorageService();
      when(() => mockStorage.getSid()).thenAnswer((_) async => 'sid_123');
      when(() => mockStorage.getRt()).thenAnswer((_) async => 'rt_123');
      cookieManager = AppCookieManager(mockStorage);
      mockSocket = MockSocket();
      socketHandlers = {};
      isConnected = false;

      when(() => mockSocket.connected).thenAnswer((_) => isConnected);
      when(() => mockSocket.on(any(), any())).thenAnswer((inv) {
        final event = inv.positionalArguments[0] as String;
        final handler = inv.positionalArguments[1] as Function;
        socketHandlers[event] = handler;
        return () {};
      });
      when(() => mockSocket.connect()).thenAnswer((_) {
        isConnected = true;
        socketHandlers['connect']?.call(null);
        return mockSocket;
      });
      when(() => mockSocket.disconnect()).thenAnswer((_) {
        isConnected = false;
        socketHandlers['disconnect']?.call('client disconnect');
        return mockSocket;
      });
      when(() => mockSocket.dispose()).thenAnswer((_) {});

      socketService = SocketServiceImpl(
        cookieManager: cookieManager,
        baseUrlProvider: () => 'https://test.example.com',
        socketFactory: (uri, opts) => mockSocket,
      );
    });

    tearDown(() {
      socketService.dispose();
    });

    test('survives 50 rapid alternating connect/disconnect cycles without leaking or throwing', () async {
      for (int i = 0; i < 50; i++) {
        socketService.connect(forceRecreate: true);
        expect(socketService.isConnected, isTrue);
        socketService.disconnect();
        expect(socketService.isConnected, isFalse);
      }

      // Reconnect one last time and ensure events still flow smoothly
      socketService.connect(forceRecreate: true);
      expect(socketService.isConnected, isTrue);

      final events = <RealtimeEvent>[];
      final sub = socketService.eventStream.listen(events.add);

      socketHandlers['attendance:changed']?.call({'ok': true});
      await Future.delayed(const Duration(milliseconds: 10));

      expect(events.length, 1);
      expect(events.first.event, 'attendance:changed');

      await sub.cancel();
    });

    test('AppLifecycleCoordinator absorbs rapid flurry of 20 resume calls via 5-second throttle', () {
      int resumeCallbackCount = 0;
      var currentTime = DateTime(2026, 11, 4, 10, 0, 0);

      final coordinator = AppLifecycleCoordinator(
        socketService: socketService,
        resumeThreshold: const Duration(seconds: 15),
        throttleInterval: const Duration(seconds: 5),
        onForegroundResume: () => resumeCallbackCount++,
        clock: () => currentTime,
        autoStart: false,
      );

      // App is paused for 30 seconds (> 15s threshold)
      coordinator.handlePause(currentTime);
      currentTime = currentTime.add(const Duration(seconds: 30));

      // Flurry of 20 rapid resume calls within 200ms
      for (int i = 0; i < 20; i++) {
        coordinator.handleResume(currentTime);
      }

      // Exactly 1 resume callback fired, remaining 19 suppressed by throttleInterval
      expect(resumeCallbackCount, 1);

      // Try again 3 seconds later (< 5s throttle)
      currentTime = currentTime.add(const Duration(seconds: 3));
      coordinator.handleResume(currentTime);
      expect(resumeCallbackCount, 1);

      // Try again after 6 seconds (> 5s throttle)
      currentTime = currentTime.add(const Duration(seconds: 6));
      coordinator.handleResume(currentTime);
      expect(resumeCallbackCount, 2);

      coordinator.dispose();
    });

    test('reconnects socket and triggers resume immediately if socket was dropped during background', () {
      int resumeCallbackCount = 0;
      var currentTime = DateTime(2026, 11, 4, 10, 0, 0);

      // Socket is explicitly DISCONNECTED
      isConnected = false;

      final coordinator = AppLifecycleCoordinator(
        socketService: socketService,
        resumeThreshold: const Duration(seconds: 15),
        throttleInterval: const Duration(seconds: 5),
        onForegroundResume: () => resumeCallbackCount++,
        clock: () => currentTime,
        autoStart: false,
      );

      // Background duration is only 2 seconds (< 15s threshold, e.g. quick camera punch)
      coordinator.handlePause(currentTime);
      currentTime = currentTime.add(const Duration(seconds: 2));
      coordinator.handleResume(currentTime);

      // Disconnected socket MUST override 15s threshold and immediately reconnect + trigger callback
      expect(resumeCallbackCount, 1);
      expect(socketService.isConnected, isTrue);

      coordinator.dispose();
    });
  });
}
