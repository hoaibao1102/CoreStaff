import 'package:dio/dio.dart';
import '../config/api_config.dart';
import '../config/app_constants.dart';
import '../error/app_exception.dart';
import 'auth_interceptor.dart';
import 'cookie_manager.dart';

class ApiClient {
  static ApiClient? _instance;
  static ApiClient get instance {
    if (_instance == null) {
      throw StateError('ApiClient has not been initialized.');
    }
    return _instance!;
  }
  static set instance(ApiClient client) => _instance = client;

  final Dio dio;
  final AppCookieManager cookieManager;
  late final AuthInterceptor _authInterceptor;

  ApiClient({
    required this.dio,
    required this.cookieManager,
    void Function()? onSignedOut,
  }) {
    _authInterceptor = AuthInterceptor(
      cookieManager: cookieManager,
      clientDio: dio,
      onSignedOut: onSignedOut,
    );

    dio.interceptors.add(_authInterceptor);
    dio.options.connectTimeout = AppConstants.connectTimeout;
    dio.options.receiveTimeout = AppConstants.receiveTimeout;
    _instance ??= this;
  }

  set onSignedOut(void Function()? handler) {
    _authInterceptor.onSignedOut = handler;
  }

  void Function()? get onSignedOut => _authInterceptor.onSignedOut;

  Future<void> clearCookies() => cookieManager.clear();

  Future<T> request<T>({
    required String path,
    String method = 'GET',
    dynamic body,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    final upper = method.toUpperCase();
    if (upper == 'GET') {
      return get<T>(path, queryParameters: queryParameters, options: options);
    } else if (upper == 'POST') {
      return post<T>(path, data: body, queryParameters: queryParameters, options: options);
    } else if (upper == 'PUT') {
      return put<T>(path, data: body, queryParameters: queryParameters, options: options);
    } else if (upper == 'DELETE') {
      return delete<T>(path, data: body, queryParameters: queryParameters, options: options);
    } else {
      return _execute(() => dio.request(
            ApiConfig.apiUrl(ApiConfig.currentBaseUrl, path),
            data: body,
            queryParameters: queryParameters,
            options: (options ?? Options()).copyWith(method: upper),
          ));
    }
  }

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return _execute(() => dio.get(
          ApiConfig.apiUrl(ApiConfig.currentBaseUrl, path),
          queryParameters: queryParameters,
          options: options,
        ));
  }

  Future<T> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return _execute(() => dio.post(
          ApiConfig.apiUrl(ApiConfig.currentBaseUrl, path),
          data: data,
          queryParameters: queryParameters,
          options: options,
        ));
  }

  Future<T> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return _execute(() => dio.put(
          ApiConfig.apiUrl(ApiConfig.currentBaseUrl, path),
          data: data,
          queryParameters: queryParameters,
          options: options,
        ));
  }

  Future<T> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return _execute(() => dio.delete(
          ApiConfig.apiUrl(ApiConfig.currentBaseUrl, path),
          data: data,
          queryParameters: queryParameters,
          options: options,
        ));
  }

  Future<T> postMultipart<T>(
    String path, {
    required FormData formData,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    final opts = options ?? Options();
    opts.contentType = 'multipart/form-data';
    return _execute(() => dio.post(
          ApiConfig.apiUrl(ApiConfig.currentBaseUrl, path),
          data: formData,
          queryParameters: queryParameters,
          options: opts,
        ));
  }

  Future<T> _execute<T>(Future<Response<dynamic>> Function() request) async {
    try {
      final response = await request();
      return _unwrapResponse<T>(response);
    } on DioException catch (e) {
      throw _handleDioException(e);
    } catch (e) {
      if (e is AppException) rethrow;
      throw ApiException(
        message: 'Lỗi không xác định: ${e.toString()}',
        statusCode: 500,
      );
    }
  }

  T _unwrapResponse<T>(Response<dynamic> response) {
    final data = response.data;
    if (data is Map<String, dynamic>) {
      if (data.containsKey('success') && data['success'] == false) {
        final error = data['error'] as Map<String, dynamic>?;
        final code = error?['code']?.toString();
        final message = error?['message']?.toString() ?? 'Yêu cầu thất bại.';
        throw ApiException(
          message: message,
          statusCode: response.statusCode ?? 400,
          code: code,
          rawData: data,
        );
      }
      if (data.containsKey('success') && data['success'] == true && data.containsKey('data')) {
        return data['data'] as T;
      }
    }
    return data as T;
  }

  ApiException _handleDioException(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.connectionError) {
      throw const NetworkException();
    }

    final response = e.response;
    final statusCode = response?.statusCode ?? 500;
    String message = 'Lỗi kết nối máy chủ.';
    String? code;

    final responseData = response?.data;
    if (responseData is Map<String, dynamic>) {
      if (responseData['error'] is Map) {
        final errObj = responseData['error'] as Map<String, dynamic>;
        code = errObj['code']?.toString();
        message = errObj['message']?.toString() ?? message;
      } else if (responseData['message'] != null) {
        final rawMsg = responseData['message'];
        if (rawMsg is List) {
          message = rawMsg.join(', ');
        } else {
          message = rawMsg.toString();
        }
      }
      code ??= responseData['code']?.toString();
    } else if (response?.statusMessage != null && response!.statusMessage!.isNotEmpty) {
      message = response.statusMessage!;
    }

    return ApiException(
      message: message,
      statusCode: statusCode,
      code: code,
      path: e.requestOptions.path,
      rawData: responseData,
    );
  }
}
