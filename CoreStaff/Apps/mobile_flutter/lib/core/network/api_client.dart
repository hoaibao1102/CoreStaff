import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';
import 'api_exception.dart';

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  final Map<String, String> _cookies = {};
  bool _initialized = false;
  Future<bool>? _refreshInFlight;

  void Function()? onSignedOut;

  static const Set<String> _noRefreshPaths = {
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
  };

  Future<void> init() async {
    if (_initialized) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final sid = prefs.getString('cookie_sid');
      final rt = prefs.getString('cookie_rt');
      if (sid != null && sid.isNotEmpty) _cookies['sid'] = sid;
      if (rt != null && rt.isNotEmpty) _cookies['rt'] = rt;
    } catch (_) {}
    _initialized = true;
  }

  void _saveCookiesFromHeaders(Map<String, String> headers) {
    // In http package on some platforms, Set-Cookie can be comma-separated or found in 'set-cookie'
    final rawSetCookie = headers['set-cookie'] ?? headers['Set-Cookie'];
    if (rawSetCookie == null || rawSetCookie.isEmpty) return;

    // Parse cookies
    final parts = rawSetCookie.split(RegExp(r',(?=\s*[a-zA-Z0-9_-]+=)'));
    for (final part in parts) {
      final cookiePair = part.split(';').first.trim();
      final eqIdx = cookiePair.indexOf('=');
      if (eqIdx > 0) {
        final key = cookiePair.substring(0, eqIdx).trim();
        final value = cookiePair.substring(eqIdx + 1).trim();
        if (value.isEmpty || value.toLowerCase() == 'deleted') {
          _cookies.remove(key);
        } else {
          _cookies[key] = value;
        }
      }
    }
    _persistCookies();
  }

  Future<void> _persistCookies() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (_cookies.containsKey('sid')) {
        await prefs.setString('cookie_sid', _cookies['sid']!);
      } else {
        await prefs.remove('cookie_sid');
      }
      if (_cookies.containsKey('rt')) {
        await prefs.setString('cookie_rt', _cookies['rt']!);
      } else {
        await prefs.remove('cookie_rt');
      }
    } catch (_) {}
  }

  Future<void> clearCookies() async {
    _cookies.clear();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('cookie_sid');
      await prefs.remove('cookie_rt');
    } catch (_) {}
  }

  String _buildCookieHeader() {
    if (_cookies.isEmpty) return '';
    return _cookies.entries.map((e) => '${e.key}=${e.value}').join('; ');
  }

  Future<bool> tryRefreshSession() {
    if (_refreshInFlight != null) return _refreshInFlight!;

    _refreshInFlight = _performRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
    return _refreshInFlight!;
  }

  Future<bool> _performRefresh() async {
    try {
      await request<dynamic>(
        path: '/api/auth/refresh',
        method: 'POST',
        allowRefresh: false,
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<T> request<T>({
    required String path,
    String method = 'GET',
    Map<String, dynamic>? body,
    Map<String, String>? headers,
    bool allowRefresh = true,
  }) async {
    await init();

    final uri = ApiConfig.buildUri(ApiConfig.currentBaseUrl, path);
    final reqHeaders = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...?headers,
    };

    final cookieHeader = _buildCookieHeader();
    if (cookieHeader.isNotEmpty) {
      reqHeaders['Cookie'] = cookieHeader;
    }

    http.Response response;
    try {
      final bodyStr = body != null ? jsonEncode(body) : null;
      switch (method.toUpperCase()) {
        case 'POST':
          response = await http.post(uri, headers: reqHeaders, body: bodyStr);
          break;
        case 'PUT':
          response = await http.put(uri, headers: reqHeaders, body: bodyStr);
          break;
        case 'DELETE':
          response = await http.delete(uri, headers: reqHeaders, body: bodyStr);
          break;
        case 'GET':
        default:
          response = await http.get(uri, headers: reqHeaders);
          break;
      }
    } catch (e) {
      throw AuthApiException('Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.', 0);
    }

    _saveCookiesFromHeaders(response.headers);

    // 401 handling with automatic session refresh
    if (response.statusCode == 401 && allowRefresh && !_noRefreshPaths.contains(path)) {
      final refreshed = await tryRefreshSession();
      if (refreshed) {
        // Retry once with new cookie
        return request<T>(
          path: path,
          method: method,
          body: body,
          headers: headers,
          allowRefresh: false,
        );
      } else {
        await clearCookies();
        onSignedOut?.call();
      }
    }

    dynamic responseData;
    if (response.body.isNotEmpty) {
      try {
        responseData = jsonDecode(response.body);
      } catch (_) {
        responseData = null;
      }
    }

    if (response.statusCode >= 400 || (responseData is Map && responseData['success'] == false)) {
      String? code;
      String? message;
      if (responseData is Map && responseData['error'] is Map) {
        code = responseData['error']['code']?.toString();
        message = responseData['error']['message']?.toString();
      }
      throw AuthApiException(
        message ?? 'Yêu cầu thất bại (HTTP ${response.statusCode})',
        response.statusCode,
        code,
      );
    }

    if (responseData is Map && responseData.containsKey('data')) {
      return responseData['data'] as T;
    }

    return responseData as T;
  }
}
