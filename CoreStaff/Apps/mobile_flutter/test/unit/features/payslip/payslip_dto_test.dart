import 'package:flutter_test/flutter_test.dart';
import 'package:corestaff_mobile/features/payslip/data/models/payslip_dto.dart';

void main() {
  group('PayslipDto Tests', () {
    test('correctly deserializes from backend API JSON', () {
      final json = {
        '_id': 'ps_123',
        'periodLabel': '05/2026',
        'status': 'RELEASED',
        'grossEarnings': 25000000,
        'netSalary': 21450000,
        'socialInsurance': 2000000,
        'healthInsurance': 375000,
        'unemploymentInsurance': 250000,
        'pitAmount': 925000,
        'otherDeductions': 0,
        'earningBreakdown': [
          {'label': 'Lương cơ bản', 'amount': 20000000},
          {'label': 'Phụ cấp ăn trưa', 'amount': 5000000},
        ],
        'deductionBreakdown': [
          {'label': 'BHXH (8%)', 'amount': 2000000},
          {'label': 'BHYT (1.5%)', 'amount': 375000},
          {'label': 'BHTN (1%)', 'amount': 250000},
          {'label': 'Thuế TNCN', 'amount': 925000},
        ],
        'releasedAt': '2026-05-31T17:00:00.000Z',
        'viewedAt': null,
      };

      final dto = PayslipDto.fromJson(json);

      expect(dto.id, 'ps_123');
      expect(dto.periodLabel, '05/2026');
      expect(dto.status, 'RELEASED');
      expect(dto.grossEarnings, 25000000);
      expect(dto.netSalary, 21450000);
      expect(dto.socialInsurance, 2000000);
      expect(dto.healthInsurance, 375000);
      expect(dto.unemploymentInsurance, 250000);
      expect(dto.totalInsurance, 2625000);
      expect(dto.pitAmount, 925000);
      expect(dto.otherDeductions, 0);
      expect(dto.isUnread, isTrue);
      expect(dto.releasedAt, '2026-05-31T17:00:00.000Z');
      expect(dto.viewedAt, isNull);
      expect(dto.earningBreakdown.length, 2);
      expect(dto.earningBreakdown[0].label, 'Lương cơ bản');
      expect(dto.earningBreakdown[0].amount, 20000000);
      expect(dto.deductionBreakdown.length, 4);
    });

    test('handles fallback defaults when fields are missing or null', () {
      final json = <String, dynamic>{
        'id': 'ps_empty',
      };

      final dto = PayslipDto.fromJson(json);

      expect(dto.id, 'ps_empty');
      expect(dto.periodLabel, '');
      expect(dto.status, 'GENERATED');
      expect(dto.grossEarnings, 0);
      expect(dto.netSalary, 0);
      expect(dto.socialInsurance, 0);
      expect(dto.healthInsurance, 0);
      expect(dto.unemploymentInsurance, 0);
      expect(dto.totalInsurance, 0);
      expect(dto.pitAmount, 0);
      expect(dto.otherDeductions, 0);
      expect(dto.isUnread, isFalse);
      expect(dto.earningBreakdown, isEmpty);
      expect(dto.deductionBreakdown, isEmpty);
      expect(dto.releasedAt, isNull);
      expect(dto.viewedAt, isNull);
    });

    test('copyWith works correctly for status and viewedAt', () {
      const original = PayslipDto(
        id: 'ps_1',
        periodLabel: '04/2026',
        status: 'RELEASED',
        grossEarnings: 10000000,
        netSalary: 9000000,
        socialInsurance: 800000,
        healthInsurance: 150000,
        unemploymentInsurance: 50000,
        pitAmount: 0,
        otherDeductions: 0,
      );

      final updated = original.copyWith(
        status: 'VIEWED',
        viewedAt: '2026-05-01T10:00:00.000Z',
      );

      expect(updated.id, 'ps_1');
      expect(updated.status, 'VIEWED');
      expect(updated.viewedAt, '2026-05-01T10:00:00.000Z');
      expect(updated.isUnread, isFalse);
    });
  });
}

