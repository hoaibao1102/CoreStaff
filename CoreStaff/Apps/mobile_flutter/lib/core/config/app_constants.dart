class AppConstants {
  AppConstants._();

  /// Default application timezone: Vietnam Time (UTC+7).
  static const String appTimezone = 'Asia/Ho_Chi_Minh';
  static const int timezoneOffsetHours = 7;

  /// Dual-token cookie keys.
  static const String sessionCookieName = 'sid';
  static const String refreshCookieName = 'rt';

  /// Endpoints that must never trigger the 401 automatic session refresh.
  static const Set<String> noRefreshPaths = {
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
  };

  /// Timeouts
  static const Duration connectTimeout = Duration(seconds: 10);
  static const Duration receiveTimeout = Duration(seconds: 15);
  static const Duration healthTimeout = Duration(seconds: 4);

  /// Default remote API endpoint.
  static const String defaultRemoteUrl = 'https://18-141-68-40.sslip.io';

  /// Local emulator fallback endpoints.
  static const String androidEmulatorLocalUrl = 'http://10.0.2.2:3000';
  static const String standardLocalUrl = 'http://localhost:3000';
}

