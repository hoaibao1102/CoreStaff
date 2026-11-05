import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

enum AttentionTone { defaultTone, warning, blue }

class AttentionMetricCard extends StatelessWidget {
  final int count;
  final String label;
  final AttentionTone tone;
  final VoidCallback onTap;

  const AttentionMetricCard({
    super.key,
    required this.count,
    required this.label,
    this.tone = AttentionTone.defaultTone,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Color bgColor;
    Color borderColor;

    switch (tone) {
      case AttentionTone.warning:
        bgColor = AppColors.warningBg;
        borderColor = AppColors.warningBorder;
        break;
      case AttentionTone.blue:
        bgColor = AppColors.infoBg;
        borderColor = AppColors.infoBorder;
        break;
      case AttentionTone.defaultTone:
        bgColor = AppColors.bgSurface;
        borderColor = AppColors.border;
        break;
    }

    return Container(
      constraints: const BoxConstraints(minHeight: 92),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor, width: 1),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            offset: const Offset(0, 2),
            blurRadius: 8,
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '$count',
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

