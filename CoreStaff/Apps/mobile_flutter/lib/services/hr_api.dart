import '../core/network/api_client.dart';
import '../widgets/cards.dart';
import 'employee_api.dart';

/// API của HR, khớp với `web/src/services/hrService.ts` và `leave.service.ts`.
/// Mobile chỉ dùng phần đọc cùng thao tác "áp dụng đơn nghỉ" (những việc HR cần làm khi đang di chuyển).
class HrApi {
  HrApi._();
  static final HrApi instance = HrApi._();
  final ApiClient _c = ApiClient.instance;

  Future<List<dynamic>> employees() => _c.request<List<dynamic>>(path: '/api/hr/employees');
  Future<List<dynamic>> departments() => _c.request<List<dynamic>>(path: '/api/hr/departments');
  Future<List<dynamic>> contracts() => _c.request<List<dynamic>>(path: '/api/hr/contracts');
  Future<Json> compliance() => _c.request<Json>(path: '/api/hr/contracts/compliance');
  Future<List<dynamic>> leaves() => _c.request<List<dynamic>>(path: '/api/hr/leave-requests');
  Future<List<dynamic>> timesheetPeriods() => _c.request<List<dynamic>>(path: '/api/hr/timesheet-periods');

  Future<Json> applyLeave(String id) =>
      _c.request<Json>(path: '/api/hr/leave-requests/${Uri.encodeComponent(id)}/apply', method: 'POST');
}

String employmentStatusLabel(String? s) => const {
      'PROBATION': 'Thử việc',
      'ACTIVE': 'Đang làm việc',
      'ON_LEAVE': 'Đang nghỉ phép',
      'RESIGNED': 'Đã nghỉ việc',
      'TERMINATED': 'Đã chấm dứt',
    }[s] ??
    (s ?? '-');

BadgeTone employmentStatusTone(String? s) => switch (s) {
      'ACTIVE' => BadgeTone.success,
      'PROBATION' => BadgeTone.warning,
      'ON_LEAVE' => BadgeTone.info,
      _ => BadgeTone.neutral,
    };

String employmentTypeLabel(String? s) => const {
      'FULL_TIME': 'Toàn thời gian',
      'PART_TIME': 'Bán thời gian',
      'INTERN': 'Thực tập',
      'CONTRACTOR': 'Cộng tác viên',
    }[s] ??
    (s ?? '-');

String contractTypeLabel(String? s) => const {
      'PROBATION': 'Thử việc',
      'FIXED_TERM': 'Có thời hạn',
      'INDEFINITE_TERM': 'Không thời hạn',
    }[s] ??
    (s ?? '-');

String contractStatusLabel(String? s) => const {
      'DRAFT': 'Nháp',
      'ACTIVE': 'Đang hiệu lực',
      'EXPIRED': 'Hết hiệu lực',
      'TERMINATED': 'Đã chấm dứt',
    }[s] ??
    (s ?? '-');

BadgeTone contractStatusTone(String? s) => switch (s) {
      'ACTIVE' => BadgeTone.success,
      'EXPIRED' => BadgeTone.danger,
      _ => BadgeTone.neutral,
    };

String complianceLabel(String? code) => const {
      'NO_CONTRACT': 'Chưa có hợp đồng',
      'ACTIVE_PAST_EXPIRY': 'Hợp đồng quá hạn vẫn đang làm',
      'EXPIRED_NOT_RENEWED': 'Hợp đồng hết hạn chưa gia hạn',
    }[code] ??
    (code ?? '-');

String periodStatusLabel(String? s) => const {
      'OPEN': 'Đang mở',
      'REVIEWING': 'Đang rà soát',
      'READY_TO_CLOSE': 'Sẵn sàng chốt',
      'CLOSED': 'Đã chốt',
      'LOCKED': 'Đã khóa',
    }[s] ??
    (s ?? '-');
