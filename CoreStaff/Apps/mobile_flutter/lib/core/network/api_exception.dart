class AuthApiException implements Exception {
  final String message;
  final int statusCode;
  final String? code;

  AuthApiException(this.message, this.statusCode, [this.code]);

  @override
  String toString() => 'AuthApiException: $message (code: $code, status: $statusCode)';

  static String friendlyMessage(dynamic error) {
    if (error is AuthApiException) {
      switch (error.code) {
        case 'VALIDATION_FAILED':
          return 'Thông tin bạn nhập chưa hợp lệ.';
        case 'AUTH_INVALID_CREDENTIALS':
          return 'Tài khoản hoặc mật khẩu không đúng.';
        case 'AUTH_ACCOUNT_DISABLED':
          return 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ HR.';
        case 'AUTH_ACCOUNT_LOCKED':
          return 'Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau.';
        case 'AUTH_SESSION_EXPIRED':
          return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
        case 'AUTH_CURRENT_PASSWORD_INVALID':
          return 'Mật khẩu hiện tại không đúng.';
        case 'AUTH_PASSWORD_POLICY_FAILED':
          return 'Mật khẩu mới cần ít nhất 8 ký tự, gồm chữ và số, và không trùng mật khẩu hiện tại.';
        case 'AUTH_RESET_TOKEN_INVALID':
          return 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';
      }
      if (error.statusCode == 401) {
        return 'Tài khoản hoặc mật khẩu không đúng.';
      }
      return error.message;
    }

    if (error is Exception) {
      final msg = error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
      return msg;
    }

    return 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
  }
}
