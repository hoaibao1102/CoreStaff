import 'dart:async';
import '../../features/account/presentation/bloc/account_bloc.dart';
import '../../features/attendance/presentation/bloc/attendance_bloc.dart';
import '../../features/attendance/presentation/bloc/attendance_event.dart';
import '../../features/overview/presentation/bloc/overview_bloc.dart';
import '../../features/overview/presentation/bloc/overview_event.dart';
import '../../features/payslip/presentation/bloc/payslip_bloc.dart';
import '../../features/requests/presentation/bloc/requests_bloc.dart';
import '../../features/requests/presentation/bloc/requests_event.dart';
import 'socket_service.dart';

class RealtimeSyncCoordinator {
  final SocketService socketService;
  final Duration debounceDuration;

  OverviewBloc? overviewBloc;
  AttendanceBloc? attendanceBloc;
  RequestsBloc? requestsBloc;
  PayslipBloc? payslipBloc;
  AccountBloc? accountBloc;

  StreamSubscription<RealtimeEvent>? _subscription;
  final Set<String> _bufferedEvents = <String>{};
  Timer? _debounceTimer;

  RealtimeSyncCoordinator({
    required this.socketService,
    this.overviewBloc,
    this.attendanceBloc,
    this.requestsBloc,
    this.payslipBloc,
    this.accountBloc,
    this.debounceDuration = const Duration(milliseconds: 300),
  }) {
    _subscription = socketService.eventStream.listen(_handleRealtimeEvent);
  }

  void attachBlocs({
    OverviewBloc? overviewBloc,
    AttendanceBloc? attendanceBloc,
    RequestsBloc? requestsBloc,
    PayslipBloc? payslipBloc,
    AccountBloc? accountBloc,
  }) {
    if (overviewBloc != null) this.overviewBloc = overviewBloc;
    if (attendanceBloc != null) this.attendanceBloc = attendanceBloc;
    if (requestsBloc != null) this.requestsBloc = requestsBloc;
    if (payslipBloc != null) this.payslipBloc = payslipBloc;
    if (accountBloc != null) this.accountBloc = accountBloc;
  }

  void detachBlocs() {
    overviewBloc = null;
    attendanceBloc = null;
    requestsBloc = null;
    payslipBloc = null;
    accountBloc = null;
  }

  void _handleRealtimeEvent(RealtimeEvent event) {
    if (event.event == 'connect' ||
        event.event == 'disconnect' ||
        event.event == 'connect_error') {
      return;
    }

    _bufferedEvents.add(event.event);

    _debounceTimer?.cancel();
    _debounceTimer = Timer(debounceDuration, _flush);
  }

  void _flush() {
    if (_bufferedEvents.isEmpty) return;

    final events = Set<String>.from(_bufferedEvents);
    _bufferedEvents.clear();

    if (events.contains('attendance:changed')) {
      attendanceBloc?.add(const AttendanceStarted(isRefresh: true));
    }

    if (events.contains('request:decided') ||
        events.contains('leave:changed') ||
        events.contains('request:new') ||
        events.contains('leave:new')) {
      requestsBloc?.add(const RequestsLoadStarted(isRefresh: true));
    }

    if (events.contains('payslip:released')) {
      payslipBloc?.add(const PayslipsRequested(isRefresh: true));
    }

    // Any domain event invalidates dashboard overview
    overviewBloc?.add(const RefreshOverview());
  }

  /// Triggers an immediate, full silent refresh across all active BLoCs.
  /// Typically called during app foreground resumption or on-demand sync.
  void triggerFullRefresh({bool force = false}) {
    _debounceTimer?.cancel();
    _bufferedEvents.clear();

    overviewBloc?.add(const RefreshOverview());
    attendanceBloc?.add(const AttendanceStarted(isRefresh: true));
    requestsBloc?.add(const RequestsLoadStarted(isRefresh: true));
    payslipBloc?.add(const PayslipsRequested(isRefresh: true));
    accountBloc?.add(const AccountProfileRequested(isRefresh: true));
  }

  void dispose() {
    _debounceTimer?.cancel();
    _debounceTimer = null;
    _subscription?.cancel();
    _subscription = null;
    _bufferedEvents.clear();
    detachBlocs();
  }
}
