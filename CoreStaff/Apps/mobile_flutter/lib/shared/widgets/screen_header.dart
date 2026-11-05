import 'package:flutter/material.dart';
import '../../core/theme/app_typography.dart';

class ScreenHeader extends StatelessWidget {
  final String eyebrow;
  final String title;
  final String? description;
  final Widget? action;

  const ScreenHeader({
    super.key,
    required this.eyebrow,
    required this.title,
    this.description,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                eyebrow,
                style: AppTypography.eyebrow,
              ),
              const SizedBox(height: 4),
              Text(
                title,
                style: AppTypography.titleLarge,
              ),
              if (description != null && description!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  description!,
                  style: AppTypography.bodySmall,
                ),
              ],
            ],
          ),
        ),
        if (action != null) ...[
          const SizedBox(width: 12),
          action!,
        ],
      ],
    );
  }
}
