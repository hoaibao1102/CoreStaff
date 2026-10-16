import 'package:flutter/material.dart';
import '../../widgets/feature_screen.dart';

class RequestsTab extends StatelessWidget {
  final VoidCallback onBackToOverview;

  const RequestsTab({super.key, required this.onBackToOverview});

  @override
  Widget build(BuildContext context) {
    return FeatureScreen(
      eyebrow: 'ĐƠN TỪ',
      title: 'Yêu cầu của tôi',
      description: 'Tạo và theo dõi đơn nghỉ phép, tăng ca tại một nơi thuận tiện.',
      action: 'Quay về tổng quan',
      onAction: onBackToOverview,
    );
  }
}
