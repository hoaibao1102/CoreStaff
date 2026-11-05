import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:corestaff_mobile/shared/widgets/app_button.dart';

void main() {
  group('AppButton Widget Tests', () {
    testWidgets('renders text and responds to tap', (tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppButton(
              label: 'Đăng nhập',
              onPress: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Đăng nhập'), findsOneWidget);
      await tester.tap(find.text('Đăng nhập'));
      await tester.pump();

      expect(tapped, isTrue);
    });

    testWidgets('displays CircularProgressIndicator and ignores tap when loading', (tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppButton(
              label: 'Đang tải',
              loading: true,
              onPress: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Đang tải'), findsNothing);

      await tester.tap(find.byType(AppButton));
      await tester.pump();

      expect(tapped, isFalse);
    });

    testWidgets('does not trigger onPress when disabled', (tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppButton(
              label: 'Vô hiệu hóa',
              disabled: true,
              onPress: () => tapped = true,
            ),
          ),
        ),
      );

      await tester.tap(find.text('Vô hiệu hóa'));
      await tester.pump();

      expect(tapped, isFalse);
    });
  });
}
