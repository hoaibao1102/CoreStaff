import '../core/network/api_client.dart';
import 'employee_api.dart';

/// API của quản lý phòng ban, khớp với `mobile/src/manager-api.ts`.
class ManagerApi {
  ManagerApi._();
  static final ManagerApi instance = ManagerApi._();
  final ApiClient _c = ApiClient.instance;

  Future<List<dynamic>> team() => _c.request<List<dynamic>>(path: '/api/manager/employees');

  Future<List<dynamic>> pendingApprovals() =>
      _c.request<List<dynamic>>(path: '/api/manager/approvals?status=PENDING');

  Future<List<dynamic>> pendingLeaves() =>
      _c.request<List<dynamic>>(path: '/api/manager/leave-requests?status=PENDING_MANAGER');

  Future<Json> approveLeave(String id) => _c.request<Json>(
      path: '/api/manager/leave-requests/${Uri.encodeComponent(id)}/approve', method: 'POST');

  Future<Json> rejectLeave(String id, String reason) => _c.request<Json>(
        path: '/api/manager/leave-requests/${Uri.encodeComponent(id)}/reject',
        method: 'POST',
        body: {'reason': reason},
      );

  /// [action]: approve | reject | request-clarification
  Future<Json> decideApproval(Json item, String action, {String? reason}) => _c.request<Json>(
        path: '/api/manager/approvals/${Uri.encodeComponent('${item['_id']}')}/$action',
        method: 'POST',
        body: {
          'expectedVersion': item['version'],
          if (reason != null && reason.isNotEmpty) 'reason': reason,
          'approvedStart': item['requestedStart'],
          'approvedEnd': item['requestedEnd'],
        },
      );
}

/// Đơn xác nhận công theo lịch cần kiểm tra kỳ công nên chỉ duyệt được trên web.
bool isWebOnlyApproval(Json item) {
  final meta = item['metadata'];
  return item['requestKind'] == 'ATTENDANCE_CONFIRMATION' ||
      item['source'] == 'ATTENDANCE_CONFIRMATION' ||
      (meta is Map && meta['adjustmentSource'] == 'ATTENDANCE_CONFIRMATION');
}

String approvalLabel(Json item) {
  if (item['type'] == 'OVERTIME') return 'Tăng ca (OT)';
  if (isWebOnlyApproval(item)) return 'Xác nhận công theo lịch';
  final meta = item['metadata'];
  return meta is Map && meta['adjustmentSource'] == 'MANUAL_ADJUSTMENT'
      ? 'Điều chỉnh công'
      : 'Chấm công selfie';
}

/// userId của nhân viên, từ trường populate hoặc id thô.
String approvalEmployeeKey(Json item) {
  String pick(dynamic v) {
    if (v == null) return '';
    if (v is String) return v;
    if (v is Map) return '${v['_id'] ?? v['id'] ?? ''}';
    return '';
  }

  final a = pick(item['employeeUserId']);
  return a.isNotEmpty ? a : pick(item['employeeId']);
}
