import 'package:flutter_test/flutter_test.dart';
import 'package:corestaff_mobile/core/error/error_resolver.dart';

void main() {
  group('ErrorResolver', () {
    test('resolves known auth error codes to friendly Vietnamese messages', () {
      expect(
        ErrorResolver.resolveAuthError('AUTH_INVALID_CREDENTIALS', 'default'),
        'Tài khoản hoặc mật khẩu không chính xác.',
      );
      expect(
        ErrorResolver.resolveAuthError('AUTH_ACCOUNT_DISABLED', 'default'),
        'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ bộ phận Nhân sự.',
      );
      expect(
        ErrorResolver.resolveAuthError('AUTH_ACCOUNT_LOCKED', 'default'),
        'Tài khoản tạm thời bị khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau.',
      );
      expect(
        ErrorResolver.resolveAuthError('AUTH_SESSION_EXPIRED', 'default'),
        'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.',
      );
      expect(
        ErrorResolver.resolveAuthError('AUTH_CURRENT_PASSWORD_INVALID', 'default'),
        'Mật khẩu hiện tại không chính xác.',
      );
      expect(
        ErrorResolver.resolveAuthError('AUTH_PASSWORD_POLICY_FAILED', 'default'),
        'Mật khẩu mới không đạt yêu cầu bảo mật (tối thiểu 8 ký tự, gồm chữ và số).',
      );
      expect(
        ErrorResolver.resolveAuthError('AUTH_RESET_TOKEN_INVALID', 'default'),
        'Mã khôi phục không hợp lệ hoặc đã hết hạn.',
      );
    });

    test('resolves known domain business error codes', () {
      expect(
        ErrorResolver.resolveEmployeeError('ATTENDANCE_ALREADY_CHECKED_IN', 'default'),
        'Bạn đã điểm danh vào ca hôm nay rồi.',
      );
      expect(
        ErrorResolver.resolveEmployeeError('LEAVE_BALANCE_INSUFFICIENT', 'default'),
        'Số ngày phép khả dụng không đủ cho yêu cầu này.',
      );
      expect(
        ErrorResolver.resolveEmployeeError('REQUEST_ALREADY_PROCESSED', 'default'),
        'Yêu cầu này đã được xử lý trước đó.',
      );
    });

    test('falls back to provided message or generic fallback when code is unknown', () {
      expect(
        ErrorResolver.resolveAuthError('UNKNOWN_CODE', 'Custom error msg'),
        'Custom error msg',
      );
      expect(
        ErrorResolver.resolveAuthError(null, null),
        'Không thể xử lý yêu cầu. Vui lòng thử lại.',
      );
      expect(
        ErrorResolver.resolveEmployeeError('NON_EXISTENT_CODE', 'Server failed'),
        'Server failed',
      );
    });
  });
}

