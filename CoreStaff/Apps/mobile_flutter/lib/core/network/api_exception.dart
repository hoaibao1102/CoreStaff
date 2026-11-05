import '../error/app_exception.dart';
import '../error/error_resolver.dart';

export '../error/app_exception.dart';

class AuthApiException implements Exception {
  final String message;
  final int statusCode;
  final String? code;

  AuthApiException(this.message, this.statusCode, [this.code]);

  @override
  String toString() => 'AuthApiException: $message (code: $code, status: $statusCode)';

  static String friendlyMessage(dynamic error) {
    if (error is AuthApiException) {
      return ErrorResolver.resolveAuthError(error.code, error.message);
    }
    if (error is ApiException) {
      return ErrorResolver.resolveAuthError(error.code, error.message);
    }
    if (error is NetworkException) {
      return error.message;
    }
    if (error is AppException) {
      return error.message;
    }
    if (error is Exception) {
      final msg = error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
      return msg;
    }
    return 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
  }
}
