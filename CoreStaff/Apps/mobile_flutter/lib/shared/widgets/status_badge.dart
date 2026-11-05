import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final String? label;

  const StatusBadge({
    super.key,
    required this.status,
    this.label,
  });

  @override
  Widget build(BuildContext context) {
    final style = _resolveStatusStyle(status);
    final text = label ?? _resolveStatusLabel(status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: style.backgroundColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: style.borderColor, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (style.hasDot) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: style.textColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
          ],
          Text(
            text,
            style: TextStyle(
              color: style.textColor,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  static _BadgeStyle _resolveStatusStyle(String status) {
    switch (status.toUpperCase()) {
      // Attendance & Active states
      case 'CHECKED_IN':
      case 'APPROVED':
      case 'HR_APPLIED':
      case 'RELEASED':
      case 'ACTIVE':
        return const _BadgeStyle(
          textColor: AppColors.successText,
          backgroundColor: AppColors.successBg,
          borderColor: AppColors.successBorder,
          hasDot: true,
        );

      case 'COMPLETED':
      case 'VIEWED':
        return const _BadgeStyle(
          textColor: AppColors.primaryDark,
          backgroundColor: AppColors.primarySoft,
          borderColor: AppColors.infoBorder,
        );

      case 'PENDING':
      case 'PENDING_MANAGER':
      case 'GENERATED':
      case 'PROBATION':
        return const _BadgeStyle(
          textColor: AppColors.warningText,
          backgroundColor: AppColors.warningBg,
          borderColor: AppColors.warningBorder,
          hasDot: true,
        );

      case 'REJECTED':
      case 'CANCELLED':
      case 'TERMINATED':
      case 'LOCKED':
        return const _BadgeStyle(
          textColor: AppColors.dangerText,
          backgroundColor: AppColors.dangerBg,
          borderColor: AppColors.borderDanger,
        );

      case 'DAY_OFF':
      case 'ON_LEAVE':
      case 'RESIGNED':
      case 'NOT_CHECKED_IN':
      default:
        return const _BadgeStyle(
          textColor: AppColors.textMuted,
          backgroundColor: Color(0xFFF1F5F9),
          borderColor: AppColors.border,
        );
    }
  }

  static String _resolveStatusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'NOT_CHECKED_IN':
        return 'Chưa vào ca';
      case 'CHECKED_IN':
        return 'Đang trong ca';
      case 'COMPLETED':
        return 'Hoàn thành';
      case 'DAY_OFF':
        return 'Ngày nghỉ';
      case 'LOCKED':
        return 'Đã khóa';
      case 'PENDING':
      case 'PENDING_MANAGER':
        return 'Chờ duyệt';
      case 'APPROVED':
        return 'Đã duyệt';
      case 'REJECTED':
        return 'Từ chối';
      case 'CANCELLED':
        return 'Đã hủy';
      case 'HR_APPLIED':
        return 'Đã áp dụng';
      case 'CLARIFICATION_REQUESTED':
        return 'Cần bổ sung';
      case 'GENERATED':
        return 'Đang xử lý';
      case 'RELEASED':
        return 'Mới';
      case 'VIEWED':
        return 'Đã xem';
      case 'ACTIVE':
        return 'Đang làm việc';
      case 'PROBATION':
        return 'Thử việc';
      case 'ON_LEAVE':
        return 'Đang nghỉ phép';
      case 'RESIGNED':
        return 'Đã nghỉ việc';
      case 'TERMINATED':
        return 'Đã chấm dứt';
      default:
        return status;
    }
  }
}

class _BadgeStyle {
  final Color textColor;
  final Color backgroundColor;
  final Color borderColor;
  final bool hasDot;

  const _BadgeStyle({
    required this.textColor,
    required this.backgroundColor,
    required this.borderColor,
    this.hasDot = false,
  });
}

