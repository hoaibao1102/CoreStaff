import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../data/models/attendance_event_dto.dart';
import '../utils/attendance_formatters.dart';

class PunchTimelineWidget extends StatelessWidget {
  final AttendanceEventDto? checkIn;
  final AttendanceEventDto? checkOut;

  const PunchTimelineWidget({
    super.key,
    this.checkIn,
    this.checkOut,
  });

  @override
  Widget build(BuildContext context) {
    final hasCheckIn = checkIn != null;
    final hasCheckOut = checkOut != null;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _buildPoint(
            label: 'VÀO CA',
            time: AttendanceFormatters.formatTime(checkIn?.recordedAt),
            isActive: hasCheckIn,
          ),
          Expanded(
            child: Container(
              height: 2,
              margin: const EdgeInsets.symmetric(horizontal: 8),
              color: hasCheckOut ? const Color(0xFF4ADE80) : const Color(0xFF475569),
            ),
          ),
          _buildPoint(
            label: 'RA CA',
            time: AttendanceFormatters.formatTime(checkOut?.recordedAt),
            isActive: hasCheckOut,
          ),
        ],
      ),
    );
  }

  Widget _buildPoint({
    required String label,
    required String time,
    required bool isActive,
  }) {
    return SizedBox(
      width: 72,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 14,
            height: 14,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isActive ? AppColors.successDot : AppColors.bgDark,
              border: Border.all(
                color: isActive ? const Color(0xFF86EFAC) : const Color(0xFF64748B),
                width: 2,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
              color: Color(0xFF93C5FD),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            time,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

