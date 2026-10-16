import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';

class PrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPress;
  final bool loading;
  final bool disabled;
  final double? width;
  final IconData? icon;

  const PrimaryButton({
    super.key,
    required this.label,
    this.onPress,
    this.loading = false,
    this.disabled = false,
    this.width,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final isInactive = disabled || loading || onPress == null;

    return SizedBox(
      width: width ?? double.infinity,
      height: 50,
      child: ElevatedButton(
        onPressed: isInactive ? null : onPress,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.55),
          foregroundColor: Colors.white,
          disabledForegroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16),
        ),
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 18, color: Colors.white),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class SecondaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPress;
  final bool loading;
  final bool disabled;
  final bool danger;
  final double? width;
  final IconData? icon;

  const SecondaryButton({
    super.key,
    required this.label,
    this.onPress,
    this.loading = false,
    this.disabled = false,
    this.danger = false,
    this.width,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final isInactive = disabled || loading || onPress == null;
    final borderColor = danger ? AppColors.borderDanger : AppColors.borderLight;
    final textColor = danger ? AppColors.dangerText : AppColors.textSecondary;

    return SizedBox(
      width: width ?? double.infinity,
      height: 48,
      child: OutlinedButton(
        onPressed: isInactive ? null : onPress,
        style: OutlinedButton.styleFrom(
          backgroundColor: AppColors.bgSurface,
          disabledBackgroundColor: AppColors.bgSurface.withValues(alpha: 0.55),
          side: BorderSide(
            color: isInactive ? borderColor.withValues(alpha: 0.55) : borderColor,
            width: 1,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16),
        ),
        child: loading
            ? SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2.2,
                  valueColor: AlwaysStoppedAnimation<Color>(textColor),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 18, color: textColor),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: isInactive ? textColor.withValues(alpha: 0.55) : textColor,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
