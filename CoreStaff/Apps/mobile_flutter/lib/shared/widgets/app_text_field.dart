import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class AppTextField extends StatelessWidget {
  final String label;
  final String? placeholder;
  final String? value;
  final ValueChanged<String>? onChanged;
  final TextEditingController? controller;
  final bool secureTextEntry;
  final bool editable;
  final bool requiredField;
  final String? actionLabel;
  final VoidCallback? onAction;
  final TextInputType keyboardType;
  final TextInputAction textInputAction;
  final int maxLines;
  final String? errorText;

  const AppTextField({
    super.key,
    required this.label,
    this.placeholder,
    this.value,
    this.onChanged,
    this.controller,
    this.secureTextEntry = false,
    this.editable = true,
    this.requiredField = false,
    this.actionLabel,
    this.onAction,
    this.keyboardType = TextInputType.text,
    this.textInputAction = TextInputAction.next,
    this.maxLines = 1,
    this.errorText,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: Text.rich(
                TextSpan(
                  text: label,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                  children: [
                    if (requiredField)
                      const TextSpan(
                        text: ' *',
                        style: TextStyle(color: AppColors.dangerText, fontWeight: FontWeight.w700),
                      ),
                  ],
                ),
              ),
            ),
            if (actionLabel != null && onAction != null)
              GestureDetector(
                onTap: onAction,
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  child: Text(
                    actionLabel!,
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 7),
        TextFormField(
          initialValue: controller == null ? value : null,
          controller: controller,
          onChanged: onChanged,
          obscureText: secureTextEntry,
          enabled: editable,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          maxLines: maxLines,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
          decoration: InputDecoration(
            hintText: placeholder,
            hintStyle: const TextStyle(
              color: AppColors.textQuaternary,
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
            filled: true,
            fillColor: editable ? AppColors.bgSurface : const Color(0xFFF8FAFC),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.borderLight, width: 1),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.borderLight, width: 1),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.borderDanger, width: 1),
            ),
            errorText: errorText,
            errorStyle: const TextStyle(color: AppColors.dangerText, fontSize: 12),
          ),
        ),
      ],
    );
  }
}

