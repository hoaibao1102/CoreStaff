import 'package:flutter_test/flutter_test.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_event_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_requirements_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/punch_request_payload.dart';
import 'package:corestaff_mobile/features/attendance/data/models/punch_result_dto.dart';

void main() {
  group('PunchRequestPayload & Enums Unit Tests', () {
    test('PunchAction paths match backend REST contract', () {
      expect(PunchAction.checkIn.path, '/api/attendance/check-in');
      expect(PunchAction.checkOut.path, '/api/attendance/check-out');
    });

    test('PunchWorkMode maps between strings and enum values', () {
      expect(PunchWorkMode.inOffice.value, 'IN_OFFICE');
      expect(PunchWorkMode.outOffice.value, 'OUT_OFFICE');
      expect(PunchWorkMode.fromString('OUT_OFFICE'), PunchWorkMode.outOffice);
      expect(PunchWorkMode.fromString('IN_OFFICE'), PunchWorkMode.inOffice);
      expect(PunchWorkMode.fromString(null), PunchWorkMode.inOffice);
    });

    test('PunchRequestPayload serializes workMode for check-in and omits for check-out', () {
      const payload = PunchRequestPayload(
        workMode: PunchWorkMode.inOffice,
        location: PunchLocationPayload(
          latitude: 10.7719,
          longitude: 106.7044,
          accuracyMeters: 15.0,
          address: 'Bitexco Financial Tower',
        ),
        wifi: PunchWifiPayload(
          ssid: 'Bitexco_Corp',
          bssid: 'aa:bb:cc:dd:ee:ff',
        ),
        note: 'Đúng giờ',
      );

      final checkInJson = payload.toJson(isCheckIn: true);
      expect(checkInJson['workMode'], 'IN_OFFICE');
      expect(checkInJson['latitude'], 10.7719);
      expect(checkInJson['longitude'], 106.7044);
      expect(checkInJson['accuracyMeters'], 15.0);
      expect(checkInJson['address'], 'Bitexco Financial Tower');
      expect(checkInJson['wifiSsid'], 'Bitexco_Corp');
      expect(checkInJson['wifiBssid'], 'aa:bb:cc:dd:ee:ff');
      expect(checkInJson['note'], 'Đúng giờ');

      final checkOutJson = payload.toJson(isCheckIn: false);
      expect(checkOutJson.containsKey('workMode'), isFalse);
      expect(checkOutJson['latitude'], 10.7719);
    });

    test('PunchRequestPayload hasSelfie reflects selfiePath presence', () {
      const payloadWithout = PunchRequestPayload(workMode: PunchWorkMode.inOffice);
      expect(payloadWithout.hasSelfie, isFalse);

      const payloadWith = PunchRequestPayload(
        workMode: PunchWorkMode.outOffice,
        selfiePath: '/tmp/selfie.jpg',
      );
      expect(payloadWith.hasSelfie, isTrue);
    });
  });

  group('PunchResultDto Unit Tests', () {
    test('correctly deserializes from backend check-in JSON response', () {
      final json = {
        'workDate': '2026-11-04',
        'attendanceStatus': 'CHECKED_IN',
        'availableAction': 'CHECK_OUT',
        'workMode': 'IN_OFFICE',
        'overallApprovalStatus': 'NOT_REQUIRED',
        'workingMinutes': 0,
        'lateMinutes': 5,
        'earlyMinutes': 0,
        'checkIn': {
          'eventId': 'evt_in_1',
          'eventType': 'CHECK_IN',
          'method': 'NETWORK',
          'recordedAt': '2026-11-04T08:05:00.000Z',
          'approvalStatus': 'NOT_REQUIRED',
        },
        'attendanceRequirements': {
          'approvedLeaveMinutes': 0,
          'requiredWorkingMinutes': 480,
          'effectiveCheckInTime': '08:00',
          'effectiveCheckOutTime': '17:00',
        },
      };

      final result = PunchResultDto.fromJson(json);

      expect(result.workDate, '2026-11-04');
      expect(result.attendanceStatus, 'CHECKED_IN');
      expect(result.availableAction, 'CHECK_OUT');
      expect(result.workMode, 'IN_OFFICE');
      expect(result.checkIn?.eventId, 'evt_in_1');
      expect(result.checkIn?.method, 'NETWORK');
      expect(result.lateMinutes, 5);
      expect(result.requiredWorkingMinutes, 480);
      expect(result.attendanceRequirements?.effectiveCheckInTime, '08:00');
    });

    test('toJson and fromJson maintain data integrity', () {
      const dto = PunchResultDto(
        workDate: '2026-11-04',
        attendanceStatus: 'COMPLETED',
        availableAction: 'NONE',
        workMode: 'OUT_OFFICE',
        overallApprovalStatus: 'PENDING',
        workingMinutes: 480,
        lateMinutes: 0,
        earlyMinutes: 0,
        checkIn: AttendanceEventDto(
          eventId: 'in_1',
          eventType: 'CHECK_IN',
          method: 'SELFIE',
          recordedAt: '2026-11-04T08:00:00.000Z',
          approvalStatus: 'PENDING',
        ),
        checkOut: AttendanceEventDto(
          eventId: 'out_1',
          eventType: 'CHECK_OUT',
          method: 'SELFIE',
          recordedAt: '2026-11-04T17:00:00.000Z',
          approvalStatus: 'PENDING',
        ),
        attendanceRequirements: AttendanceRequirementsDto(
          requiredWorkingMinutes: 480,
        ),
      );

      final json = dto.toJson();
      final roundTrip = PunchResultDto.fromJson(json);

      expect(roundTrip.workDate, dto.workDate);
      expect(roundTrip.attendanceStatus, dto.attendanceStatus);
      expect(roundTrip.workingMinutes, 480);
      expect(roundTrip.checkIn?.method, 'SELFIE');
      expect(roundTrip.checkOut?.method, 'SELFIE');
      expect(roundTrip.checkOut?.approvalStatus, 'PENDING');
    });
  });
}
