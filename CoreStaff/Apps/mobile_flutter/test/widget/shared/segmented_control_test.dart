import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:corestaff_mobile/shared/widgets/segmented_control.dart';

void main() {
  group('SegmentedControl Widget Tests', () {
    testWidgets('renders all options and reacts to selection tap', (tester) async {
      String selected = 'leave';

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return SegmentedControl<String>(
                  selectedValue: selected,
                  options: const [
                    SegmentOption(value: 'all', label: 'Tất cả'),
                    SegmentOption(value: 'leave', label: 'Nghỉ phép'),
                    SegmentOption(value: 'overtime', label: 'Tăng ca'),
                  ],
                  onChanged: (val) {
                    setState(() {
                      selected = val;
                    });
                  },
                );
              },
            ),
          ),
        ),
      );

      expect(find.text('Tất cả'), findsOneWidget);
      expect(find.text('Nghỉ phép'), findsOneWidget);
      expect(find.text('Tăng ca'), findsOneWidget);

      // Tap on 'Tăng ca'
      await tester.tap(find.text('Tăng ca'));
      await tester.pumpAndSettle();

      expect(selected, 'overtime');
    });
  });
}
