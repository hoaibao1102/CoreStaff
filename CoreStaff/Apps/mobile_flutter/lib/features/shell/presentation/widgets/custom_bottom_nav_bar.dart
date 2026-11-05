import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

enum ShellTab { overview, requests, attendance, payslips, account }

class CustomBottomNavBar extends StatelessWidget {
  final ShellTab activeTab;
  final ValueChanged<ShellTab> onTabSelected;

  const CustomBottomNavBar({
    super.key,
    required this.activeTab,
    required this.onTabSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        border: const Border(
          top: BorderSide(color: AppColors.border, width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            offset: const Offset(0, -4),
            blurRadius: 14,
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              _buildStandardTab(
                tab: ShellTab.overview,
                label: 'Tổng quan',
                icon: Icons.home_outlined,
                activeIcon: Icons.home_rounded,
              ),
              _buildStandardTab(
                tab: ShellTab.requests,
                label: 'Đơn từ',
                icon: Icons.description_outlined,
                activeIcon: Icons.description_rounded,
              ),
              _buildAttendancePrimaryTab(),
              _buildStandardTab(
                tab: ShellTab.payslips,
                label: 'Phiếu lương',
                icon: Icons.account_balance_wallet_outlined,
                activeIcon: Icons.account_balance_wallet_rounded,
              ),
              _buildStandardTab(
                tab: ShellTab.account,
                label: 'Tài khoản',
                icon: Icons.person_outline_rounded,
                activeIcon: Icons.person_rounded,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStandardTab({
    required ShellTab tab,
    required String label,
    required IconData icon,
    required IconData activeIcon,
  }) {
    final isActive = activeTab == tab;

    return Expanded(
      child: InkWell(
        onTap: () => onTabSelected(tab),
        splashColor: AppColors.primarySoft,
        highlightColor: Colors.transparent,
        child: SizedBox(
          height: 52,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 36,
                height: 28,
                decoration: BoxDecoration(
                  color: isActive ? AppColors.primarySoft : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  isActive ? activeIcon : icon,
                  size: 22,
                  color: isActive ? AppColors.primary : AppColors.textMuted,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.caption.copyWith(
                  color: isActive ? AppColors.primary : AppColors.textMuted,
                  fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAttendancePrimaryTab() {
    final isActive = activeTab == ShellTab.attendance;

    return Expanded(
      child: GestureDetector(
        onTap: () => onTabSelected(ShellTab.attendance),
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          height: 60,
          child: OverflowBox(
            maxHeight: 80,
            alignment: Alignment.topCenter,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.start,
            children: [
              Transform.translate(
                offset: const Offset(0, -16),
                child: Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: AppColors.bgDark,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.bgSurface, width: 4),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.bgDark.withValues(alpha: 0.3),
                        offset: const Offset(0, 4),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.fingerprint_rounded,
                      color: Colors.white,
                      size: 28,
                    ),
                  ),
                ),
              ),
              Transform.translate(
                offset: const Offset(0, -12),
                child: Text(
                  'Chấm công',
                  maxLines: 1,
                  style: AppTypography.caption.copyWith(
                    color: isActive ? AppColors.bgDark : AppColors.textSecondary,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
        ),
        ),
      ),
    );
  }
}
