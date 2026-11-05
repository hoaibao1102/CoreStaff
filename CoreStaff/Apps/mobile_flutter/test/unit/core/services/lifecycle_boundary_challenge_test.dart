import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/services/lifecycle_listener.dart';
import 'package:corestaff_mobile/core/services/socket_service.dart';

class MockSocketService extends Mock implements SocketService {}

void main() {
  late MockSocketService mockSocket;
  late DateTime fakeNow;

  setUp(() {
    mockSocket = MockSocketService();
    fakeNow = DateTime(2026, 11, 5, 10, 0, 0);
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

  group('Empirical Challenge: Reset _pausedAt = null and Subsequent Brief Backgroundings', () {
    test('Resetting _pausedAt = null upon resume does NOT cause subsequent brief backgroundings (< 15s) to prematurely refresh', () {
      int resumeCount = 0;
      final coordinator = createCoordinator(
        onForegroundResume: () => resumeCount++,
        isConnected: true,
      );

      // 1. Initial pause at 10:00:00
      coordinator.handlePause(fakeNow);
      expect(coordinator.pausedAt, equals(fakeNow));

      // 2. Initial resume at 10:00:20 (20s elapsed >= 15s threshold)
      fakeNow = fakeNow.add(const Duration(seconds: 20));
      coordinator.handleResume(fakeNow);

      expect(resumeCount, equals(1), reason: 'First resume after 20s must trigger refresh');
      expect(coordinator.pausedAt, isNull, reason: '_pausedAt must be reset to null upon refresh');
      expect(coordinator.lastResumeRefreshAt, equals(fakeNow));

      // 3. User uses app for 10 seconds, then app is backgrounded (e.g. camera selfie) at 10:00:30
      fakeNow = fakeNow.add(const Duration(seconds: 10)); // 10:00:30
      coordinator.handlePause(fakeNow);
      expect(coordinator.pausedAt, equals(fakeNow), reason: '_pausedAt must be updated to new pause timestamp');

      // 4. Brief backgrounding 1: resumes after 5 seconds at 10:00:35 (< 15s threshold)
      // Note: 15s since lastResumeRefreshAt (10:00:20), so throttle (5s) does NOT block.
      fakeNow = fakeNow.add(const Duration(seconds: 5)); // 10:00:35
      coordinator.handleResume(fakeNow);

      expect(resumeCount, equals(1), reason: '5s pause (< 15s) must NOT trigger premature refresh');
      expect(coordinator.pausedAt, isNotNull, reason: '_pausedAt must NOT be cleared when threshold is not exceeded');

      // 5. Still in same background session or another resume attempt at 10:00:44 (14s elapsed since pause < 15s)
      fakeNow = fakeNow.add(const Duration(seconds: 9)); // 10:00:44 (total 14s since 10:00:30 pause)
      coordinator.handleResume(fakeNow);

      expect(resumeCount, equals(1), reason: '14s pause (< 15s) must NOT trigger premature refresh');

      // 6. At 10:00:45 (exactly 15s elapsed since 10:00:30 pause)
      fakeNow = fakeNow.add(const Duration(seconds: 1)); // 10:00:45 (total 15s since 10:00:30 pause)
      coordinator.handleResume(fakeNow);

      expect(resumeCount, equals(2), reason: '15s pause satisfies threshold and triggers refresh');
      expect(coordinator.pausedAt, isNull, reason: '_pausedAt must be reset to null again upon refresh');

      coordinator.dispose();
    });

    test('Stress test: 50 consecutive brief pauses (< 15s) after a refresh produce ZERO premature refreshes', () {
      int resumeCount = 0;
      final coordinator = createCoordinator(
        onForegroundResume: () => resumeCount++,
        isConnected: true,
      );

      // Initial long pause of 30s triggers first refresh
      coordinator.handlePause(fakeNow);
      fakeNow = fakeNow.add(const Duration(seconds: 30));
      coordinator.handleResume(fakeNow);
      expect(resumeCount, equals(1));
      expect(coordinator.pausedAt, isNull);

      // Now run 50 consecutive brief backgroundings (durations between 1 and 14 seconds)
      // with active foreground intervals of 6 seconds (ensuring throttle does not mask threshold logic)
      for (int i = 1; i <= 50; i++) {
        // App is active in foreground for 6s (passes 5s throttle window)
        fakeNow = fakeNow.add(const Duration(seconds: 6));

        // Backgrounded
        final pauseTime = fakeNow;
        coordinator.handlePause(pauseTime);
        expect(coordinator.pausedAt, equals(pauseTime), reason: 'Cycle $i: _pausedAt set to pause timestamp');

        // Resume after (i % 14) + 1 seconds (1s to 14s, always < 15s)
        final durationSeconds = (i % 14) + 1;
        fakeNow = fakeNow.add(Duration(seconds: durationSeconds));
        coordinator.handleResume(fakeNow);

        expect(resumeCount, equals(1),
          reason: 'Cycle $i: pause duration of ${durationSeconds}s must NOT trigger premature refresh');
      }

      // Finally, an authentic 15s backgrounding DOES trigger refresh #2
      fakeNow = fakeNow.add(const Duration(seconds: 6));
      coordinator.handlePause(fakeNow);
      fakeNow = fakeNow.add(const Duration(seconds: 15));
      coordinator.handleResume(fakeNow);

      expect(resumeCount, equals(2), reason: 'Legitimate 15s pause must trigger refresh');
      expect(coordinator.pausedAt, isNull);

      coordinator.dispose();
    });
  });

  group('Empirical Challenge: Non-Paused Focus Toggles & Null State Boundaries', () {
    test('Non-paused focus toggles within 5s throttle window are strictly blocked', () {
      int resumeCount = 0;
      final coordinator = createCoordinator(
        onForegroundResume: () => resumeCount++,
        isConnected: true,
      );

      // Initial resume with _pausedAt = null
      coordinator.handleResume(fakeNow);
      expect(resumeCount, equals(1), reason: 'Initial resume triggers first sync');
      expect(coordinator.pausedAt, isNull);

      // Focus toggles within 5s throttle window (pause is NEVER invoked, _pausedAt remains null)
      fakeNow = fakeNow.add(const Duration(milliseconds: 500));
      coordinator.handleResume(fakeNow);
      expect(resumeCount, equals(1), reason: '500ms focus bounce throttled');

      fakeNow = fakeNow.add(const Duration(milliseconds: 2000));
      coordinator.handleResume(fakeNow);
      expect(resumeCount, equals(1), reason: '2500ms focus bounce throttled');

      fakeNow = fakeNow.add(const Duration(milliseconds: 2499)); // 4999ms total
      coordinator.handleResume(fakeNow);
      expect(resumeCount, equals(1), reason: '4999ms focus bounce throttled');

      // Exactly at 5000ms, throttle window expires
      fakeNow = fakeNow.add(const Duration(milliseconds: 1)); // 5000ms total
      coordinator.handleResume(fakeNow);
      expect(resumeCount, equals(2), reason: 'At 5000ms, throttle permits resume');

      coordinator.dispose();
    });

    test('Disconnected socket forces immediate resume & reconnect even during brief 1s pause', () {
      int resumeCount = 0;
      bool connected = false;
      when(() => mockSocket.isConnected).thenAnswer((_) => connected);
      when(() => mockSocket.connect()).thenAnswer((_) {
        connected = true;
      });

      final coordinator = AppLifecycleCoordinator(
        socketService: mockSocket,
        resumeThreshold: const Duration(seconds: 15),
        throttleInterval: const Duration(seconds: 5),
        onForegroundResume: () => resumeCount++,
        clock: () => fakeNow,
        autoStart: false,
      );

      // 1s pause with disconnected socket
      coordinator.handlePause(fakeNow);
      fakeNow = fakeNow.add(const Duration(seconds: 1));
      coordinator.handleResume(fakeNow);

      expect(resumeCount, equals(1));
      expect(connected, isTrue);
      expect(coordinator.pausedAt, isNull);
      verify(() => mockSocket.connect()).called(1);

      coordinator.dispose();
    });

    test('Disposed coordinator does not fire callbacks on subsequent pause or resume', () {
      int resumeCount = 0;
      final coordinator = createCoordinator(
        onForegroundResume: () => resumeCount++,
      );

      coordinator.dispose();

      coordinator.handlePause(fakeNow);
      fakeNow = fakeNow.add(const Duration(seconds: 60));
      coordinator.handleResume(fakeNow);

      expect(resumeCount, equals(0));
    });
  });
}
