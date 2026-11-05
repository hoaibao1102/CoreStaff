import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../data/models/attendance_day_dto.dart';
import '../utils/attendance_formatters.dart';

class AttendanceDayCard extends StatelessWidget {
  final AttendanceDayDto day;

  const AttendanceDayCard({
    super.key,
    required this.day,
  });

  @override
  Widget build(BuildContext context) {
    final dateStr = AttendanceFormatters.formatDate(day.workDate);
    final inTime = AttendanceFormatters.formatTime(day.checkIn?.recordedAt);
    final outTime = AttendanceFormatters.formatTime(day.checkOut?.recordedAt);
    final timeRange = '$inTime - $outTime';

    final hasLate = day.lateMinutes > 0;
    final hasEarly = day.earlyMinutes > 0;
    final hasOt = day.overtime != null && day.overtime!.otMinutes > 0;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      dateStr,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      timeRange,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              StatusBadge(status: day.attendanceStatus),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.only(top: 10),
            decoration: const BoxDecoration(
              border: Border(
                top: BorderSide(color: AppColors.divider, width: 1),
              ),
            ),
            child: Wrap(
              spacing: 8,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  AttendanceFormatters.formatMinutes(day.workingMinutes),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                  ),
                ),
                if (hasLate)
                  _buildTag(
                    text: 'Muộn ${day.lateMinutes}p',
                    color: AppColors.warningText,
                    bgColor: AppColors.warningBg,
                    borderColor: AppColors.warningBorder,
                  ),
                if (hasEarly)
                  _buildTag(
                    text: 'Về sớm ${day.earlyMinutes}p',
                    color: AppColors.dangerText,
                    bgColor: AppColors.dangerBg,
                    borderColor: AppColors.borderDanger,
                  ),
                if (hasOt)
                  _buildTag(
                    text: 'OT ${day.overtime!.otMinutes}p',
                    color: AppColors.primaryDark,
                    bgColor: AppColors.primarySoft,
                    borderColor: const Color(0xFFBFDBFE),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTag({
    required String text,
    required Color color,
    required Color bgColor,
    required Color borderColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: borderColor, width: 0.8),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

