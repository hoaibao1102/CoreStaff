import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/error/app_exception.dart';
import 'package:corestaff_mobile/features/payslip/data/models/payslip_dto.dart';
import 'package:corestaff_mobile/features/payslip/data/payslip_repository.dart';
import 'package:corestaff_mobile/features/payslip/presentation/bloc/payslip_bloc.dart';

class MockPayslipRepository extends Mock implements PayslipRepository {}

void main() {
  late MockPayslipRepository mockRepository;

  const samplePayslip1 = PayslipDto(
    id: 'ps_01',
    periodLabel: '05/2026',
    status: 'RELEASED',
    grossEarnings: 20000000,
    netSalary: 18000000,
    socialInsurance: 1600000,
    healthInsurance: 300000,
    unemploymentInsurance: 100000,
    pitAmount: 0,
    otherDeductions: 0,
  );

  const samplePayslip2 = PayslipDto(
    id: 'ps_02',
    periodLabel: '04/2026',
    status: 'VIEWED',
    grossEarnings: 20000000,
    netSalary: 18000000,
    socialInsurance: 1600000,
    healthInsurance: 300000,
    unemploymentInsurance: 100000,
    pitAmount: 0,
    otherDeductions: 0,
  );

  setUp(() {
    mockRepository = MockPayslipRepository();
  });

  group('PayslipBloc Tests', () {
    test('initial state is PayslipInitial', () {
      final bloc = PayslipBloc(payslipRepository: mockRepository);
      expect(bloc.state, isA<PayslipInitial>());
    });

    blocTest<PayslipBloc, PayslipState>(
      'emits [PayslipLoading, PayslipLoaded] on successful PayslipsRequested',
      build: () {
        when(() => mockRepository.getMyPayslips()).thenAnswer(
          (_) async => [samplePayslip1, samplePayslip2],
        );
        return PayslipBloc(payslipRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const PayslipsRequested()),
      expect: () => [
        isA<PayslipLoading>(),
        isA<PayslipLoaded>()
            .having((s) => s.payslips.length, 'length', 2)
            .having((s) => s.unreadCount, 'unreadCount', 1)
            .having((s) => s.newest?.id, 'latestId', 'ps_01'),
      ],
    );

    blocTest<PayslipBloc, PayslipState>(
      'emits [PayslipLoaded] directly without PayslipLoading when isRefresh is true',
      build: () {
        when(() => mockRepository.getMyPayslips()).thenAnswer(
          (_) async => [samplePayslip2],
        );
        return PayslipBloc(payslipRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const PayslipsRequested(isRefresh: true)),
      expect: () => [
        isA<PayslipLoaded>()
            .having((s) => s.payslips.length, 'length', 1)
            .having((s) => s.unreadCount, 'unreadCount', 0),
      ],
    );

    blocTest<PayslipBloc, PayslipState>(
      'emits [PayslipLoading, PayslipError] on ApiException',
      build: () {
        when(() => mockRepository.getMyPayslips()).thenThrow(
          const ApiException(
            message: 'Hồ sơ nhân viên không tồn tại',
            code: 'EMPLOYEE_PROFILE_NOT_FOUND',
            statusCode: 404,
          ),
        );
        return PayslipBloc(payslipRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const PayslipsRequested()),
      expect: () => [
        isA<PayslipLoading>(),
        isA<PayslipError>().having(
          (s) => s.message,
          'message',
          'Chưa tìm thấy hồ sơ nhân viên. Vui lòng liên hệ HR.',
        ),
      ],
    );

    blocTest<PayslipBloc, PayslipState>(
      'emits [PayslipLoading, PayslipError] on generic Exception',
      build: () {
        when(() => mockRepository.getMyPayslips()).thenThrow(Exception('Timeout'));
        return PayslipBloc(payslipRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const PayslipsRequested()),
      expect: () => [
        isA<PayslipLoading>(),
        isA<PayslipError>().having(
          (s) => s.message,
          'message',
          contains('Không thể tải phiếu lương'),
        ),
      ],
    );

    blocTest<PayslipBloc, PayslipState>(
      'PayslipToggleExpanded updates expandedId and marks RELEASED item as VIEWED optimistically',
      build: () {
        when(() => mockRepository.markViewed('ps_01')).thenAnswer((_) async {});
        return PayslipBloc(payslipRepository: mockRepository);
      },
      seed: () => const PayslipLoaded(
        payslips: [samplePayslip1, samplePayslip2],
      ),
      act: (bloc) => bloc.add(const PayslipToggleExpanded(id: 'ps_01')),
      expect: () => [
        isA<PayslipLoaded>()
            .having((s) => s.expandedId, 'expandedId', 'ps_01')
            .having((s) => s.payslips[0].status, 'status', 'VIEWED')
            .having((s) => s.unreadCount, 'unreadCount', 0),
      ],
      verify: (_) {
        verify(() => mockRepository.markViewed('ps_01')).called(1);
      },
    );

    blocTest<PayslipBloc, PayslipState>(
      'PayslipToggleExpanded collapses item when tapped again and does not call markViewed if already VIEWED',
      build: () => PayslipBloc(payslipRepository: mockRepository),
      seed: () => const PayslipLoaded(
        payslips: [samplePayslip2],
        expandedId: 'ps_02',
      ),
      act: (bloc) => bloc.add(const PayslipToggleExpanded(id: 'ps_02')),
      expect: () => [
        isA<PayslipLoaded>().having((s) => s.expandedId, 'expandedId', isNull),
      ],
      verify: (_) {
        verifyNever(() => mockRepository.markViewed(any()));
      },
    );
  });
}

