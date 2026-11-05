import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../data/models/overtime_request_dto.dart';

class OvertimeCard extends StatelessWidget {
  final OvertimeRequestDto item;

  const OvertimeCard({
    super.key,
    required this.item,
  });

  String _formatDate(String? raw) {
    if (raw == null || raw.isEmpty) return '-';
    final clean = raw.length >= 10 ? raw.substring(0, 10) : raw;
    final parts = clean.split('-');
    return parts.length == 3 ? '${parts[2]}/${parts[1]}/${parts[0]}' : raw;
  }

  String _formatTime(String? raw) {
    if (raw == null || raw.isEmpty) return '--:--';
    try {
      final dt = DateTime.parse(raw);
      final vnTime = dt.toUtc().add(const Duration(hours: 7));
      final h = vnTime.hour.toString().padLeft(2, '0');
      final m = vnTime.minute.toString().padLeft(2, '0');
      return '$h:$m';
    } catch (_) {
      return raw;
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(11),
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.access_time_rounded,
                  size: 20,
                  color: AppColors.primaryDark,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Tăng ca ngày ${_formatDate(item.workDate)}',
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${_formatTime(item.requestedStart)} - ${_formatTime(item.requestedEnd)}',
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              StatusBadge(status: item.status),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.only(top: 8),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.divider)),
            ),
            child: Text(
              item.reason,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                height: 1.4,
              ),
            ),
          ),
          if (item.eligibleMinutes != null) ...[
            const SizedBox(height: 8),
            Text(
              'Đủ điều kiện: ${item.eligibleMinutes} phút',
              style: const TextStyle(
                color: AppColors.successText,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          if (item.reviewComment != null && item.reviewComment!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.warningBg,
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: AppColors.warningBorder),
              ),
              child: Text(
                'Phản hồi: ${item.reviewComment}',
                style: const TextStyle(
                  color: AppColors.warningText,
                  fontSize: 11,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
