import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

enum AppButtonVariant { primary, secondary, danger }

class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPress;
  final bool loading;
  final bool disabled;
  final AppButtonVariant variant;
  final double minHeight;

  const AppButton({
    super.key,
    required this.label,
    required this.onPress,
    this.loading = false,
    this.disabled = false,
    this.variant = AppButtonVariant.primary,
    this.minHeight = 50.0,
  });

  const AppButton.secondary({
    super.key,
    required this.label,
    required this.onPress,
    this.loading = false,
    this.disabled = false,
    this.minHeight = 48.0,
  }) : variant = AppButtonVariant.secondary;

  const AppButton.danger({
    super.key,
    required this.label,
    required this.onPress,
    this.loading = false,
    this.disabled = false,
    this.minHeight = 48.0,
  }) : variant = AppButtonVariant.danger;

  @override
  Widget build(BuildContext context) {
    final isInteractive = !disabled && !loading && onPress != null;

    Color bgColor;
    Color textColor;
    BorderSide borderSide;

    switch (variant) {
      case AppButtonVariant.primary:
        bgColor = AppColors.primary;
        textColor = Colors.white;
        borderSide = BorderSide.none;
        break;
      case AppButtonVariant.secondary:
        bgColor = AppColors.bgSurface;
        textColor = AppColors.textSecondary;
        borderSide = const BorderSide(color: AppColors.borderLight, width: 1);
        break;
      case AppButtonVariant.danger:
        bgColor = AppColors.bgSurface;
        textColor = AppColors.dangerText;
        borderSide = const BorderSide(color: AppColors.borderDanger, width: 1);
        break;
    }

    return ConstrainedBox(
      constraints: BoxConstraints(minHeight: minHeight),
      child: Material(
        color: bgColor,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: borderSide,
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: isInteractive ? onPress : null,
          child: Opacity(
            opacity: disabled ? 0.55 : 1.0,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              child: Center(
                child: loading
                    ? SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            variant == AppButtonVariant.primary
                                ? Colors.white
                                : (variant == AppButtonVariant.danger
                                    ? AppColors.dangerText
                                    : AppColors.textSecondary),
                          ),
                        ),
                      )
                    : Text(
                        label,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: variant == AppButtonVariant.primary
                              ? FontWeight.w800
                              : FontWeight.w700,
                          color: textColor,
                        ),
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

