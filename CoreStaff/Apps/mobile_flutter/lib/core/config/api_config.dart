import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class HealthResponse {
  final String status;
  final String service;
  final String mongo;
  final String timezone;

  HealthResponse({
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
}

class ApiConfig {
  static const String defaultRemoteUrl = 'http://10.87.51.1:3000';

  static String get fallbackLocalUrl {
    if (kIsWeb) return 'http://localhost:3000';
    if (Platform.isAndroid) return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }

  static String currentBaseUrl = defaultRemoteUrl;

  static String stripSlash(String url) => url.replaceAll(RegExp(r'/+$'), '');

  static Uri buildUri(String baseUrl, String path) {
    final cleanBase = stripSlash(baseUrl);
    final cleanPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$cleanBase$cleanPath');
  }

  static Future<HealthResponse> checkHealth(String baseUrl, {Duration timeout = const Duration(seconds: 4)}) async {
    final uri = buildUri(baseUrl, '/api/healthz');
    final response = await http.get(uri).timeout(timeout);
    if (response.statusCode != 200) {
      throw Exception('Kiểm tra kết nối API thất bại (HTTP ${response.statusCode}).');
    }
    final dynamic body = jsonDecode(response.body);
    if (body is! Map<String, dynamic> || body['status'] != 'ok' || body['service'] != 'corestaff-api') {
      throw Exception('Phản hồi kiểm tra kết nối API không hợp lệ.');
    }
    return HealthResponse.fromJson(body);
  }

  /// Dev: thử API remote, hỏng thì fallback local (Android emulator -> 10.0.2.2)
  static Future<String> resolveApiBase() async {
    if (kReleaseMode) {
      currentBaseUrl = defaultRemoteUrl;
      await checkHealth(currentBaseUrl);
      return currentBaseUrl;
    }

    try {
      await checkHealth(defaultRemoteUrl, timeout: const Duration(seconds: 2));
      currentBaseUrl = defaultRemoteUrl;
      return currentBaseUrl;
    } catch (_) {
      // 1. Thử qua reverse port hoặc máy tính cục bộ
      try {
        await checkHealth('http://localhost:3000', timeout: const Duration(seconds: 2));
        currentBaseUrl = 'http://localhost:3000';
        return currentBaseUrl;
      } catch (_) {
        // 2. Thử qua Android emulator 10.0.2.2
        final fallback = fallbackLocalUrl;
        await checkHealth(fallback, timeout: const Duration(seconds: 2));
        currentBaseUrl = fallback;
        return currentBaseUrl;
      }
    }
  }
}
