import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../data/models/attendance_requirements_dto.dart';
import '../utils/attendance_formatters.dart';

class LeaveIntervalCard extends StatelessWidget {
  final AttendanceRequirementsDto requirements;

  const LeaveIntervalCard({
    super.key,
    required this.requirements,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.successBg,
        border: Border.all(color: AppColors.successBorder, width: 1),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Nghỉ phép đã được HR áp dụng',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.successText,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Thời gian nghỉ: ${AttendanceFormatters.intervalText(requirements.approvedLeaveIntervals)} (${AttendanceFormatters.formatMinutes(requirements.approvedLeaveMinutes)})',
            style: const TextStyle(
              fontSize: 12,
              height: 1.45,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            'Thời gian còn phải làm: ${AttendanceFormatters.intervalText(requirements.requiredWorkingIntervals)} (${AttendanceFormatters.formatMinutes(requirements.requiredWorkingMinutes)})',
            style: const TextStyle(
              fontSize: 12,
              height: 1.45,
              color: AppColors.textSecondary,
            ),
          ),
          if (requirements.effectiveCheckInTime != null ||
              requirements.effectiveCheckOutTime != null) ...[
            const SizedBox(height: 3),
            Text(
              'Khung chấm công hiệu lực: ${requirements.effectiveCheckInTime ?? '—'} – ${requirements.effectiveCheckOutTime ?? '—'}',
              style: const TextStyle(
                fontSize: 12,
                height: 1.45,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

