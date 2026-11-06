import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import 'buttons.dart';

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  final Color? color;
  final Color? borderColor;
  final VoidCallback? onTap;

  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.color,
    this.borderColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(16);
    return Material(
      color: color ?? AppColors.bgSurface,
      shape: RoundedRectangleBorder(
        borderRadius: radius,
        side: BorderSide(color: borderColor ?? AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(width: double.infinity, padding: padding, child: child),
      ),
    );
  }
}

enum BadgeTone { neutral, success, warning, danger, info }

class StatusBadge extends StatelessWidget {
  final String label;
  final BadgeTone tone;

  const StatusBadge({super.key, required this.label, this.tone = BadgeTone.neutral});

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      BadgeTone.success => (AppColors.successBg, AppColors.successText),
      BadgeTone.warning => (AppColors.warningBg, AppColors.warningText),
      BadgeTone.danger => (AppColors.dangerBg, AppColors.dangerDarkText),
      BadgeTone.info => (AppColors.infoBg, AppColors.infoText),
      BadgeTone.neutral => (AppColors.divider, AppColors.textMuted),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w800)),
    );
  }
}

class LoadingBlock extends StatelessWidget {
  const LoadingBlock({super.key});

  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.symmetric(vertical: 48),
        child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
}

class ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const ErrorState({super.key, required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) => AppCard(
        child: Column(
          children: [
            const Icon(Icons.cloud_off_outlined, color: AppColors.dangerText, size: 30),
            const SizedBox(height: 10),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textMuted, fontSize: 13, height: 1.4)),
            const SizedBox(height: 14),
            PrimaryButton(label: 'Thử lại', onPress: onRetry),
          ],
        ),
      );
}

class EmptyCard extends StatelessWidget {
  final String message;
  const EmptyCard(this.message, {super.key});

  @override
  Widget build(BuildContext context) => AppCard(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Center(
            child: Text(message, style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
          ),
        ),
      );
}

class SectionTitle extends StatelessWidget {
  final String text;
  const SectionTitle(this.text, {super.key});

  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w800));
}
