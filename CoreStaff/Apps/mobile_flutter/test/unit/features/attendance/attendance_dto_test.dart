import 'package:flutter_test/flutter_test.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_assignment_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_event_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_history_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_requirements_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/today_attendance_dto.dart';
import 'package:corestaff_mobile/features/attendance/presentation/utils/attendance_formatters.dart';

void main() {
  group('Attendance DTO Deserialization & Serialization', () {
    test('AttendanceEventDto fromJson & toJson', () {
      final json = {
        'eventId': 'evt_001',
        'eventType': 'CHECK_IN',
        'method': 'NETWORK',
        'recordedAt': '2026-11-04T08:02:15.000Z',
        'address': 'Bitexco Tower',
        'distanceMeters': 12.5,
        'accuracyMeters': 10.0,
        'latitude': 10.7769,
        'longitude': 106.7009,
        'approvalStatus': 'NOT_REQUIRED',
        'evidenceUrl': null,
      };

      final dto = AttendanceEventDto.fromJson(json);
      expect(dto.eventId, 'evt_001');
      expect(dto.eventType, 'CHECK_IN');
      expect(dto.method, 'NETWORK');
      expect(dto.recordedAt, '2026-11-04T08:02:15.000Z');
      expect(dto.address, 'Bitexco Tower');
      expect(dto.distanceMeters, 12.5);
      expect(dto.accuracyMeters, 10.0);
      expect(dto.approvalStatus, 'NOT_REQUIRED');

      final serialized = dto.toJson();
      expect(serialized['eventId'], 'evt_001');
      expect(serialized['eventType'], 'CHECK_IN');
      expect(serialized['method'], 'NETWORK');
    });

    test('AttendanceAssignmentDto fromJson & defaults', () {
      final json = {
        'shiftName': 'Ca hành chính',
        'shiftHours': '08:00 - 17:00',
        'startTime': '08:00',
        'endTime': '17:00',
        'workplaceName': 'Văn phòng An Phát',
        'workplaceType': 'IN_OFFICE',
        'address': 'Tầng 5, Bitexco',
      };

      final dto = AttendanceAssignmentDto.fromJson(json);
      expect(dto.shiftName, 'Ca hành chính');
      expect(dto.breakMinutes, 60);
      expect(dto.gracePeriodMinutes, 15);
      expect(dto.allowedRadiusMeters, 100.0);
      expect(dto.allowWifiAttendance, true);
      expect(dto.allowGpsAttendance, true);
    });

    test('AttendanceRequirementsDto & PendingLeaveDto fromJson', () {
      final json = {
        'durationTypes': ['CUSTOM_HOURS'],
        'leaveTypes': ['PAID_LEAVE'],
        'approvedLeaveIntervals': [
          {'from': '08:00', 'to': '12:00'}
        ],
        'requiredWorkingIntervals': [
          {'from': '13:00', 'to': '17:00'}
        ],
        'approvedLeaveMinutes': 240,
        'requiredWorkingMinutes': 240,
        'effectiveCheckInTime': '13:00',
        'effectiveCheckOutTime': '17:00',
      };

      final dto = AttendanceRequirementsDto.fromJson(json);
      expect(dto.durationTypes, ['CUSTOM_HOURS']);
      expect(dto.approvedLeaveIntervals.length, 1);
      expect(dto.approvedLeaveIntervals.first.from, '08:00');
      expect(dto.approvedLeaveIntervals.first.to, '12:00');
      expect(dto.approvedLeaveMinutes, 240);
      expect(dto.effectiveCheckInTime, '13:00');

      final pendingJson = {
        'durationType': 'MORNING_HALF',
        'requestedStart': '08:00',
        'requestedEnd': '12:00',
      };
      final pendingDto = PendingLeaveDto.fromJson(pendingJson);
      expect(pendingDto.durationType, 'MORNING_HALF');
      expect(pendingDto.requestedStart, '08:00');
    });

    test('TodayAttendanceDto fromJson composite model', () {
      final json = {
        'workDate': '2026-11-04',
        'serverTime': '2026-11-04T12:00:00.000Z',
        'attendanceStatus': 'CHECKED_IN',
        'availableAction': 'CHECK_OUT',
        'workMode': 'IN_OFFICE',
        'checkIn': {
          'eventId': 'evt_01',
          'eventType': 'CHECK_IN',
          'method': 'NETWORK',
          'recordedAt': '2026-11-04T08:00:00.000Z',
          'approvalStatus': 'NOT_REQUIRED',
        },
        'checkOut': null,
        'workingMinutes': 240,
        'lateMinutes': 0,
        'earlyMinutes': 0,
        'assignment': {
          'shiftName': 'Ca sáng',
          'shiftHours': '08:00 - 17:00',
          'startTime': '08:00',
          'endTime': '17:00',
          'workplaceName': 'Bitexco',
          'address': 'Bitexco',
        },
      };

      final dto = TodayAttendanceDto.fromJson(json);
      expect(dto.workDate, '2026-11-04');
      expect(dto.attendanceStatus, 'CHECKED_IN');
      expect(dto.availableAction, 'CHECK_OUT');
      expect(dto.checkIn?.eventId, 'evt_01');
      expect(dto.checkOut, isNull);
      expect(dto.workingMinutes, 240);
      expect(dto.assignment.shiftName, 'Ca sáng');
    });

    test('AttendanceHistoryDto fromJson', () {
      final json = {
        'month': '2026-11',
        'totalDays': 30,
        'summary': {
          'workingDays': 20,
          'totalWorkingMinutes': 9600,
          'lateDays': 1,
          'earlyDays': 0,
          'otMinutes': 120,
          'otDays': 1,
        },
        'items': [
          {
            '_id': 'day_1',
            'workDate': '2026-11-01',
            'attendanceStatus': 'COMPLETED',
            'workingMinutes': 480,
            'lateMinutes': 0,
            'earlyMinutes': 0,
            'checkIn': {
              'eventId': 'in_1',
              'eventType': 'CHECK_IN',
              'method': 'NETWORK',
              'recordedAt': '2026-11-01T08:00:00.000Z',
              'approvalStatus': 'NOT_REQUIRED',
            },
            'checkOut': {
              'eventId': 'out_1',
              'eventType': 'CHECK_OUT',
              'method': 'NETWORK',
              'recordedAt': '2026-11-01T17:00:00.000Z',
              'approvalStatus': 'NOT_REQUIRED',
            },
            'overtime': {
              'requestId': 'ot_1',
              'status': 'APPROVED',
              'otMinutes': 120,
            },
          }
        ],
      };

      final dto = AttendanceHistoryDto.fromJson(json);
      expect(dto.month, '2026-11');
      expect(dto.totalDays, 30);
      expect(dto.summary.workingDays, 20);
      expect(dto.summary.totalWorkingMinutes, 9600);
      expect(dto.summary.otMinutes, 120);
      expect(dto.items.length, 1);
      final day = dto.items.first;
      expect(day.id, 'day_1');
      expect(day.attendanceStatus, 'COMPLETED');
      expect(day.firstIn, '2026-11-01T08:00:00.000Z');
      expect(day.lastOut, '2026-11-01T17:00:00.000Z');
      expect(day.workedMinutes, 480);
      expect(day.overtimeMinutes, 120);
    });
  });

  group('AttendanceFormatters Utilities', () {
    test('formatTime with UTC timestamp translates to UTC+7', () {
      // 01:00 UTC = 08:00 UTC+7
      expect(AttendanceFormatters.formatTime('2026-11-04T01:00:00.000Z'), '08:00');
      // 10:35 UTC = 17:35 UTC+7
      expect(AttendanceFormatters.formatTime('2026-11-04T10:35:00.000Z'), '17:35');
      expect(AttendanceFormatters.formatTime(null), '--:--');
      expect(AttendanceFormatters.formatTime(''), '--:--');
      expect(AttendanceFormatters.formatTime('malformed'), '--:--');
    });

    test('formatDate translates correctly', () {
      expect(AttendanceFormatters.formatDate('2026-11-04'), '04/11/2026');
      expect(AttendanceFormatters.formatDate('2026-11-04T00:00:00.000Z'), '04/11/2026');
      expect(AttendanceFormatters.formatDate(null), '-');
      expect(AttendanceFormatters.formatDate(''), '-');
    });

    test('formatMinutes produces expected Vietnamese phrasing', () {
      expect(AttendanceFormatters.formatMinutes(480), '8g 00p');
      expect(AttendanceFormatters.formatMinutes(495), '8g 15p');
      expect(AttendanceFormatters.formatMinutes(45), '45 phút');
      expect(AttendanceFormatters.formatMinutes(0), '0 phút');
      expect(AttendanceFormatters.formatMinutes(null), '0 phút');
      expect(AttendanceFormatters.formatMinutes(-10), '0 phút');
    });

    test('intervalText formats list cleanly', () {
      expect(AttendanceFormatters.intervalText([]), 'Không có');
      expect(
        AttendanceFormatters.intervalText([
          const TimeIntervalDto(from: '08:00', to: '12:00'),
          const TimeIntervalDto(from: '13:00', to: '17:00'),
        ]),
        '08:00–12:00, 13:00–17:00',
      );
    });

    test('pendingLeaveText translates duration types', () {
      expect(AttendanceFormatters.pendingLeaveText('MORNING_HALF', null, null), 'Nghỉ buổi sáng');
      expect(AttendanceFormatters.pendingLeaveText('AFTERNOON_HALF', null, null), 'Nghỉ buổi chiều');
      expect(AttendanceFormatters.pendingLeaveText('CUSTOM_HOURS', '08:00', '10:00'), 'Nghỉ theo giờ (08:00–10:00)');
      expect(AttendanceFormatters.pendingLeaveText('FULL_DAY', null, null), 'Nghỉ cả ngày');
    });

    test('formatMonthLabel formats month key to Vietnamese', () {
      expect(AttendanceFormatters.formatMonthLabel('2026-11'), 'Tháng 11/2026');
      expect(AttendanceFormatters.formatMonthLabel('2026-05'), 'Tháng 5/2026');
    });

    test('shiftMonth navigates and bounds checks', () {
      expect(AttendanceFormatters.shiftMonth('2026-05', -1), '2026-04');
      expect(AttendanceFormatters.shiftMonth('2026-01', -1), '2025-12');
      expect(AttendanceFormatters.shiftMonth('2025-12', 1), '2026-01');

      // Cannot navigate beyond current month
      final currentMonth = AttendanceFormatters.currentMonthKey();
      expect(AttendanceFormatters.shiftMonth(currentMonth, 1), currentMonth);
    });
  });
}
