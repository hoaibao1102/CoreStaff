import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../data/models/leave_request_dto.dart';

class LeaveCard extends StatelessWidget {
  final LeaveRequestDto item;
  final VoidCallback? onCancel;

  const LeaveCard({
    super.key,
    required this.item,
    this.onCancel,
  });

  String _formatDate(String? raw) {
    if (raw == null || raw.isEmpty) return '-';
    final clean = raw.length >= 10 ? raw.substring(0, 10) : raw;
    final parts = clean.split('-');
    return parts.length == 3 ? '${parts[2]}/${parts[1]}/${parts[0]}' : raw;
  }

  void _showCancelConfirmation(BuildContext context) {
    showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Hủy đơn nghỉ phép'),
        content: const Text('Bạn có chắc chắn muốn hủy đơn nghỉ phép này không?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Không'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(dialogContext, true);
              onCancel?.call();
            },
            style: TextButton.styleFrom(foregroundColor: AppColors.dangerText),
            child: const Text('Hủy đơn'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasIntervals = item.requestedStart != null &&
        item.requestedEnd != null &&
        item.requestedStart!.isNotEmpty &&
        item.requestedEnd!.isNotEmpty;

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
                  color: AppColors.successBg,
                  borderRadius: BorderRadius.circular(11),
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.calendar_today_outlined,
                  size: 19,
                  color: AppColors.successText,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.leaveTypeLabel,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${_formatDate(item.startDate)} - ${_formatDate(item.endDate)}',
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${item.durationLabel}${hasIntervals ? ' · ${item.requestedStart}–${item.requestedEnd}' : ''}',
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
          if (item.calculatedMinutes != null) ...[
            const SizedBox(height: 8),
            Text(
              '${item.formattedDuration} · ${item.formattedDays}',
              style: const TextStyle(
                color: AppColors.successText,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
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
                'Phản hồi quản lý: ${item.reviewComment}',
                style: const TextStyle(
                  color: AppColors.warningText,
                  fontSize: 11,
                  height: 1.4,
                ),
              ),
            ),
          ],
          if (item.isCancellable && onCancel != null) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () => _showCancelConfirmation(context),
                icon: const Icon(Icons.close_rounded, size: 14),
                label: const Text('Hủy đơn', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.dangerText,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
