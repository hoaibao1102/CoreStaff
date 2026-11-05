import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class SegmentOption<T> {
  final T value;
  final String label;

  const SegmentOption({
    required this.value,
    required this.label,
  });
}

class SegmentedControl<T> extends StatelessWidget {
  final T selectedValue;
  final List<SegmentOption<T>> options;
  final ValueChanged<T> onChanged;
  final double height;

  const SegmentedControl({
    super.key,
    required this.selectedValue,
    required this.options,
    required this.onChanged,
    this.height = 44,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color(0xFFE8EDF5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: options.map((option) {
          final isSelected = option.value == selectedValue;
          return Expanded(
            child: Semantics(
              selected: isSelected,
              button: true,
              label: option.label,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(option.value),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: isSelected ? Colors.white : Colors.transparent,
                    borderRadius: BorderRadius.circular(9),
                    boxShadow: isSelected
                        ? [
                            BoxShadow(
                              color: const Color(0xFF0F172A).withValues(alpha: 0.06),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Text(
                    option.label,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: isSelected ? AppColors.primaryDark : AppColors.textMuted,
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
