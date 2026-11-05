import 'package:flutter_test/flutter_test.dart';
import 'package:corestaff_mobile/features/requests/data/models/overtime_request_dto.dart';

void main() {
  group('OvertimeDto Tests', () {
    test('correctly deserializes OvertimeRequestDto with nested overtimeResult', () {
      final json = {
        '_id': 'ot_001',
        'workDate': '2026-11-04',
        'requestedStart': '2026-11-04T18:00:00+07:00',
        'requestedEnd': '2026-11-04T20:00:00+07:00',
        'approvedStart': null,
        'approvedEnd': null,
        'reason': 'Hoàn thành tiến độ kiểm thử ứng dụng',
        'workDescription': 'Kiểm thử màn hình Requests và modal sheet',
        'retroactiveReason': null,
        'isRetroactive': false,
        'status': 'PENDING',
        'reviewComment': null,
        'reviewedBy': null,
        'overtimeResult': {
          'eligibleMinutes': 120,
          'overtimeType': 'WORKING_DAY',
          'actualMinutes': 120,
          'classificationStatus': 'FINAL',
          'calculationNote': 'Đạt điều kiện tăng ca ngày làm việc',
        },
        'createdAt': '2026-11-04T11:00:00.000Z',
        'updatedAt': '2026-11-04T11:00:00.000Z',
      };

      final dto = OvertimeRequestDto.fromJson(json);

      expect(dto.id, 'ot_001');
      expect(dto.workDate, '2026-11-04');
      expect(dto.requestedStart, '2026-11-04T18:00:00+07:00');
      expect(dto.requestedEnd, '2026-11-04T20:00:00+07:00');
      expect(dto.reason, 'Hoàn thành tiến độ kiểm thử ứng dụng');
      expect(dto.workDescription, 'Kiểm thử màn hình Requests và modal sheet');
      expect(dto.isRetroactive, isFalse);
      expect(dto.status, 'PENDING');
      expect(dto.eligibleMinutes, 120);
      expect(dto.overtimeResult?.overtimeType, 'WORKING_DAY');
      expect(dto.overtimeResult?.actualMinutes, 120);
      expect(dto.overtimeResult?.classificationStatus, 'FINAL');
    });

    test('correctly deserializes flattened overtimeResult properties and handles ISO workDate', () {
      final json = {
        'id': 'ot_002',
        'workDate': '2026-11-05T00:00:00.000Z',
        'requestedStart': '2026-11-05T18:00:00+07:00',
        'requestedEnd': '2026-11-05T21:30:00+07:00',
        'reason': 'Bảo trì hệ thống server ca đêm',
        'status': 'APPROVED',
        'eligibleMinutes': 210,
        'overtimeType': 'WEEKLY_OFF',
        'actualMinutes': 210,
        'classificationStatus': 'FINAL',
        'reviewComment': 'Đồng ý duyệt tăng ca',
      };

      final dto = OvertimeRequestDto.fromJson(json);

      expect(dto.id, 'ot_002');
      expect(dto.workDate, '2026-11-05');
      expect(dto.status, 'APPROVED');
      expect(dto.eligibleMinutes, 210);
      expect(dto.overtimeResult?.overtimeType, 'WEEKLY_OFF');
      expect(dto.reviewComment, 'Đồng ý duyệt tăng ca');
    });

    test('handles fallback defaults when overtimeResult is absent', () {
      final json = <String, dynamic>{
        'id': 'ot_003',
        'workDate': '2026-11-06',
        'reason': 'Làm thêm báo cáo tuần',
      };

      final dto = OvertimeRequestDto.fromJson(json);

      expect(dto.id, 'ot_003');
      expect(dto.workDate, '2026-11-06');
      expect(dto.status, 'PENDING');
      expect(dto.eligibleMinutes, isNull);
      expect(dto.overtimeResult, isNull);
      expect(dto.isRetroactive, isFalse);
    });
  });
}
