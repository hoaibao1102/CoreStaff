import '../../../core/network/api_client.dart';
import 'models/leave_preview_dto.dart';
import 'models/leave_request_dto.dart';
import 'models/overtime_request_dto.dart';
import 'models/request_payloads.dart';

abstract class RequestsRepository {
  /// Fetches all leave requests for the authenticated employee/manager.
  /// Calls GET /api/leave-requests/mine
  Future<List<LeaveRequestDto>> getMyLeaveRequests();

  /// Fetches all overtime requests for the authenticated employee/manager.
  /// Calls GET /api/overtime/mine
  Future<List<OvertimeRequestDto>> getMyOvertimeRequests({String? month});

  /// Evaluates leave preview calculation against employee shift and calendar exceptions.
  /// Calls POST /api/leave-requests/preview
  Future<LeavePreviewDto> previewLeave(PreviewLeaveRequestPayload payload);

  /// Submits a new leave request.
  /// Calls POST /api/leave-requests
  Future<LeaveRequestDto> createLeaveRequest(CreateLeaveRequestPayload payload);

  /// Cancels a pending leave request.
  /// Calls POST /api/leave-requests/mine/:id/cancel
  Future<LeaveRequestDto> cancelLeaveRequest(String id);

  /// Submits a new overtime registration.
  /// Calls POST /api/overtime
  Future<OvertimeRequestDto> createOvertimeRequest(CreateOvertimeRequestPayload payload);
}

class RequestsRepositoryImpl implements RequestsRepository {
  final ApiClient apiClient;

  RequestsRepositoryImpl({required this.apiClient});

  @override
  Future<List<LeaveRequestDto>> getMyLeaveRequests() async {
    final data = await apiClient.get<dynamic>('/api/leave-requests/mine');
    if (data is List) {
      return data
          .map((item) => LeaveRequestDto.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  @override
  Future<List<OvertimeRequestDto>> getMyOvertimeRequests({String? month}) async {
    final queryParams = month != null ? {'month': month} : null;
    final data = await apiClient.get<dynamic>(
      '/api/overtime/mine',
      queryParameters: queryParams,
    );
    if (data is List) {
      return data
          .map((item) => OvertimeRequestDto.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  @override
  Future<LeavePreviewDto> previewLeave(PreviewLeaveRequestPayload payload) async {
    final data = await apiClient.post<dynamic>(
      '/api/leave-requests/preview',
      data: payload.toJson(),
    );
    return LeavePreviewDto.fromJson(data as Map<String, dynamic>);
  }

  @override
  Future<LeaveRequestDto> createLeaveRequest(CreateLeaveRequestPayload payload) async {
    final data = await apiClient.post<dynamic>(
      '/api/leave-requests',
      data: payload.toJson(),
    );
    return LeaveRequestDto.fromJson(data as Map<String, dynamic>);
  }

  @override
  Future<LeaveRequestDto> cancelLeaveRequest(String id) async {
    final data = await apiClient.post<dynamic>(
      '/api/leave-requests/mine/${Uri.encodeComponent(id)}/cancel',
    );
    return LeaveRequestDto.fromJson(data as Map<String, dynamic>);
  }

  @override
  Future<OvertimeRequestDto> createOvertimeRequest(CreateOvertimeRequestPayload payload) async {
    final data = await apiClient.post<dynamic>(
      '/api/overtime',
      data: payload.toJson(),
    );
    return OvertimeRequestDto.fromJson(data as Map<String, dynamic>);
  }
}
