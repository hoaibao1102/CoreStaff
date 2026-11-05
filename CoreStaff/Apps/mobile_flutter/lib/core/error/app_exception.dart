abstract class AppException implements Exception {
  final String message;
  final String? code;

  const AppException(this.message, [this.code]);

  @override
  String toString() => message;
}

class ApiException extends AppException {
  final int statusCode;
  final String? path;
  final dynamic rawData;

  const ApiException({
    required String message,
    required this.statusCode,
    String? code,
    this.path,
    this.rawData,
  }) : super(message, code);

  @override
  String toString() => 'ApiException(status: $statusCode, code: $code, message: $message)';
}

class AuthException extends AppException {
  final int statusCode;

  const AuthException(String message, {this.statusCode = 401, String? code})
      : super(message, code);
}

class NetworkException extends AppException {
  const NetworkException([String message = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.'])
      : super(message, 'NETWORK_ERROR');
}

class SessionExpiredException extends AuthException {
  const SessionExpiredException([super.message = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'])
      : super(statusCode: 401, code: 'AUTH_SESSION_EXPIRED');
}

