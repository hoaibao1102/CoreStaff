import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/services/lifecycle_listener.dart';
import '../../../../core/services/realtime_sync_coordinator.dart';
import '../../../../core/services/socket_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../account/presentation/bloc/account_bloc.dart';
import '../../../account/presentation/screens/account_screen.dart';
import '../../../attendance/presentation/bloc/attendance_bloc.dart';
import '../../../attendance/presentation/bloc/attendance_event.dart';
import '../../../attendance/presentation/bloc/punch_bloc.dart';
import '../../../attendance/presentation/screens/attendance_screen.dart';
import '../../../auth/data/models/auth_user_dto.dart';
import '../../../overview/presentation/bloc/overview_bloc.dart';
import '../../../overview/presentation/bloc/overview_event.dart';
import '../../../overview/presentation/screens/overview_screen.dart';
import '../../../payslip/presentation/bloc/payslip_bloc.dart';
import '../../../payslip/presentation/screens/payslips_screen.dart';
import '../../../requests/presentation/bloc/requests_bloc.dart';
import '../../../requests/presentation/bloc/requests_event.dart';
import '../../../requests/presentation/screens/requests_screen.dart';
import '../widgets/custom_bottom_nav_bar.dart';

class MainShellScreen extends StatefulWidget {
  final AuthUser user;
  final VoidCallback onChangePassword;
  final VoidCallback onLogout;

  const MainShellScreen({
    super.key,
    required this.user,
    required this.onChangePassword,
    required this.onLogout,
  });

  @override
  State<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends State<MainShellScreen> {
  ShellTab _activeTab = ShellTab.overview;

  @override
  void initState() {
    super.initState();
    _connectSocketIfEligible();
  }

  void _connectSocketIfEligible() {
    if (sl.isRegistered<SocketService>()) {
      final isBlockedRole =
          widget.user.role == 'HR' || widget.user.role == 'SYSTEM_ADMIN';
      if (!isBlockedRole) {
        sl<SocketService>().connect();
      }
    }
  }

  @override
  void dispose() {
    if (sl.isRegistered<SocketService>()) {
      sl<SocketService>().disconnect();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final providers = <BlocProvider>[
      BlocProvider<OverviewBloc>(
        create: (context) => sl<OverviewBloc>()..add(const LoadOverview()),
      ),
      BlocProvider<AttendanceBloc>(
        create: (context) =>
            sl<AttendanceBloc>()..add(const AttendanceStarted()),
      ),
    ];

    if (sl.isRegistered<RequestsBloc>()) {
      providers.add(
        BlocProvider<RequestsBloc>(
          create: (context) =>
              sl<RequestsBloc>()..add(const RequestsLoadStarted()),
        ),
      );
    }

    if (sl.isRegistered<PayslipBloc>()) {
      providers.add(
        BlocProvider<PayslipBloc>(
          create: (context) =>
              sl<PayslipBloc>()..add(const PayslipsRequested()),
        ),
      );
    }

    if (sl.isRegistered<AccountBloc>()) {
      providers.add(
        BlocProvider<AccountBloc>(
          create: (context) =>
              sl<AccountBloc>()..add(const AccountProfileRequested()),
        ),
      );
    }

    if (sl.isRegistered<PunchBloc>()) {
      providers.add(
        BlocProvider<PunchBloc>(
          create: (context) => sl<PunchBloc>(),
        ),
      );
    }

    return MultiBlocProvider(
      providers: providers,
      child: _ShellCoordinatorBridge(
        child: Scaffold(
          backgroundColor: AppColors.bgDefault,
          body: SafeArea(
            bottom: false,
            child: IndexedStack(
              index: _activeTab.index,
              children: [
                OverviewScreen(
                  user: widget.user,
                  onNavigate: (tab) => setState(() => _activeTab = tab),
                ),
                const RequestsScreen(),
                const AttendanceScreen(),
                const PayslipsScreen(),
                AccountScreen(
                  user: widget.user,
                  onChangePassword: widget.onChangePassword,
                  onOpenPayslips: () =>
                      setState(() => _activeTab = ShellTab.payslips),
                  onLogout: widget.onLogout,
                ),
              ],
            ),
          ),
          bottomNavigationBar: CustomBottomNavBar(
            activeTab: _activeTab,
            onTabSelected: (tab) => setState(() => _activeTab = tab),
          ),
        ),
      ),
    );
  }
}

class _ShellCoordinatorBridge extends StatefulWidget {
  final Widget child;

  const _ShellCoordinatorBridge({required this.child});

  @override
  State<_ShellCoordinatorBridge> createState() =>
      _ShellCoordinatorBridgeState();
}

class _ShellCoordinatorBridgeState extends State<_ShellCoordinatorBridge> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _wireCoordinators();
    });
  }

  void _wireCoordinators() {
    if (!mounted) return;

    if (sl.isRegistered<RealtimeSyncCoordinator>()) {
      final coordinator = sl<RealtimeSyncCoordinator>();
      OverviewBloc? overview;
      AttendanceBloc? attendance;
      RequestsBloc? requests;
      PayslipBloc? payslip;
      AccountBloc? account;

      try {
        overview = context.read<OverviewBloc>();
      } catch (_) {}
      try {
        attendance = context.read<AttendanceBloc>();
      } catch (_) {}
      try {
        requests = context.read<RequestsBloc>();
      } catch (_) {}
      try {
        payslip = context.read<PayslipBloc>();
      } catch (_) {}
      try {
        account = context.read<AccountBloc>();
      } catch (_) {}

      coordinator.attachBlocs(
        overviewBloc: overview,
        attendanceBloc: attendance,
        requestsBloc: requests,
        payslipBloc: payslip,
        accountBloc: account,
      );

      if (sl.isRegistered<AppLifecycleCoordinator>()) {
        final lifecycle = sl<AppLifecycleCoordinator>();
        lifecycle.attachResumeCallback(() {
          coordinator.triggerFullRefresh();
        });
      }
    }
  }

  @override
  void dispose() {
    if (sl.isRegistered<RealtimeSyncCoordinator>()) {
      sl<RealtimeSyncCoordinator>().detachBlocs();
    }
    if (sl.isRegistered<AppLifecycleCoordinator>()) {
      sl<AppLifecycleCoordinator>().detachResumeCallback();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
