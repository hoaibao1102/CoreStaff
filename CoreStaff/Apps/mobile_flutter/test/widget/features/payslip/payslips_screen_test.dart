import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/error/app_exception.dart';
import 'package:corestaff_mobile/features/payslip/data/models/payslip_dto.dart';
import 'package:corestaff_mobile/features/payslip/data/payslip_repository.dart';
import 'package:corestaff_mobile/features/payslip/presentation/bloc/payslip_bloc.dart';
import 'package:corestaff_mobile/features/payslip/presentation/screens/payslips_screen.dart';

class MockPayslipRepository extends Mock implements PayslipRepository {}

void main() {
  late MockPayslipRepository mockRepository;

  const samplePayslip1 = PayslipDto(
    id: 'ps_101',
    periodLabel: '05/2026',
    status: 'RELEASED',
    grossEarnings: 25000000,
    netSalary: 21450000,
    socialInsurance: 2000000,
    healthInsurance: 375000,
    unemploymentInsurance: 250000,
    pitAmount: 925000,
    otherDeductions: 0,
    releasedAt: '2026-05-31T17:00:00.000Z',
  );

  setUp(() {
    mockRepository = MockPayslipRepository();
    final sl = GetIt.instance;
    if (sl.isRegistered<PayslipBloc>()) {
      sl.unregister<PayslipBloc>();
    }
    sl.registerFactory<PayslipBloc>(
      () => PayslipBloc(payslipRepository: mockRepository),
    );
  });

  tearDown(() {
    final sl = GetIt.instance;
    if (sl.isRegistered<PayslipBloc>()) {
      sl.unregister<PayslipBloc>();
    }
  });

  group('PayslipsScreen Widget Tests', () {
    testWidgets('renders loaded payslips and summary card', (tester) async {
      when(() => mockRepository.getMyPayslips()).thenAnswer(
        (_) async => [samplePayslip1],
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: PayslipsScreen(),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Header and summary card check
      expect(find.text('Phiếu lương'), findsOneWidget);
      expect(find.text('Tháng 05/2026'), findsOneWidget);
      expect(find.text('1 mới'), findsOneWidget);
      expect(find.text('Lịch sử phiếu lương'), findsOneWidget);
      expect(find.text('1 kỳ'), findsOneWidget);
      expect(find.text('Kỳ 05/2026'), findsOneWidget);
      expect(find.text('Mới'), findsOneWidget); // StatusBadge on payslip card
      expect(find.text('Chạm để xem chi tiết'), findsOneWidget);
    });

    testWidgets('shows empty state when payslips list is empty', (tester) async {
      when(() => mockRepository.getMyPayslips()).thenAnswer((_) async => []);

      await tester.pumpWidget(
        const MaterialApp(
          home: PayslipsScreen(),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Chưa có phiếu lương'), findsOneWidget);
      expect(find.text('Phiếu lương sẽ xuất hiện khi HR phát hành kỳ lương.'), findsOneWidget);
      expect(find.text('0 kỳ'), findsOneWidget);
    });

    testWidgets('shows error banner when repository fails', (tester) async {
      when(() => mockRepository.getMyPayslips()).thenThrow(
        const ApiException(
          message: 'Không tìm thấy hồ sơ',
          code: 'EMPLOYEE_PROFILE_NOT_FOUND',
          statusCode: 404,
        ),
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: PayslipsScreen(),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Chưa tìm thấy hồ sơ nhân viên. Vui lòng liên hệ HR.'), findsOneWidget);
    });

    testWidgets('expands payslip card on tap, reveals breakdown, and marks viewed', (tester) async {
      when(() => mockRepository.getMyPayslips()).thenAnswer(
        (_) async => [samplePayslip1],
      );
      when(() => mockRepository.markViewed('ps_101')).thenAnswer((_) async {});

      await tester.pumpWidget(
        const MaterialApp(
          home: PayslipsScreen(),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Initially breakdown is hidden
      expect(find.text('Tổng thu nhập'), findsNothing);
      expect(find.text('Chạm để xem chi tiết'), findsOneWidget);

      // Tap card to expand
      await tester.tap(find.text('Kỳ 05/2026'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Now breakdown rows should be visible
      expect(find.text('Tổng thu nhập'), findsOneWidget);
      expect(find.text('Bảo hiểm'), findsOneWidget);
      expect(find.text('Thuế TNCN'), findsOneWidget);
      expect(find.text('Khấu trừ khác'), findsOneWidget);
      expect(find.text('Chạm để xem chi tiết'), findsNothing);

      // Status badge should update from 'Mới' to 'Đã xem'
      expect(find.text('Đã xem'), findsOneWidget);

      // markViewed was invoked
      verify(() => mockRepository.markViewed('ps_101')).called(1);
    });
  });
}
