import '../../../core/network/api_client.dart';
import 'models/payslip_dto.dart';

abstract class PayslipRepository {
  Future<List<PayslipDto>> getMyPayslips();
  Future<void> markViewed(String id);
}

class PayslipRepositoryImpl implements PayslipRepository {
  final ApiClient apiClient;

  PayslipRepositoryImpl({required this.apiClient});

  @override
  Future<List<PayslipDto>> getMyPayslips() async {
    final data = await apiClient.get<dynamic>('/api/payslips/me');
    if (data is List) {
      return data
          .map((item) => PayslipDto.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  @override
  Future<void> markViewed(String id) async {
    await apiClient.post<dynamic>(
      '/api/payslips/me/${Uri.encodeComponent(id)}/viewed',
    );
  }
}

