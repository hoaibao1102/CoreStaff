import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../data/models/attendance_summary_dto.dart';

class MonthSummaryRow extends StatelessWidget {
  final AttendanceSummaryDto summary;

  const MonthSummaryRow({
    super.key,
    required this.summary,
  });

  @override
  Widget build(BuildContext context) {
    final otHours = (summary.otMinutes / 60).toStringAsFixed(1);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildItem(
              label: 'Ngày công',
              value: '${summary.workingDays}',
            ),
          ),
          Container(
            width: 1,
            height: 28,
            color: const Color(0xFFBFDBFE),
          ),
          Expanded(
            child: _buildItem(
              label: 'Đi muộn',
              value: '${summary.lateDays}',
            ),
          ),
          Container(
            width: 1,
            height: 28,
            color: const Color(0xFFBFDBFE),
          ),
          Expanded(
            child: _buildItem(
              label: 'OT',
              value: '${otHours}g',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildItem({
    required String label,
    required String value,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: AppColors.primaryDark,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: AppColors.textMuted,
          ),
        ),
      ],
    );
  }
}

