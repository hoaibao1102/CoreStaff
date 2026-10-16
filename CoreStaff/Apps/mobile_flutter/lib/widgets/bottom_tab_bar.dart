import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';

enum BottomTabKey { overview, attendance, requests, account }

class BottomTabItem {
  final BottomTabKey key;
  final String label;
  final String iconChar;

  const BottomTabItem({
    required this.key,
    required this.label,
    required this.iconChar,
  });
}

class AppBottomTabBar extends StatelessWidget {
  final BottomTabKey activeTab;
  final ValueChanged<BottomTabKey> onTabChanged;

  const AppBottomTabBar({
    super.key,
    required this.activeTab,
    required this.onTabChanged,
  });

  static const List<BottomTabItem> tabs = [
    BottomTabItem(
      key: BottomTabKey.overview,
      label: 'Tổng quan',
      iconChar: '⌂',
    ),
    BottomTabItem(
      key: BottomTabKey.attendance,
      label: 'Chấm công',
      iconChar: '◷',
    ),
    BottomTabItem(
      key: BottomTabKey.requests,
      label: 'Đơn từ',
      iconChar: '▤',
    ),
    BottomTabItem(
      key: BottomTabKey.account,
      label: 'Tài khoản',
      iconChar: '○',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(
          top: BorderSide(color: AppColors.border, width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.06),
            offset: const Offset(0, -4),
            blurRadius: 14,
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 68,
          child: Padding(
            padding: const EdgeInsets.only(top: 7, bottom: 5, left: 8, right: 8),
            child: Row(
              children: tabs.map((tab) {
                final isSelected = tab.key == activeTab;
                return Expanded(
                  child: InkWell(
                    onTap: () => onTabChanged(tab.key),
                    borderRadius: BorderRadius.circular(12),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 32,
                          height: 25,
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFFDBEAFE) : Colors.transparent,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            tab.iconChar,
                            style: TextStyle(
                              color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF64748B),
                              fontSize: 18,
                              height: 1.0,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          tab.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 10,
                            height: 1.4,
                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w700,
                            color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      ),
    );
  }
}
