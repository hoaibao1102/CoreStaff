import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import '../models/auth_user.dart';
import '../widgets/bottom_tab_bar.dart';
import '../widgets/buttons.dart';
import 'account/account_tab.dart';
import 'attendance/attendance_tab.dart';
import 'overview/overview_tab.dart';
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

class _MainShellScreenState extends State<MainShellScreen> {
  BottomTabKey _activeTab = BottomTabKey.overview;

  @override
  Widget build(BuildContext context) {
    // Only block HR and SYSTEM_ADMIN; allow EMPLOYEE and DEPARTMENT_MANAGER
    final isBlockedRole = widget.user.role == 'HR' || widget.user.role == 'SYSTEM_ADMIN';
    if (isBlockedRole) {
      final roleTitle = widget.user.role == 'HR' ? 'Nhân sự (HR)' : 'Quản trị hệ thống (System Admin)';
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
                    child: const Text(
                      '!',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w900,
                        color: AppColors.dangerText,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Cổng quản trị Web',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Tài khoản vai trò $roleTitle cần sử dụng cổng quản trị web.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textMuted,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 28),
                  PrimaryButton(
                    label: 'Đăng xuất',
                    onPress: widget.onLogout,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.bgDefault,
      body: SafeArea(
        bottom: false,
        child: IndexedStack(
          index: _activeTab.index,
          children: [
            OverviewTab(
              user: widget.user,
              onNavigateTab: (tab) => setState(() => _activeTab = tab),
            ),
            AttendanceTab(
              onBackToOverview: () => setState(() => _activeTab = BottomTabKey.overview),
            ),
            RequestsTab(
              onBackToOverview: () => setState(() => _activeTab = BottomTabKey.overview),
            ),
            AccountTab(
              user: widget.user,
              onChangePassword: widget.onChangePassword,
              onLogout: widget.onLogout,
            ),
          ],
        ),
      ),
      bottomNavigationBar: AppBottomTabBar(
        activeTab: _activeTab,
        onTabChanged: (tab) => setState(() => _activeTab = tab),
      ),
    );
  }
}
