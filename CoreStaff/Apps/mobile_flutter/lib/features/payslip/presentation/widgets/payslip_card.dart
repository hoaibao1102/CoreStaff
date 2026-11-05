import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../data/models/payslip_dto.dart';

class PayslipCard extends StatelessWidget {
  final PayslipDto item;
  final bool isExpanded;
  final VoidCallback onTap;

  const PayslipCard({
    super.key,
    required this.item,
    required this.isExpanded,
    required this.onTap,
  });

  String _formatCurrency(num value) {
    final formatter = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);
    return formatter.format(value).trim();
  }

  String _formatDate(String? raw) {
    if (raw == null || raw.isEmpty) return 'Chưa phát hành';
    try {
      final dt = DateTime.parse(raw);
      return DateFormat('dd/MM/yyyy').format(dt);
    } catch (_) {
      return raw;
    }
  }

  String _statusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'RELEASED':
        return 'Mới';
      case 'VIEWED':
        return 'Đã xem';
      case 'GENERATED':
        return 'Đang xử lý';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Kỳ ${item.periodLabel}',
                        style: AppTypography.titleSmall.copyWith(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.releasedAt != null
                            ? 'Phát hành ${_formatDate(item.releasedAt)}'
                            : 'Chưa phát hành',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.textMuted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                StatusBadge(
                  status: item.status,
                  label: _statusLabel(item.status),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Net Row Box
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Thực nhận',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.primaryDark,
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                    ),
                  ),
                  Text(
                    _formatCurrency(item.netSalary),
                    style: TextStyle(
                      color: AppColors.primaryDark,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),

            // Expand / Collapse Content
            if (isExpanded) ...[
              const Divider(height: 16, color: AppColors.divider),
              _buildMoneyRow('Tổng thu nhập', item.grossEarnings),
              const SizedBox(height: 8),
              _buildMoneyRow('Bảo hiểm', -item.totalInsurance, isNegative: true),
              const SizedBox(height: 8),
              _buildMoneyRow('Thuế TNCN', -item.pitAmount, isNegative: true),
              const SizedBox(height: 8),
              _buildMoneyRow('Khấu trừ khác', -item.otherDeductions, isNegative: true),
              const Divider(height: 16, color: AppColors.divider),
              _buildMoneyRow('Thực nhận', item.netSalary, isStrong: true),
            ] else ...[
              Center(
                child: Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Chạm để xem chi tiết',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildMoneyRow(
    String label,
    num value, {
    bool isNegative = false,
    bool isStrong = false,
  }) {
    final color = isNegative
        ? AppColors.dangerText
        : (isStrong ? AppColors.textPrimary : AppColors.textSecondary);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: isStrong ? FontWeight.w800 : FontWeight.w500,
            color: isStrong ? AppColors.textPrimary : AppColors.textMuted,
          ),
        ),
        Text(
          _formatCurrency(value),
          style: TextStyle(
            fontSize: isStrong ? 14 : 12.5,
            fontWeight: isStrong ? FontWeight.w800 : FontWeight.w700,
            color: color,
          ),
        ),
      ],
    );
  }
}

