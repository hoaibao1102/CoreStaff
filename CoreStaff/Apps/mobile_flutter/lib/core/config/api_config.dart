import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'app_constants.dart';

class HealthResponse {
  final String status;
  final String service;
  final String mongo;
  final String timezone;

  const HealthResponse({
    required this.status,
    required this.service,
    required this.mongo,
    required this.timezone,
  });

  factory HealthResponse.fromJson(Map<String, dynamic> json) {
    return HealthResponse(
      status: json['status']?.toString() ?? '',
      service: json['service']?.toString() ?? '',
      mongo: json['mongo']?.toString() ?? '',
      timezone: json['timezone']?.toString() ?? '',
    );
  }

  bool get isValid =>
      status == 'ok' &&
      service == 'corestaff-api' &&
      (mongo == 'configured' || mongo == 'missing') &&
      timezone.trim().isNotEmpty;
}

class ApiConfig {
  ApiConfig._();

  static String _activeBaseUrl = AppConstants.defaultRemoteUrl;

  static String get currentBaseUrl => _activeBaseUrl;

  static void setBaseUrl(String url) {
    _activeBaseUrl = stripSlash(url);
  }

  static String stripSlash(String url) {
    return url.replaceAll(RegExp(r'/+$'), '');
  }

  static String get fallbackLocalUrl {
    if (!kIsWeb && Platform.isAndroid) {
      return AppConstants.androidEmulatorLocalUrl;
    }
    return AppConstants.standardLocalUrl;
  }

  static String apiUrl(String base, String path) {
    final cleanBase = stripSlash(base);
    final cleanPath = path.startsWith('/') ? path : '/$path';
    return '$cleanBase$cleanPath';
  }

  static Uri buildUri(String base, String path, [Map<String, dynamic>? queryParameters]) {
    final fullUrl = apiUrl(base, path);
    final parsed = Uri.parse(fullUrl);
    if (queryParameters != null && queryParameters.isNotEmpty) {
      return parsed.replace(
        queryParameters: queryParameters.map((k, v) => MapEntry(k, v.toString())),
      );
    }
    return parsed;
  }

  /// Probes the public health endpoint using a dedicated Dio client.
  static Future<HealthResponse> getHealth(String base, {Duration? timeout}) async {
    final dio = Dio(
      BaseOptions(
        connectTimeout: timeout ?? AppConstants.healthTimeout,
        receiveTimeout: timeout ?? AppConstants.healthTimeout,
      ),
    );

    try {
      final uri = apiUrl(base, '/api/healthz');
      final response = await dio.get<Map<String, dynamic>>(uri);
      if (response.statusCode != 200 || response.data == null) {
        throw Exception('Kiểm tra kết nối API thất bại (HTTP ${response.statusCode}).');
      }

      final health = HealthResponse.fromJson(response.data!);
      if (!health.isValid) {
        throw Exception('Phản hồi kiểm tra kết nối API không hợp lệ.');
      }
      return health;
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        throw Exception('Hết thời gian chờ kết nối API. Vui lòng thử lại.');
      }
      throw Exception('Không thể kết nối đến máy chủ: ${e.message}');
    }
  }

  /// In dev: probes remote API; falls back to local dev emulator if remote fails.
  /// In release: strictly uses remote API.
  static Future<String> resolveApiBase() async {
    if (!kDebugMode) {
      final health = await getHealth(AppConstants.defaultRemoteUrl);
      if (!health.isValid) throw Exception('API production không khả dụng.');
      setBaseUrl(AppConstants.defaultRemoteUrl);
      return currentBaseUrl;
    }

    try {
      final health = await getHealth(AppConstants.defaultRemoteUrl);
      if (health.isValid) {
        setBaseUrl(AppConstants.defaultRemoteUrl);
        return currentBaseUrl;
      }
    } catch (_) {
      // Remote failed in debug mode, probe local fallback
    }

    try {
      final localBase = fallbackLocalUrl;
      final localHealth = await getHealth(localBase);
      if (localHealth.isValid) {
        setBaseUrl(localBase);
        return currentBaseUrl;
      }
    } catch (e) {
      throw Exception('Không thể kết nối máy chủ API (cả remote và local).');
    }

    setBaseUrl(AppConstants.defaultRemoteUrl);
    return currentBaseUrl;
  }
}
