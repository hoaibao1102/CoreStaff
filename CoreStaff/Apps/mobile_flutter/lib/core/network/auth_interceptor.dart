import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../config/api_config.dart';
import '../config/app_constants.dart';
import 'cookie_manager.dart';

class AuthInterceptor extends QueuedInterceptor {
  final AppCookieManager cookieManager;
  final Dio clientDio;
  void Function()? onSignedOut;

  AuthInterceptor({
    required this.cookieManager,
    required this.clientDio,
    this.onSignedOut,
  });

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (kIsWeb) {
      options.extra['withCredentials'] = true;
    }

    await cookieManager.init();

    final cookieHeader = cookieManager.buildCookieHeader();
    if (cookieHeader.isNotEmpty) {
      options.headers['Cookie'] = cookieHeader;
    }

    options.headers['Accept'] = 'application/json';
    if (options.data is! FormData && !options.headers.containsKey('Content-Type')) {
      options.headers['Content-Type'] = 'application/json';
    }

    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final setCookies = response.headers['set-cookie'];
    if (setCookies != null && setCookies.isNotEmpty) {
      cookieManager.parseAndSaveCookies(setCookies);
    }
    handler.next(response);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final setCookies = err.response?.headers['set-cookie'];
    if (setCookies != null && setCookies.isNotEmpty) {
      cookieManager.parseAndSaveCookies(setCookies);
    }

    final statusCode = err.response?.statusCode;
    final path = err.requestOptions.path;
    final isRetry = err.requestOptions.extra['is_retry'] == true;
    final isNoRefreshPath = AppConstants.noRefreshPaths.any((p) => path.contains(p));

    if (statusCode == 401 && !isRetry && !isNoRefreshPath) {
      final refreshed = await _performRefresh();
      if (refreshed) {
        try {
          final retryOptions = err.requestOptions;
          retryOptions.extra['is_retry'] = true;
          final updatedCookie = cookieManager.buildCookieHeader();
          if (updatedCookie.isNotEmpty) {
            retryOptions.headers['Cookie'] = updatedCookie;
          }

          final response = await clientDio.fetch(retryOptions);
          return handler.resolve(response);
        } catch (retryError) {
          if (retryError is DioException) {
            return handler.reject(retryError);
          }
          return handler.reject(
            DioException(
              requestOptions: err.requestOptions,
              error: retryError,
            ),
          );
        }
      } else {
        await cookieManager.clear();
        onSignedOut?.call();
      }
    }

    handler.next(err);
  }

  Future<bool> _performRefresh() async {
    if (!cookieManager.hasRefreshToken) {
      return false;
    }

    try {
      // Direct raw Dio call to avoid interceptor recursion
      final refreshDio = Dio(
        BaseOptions(
          connectTimeout: AppConstants.connectTimeout,
          receiveTimeout: AppConstants.receiveTimeout,
        ),
      );

      final url = ApiConfig.apiUrl(ApiConfig.currentBaseUrl, '/api/auth/refresh');
      final rtHeader = '${AppConstants.refreshCookieName}=${cookieManager.rt}';

      final response = await refreshDio.post<Map<String, dynamic>>(
        url,
        options: Options(
          headers: {
            'Cookie': rtHeader,
            'Accept': 'application/json',
          },
        ),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final setCookies = response.headers['set-cookie'];
        if (setCookies != null && setCookies.isNotEmpty) {
          cookieManager.parseAndSaveCookies(setCookies);
        }
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}

