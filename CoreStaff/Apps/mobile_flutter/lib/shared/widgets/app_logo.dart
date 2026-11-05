import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class AppLogo extends StatelessWidget {
  final bool large;

  const AppLogo({super.key, this.large = false});

  @override
  Widget build(BuildContext context) {
    final markSize = large ? 64.0 : 34.0;
    final markRadius = large ? 20.0 : 10.0;
    final letterSize = large ? 32.0 : 18.0;
    final fontSize = large ? 28.0 : 20.0;

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: markSize,
          height: markSize,
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(markRadius),
          ),
          alignment: Alignment.center,
          child: Text(
            'C',
            style: TextStyle(
              color: Colors.white,
              fontSize: letterSize,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          'CoreStaff',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: fontSize,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
          ),
        ),
      ],
    );
  }
}

