import 'dart:math';
import '../core/network/api_client.dart';
import '../core/network/api_exception.dart';

typedef Json = Map<String, dynamic>;

/// Vị trí GPS gửi kèm lần chấm công.
class PunchLocation {
  final double latitude;
  final double longitude;
  final double? accuracyMeters;
  final String? address;

  const PunchLocation({
    required this.latitude,
    required this.longitude,
    this.accuracyMeters,
    this.address,
  });

  Json toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        if (accuracyMeters != null) 'accuracyMeters': accuracyMeters,
        if (address != null) 'address': address,
      };
}

String _idempotencyKey() {
  final rnd = Random.secure();
  final suffix = List.generate(8, (_) => rnd.nextInt(36).toRadixString(36)).join();
  return '${DateTime.now().microsecondsSinceEpoch}-$suffix';
}

/// Các API dành cho nhân viên, khớp với `mobile/src/employee-api.ts`.
class EmployeeApi {
  EmployeeApi._();
  static final EmployeeApi instance = EmployeeApi._();
  final ApiClient _c = ApiClient.instance;

  Future<Json> today() => _c.request<Json>(path: '/api/attendance/today');

  Future<Json> history(String month) =>
      _c.request<Json>(path: '/api/attendance/history?month=${Uri.encodeQueryComponent(month)}');

  /// GPS chứng minh IN_OFFICE, selfie chứng minh OUT_OFFICE (hoặc dự phòng
  /// khi server trả SELFIE_REQUIRED). Có selfie thì gửi multipart.
  Future<void> punch(
    String action, {
    String? workMode,
    PunchLocation? location,
    String? selfiePath,
    String? note,
    String? wifiSsid,
    String? wifiBssid,
  }) async {
    final path = action == 'CHECK_IN' ? '/api/attendance/check-in' : '/api/attendance/check-out';
    final headers = {'Idempotency-Key': _idempotencyKey()};
    if (selfiePath == null) {
      await _c.request<dynamic>(
        path: path,
        method: 'POST',
        headers: headers,
        body: {
          if (action == 'CHECK_IN' && workMode != null) 'workMode': workMode,
          if (location != null) 'location': location.toJson(),
          if (note != null && note.isNotEmpty) 'note': note,
          if (wifiSsid != null) 'wifiSsid': wifiSsid,
          if (wifiBssid != null) 'wifiBssid': wifiBssid,
        },
      );
      return;
    }
    final fields = <String, String>{
      if (action == 'CHECK_IN' && workMode != null) 'workMode': workMode,
      if (location != null) 'latitude': '${location.latitude}',
      if (location != null) 'longitude': '${location.longitude}',
      if (location?.accuracyMeters != null) 'accuracyMeters': '${location!.accuracyMeters}',
      if (location?.address != null) 'address': location!.address!,
      if (note != null && note.isNotEmpty) 'note': note,
      if (wifiSsid != null) 'wifiSsid': wifiSsid,
      if (wifiBssid != null) 'wifiBssid': wifiBssid,
    };
    await _c.multipart<dynamic>(
      path: path,
      fields: fields,
      fileField: 'selfie',
      filePath: selfiePath,
      headers: headers,
    );
  }

  Future<List<dynamic>> myLeaves() => _c.request<List<dynamic>>(path: '/api/leave-requests/mine');

  Future<Json> previewLeave(Json payload) =>
      _c.request<Json>(path: '/api/leave-requests/preview', method: 'POST', body: payload);

  Future<Json> createLeave(Json payload) =>
      _c.request<Json>(path: '/api/leave-requests', method: 'POST', body: payload);

  Future<Json> cancelLeave(String id) => _c.request<Json>(
      path: '/api/leave-requests/mine/${Uri.encodeComponent(id)}/cancel', method: 'POST');

  Future<List<dynamic>> myOvertime() => _c.request<List<dynamic>>(path: '/api/overtime/mine');

  Future<Json> createOvertime(Json payload) =>
      _c.request<Json>(path: '/api/overtime', method: 'POST', body: payload);

  Future<Json> myProfile() => _c.request<Json>(path: '/api/hr/employees/me');

  Future<List<dynamic>> myPayslips() => _c.request<List<dynamic>>(path: '/api/payslips/me');

  Future<void> markPayslipViewed(String id) => _c.request<dynamic>(
      path: '/api/payslips/me/${Uri.encodeComponent(id)}/viewed', method: 'POST');
}

const _messages = <String, String>{
  'ASSIGNMENT_NOT_CONFIGURED': 'Bạn chưa được phân ca hoặc nơi làm việc. Vui lòng liên hệ HR.',
  'ALREADY_CHECKED_IN': 'Bạn đã vào ca hôm nay.',
  'ALREADY_CHECKED_OUT': 'Bạn đã hoàn thành ca hôm nay.',
  'NETWORK_NOT_ALLOWED': 'Mạng hiện tại không thuộc mạng công ty.',
  'SELFIE_REQUIRED': 'Không xác thực được vị trí công ty. Vui lòng chấm công bằng ảnh selfie.',
  'UNSUPPORTED_FILE_TYPE': 'Ảnh không đúng định dạng (chỉ nhận JPG, PNG hoặc WebP). Vui lòng chụp lại.',
  'FILE_TOO_LARGE': 'Ảnh quá lớn (tối đa 5MB). Vui lòng chụp lại.',
  'OUTSIDE_ALLOWED_AREA':'Bạn đang ở ngoài phạm vi chấm công.',
  'LOW_LOCATION_ACCURACY': 'Tín hiệu GPS chưa đủ chính xác. Hãy ra nơi thoáng hơn và thử lại.',
  'ATTENDANCE_LOCKED': 'Kỳ công đã khóa, không thể thay đổi.',
  'LEAVE_DATE_RANGE_INVALID': 'Khoảng ngày nghỉ chưa hợp lệ.',
  'LEAVE_WORK_SCHEDULE_REQUIRED': 'Ngày này bạn không có lịch làm việc (có thể là ngày nghỉ). Hãy chọn ngày khác.',
  'LEAVE_WORK_SCHEDULE_INVALID': 'Lịch làm việc của ngày này chưa hợp lệ. Vui lòng liên hệ HR.',
  'LEAVE_NON_WORKING_DAY': 'Ngày này là ngày nghỉ, không cần xin nghỉ phép.',
  'LEAVE_INTERVAL_OUTSIDE_WORKING_TIME': 'Khoảng giờ xin nghỉ nằm ngoài giờ làm việc của ca.',
  'LEAVE_RANGE_TOO_LARGE': 'Khoảng ngày xin nghỉ quá dài. Hãy chia thành nhiều đơn.',
  'LEAVE_REQUEST_OVERLAP': 'Bạn đã có đơn nghỉ trùng thời gian này.',
  'LEAVE_REQUEST_INTERVAL_INVALID': 'Khoảng giờ xin nghỉ chưa hợp lệ.',
  'LEAVE_DAY_ALREADY_OVERRIDDEN': 'Ngày này đã được HR điều chỉnh, không thể gửi thêm đơn.',
  'REVIEW_REASON_REQUIRED': 'Vui lòng nhập ý kiến xử lý (tối thiểu vài ký tự).',
  'LEAVE_REJECTION_REASON_REQUIRED': 'Vui lòng nhập lý do từ chối (tối thiểu 3 ký tự).',
  'REQUEST_STATE_CHANGED': 'Đơn này vừa được cập nhật ở nơi khác. Hãy kéo để tải lại danh sách.',
  'LEAVE_REQUEST_NOT_PENDING': 'Đơn này đã được xử lý.',
  'LEAVE_REQUEST_ALREADY_DECIDED': 'Đơn này đã được xử lý.',
  'SELF_APPROVAL_FORBIDDEN': 'Bạn không thể tự duyệt đơn của chính mình.',
  'LEAVE_SELF_APPROVAL_FORBIDDEN': 'Bạn không thể tự duyệt đơn của chính mình.',
  'DEPARTMENT_SCOPE_VIOLATION': 'Đơn này không thuộc phòng ban bạn phụ trách.',
  'PERIOD_CLOSED_OR_PAYROLL_CLAIMED': 'Kỳ công đã khóa hoặc đã chốt lương, không thể thay đổi.',
  'REQUEST_NOT_FOUND': 'Không tìm thấy đơn này.',
  'DEPARTMENT_MANAGER_NOT_FOUND': 'Bạn chưa được gán phụ trách phòng ban nào. Vui lòng liên hệ HR.',
  'OVERTIME_ANNUAL_LIMIT_EXCEEDED': 'Bạn đã vượt giới hạn tăng ca trong năm.',
  'OVERTIME_MONTHLY_LIMIT_EXCEEDED': 'Bạn đã vượt giới hạn tăng ca trong tháng.',
  'OVERTIME_DAILY_LIMIT_EXCEEDED': 'Bạn đã vượt giới hạn tăng ca trong ngày.',
  'OVERTIME_ATTENDANCE_INCOMPLETE': 'Chưa thể đăng ký tăng ca: ngày này bạn chưa có bản ghi chấm công vào/ra hoàn chỉnh.',
  'OVERTIME_ATTENDANCE_NOT_VERIFIED': 'Chấm công của ngày này chưa được xác thực nên chưa thể đăng ký tăng ca.',
  'OVERTIME_BELOW_MINIMUM': 'Thời lượng tăng ca chưa đạt mức tối thiểu theo chính sách.',
  'OVERTIME_FILING_WINDOW_CLOSED': 'Đã quá thời hạn đăng ký tăng ca cho ngày này.',
  'OVERTIME_WINDOW_INVALID': 'Khung giờ tăng ca chưa hợp lệ.',
  'OVERTIME_POLICY_NOT_FOUND': 'Công ty chưa cấu hình chính sách tăng ca. Vui lòng liên hệ HR.',
  'OVERTIME_OVERLAPS_SCHEDULE': 'Khung giờ OT đang trùng với ca làm chính.',
  'OVERTIME_REQUEST_WINDOW_INVALID': 'Giờ bắt đầu phải sớm hơn giờ kết thúc.',
  'OVERTIME_OVERLAP': 'Khung giờ này đang trùng với một đăng ký tăng ca khác.',
  'OVERTIME_RETROACTIVE_REASON_REQUIRED': 'Đăng ký tăng ca muộn cần nêu rõ lý do khai báo muộn.',
  'EMPLOYEE_PROFILE_NOT_FOUND': 'Chưa tìm thấy hồ sơ nhân viên. Vui lòng liên hệ HR.',
  'PAYSLIP_NOT_FOUND_OR_NOT_ACCESSIBLE': 'Phiếu lương không tồn tại hoặc bạn không có quyền xem.',
};

String friendlyEmployeeError(Object error) {
  if (error is AuthApiException) {
    return _messages[error.code] ?? _messages[error.message] ?? error.message;
  }
  return error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
}
