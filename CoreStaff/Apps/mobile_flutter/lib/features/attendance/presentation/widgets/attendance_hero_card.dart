import 'package:flutter/material.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../data/models/today_attendance_dto.dart';
import 'punch_timeline_widget.dart';

class AttendanceHeroCard extends StatelessWidget {
  final TodayAttendanceDto? today;
  final bool isSubmitting;
  final VoidCallback onPunchConfirm;

  const AttendanceHeroCard({
    super.key,
    required this.today,
    this.isSubmitting = false,
    required this.onPunchConfirm,
  });

  @override
  Widget build(BuildContext context) {
    final shiftName = today?.assignment.shiftName ?? 'Ca làm hôm nay';
    final shiftHours = today?.assignment.shiftHours ?? '-';
    final workplaceName = today?.assignment.workplaceName ?? '';
    final workplaceAddress = today?.assignment.address ?? '';
    final fullLocation = workplaceName.isNotEmpty && workplaceAddress.isNotEmpty
        ? '$workplaceName - $workplaceAddress'
        : (workplaceName.isNotEmpty ? workplaceName : workplaceAddress);

    final status = today?.attendanceStatus ?? 'NOT_CHECKED_IN';
    final action = today?.availableAction ?? 'NONE';

    String actionLabel;
    switch (action) {
      case 'CHECK_IN':
        actionLabel = 'Xác nhận vào ca';
        break;
      case 'CHECK_OUT':
        actionLabel = 'Xác nhận ra ca';
        break;
      default:
        actionLabel = 'Ca làm đã hoàn tất';
        break;
    }

    final isButtonDisabled = today == null || action == 'NONE';

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
                    Text(
                      shiftName.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.1,
                        color: Color(0xFF93C5FD),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      shiftHours,
                      style: const TextStyle(
                        fontSize: 24,
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
          if (fullLocation.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              fullLocation,
              style: const TextStyle(
                fontSize: 12,
                height: 1.4,
                color: Color(0xFFCBD5E1),
              ),
            ),
          ],
          PunchTimelineWidget(
            checkIn: today?.checkIn,
            checkOut: today?.checkOut,
          ),
          AppButton(
            label: actionLabel,
            onPress: isButtonDisabled ? null : onPunchConfirm,
            disabled: isButtonDisabled,
            loading: isSubmitting,
          ),
          if (today?.assignment.workplaceType == 'OUT_OFFICE') ...[
            const SizedBox(height: 10),
            const Center(
              child: Text(
                'Ca ngoài văn phòng có thể yêu cầu vị trí hoặc selfie theo chính sách công ty.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11,
                  height: 1.4,
                  color: Color(0xFFBFDBFE),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

