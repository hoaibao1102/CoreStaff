import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class AppCard extends StatelessWidget {
  final Widget child;
  final bool dark;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final double borderRadius;
  final BorderSide? border;

  const AppCard({
    super.key,
    required this.child,
    this.dark = false,
    this.padding,
    this.onTap,
    this.borderRadius = 16.0,
    this.border,
  });

  const AppCard.dark({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.onTap,
    this.borderRadius = 20.0,
    this.border,
  }) : dark = true;

  @override
  Widget build(BuildContext context) {
    final effectivePadding = padding ?? const EdgeInsets.all(16);
    final effectiveBorder = border ??
        (dark
            ? BorderSide.none
            : const BorderSide(color: AppColors.border, width: 1));

    final cardContent = Container(
      padding: effectivePadding,
      decoration: BoxDecoration(
        color: dark ? AppColors.bgDark : AppColors.bgSurface,
        borderRadius: BorderRadius.circular(borderRadius),
        border: effectiveBorder == BorderSide.none
            ? null
            : Border.fromBorderSide(effectiveBorder),
        boxShadow: dark
            ? null
            : [
                BoxShadow(
                  color: const Color(0xFF0F172A).withValues(alpha: 0.04),
                  offset: const Offset(0, 4),
                  blurRadius: 12,
                ),
              ],
      ),
      child: child,
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(borderRadius),
          child: cardContent,
        ),
      );
    }

    return cardContent;
  }
}

