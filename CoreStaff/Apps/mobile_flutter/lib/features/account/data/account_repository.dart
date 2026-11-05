import '../../../core/network/api_client.dart';
import 'models/employee_profile_dto.dart';

abstract class AccountRepository {
  Future<EmployeeProfileDto> getMyProfile();
}

class AccountRepositoryImpl implements AccountRepository {
  final ApiClient apiClient;

  AccountRepositoryImpl({required this.apiClient});

  @override
  Future<EmployeeProfileDto> getMyProfile() async {
    final data = await apiClient.get<Map<String, dynamic>>('/api/hr/employees/me');
    return EmployeeProfileDto.fromJson(data);
  }
}

