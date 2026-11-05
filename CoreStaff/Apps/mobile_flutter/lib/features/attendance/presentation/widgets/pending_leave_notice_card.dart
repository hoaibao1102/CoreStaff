import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../data/models/attendance_requirements_dto.dart';
import '../utils/attendance_formatters.dart';

class PendingLeaveNoticeCard extends StatelessWidget {
  final PendingLeaveDto pendingLeave;

  const PendingLeaveNoticeCard({
    super.key,
    required this.pendingLeave,
  });

  @override
  Widget build(BuildContext context) {
    final leaveDesc = AttendanceFormatters.pendingLeaveText(
      pendingLeave.durationType,
      pendingLeave.requestedStart,
      pendingLeave.requestedEnd,
    );

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.warningBg,
        border: Border.all(color: AppColors.warningBorder, width: 1),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Đơn nghỉ đang chờ xử lý',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.warningText,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '$leaveDesc. Ca làm gốc vẫn được áp dụng cho tới khi quản lý duyệt và HR áp dụng.',
            style: const TextStyle(
              fontSize: 12,
              height: 1.45,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

