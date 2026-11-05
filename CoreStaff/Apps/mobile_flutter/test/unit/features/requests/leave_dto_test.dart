import 'package:flutter_test/flutter_test.dart';
import 'package:corestaff_mobile/features/requests/data/models/leave_preview_dto.dart';
import 'package:corestaff_mobile/features/requests/data/models/leave_request_dto.dart';

void main() {
  group('LeaveDto Tests', () {
    test('correctly deserializes LeaveRequestDto from backend API JSON', () {
      final json = {
        '_id': 'leave_001',
        'startDate': '2026-11-10',
        'endDate': '2026-11-10',
        'leaveType': 'PAID_LEAVE',
        'durationType': 'CUSTOM_HOURS',
        'requestedStart': '08:00',
        'requestedEnd': '12:00',
        'calculatedMinutes': 240,
        'leaveEquivalent': 0.5,
        'approvedLeaveIntervals': [
          {'from': '08:00', 'to': '12:00'},
        ],
        'requiredWorkingIntervals': [
          {'from': '13:00', 'to': '17:00'},
        ],
        'reason': 'Khám sức khỏe định kỳ tại bệnh viện',
        'status': 'PENDING_MANAGER',
        'reviewComment': null,
        'reviewedBy': null,
        'createdAt': '2026-11-04T12:00:00.000Z',
        'updatedAt': '2026-11-04T12:00:00.000Z',
      };

      final dto = LeaveRequestDto.fromJson(json);

      expect(dto.id, 'leave_001');
      expect(dto.startDate, '2026-11-10');
      expect(dto.endDate, '2026-11-10');
      expect(dto.leaveType, 'PAID_LEAVE');
      expect(dto.isPaidLeave, isTrue);
      expect(dto.leaveTypeLabel, 'Nghỉ phép có lương');
      expect(dto.durationType, 'CUSTOM_HOURS');
      expect(dto.durationLabel, 'Theo giờ');
      expect(dto.requestedStart, '08:00');
      expect(dto.requestedEnd, '12:00');
      expect(dto.calculatedMinutes, 240);
      expect(dto.formattedDuration, '4 giờ');
      expect(dto.leaveEquivalent, 0.5);
      expect(dto.formattedDays, '0.5 ngày phép');
      expect(dto.isCancellable, isTrue);
      expect(dto.reason, 'Khám sức khỏe định kỳ tại bệnh viện');
      expect(dto.status, 'PENDING_MANAGER');
      expect(dto.approvedLeaveIntervals.length, 1);
      expect(dto.approvedLeaveIntervals[0].from, '08:00');
      expect(dto.approvedLeaveIntervals[0].to, '12:00');
      expect(dto.requiredWorkingIntervals.length, 1);
      expect(dto.requiredWorkingIntervals[0].from, '13:00');
      expect(dto.requiredWorkingIntervals[0].to, '17:00');
    });

    test('handles fallback defaults and formatting edge cases', () {
      final json = <String, dynamic>{
        'id': 'leave_minimal',
        'startDate': '2026-11-12',
        'endDate': '2026-11-14',
        'reason': 'Việc gia đình cá nhân',
      };

      final dto = LeaveRequestDto.fromJson(json);

      expect(dto.id, 'leave_minimal');
      expect(dto.leaveType, 'PAID_LEAVE');
      expect(dto.durationType, 'FULL_DAY');
      expect(dto.durationLabel, 'Cả ngày');
      expect(dto.status, 'PENDING_MANAGER');
      expect(dto.calculatedMinutes, isNull);
      expect(dto.formattedDuration, '');
      expect(dto.formattedDays, '');
      expect(dto.approvedLeaveIntervals, isEmpty);
      expect(dto.requiredWorkingIntervals, isEmpty);
    });

    test('duration labels and formatted durations for minute splits', () {
      const morning = LeaveRequestDto(
        id: '1',
        startDate: '2026-11-10',
        endDate: '2026-11-10',
        leaveType: 'UNPAID_LEAVE',
        durationType: 'MORNING_HALF',
        calculatedMinutes: 210,
        leaveEquivalent: 0.5,
        reason: 'Lý do xin nghỉ việc gia đình',
        status: 'APPROVED',
      );

      expect(morning.isPaidLeave, isFalse);
      expect(morning.leaveTypeLabel, 'Nghỉ không lương');
      expect(morning.durationLabel, 'Buổi sáng');
      expect(morning.formattedDuration, '3 giờ 30 phút');
      expect(morning.isCancellable, isFalse);

      const afternoon = LeaveRequestDto(
        id: '2',
        startDate: '2026-11-10',
        endDate: '2026-11-10',
        leaveType: 'PAID_LEAVE',
        durationType: 'AFTERNOON_HALF',
        calculatedMinutes: 45,
        leaveEquivalent: 0.1,
        reason: 'Lý do xin nghỉ việc cá nhân',
        status: 'PENDING',
      );

      expect(afternoon.durationLabel, 'Buổi chiều');
      expect(afternoon.formattedDuration, '45 phút');
      expect(afternoon.isCancellable, isTrue);
    });

    test('copyWith updates status and reviewComment correctly', () {
      const original = LeaveRequestDto(
        id: 'leave_10',
        startDate: '2026-11-15',
        endDate: '2026-11-15',
        leaveType: 'PAID_LEAVE',
        reason: 'Khám bệnh định kỳ',
        status: 'PENDING_MANAGER',
      );

      final updated = original.copyWith(
        status: 'CANCELLED',
        reviewComment: 'Đã hủy bởi nhân viên',
      );

      expect(updated.id, 'leave_10');
      expect(updated.status, 'CANCELLED');
      expect(updated.reviewComment, 'Đã hủy bởi nhân viên');
      expect(updated.isCancellable, isFalse);
    });

    test('deserializes LeavePreviewDto correctly', () {
      final json = {
        'durationType': 'CUSTOM_HOURS',
        'requestedStart': '08:00',
        'requestedEnd': '12:00',
        'calculatedMinutes': 240,
        'leaveEquivalent': 0.5,
        'days': [
          {
            'date': '2026-11-10',
            'shiftStart': '08:00',
            'shiftEnd': '17:00',
            'breakMinutes': 60,
            'breakStart': '12:00',
            'breakEnd': '13:00',
            'requestedStart': '08:00',
            'requestedEnd': '12:00',
            'calculatedMinutes': 240,
            'leaveEquivalent': 0.5,
            'approvedLeaveIntervals': [
              {'from': '08:00', 'to': '12:00'},
            ],
            'requiredWorkingIntervals': [
              {'from': '13:00', 'to': '17:00'},
            ],
          }
        ],
      };

      final preview = LeavePreviewDto.fromJson(json);

      expect(preview.durationType, 'CUSTOM_HOURS');
      expect(preview.calculatedMinutes, 240);
      expect(preview.formattedDuration, '4 giờ');
      expect(preview.leaveEquivalent, 0.5);
      expect(preview.formattedDays, '0.5 ngày phép');
      expect(preview.days.length, 1);
      expect(preview.days[0].shiftStart, '08:00');
      expect(preview.days[0].shiftEnd, '17:00');
      expect(preview.days[0].breakStart, '12:00');
      expect(preview.days[0].breakEnd, '13:00');
      expect(preview.days[0].breakMinutes, 60);
    });
  });
}
