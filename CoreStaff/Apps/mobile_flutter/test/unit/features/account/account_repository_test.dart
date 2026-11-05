import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_client.dart';
import 'package:corestaff_mobile/features/account/data/account_repository.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late AccountRepository repository;

  setUp(() {
    mockApiClient = MockApiClient();
    repository = AccountRepositoryImpl(apiClient: mockApiClient);
  });

  group('AccountRepository Tests', () {
    test('getMyProfile calls GET /api/hr/employees/me and returns EmployeeProfileDto', () async {
      when(() => mockApiClient.get<Map<String, dynamic>>('/api/hr/employees/me')).thenAnswer(
        (_) async => {
          '_id': 'profile_abc',
          'fullName': 'Lê Thị Thu',
          'employeeCode': 'EMP999',
          'employmentType': 'FULL_TIME',
          'employmentStatus': 'ACTIVE',
          'departmentName': 'Phòng Kế Toán',
        },
      );

      final profile = await repository.getMyProfile();

      expect(profile.id, 'profile_abc');
      expect(profile.fullName, 'Lê Thị Thu');
      expect(profile.employeeCode, 'EMP999');
      expect(profile.departmentName, 'Phòng Kế Toán');
      verify(() => mockApiClient.get<Map<String, dynamic>>('/api/hr/employees/me')).called(1);
    });
  });
}

