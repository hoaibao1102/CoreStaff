import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import '../models/auth_user.dart';
import '../services/realtime.dart';
import '../widgets/bottom_tab_bar.dart';
import '../widgets/buttons.dart';
import 'account/account_tab.dart';
import 'attendance/attendance_tab.dart';
import 'hr/hr_contracts_screen.dart';
import 'hr/hr_employees_screen.dart';
import 'hr/hr_leaves_screen.dart';
import 'hr/hr_overview_screen.dart';
import 'manager/manager_approvals_screen.dart';
import 'manager/manager_team_screen.dart';
import 'overview/overview_tab.dart';
import 'payslips/payslips_screen.dart';
import 'requests/requests_tab.dart';

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

class _MainShellScreenState extends State<MainShellScreen> with WidgetsBindingObserver {
  BottomTabKey _activeTab = BottomTabKey.overview;
  int _revision = 0;
  int _pendingApprovals = 0;
  void Function()? _unsubscribe;

  bool get _isManager => widget.user.role == 'DEPARTMENT_MANAGER';
  bool get _isHr => widget.user.role == 'HR';
  // SYSTEM_ADMIN dùng cổng quản trị web, không có workspace trên mobile.
  bool get _isBlocked => widget.user.role == 'SYSTEM_ADMIN';

  void _bump() {
    if (mounted) setState(() => _revision++);
  }

  @override
  void initState() {
    super.initState();
    if (_isBlocked) return;
    WidgetsBinding.instance.addObserver(this);
    try {
      _unsubscribe = subscribeEmployeeRealtime((_) => _bump());
    } catch (_) {
      // Realtime là phần bổ trợ: lỗi kết nối không được chặn app.
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _bump();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _unsubscribe?.call();
    super.dispose();
  }

  /// Quản lý chỉ có 5 tab nên các đích của nhân viên được ánh xạ sang nơi tương ứng.
  void _navigate(BottomTabKey tab) {
    if (_isManager && tab == BottomTabKey.requests) tab = BottomTabKey.approvals;
    if (_isManager && tab == BottomTabKey.payslips) {
      setState(() => _activeTab = BottomTabKey.account);
      _openPayslips();
      return;
    }
    setState(() => _activeTab = tab);
  }

  void _openPayslips() {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => Scaffold(
        backgroundColor: AppColors.bgDefault,
        appBar: AppBar(
          backgroundColor: AppColors.bgDefault,
          elevation: 0,
          scrolledUnderElevation: 0,
          leading: IconButton(icon: const Icon(Icons.arrow_back, color: AppColors.primary), onPressed: () => Navigator.pop(context)),
        ),
        body: SafeArea(child: PayslipsScreen(realtimeRevision: _revision)),
      ),
    ));
  }

  Widget _blockedView() {
    const roleTitle = 'Quản trị hệ thống (System Admin)';
    return Scaffold(
      backgroundColor: AppColors.bgDefault,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.borderDanger, width: 1.5),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(Icons.desktop_windows_outlined, color: AppColors.dangerText),
                ),
                const SizedBox(height: 20),
                const Text('Cổng quản trị Web',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                const SizedBox(height: 8),
                Text('Tài khoản vai trò $roleTitle cần sử dụng cổng quản trị web.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 14, color: AppColors.textMuted, height: 1.4)),
                const SizedBox(height: 28),
                PrimaryButton(label: 'Đăng xuất', onPress: widget.onLogout),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// HR không có workspace cá nhân (không chấm công, không phiếu lương): chỉ dùng các màn quản trị nhẹ.
  Widget _hrScaffold() {
    final pages = <BottomTabKey, Widget>{
      BottomTabKey.overview: HrOverviewScreen(user: widget.user, onNavigateTab: _navigate, realtimeRevision: _revision),
      BottomTabKey.employees: HrEmployeesScreen(realtimeRevision: _revision),
      BottomTabKey.leaves: HrLeavesScreen(realtimeRevision: _revision),
      BottomTabKey.contracts: HrContractsScreen(realtimeRevision: _revision),
      BottomTabKey.account: AccountTab(user: widget.user, onChangePassword: widget.onChangePassword, onLogout: widget.onLogout),
    };
    return Scaffold(
      backgroundColor: AppColors.bgDefault,
      body: SafeArea(
        bottom: false,
        child: IndexedStack(
          index: hrTabs.indexWhere((t) => t.key == _activeTab).clamp(0, hrTabs.length - 1),
          children: hrTabs.map((t) => pages[t.key]!).toList(),
        ),
      ),
      bottomNavigationBar: AppBottomTabBar(activeTab: _activeTab, hr: true, onTabChanged: _navigate),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isBlocked) return _blockedView();

    if (_isHr) return _hrScaffold();
    final tabs = _isManager ? managerTabs : employeeTabs;
    final pages = <BottomTabKey, Widget>{
      BottomTabKey.overview: OverviewTab(
        user: widget.user,
        onNavigateTab: _navigate,
        realtimeRevision: _revision,
        pendingApprovals: _isManager ? _pendingApprovals : null,
      ),
      BottomTabKey.attendance: AttendanceTab(
        onBackToOverview: () => setState(() => _activeTab = BottomTabKey.overview),
        realtimeRevision: _revision,
      ),
      if (!_isManager) ...{
        BottomTabKey.requests: RequestsTab(
          onBackToOverview: () => setState(() => _activeTab = BottomTabKey.overview),
          realtimeRevision: _revision,
        ),
        BottomTabKey.payslips: PayslipsScreen(realtimeRevision: _revision),
      } else ...{
        BottomTabKey.approvals: ManagerApprovalsScreen(
          realtimeRevision: _revision,
          onCountChange: (n) {
            if (n == _pendingApprovals) return;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) setState(() => _pendingApprovals = n);
            });
          },
        ),
        BottomTabKey.team: ManagerTeamScreen(realtimeRevision: _revision),
      },
      BottomTabKey.account: AccountTab(
        user: widget.user,
        onChangePassword: widget.onChangePassword,
        onLogout: widget.onLogout,
        onOpenPayslips: _isManager ? _openPayslips : null,
      ),
    };

    return Scaffold(
      backgroundColor: AppColors.bgDefault,
      body: SafeArea(
        bottom: false,
        child: IndexedStack(
          index: tabs.indexWhere((t) => t.key == _activeTab).clamp(0, tabs.length - 1),
          children: tabs.map((t) => pages[t.key]!).toList(),
        ),
      ),
      bottomNavigationBar: AppBottomTabBar(
        activeTab: _activeTab,
        manager: _isManager,
        badges: {if (_isManager) BottomTabKey.approvals: _pendingApprovals},
        onTabChanged: _navigate,
      ),
    );
  }
}
