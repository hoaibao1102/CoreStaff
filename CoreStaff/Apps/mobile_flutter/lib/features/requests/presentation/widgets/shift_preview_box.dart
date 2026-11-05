import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../data/models/leave_preview_dto.dart';

class ShiftPreviewBox extends StatelessWidget {
  final LeavePreviewDto? preview;
  final bool isPreviewing;

  const ShiftPreviewBox({
    super.key,
    required this.preview,
    required this.isPreviewing,
  });

  @override
  Widget build(BuildContext context) {
    final firstDay = preview != null && preview!.days.isNotEmpty ? preview!.days.first : null;

    final leaveIntervalsStr = firstDay?.approvedLeaveIntervals.isNotEmpty == true
        ? firstDay!.approvedLeaveIntervals.map((x) => '${x.from}–${x.to}').join(', ')
        : '—';

    final workingIntervalsStr = firstDay?.requiredWorkingIntervals.isNotEmpty == true
        ? firstDay!.requiredWorkingIntervals.map((x) => '${x.from}–${x.to}').join(', ')
        : 'Không có';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isPreviewing) ...[
            const Row(
              children: [
                SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(AppColors.primaryDark),
                  ),
                ),
                SizedBox(width: 8),
                Text(
                  'Đang tính theo ca làm việc…',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ] else if (preview != null && firstDay != null) ...[
            const Text(
              'Kết quả từ lịch làm việc',
              style: TextStyle(
                color: AppColors.primaryDark,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Ca: ${firstDay.shiftStart}–${firstDay.shiftEnd} · Nghỉ trưa: ${firstDay.breakStart}–${firstDay.breakEnd}',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 11,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'Xin nghỉ: $leaveIntervalsStr',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 11,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'Tổng: ${preview!.formattedDuration} · ${preview!.formattedDays}',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 11,
                height: 1.5,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'Còn phải làm: $workingIntervalsStr',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 11,
                height: 1.5,
              ),
            ),
          ] else ...[
            const Text(
              'Nhập ngày/giờ hợp lệ để hệ thống tính theo ca thực tế.',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 11,
                height: 1.5,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
