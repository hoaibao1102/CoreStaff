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
    fakeNow = DateTime(2026, 11, 4, 12, 0, 0);
  });

  AppLifecycleCoordinator createCoordinator({
    required VoidCallback onForegroundResume,
    bool isConnected = true,
  }) {
    when(() => mockSocket.isConnected).thenReturn(isConnected);
    when(() => mockSocket.connect()).thenAnswer((_) {});

    return AppLifecycleCoordinator(
      socketService: mockSocket,
      resumeThreshold: const Duration(seconds: 15),
      throttleInterval: const Duration(seconds: 5),
      onForegroundResume: onForegroundResume,
      clock: () => fakeNow,
      autoStart: false,
    );
  }

  group('AppLifecycleCoordinator Threshold & Resumption Logic', () {
    test('does NOT trigger onForegroundResume when background duration < 15 seconds', () {
      int resumeCount = 0;
      final coordinator = createCoordinator(
        onForegroundResume: () => resumeCount++,
        isConnected: true,
      );

      // App pauses at 12:00:00
      coordinator.handlePause(fakeNow);

      // App resumes at 12:00:10 (10s elapsed, < 15s threshold)
      fakeNow = fakeNow.add(const Duration(seconds: 10));
      coordinator.handleResume(fakeNow);

      expect(resumeCount, 0);
      verifyNever(() => mockSocket.connect());

      coordinator.dispose();
    });

    test('triggers onForegroundResume when background duration >= 15 seconds', () {
      int resumeCount = 0;
      final coordinator = createCoordinator(
        onForegroundResume: () => resumeCount++,
        isConnected: true,
      );

      // App pauses at 12:00:00
      coordinator.handlePause(fakeNow);

      // App resumes at 12:00:16 (16s elapsed, >= 15s threshold)
      fakeNow = fakeNow.add(const Duration(seconds: 16));
      coordinator.handleResume(fakeNow);

      expect(resumeCount, 1);
      expect(coordinator.pausedAt, isNull);
      verifyNever(() => mockSocket.connect()); // socket was already connected

      coordinator.dispose();
    });

    test('reconnects socket and triggers resume immediately if socket was disconnected', () {
      int resumeCount = 0;
      final coordinator = createCoordinator(
        onForegroundResume: () => resumeCount++,
        isConnected: false, // disconnected by OS or network
      );

      // App pauses for only 3 seconds (e.g. quick selfie or notification toggle)
      coordinator.handlePause(fakeNow);
      fakeNow = fakeNow.add(const Duration(seconds: 3));
      coordinator.handleResume(fakeNow);

      // Disconnected socket overrides the 15s threshold
      expect(resumeCount, 1);
      verify(() => mockSocket.connect()).called(1);

      coordinator.dispose();
    });

    test('enforces 5-second throttle to prevent rapid double-resumes', () {
      int resumeCount = 0;
      final coordinator = createCoordinator(
        onForegroundResume: () => resumeCount++,
        isConnected: true,
      );

      // First pause & resume after 20s
      coordinator.handlePause(fakeNow);
      fakeNow = fakeNow.add(const Duration(seconds: 20));
      coordinator.handleResume(fakeNow);
      expect(resumeCount, 1);

      // Rapid secondary resume after 2 seconds (< 5s throttle)
      fakeNow = fakeNow.add(const Duration(seconds: 2));
      coordinator.handleResume(fakeNow);
      expect(resumeCount, 1); // ignored due to throttle

      // Resume after throttle period elapses (6s later)
      fakeNow = fakeNow.add(const Duration(seconds: 6));
      coordinator.handleResume(fakeNow);
      expect(resumeCount, 2); // processed

      coordinator.dispose();
    });

    test('dispose cleans up resume callback and resources', () {
      int resumeCount = 0;
      final coordinator = createCoordinator(
        onForegroundResume: () => resumeCount++,
        isConnected: false,
      );

      coordinator.dispose();

      coordinator.handleResume(fakeNow);
      expect(resumeCount, 0);
    });
  });
}
