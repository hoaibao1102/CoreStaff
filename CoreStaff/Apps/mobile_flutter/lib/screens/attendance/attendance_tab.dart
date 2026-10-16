import 'package:flutter/material.dart';
import '../../widgets/feature_screen.dart';

class AttendanceTab extends StatelessWidget {
  final VoidCallback onBackToOverview;

  const AttendanceTab({super.key, required this.onBackToOverview});

  @override
  Widget build(BuildContext context) {
    return FeatureScreen(
      eyebrow: 'CHẤM CÔNG',
      title: 'Ngày làm việc của bạn',
      description: 'Tính năng ghi nhận vào ca, ra ca và lịch sử chấm công đang được hoàn thiện.',
      action: 'Quay về tổng quan',
      onAction: onBackToOverview,
    );
  }
}
