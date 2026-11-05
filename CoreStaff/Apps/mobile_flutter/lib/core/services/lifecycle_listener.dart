import 'package:flutter/widgets.dart';
import 'socket_service.dart';

class AppLifecycleCoordinator {
  final SocketService socketService;
  final Duration resumeThreshold;
  final Duration throttleInterval;
  VoidCallback? onForegroundResume;
  final DateTime Function() clock;

  AppLifecycleListener? _listener;
  DateTime? _pausedAt;
  DateTime? _lastResumeRefreshAt;

  AppLifecycleCoordinator({
    required this.socketService,
    this.resumeThreshold = const Duration(seconds: 15),
    this.throttleInterval = const Duration(seconds: 5),
    this.onForegroundResume,
    this.clock = DateTime.now,
    bool autoStart = true,
  }) {
    if (autoStart) {
      start();
    }
  }

  DateTime? get pausedAt => _pausedAt;
  DateTime? get lastResumeRefreshAt => _lastResumeRefreshAt;

  void attachResumeCallback(VoidCallback callback) {
    onForegroundResume = callback;
  }

  void detachResumeCallback() {
    onForegroundResume = null;
  }

  void start() {
    if (_listener != null) return;
    try {
      _listener = AppLifecycleListener(
        onPause: handlePause,
        onResume: handleResume,
      );
    } catch (_) {
      // In non-widget unit test environments, binding might not be bound.
    }
  }

  void handlePause([DateTime? now]) {
    _pausedAt = now ?? clock();
  }

  void handleResume([DateTime? now]) {
    final current = now ?? clock();

    // Throttle check (5-second throttle to prevent rapid double-resumes)
    if (_lastResumeRefreshAt != null &&
        current.difference(_lastResumeRefreshAt!) < throttleInterval) {
      return;
    }

    final bool socketWasDisconnected = !socketService.isConnected;
    final bool exceededThreshold = _pausedAt == null ||
        current.difference(_pausedAt!) >= resumeThreshold;

    if (socketWasDisconnected || exceededThreshold) {
      _lastResumeRefreshAt = current;
      _pausedAt = null;
      if (socketWasDisconnected) {
        socketService.connect();
      }
      onForegroundResume?.call();
    }
  }

  void dispose() {
    _listener?.dispose();
    _listener = null;
    detachResumeCallback();
  }
}
