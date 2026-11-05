import 'app_exception.dart';

class ErrorResolver {
  ErrorResolver._();

  static const Map<String, String> _domainMessages = {
    // Auth errors
    'VALIDATION_FAILED': 'Thông tin bạn nhập chưa hợp lệ.',
    'AUTH_INVALID_CREDENTIALS': 'Tài khoản hoặc mật khẩu không chính xác.',
    'AUTH_AMBIGUOUS_IDENTIFIER': 'Tài khoản không xác định. Vui lòng kiểm tra lại.',
    'AUTH_ACCOUNT_DISABLED': 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ bộ phận Nhân sự.',
    'AUTH_ACCOUNT_LOCKED': 'Tài khoản tạm thời bị khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau.',
    'AUTH_SESSION_EXPIRED': 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.',
    'AUTH_CURRENT_PASSWORD_INVALID': 'Mật khẩu hiện tại không chính xác.',
    'AUTH_PASSWORD_POLICY_FAILED':
        'Mật khẩu mới không đạt yêu cầu bảo mật (tối thiểu 8 ký tự, gồm chữ và số).',
    'AUTH_PASSWORD_CHANGE_REQUIRED': 'Bạn cần đổi mật khẩu trước khi tiếp tục.',
    'AUTH_RESET_TOKEN_INVALID': 'Mã khôi phục không hợp lệ hoặc đã hết hạn.',
    'TENANT_SUSPENDED': 'Công ty đang bị tạm khóa. Vui lòng liên hệ quản trị viên.',

    // Attendance errors
    'ASSIGNMENT_NOT_CONFIGURED': 'Bạn chưa được phân ca hoặc nơi làm việc. Vui lòng liên hệ HR.',
    'ATTENDANCE_ALREADY_CHECKED_IN': 'Bạn đã điểm danh vào ca hôm nay rồi.',
    'ALREADY_CHECKED_IN': 'Bạn đã điểm danh vào ca hôm nay rồi.',
    'ALREADY_CHECKED_OUT': 'Bạn đã hoàn thành ca hôm nay.',
    'NETWORK_NOT_ALLOWED': 'Mạng hiện tại không thuộc mạng công ty.',
    'SELFIE_REQUIRED': 'Không xác thực được vị trí công ty. Vui lòng chấm công bằng ảnh selfie.',
    'OUTSIDE_ALLOWED_AREA': 'Bạn đang ở ngoài phạm vi chấm công.',
    'LOW_LOCATION_ACCURACY': 'Tín hiệu GPS chưa đủ chính xác. Hãy ra nơi thoáng hơn và thử lại.',
    'ATTENDANCE_LOCKED': 'Kỳ công đã khóa, không thể thay đổi.',

    // Leave & OT errors
    'LEAVE_BALANCE_INSUFFICIENT': 'Số ngày phép khả dụng không đủ cho yêu cầu này.',
    'REQUEST_ALREADY_PROCESSED': 'Yêu cầu này đã được xử lý trước đó.',
    'LEAVE_DATE_RANGE_INVALID': 'Khoảng ngày nghỉ chưa hợp lệ.',
    'LEAVE_RANGE_TOO_LARGE': 'Khoảng thời gian xin nghỉ không được vượt quá 366 ngày.',
    'PARTIAL_LEAVE_SINGLE_DAY_REQUIRED': 'Đơn nghỉ một phần ngày chỉ áp dụng cho một ngày.',
    'LEAVE_NON_WORKING_DAY': 'Ngày đã chọn không phải ngày làm việc.',
    'LEAVE_WORK_SCHEDULE_REQUIRED': 'Chưa cấu hình lịch làm việc cho khoảng thời gian này.',
    'LEAVE_WORK_SCHEDULE_INVALID': 'Lịch làm việc của ngày đã chọn không hợp lệ.',
    'LEAVE_REQUEST_INTERVAL_INVALID': 'Khung giờ xin nghỉ không hợp lệ.',
    'LEAVE_INTERVAL_OUTSIDE_WORKING_TIME': 'Khung giờ xin nghỉ nằm ngoài thời gian làm việc.',
    'LEAVE_REQUEST_OVERLAP': 'Khoảng thời gian xin nghỉ trùng với đơn khác đã gửi.',
    'LEAVE_REQUEST_NOT_FOUND': 'Không tìm thấy đơn nghỉ phép.',
    'LEAVE_REQUEST_CANNOT_CANCEL': 'Đơn nghỉ phép đã được xử lý, không thể hủy.',
    'LEAVE_REQUEST_ALREADY_DECIDED': 'Đơn nghỉ phép đã có quyết định phê duyệt.',
    'OVERTIME_OVERLAPS_SCHEDULE': 'Khung giờ OT đang trùng với ca làm chính.',
    'OVERTIME_REQUEST_WINDOW_INVALID': 'Giờ bắt đầu phải sớm hơn giờ kết thúc.',
    'OVERTIME_OVERLAP': 'Khung giờ này đang trùng với một đăng ký tăng ca khác.',
    'OVERTIME_RETROACTIVE_REASON_REQUIRED': 'Đăng ký tăng ca muộn cần nêu rõ lý do khai báo muộn.',
    'OVERTIME_RETROACTIVE_CUTOFF_EXCEEDED': 'Đã quá thời hạn cho phép đăng ký tăng ca bổ sung.',
    'OVERTIME_SELF_TYPE_FORBIDDEN': 'Loại tăng ca do hệ thống tự phân loại.',
    'LABOR_POLICY_NOT_FOUND': 'Chưa cấu hình chính sách lao động.',

    // Profile & Payslip
    'EMPLOYEE_PROFILE_NOT_FOUND': 'Chưa tìm thấy hồ sơ nhân viên. Vui lòng liên hệ HR.',
    'PAYSLIP_NOT_FOUND_OR_NOT_ACCESSIBLE': 'Phiếu lương không tồn tại hoặc bạn không có quyền xem.',
  };

  static String resolveAuthError(String? code, [String? fallback]) {
    if (code != null && _domainMessages.containsKey(code)) {
      return _domainMessages[code]!;
    }
    if (fallback != null && fallback.isNotEmpty) {
      return fallback;
    }
    return 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
  }

  static String resolveEmployeeError(String? code, [String? fallback]) {
    if (code != null && _domainMessages.containsKey(code)) {
      return _domainMessages[code]!;
    }
    if (fallback != null && fallback.isNotEmpty) {
      return fallback;
    }
    return 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
  }

  static String resolve(dynamic error) {
    if (error is ApiException) {
      if (error.code != null && _domainMessages.containsKey(error.code)) {
        return _domainMessages[error.code]!;
      }
      if (error.statusCode == 401) {
        return 'Tài khoản hoặc mật khẩu không chính xác.';
      }
      if (error.message.isNotEmpty && _domainMessages.containsKey(error.message)) {
        return _domainMessages[error.message]!;
      }
      return error.message;
    }

    if (error is AuthException) {
      if (error.code != null && _domainMessages.containsKey(error.code)) {
        return _domainMessages[error.code]!;
      }
      return error.message;
    }

    if (error is NetworkException) {
      return error.message;
    }

    if (error is Exception) {
      final text = error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
      return _domainMessages[text] ?? text;
    }

    return 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
  }
}
