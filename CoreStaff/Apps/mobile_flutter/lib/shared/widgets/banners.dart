import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class ErrorBanner extends StatelessWidget {
  final String message;

  const ErrorBanner({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.dangerBg,
        border: Border.all(color: AppColors.borderDanger, width: 1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        message,
        style: const TextStyle(
          color: AppColors.dangerDarkText,
          fontSize: 13,
          height: 1.45,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class SuccessBanner extends StatelessWidget {
  final String message;

  const SuccessBanner({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.successBg,
        border: Border.all(color: AppColors.successBorder, width: 1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        message,
        style: const TextStyle(
          color: AppColors.successText,
          fontSize: 13,
          height: 1.45,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class NoticeBanner extends StatelessWidget {
  final String message;

  const NoticeBanner({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.infoBg,
        border: Border.all(color: AppColors.infoBorder, width: 1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        message,
        style: const TextStyle(
          color: AppColors.infoText,
          fontSize: 13,
          height: 1.45,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

