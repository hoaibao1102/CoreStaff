import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:corestaff_mobile/shared/widgets/status_badge.dart';

void main() {
  group('StatusBadge Widget Tests', () {
    testWidgets('renders Vietnamese text for standard statuses', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                StatusBadge(status: 'PENDING'),
                StatusBadge(status: 'APPROVED'),
                StatusBadge(status: 'REJECTED'),
                StatusBadge(status: 'ACTIVE'),
              ],
            ),
          ),
        ),
      );

      expect(find.text('Chờ duyệt'), findsOneWidget);
      expect(find.text('Đã duyệt'), findsOneWidget);
      expect(find.text('Từ chối'), findsOneWidget);
      expect(find.text('Đang làm việc'), findsOneWidget);
    });

    testWidgets('uses custom label override when specified', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: StatusBadge(
              status: 'APPROVED',
              label: 'Đã hoàn tất',
            ),
          ),
        ),
      );

      expect(find.text('Đã hoàn tất'), findsOneWidget);
      expect(find.text('Đã duyệt'), findsNothing);
    });
  });
}
