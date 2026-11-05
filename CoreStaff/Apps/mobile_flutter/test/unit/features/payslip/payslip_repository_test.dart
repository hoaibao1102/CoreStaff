import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_client.dart';
import 'package:corestaff_mobile/features/payslip/data/payslip_repository.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late PayslipRepository repository;

  setUp(() {
    mockApiClient = MockApiClient();
    repository = PayslipRepositoryImpl(apiClient: mockApiClient);
  });

  group('PayslipRepository Tests', () {
    test('getMyPayslips calls GET /api/payslips/me and returns List<PayslipDto>', () async {
      when(() => mockApiClient.get<dynamic>('/api/payslips/me')).thenAnswer(
        (_) async => [
          {
            '_id': 'ps_101',
            'periodLabel': '05/2026',
            'status': 'RELEASED',
            'grossEarnings': 20000000,
            'netSalary': 18000000,
            'socialInsurance': 1600000,
            'healthInsurance': 300000,
            'unemploymentInsurance': 100000,
            'pitAmount': 0,
            'otherDeductions': 0,
          },
          {
            '_id': 'ps_102',
            'periodLabel': '04/2026',
            'status': 'VIEWED',
            'grossEarnings': 20000000,
            'netSalary': 18000000,
            'socialInsurance': 1600000,
            'healthInsurance': 300000,
            'unemploymentInsurance': 100000,
            'pitAmount': 0,
            'otherDeductions': 0,
          },
        ],
      );

      final payslips = await repository.getMyPayslips();

      expect(payslips.length, 2);
      expect(payslips[0].id, 'ps_101');
      expect(payslips[0].periodLabel, '05/2026');
      expect(payslips[0].isUnread, isTrue);
      expect(payslips[1].id, 'ps_102');
      expect(payslips[1].status, 'VIEWED');
      verify(() => mockApiClient.get<dynamic>('/api/payslips/me')).called(1);
    });

    test('getMyPayslips returns empty list if response is not a list', () async {
      when(() => mockApiClient.get<dynamic>('/api/payslips/me')).thenAnswer(
        (_) async => null,
      );

      final payslips = await repository.getMyPayslips();

      expect(payslips, isEmpty);
      verify(() => mockApiClient.get<dynamic>('/api/payslips/me')).called(1);
    });

    test('markViewed calls POST /api/payslips/me/:id/viewed', () async {
      when(() => mockApiClient.post<dynamic>('/api/payslips/me/ps_101/viewed')).thenAnswer(
        (_) async => {'success': true},
      );

      await repository.markViewed('ps_101');

      verify(() => mockApiClient.post<dynamic>('/api/payslips/me/ps_101/viewed')).called(1);
    });
  });
}

