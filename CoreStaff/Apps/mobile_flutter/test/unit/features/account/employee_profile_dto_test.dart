import 'package:flutter_test/flutter_test.dart';
import 'package:corestaff_mobile/features/account/data/models/employee_profile_dto.dart';

void main() {
  group('EmployeeProfileDto Tests', () {
    test('correctly deserializes from backend API JSON', () {
      final json = {
        '_id': 'emp_123',
        'fullName': 'Nguyễn Văn An',
        'employeeCode': 'EMP001',
        'employmentType': 'FULL_TIME',
        'employmentStatus': 'ACTIVE',
        'phone': '0901234567',
        'email': 'an.nguyen@corestaff.vn',
        'address': '123 Đường Lê Lợi, Q1, TP.HCM',
        'joinDate': '2023-01-15T00:00:00.000Z',
        'departmentName': 'Phòng Kỹ Thuật',
        'positionName': 'Lập trình viên Mobile',
        'managerName': 'Trần Văn Quản Lý',
        'workplaceName': 'Trụ sở chính',
      };

      final dto = EmployeeProfileDto.fromJson(json);

      expect(dto.id, 'emp_123');
      expect(dto.fullName, 'Nguyễn Văn An');
      expect(dto.employeeCode, 'EMP001');
      expect(dto.employmentType, 'FULL_TIME');
      expect(dto.employmentStatus, 'ACTIVE');
      expect(dto.phone, '0901234567');
      expect(dto.email, 'an.nguyen@corestaff.vn');
      expect(dto.address, '123 Đường Lê Lợi, Q1, TP.HCM');
      expect(dto.joinDate, '2023-01-15T00:00:00.000Z');
      expect(dto.departmentName, 'Phòng Kỹ Thuật');
      expect(dto.positionName, 'Lập trình viên Mobile');
      expect(dto.managerName, 'Trần Văn Quản Lý');
      expect(dto.workplaceName, 'Trụ sở chính');
      expect(dto.initials, 'VA');
    });

    test('handles fallback defaults when fields are missing or null', () {
      final json = <String, dynamic>{
        'id': 'emp_empty',
      };

      final dto = EmployeeProfileDto.fromJson(json);

      expect(dto.id, 'emp_empty');
      expect(dto.fullName, isNull);
      expect(dto.employeeCode, '');
      expect(dto.employmentType, 'FULL_TIME');
      expect(dto.employmentStatus, 'ACTIVE');
      expect(dto.initials, 'NV');
    });
  });
}

