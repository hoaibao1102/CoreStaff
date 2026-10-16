import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../widgets/app_logo.dart';
import '../../widgets/buttons.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppColors.bgDefault,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppLogo(large: true),
              SizedBox(height: 36),
              SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 3,
                  valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                ),
              ),
              SizedBox(height: 18),
              Text(
                'Đang kết nối hệ thống…',
                style: AppTypography.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ConnectionErrorScreen extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  final VoidCallback? onSkipToDemo;

  const ConnectionErrorScreen({
    super.key,
    required this.message,
    required this.onRetry,
    this.onSkipToDemo,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDefault,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.borderDanger, width: 1.5),
                  ),
                  alignment: Alignment.center,
                  child: const Text(
                    '!',
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      color: AppColors.dangerText,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Không thể kết nối máy chủ',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: AppTypography.bodySmall,
                ),
                const SizedBox(height: 28),
                PrimaryButton(
                  label: 'Thử kết nối lại',
                  onPress: onRetry,
                ),
                if (onSkipToDemo != null) ...[
                  const SizedBox(height: 12),
                  SecondaryButton(
                    label: 'Xem trước giao diện (Offline Demo)',
                    onPress: onSkipToDemo,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
