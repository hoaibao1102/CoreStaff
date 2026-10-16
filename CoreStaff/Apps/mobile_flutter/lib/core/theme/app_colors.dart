import 'package:flutter/material.dart';

/// Design tokens from Docs/MOBILE_DESIGN_MASTER.md
class AppColors {
  AppColors._();

  // Primary
  static const Color primary = Color(0xFF2563EB); // blue-600
  static const Color primaryDark = Color(0xFF1D4ED8);
  static const Color primaryLight = Color(0xFF3B82F6);
  static const Color primarySoft = Color(0xFFDBEAFE); // blue-100

  // Backgrounds
  static const Color bgDefault = Color(0xFFF6F8FC);
  static const Color bgSurface = Color(0xFFFFFFFF);
  static const Color bgDark = Color(0xFF172554); // shift card dark theme

  // Borders & Dividers
  static const Color border = Color(0xFFE2E8F0);
  static const Color borderLight = Color(0xFFCBD5E1);
  static const Color borderDanger = Color(0xFFFECACA);
  static const Color divider = Color(0xFFF1F5F9);

  // Text colors
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF334155);
  static const Color textMuted = Color(0xFF64748B);
  static const Color textQuaternary = Color(0xFF94A3B8);
  static const Color textLink = Color(0xFF2563EB);
  static const Color textWhite = Color(0xFFFFFFFF);
  static const Color textOnDark = Color(0xFFCBD5E1);
  static const Color textStatus = Color(0xFFE2E8F0);

  // Semantic
  static const Color successText = Color(0xFF166534);
  static const Color successBg = Color(0xFFF0FDF4);
  static const Color successBorder = Color(0xFFBBF7D0);
  static const Color successDot = Color(0xFF4ADE80);

  static const Color dangerText = Color(0xFFDC2626);
  static const Color dangerDarkText = Color(0xFFB91C1C);
  static const Color dangerBg = Color(0xFFFEF2F2);

  static const Color infoText = Color(0xFF1E40AF);
  static const Color infoBg = Color(0xFFEFF6FF);
  static const Color infoBorder = Color(0xFFBFDBFE);

  static const Color warningText = Color(0xFFB45309);
  static const Color warningBg = Color(0xFFFFFBEB);
  static const Color warningBorder = Color(0xFFFDE68A);
}
