import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../utils/attendance_formatters.dart';

class TodayMetricGrid extends StatelessWidget {
  final int? workingMinutes;
  final int? lateMinutes;
  final int? earlyMinutes;

  const TodayMetricGrid({
    super.key,
    this.workingMinutes,
    this.lateMinutes,
    this.earlyMinutes,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _buildMetricCell(
            label: 'Giờ làm',
            value: AttendanceFormatters.formatMinutes(workingMinutes),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildMetricCell(
            label: 'Đi muộn',
            value: AttendanceFormatters.formatMinutes(lateMinutes),
            valueColor: (lateMinutes != null && lateMinutes! > 0)
                ? AppColors.warningText
                : AppColors.textPrimary,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildMetricCell(
            label: 'Về sớm',
            value: AttendanceFormatters.formatMinutes(earlyMinutes),
            valueColor: (earlyMinutes != null && earlyMinutes! > 0)
                ? AppColors.dangerText
                : AppColors.textPrimary,
          ),
        ),
      ],
    );
  }

  Widget _buildMetricCell({
    required String label,
    required String value,
    Color valueColor = AppColors.textPrimary,
  }) {
    return Container(
      constraints: const BoxConstraints(minHeight: 76),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        border: Border.all(color: AppColors.border, width: 1),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            offset: const Offset(0, 2),
            blurRadius: 8,
          ),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            value,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: valueColor,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }
}

