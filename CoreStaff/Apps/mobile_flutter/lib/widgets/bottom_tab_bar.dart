import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';

enum BottomTabKey { overview, requests, attendance, payslips, account, approvals, team, employees, leaves, contracts }

class BottomTabItem {
  final BottomTabKey key;
  final String label;
  final IconData icon;
  final IconData activeIcon;
  final bool primary;

  const BottomTabItem(this.key, this.label, this.icon, this.activeIcon, {this.primary = false});
}

/// 5 tab (số lẻ): tab giữa là hành động cốt lõi — Chấm công — nổi lên trên thanh.
const employeeTabs = [
  BottomTabItem(BottomTabKey.overview, 'Tổng quan', Icons.home_outlined, Icons.home),
  BottomTabItem(BottomTabKey.requests, 'Đơn từ', Icons.description_outlined, Icons.description),
  BottomTabItem(BottomTabKey.attendance, 'Chấm công', Icons.fingerprint, Icons.fingerprint, primary: true),
  BottomTabItem(BottomTabKey.payslips, 'Phiếu lương', Icons.account_balance_wallet_outlined, Icons.account_balance_wallet),
  BottomTabItem(BottomTabKey.account, 'Tài khoản', Icons.person_outline, Icons.person),
];

/// Quản lý: Duyệt đơn và Phòng ban thay cho Đơn từ và Phiếu lương.
const managerTabs = [
  BottomTabItem(BottomTabKey.overview, 'Tổng quan', Icons.home_outlined, Icons.home),
  BottomTabItem(BottomTabKey.approvals, 'Duyệt đơn', Icons.done_all, Icons.done_all),
  BottomTabItem(BottomTabKey.attendance, 'Chấm công', Icons.fingerprint, Icons.fingerprint, primary: true),
  BottomTabItem(BottomTabKey.team, 'Phòng ban', Icons.people_outline, Icons.people),
  BottomTabItem(BottomTabKey.account, 'Tài khoản', Icons.person_outline, Icons.person),
];

/// HR: tab giữa là Nghỉ phép, việc HR phải xử lý thường xuyên nhất (áp dụng đơn).
const hrTabs = [
  BottomTabItem(BottomTabKey.overview, 'Tổng quan', Icons.dashboard_outlined, Icons.dashboard),
  BottomTabItem(BottomTabKey.employees, 'Nhân viên', Icons.groups_outlined, Icons.groups),
  BottomTabItem(BottomTabKey.leaves, 'Nghỉ phép', Icons.event_available_outlined, Icons.event_available, primary: true),
  BottomTabItem(BottomTabKey.contracts, 'Hợp đồng', Icons.description_outlined, Icons.description),
  BottomTabItem(BottomTabKey.account, 'Tài khoản', Icons.person_outline, Icons.person),
];

class AppBottomTabBar extends StatelessWidget {
  final BottomTabKey activeTab;
  final ValueChanged<BottomTabKey> onTabChanged;
  final bool manager;
  final bool hr;
  final Map<BottomTabKey, int> badges;

  const AppBottomTabBar({
    super.key,
    required this.activeTab,
    required this.onTabChanged,
    this.manager = false,
    this.hr = false,
    this.badges = const {},
  });

  @override
  Widget build(BuildContext context) {
    final tabs = hr ? hrTabs : (manager ? managerTabs : employeeTabs);
    const barHeight = 68.0;
    const lift = 26.0; // phần nút giữa nhô lên khỏi thanh
    return SizedBox(
      height: barHeight + lift + MediaQuery.of(context).padding.bottom,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
                border: const Border(top: BorderSide(color: AppColors.border, width: 1)),
                boxShadow: [BoxShadow(color: const Color(0xFF0F172A).withValues(alpha: 0.10), offset: const Offset(0, -6), blurRadius: 22)],
              ),
              child: SafeArea(
                top: false,
                child: SizedBox(
                  height: barHeight,
                  child: Row(children: tabs.map((t) => Expanded(child: t.primary ? _primarySlot(t) : _tab(t))).toList()),
                ),
              ),
            ),
          ),
          // Nút giữa đứng độc lập phía trên thanh để bắt chạm chính xác.
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            child: Row(
              children: tabs.map((t) => Expanded(child: t.primary ? _primaryButton(t) : const SizedBox.shrink())).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _primarySlot(BottomTabItem tab) {
    final selected = tab.key == activeTab;
    return InkWell(
      onTap: () => onTabChanged(tab.key),
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 9),
          child: Text(tab.label,
              maxLines: 1,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: selected ? AppColors.primaryDark : AppColors.textSecondary)),
        ),
      ),
    );
  }

  Widget _primaryButton(BottomTabItem tab) {
    final selected = tab.key == activeTab;
    final badge = badges[tab.key] ?? 0;
    return Center(
      child: GestureDetector(
        onTap: () => onTabChanged(tab.key),
        child: Stack(clipBehavior: Clip.none, children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 66,
            height: 66,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: selected ? const [Color(0xFF3B82F6), Color(0xFF1D4ED8)] : const [Color(0xFF60A5FA), Color(0xFF2563EB)],
              ),
              border: Border.all(color: Colors.white, width: 5),
              boxShadow: [
                BoxShadow(color: AppColors.primary.withValues(alpha: selected ? 0.55 : 0.38), blurRadius: selected ? 22 : 16, offset: const Offset(0, 8)),
              ],
            ),
            alignment: Alignment.center,
            child: Icon(tab.activeIcon, size: 32, color: Colors.white),
          ),
          if (badge > 0)
            Positioned(
              right: -2,
              top: -2,
              child: Container(
                constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
                padding: const EdgeInsets.symmetric(horizontal: 5),
                decoration: BoxDecoration(color: AppColors.dangerText, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white, width: 2)),
                alignment: Alignment.center,
                child: Text(badge > 99 ? '99+' : '$badge', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
              ),
            ),
        ]),
      ),
    );
  }

  Widget _tab(BottomTabItem tab) {
    final selected = tab.key == activeTab;
    final badge = badges[tab.key] ?? 0;
    final color = selected ? AppColors.primaryDark : AppColors.textMuted;
    return InkWell(
      onTap: () => onTabChanged(tab.key),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Stack(clipBehavior: Clip.none, children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 44,
              height: 28,
              decoration: BoxDecoration(color: selected ? AppColors.primarySoft : Colors.transparent, borderRadius: BorderRadius.circular(14)),
              alignment: Alignment.center,
              child: Icon(selected ? tab.activeIcon : tab.icon, size: 22, color: color),
            ),
            if (badge > 0)
              Positioned(
                right: 0,
                top: -4,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(color: AppColors.dangerText, borderRadius: BorderRadius.circular(8)),
                  alignment: Alignment.center,
                  child: Text(badge > 99 ? '99+' : '$badge', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                ),
              ),
          ]),
          const SizedBox(height: 3),
          Text(tab.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10.5, fontWeight: selected ? FontWeight.w800 : FontWeight.w700, color: color)),
        ],
      ),
    );
  }
}
