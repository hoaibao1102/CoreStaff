import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../utils/attendance_formatters.dart';

class MonthSelectorBar extends StatelessWidget {
  final String monthKey;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final bool canMoveNext;

  const MonthSelectorBar({
    super.key,
    required this.monthKey,
    required this.onPrevious,
    required this.onNext,
    required this.canMoveNext,
  });

  @override
  Widget build(BuildContext context) {
    final label = AttendanceFormatters.formatMonthLabel(monthKey);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text(
          'Lịch sử tháng',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildArrowButton(
              arrow: '‹',
              tooltip: 'Tháng trước',
              onTap: onPrevious,
              enabled: true,
            ),
            Container(
              constraints: const BoxConstraints(minWidth: 88),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              alignment: Alignment.center,
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
            _buildArrowButton(
              arrow: '›',
              tooltip: 'Tháng sau',
              onTap: canMoveNext ? onNext : null,
              enabled: canMoveNext,
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildArrowButton({
    required String arrow,
    required String tooltip,
    required VoidCallback? onTap,
    required bool enabled,
  }) {
    return SizedBox(
      width: 40,
      height: 40,
      child: Material(
        color: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Center(
            child: Opacity(
              opacity: enabled ? 1.0 : 0.3,
              child: Text(
                arrow,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                  height: 1.0,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

