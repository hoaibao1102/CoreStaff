import 'package:corestaff_mobile/core/format.dart';
import 'package:corestaff_mobile/models/auth_user.dart';
import 'package:corestaff_mobile/screens/attendance/day_detail_sheet.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('formatMinutes', () {
    test('đổi phút sang giờ và phút', () {
      expect(formatMinutes(617), '10 giờ 17 phút');
      expect(formatMinutes(125), '2 giờ 5 phút');
      expect(formatMinutes(120), '2 giờ');
      expect(formatMinutes(40), '40 phút');
      expect(formatMinutes(0), '0 phút');
      expect(formatMinutes(null), '-');
    });
  });

  group('formatPeriod', () {
    test('yyyy-MM thành MM/yyyy, giá trị khác giữ nguyên', () {
      expect(formatPeriod('2026-09'), '09/2026');
      expect(formatPeriod('Q3'), 'Q3');
    });
  });

  group('shiftTitle', () {
    test('bỏ phần giờ trong ngoặc ở tên ca', () {
      expect(shiftTitle('Ca hành chính (08:00 - 17:00)'), 'Ca hành chính');
      expect(shiftTitle('Ca sáng'), 'Ca sáng');
      expect(shiftTitle(null, 'Chưa có ca làm'), 'Chưa có ca làm');
    });
  });

  group('AuthUser.initials', () {
    AuthUser user(String name) => AuthUser(
          id: '1',
          email: 'a@b.c',
          fullName: name,
          role: 'EMPLOYEE',
          status: 'ACTIVE',
        );

    test('lấy chữ cái đầu của hai từ cuối', () {
      expect(user('Phạm Hoàng Nam').initials, 'HN');
    });

    test('bỏ qua ký tự gạch ngang như "HR A — TVS"', () {
      expect(user('HR A — TVS').initials, 'AT');
    });
  });

  group('calculateDayCredit', () {
    Map<String, dynamic> day(int worked) => {
          'workDate': '2026-01-05',
          'attendanceStatus': 'COMPLETED',
          'workingMinutes': worked,
          'checkIn': {'recordedAt': '2026-01-05T01:00:00Z'},
          'checkOut': {'recordedAt': '2026-01-05T10:00:00Z'},
        };

    test('đủ 87.5% ca là 1 công, từ 50% là 0.5 công, dưới là 0 công', () {
      expect(calculateDayCredit(day(480), 'ATTENDED', null).credit, 1);
      expect(calculateDayCredit(day(420), 'ATTENDED', null).credit, 1);
      expect(calculateDayCredit(day(300), 'ATTENDED', null).credit, 0.5);
      expect(calculateDayCredit(day(100), 'ATTENDED', null).credit, 0);
    });

    test('thiếu mốc chấm công là tạm tính 0 công', () {
      final c = calculateDayCredit({'workDate': '2026-01-05'}, 'FORGOTTEN', null);
      expect(c.credit, 0);
      expect(c.provisional, true);
    });
  });
}
