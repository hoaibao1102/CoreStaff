import 'package:flutter/material.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../../attendance/data/models/today_attendance_dto.dart';
import '../../../attendance/presentation/utils/attendance_formatters.dart';

class OverviewShiftCard extends StatelessWidget {
  final TodayAttendanceDto? today;
  final VoidCallback onNavigateAttendance;

  const OverviewShiftCard({
    super.key,
    required this.today,
    required this.onNavigateAttendance,
  });

  @override
  Widget build(BuildContext context) {
    final shiftName = today?.assignment.shiftName ?? 'Chưa có ca làm';
    final status = today?.attendanceStatus ?? 'NOT_CHECKED_IN';
    final shiftMeta = today != null
        ? '${today!.assignment.shiftHours} - ${today!.assignment.workplaceName}'
        : 'Liên hệ HR để được phân ca';

    final inTime = AttendanceFormatters.formatTime(today?.checkIn?.recordedAt);
    final outTime = AttendanceFormatters.formatTime(today?.checkOut?.recordedAt);

    String actionText;
    if (today?.availableAction == 'CHECK_OUT') {
      actionText = 'Mở chấm công để ra ca';
    } else if (today?.availableAction == 'CHECK_IN') {
      actionText = 'Mở chấm công để vào ca';
    } else {
      actionText = 'Xem chi tiết ngày công';
    }

    return AppCard.dark(
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
                    const Text(
                      'CA LÀM HÔM NAY',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                        color: Color(0xFF93C5FD),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      shiftName,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              StatusBadge(status: status),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            shiftMeta,
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFFCBD5E1),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(color: Colors.white.withValues(alpha: 0.1), width: 1),
                bottom: BorderSide(color: Colors.white.withValues(alpha: 0.1), width: 1),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'VÀO CA',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1,
                          color: Color(0xFF93C5FD),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        inTime,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 1,
                  height: 32,
                  color: Colors.white.withValues(alpha: 0.15),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'RA CA',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1,
                          color: Color(0xFF93C5FD),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        outTime,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          InkWell(
            onTap: onNavigateAttendance,
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    actionText,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFFBFDBFE),
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 22,
                    color: Color(0xFFBFDBFE),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

