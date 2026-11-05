import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/error/app_exception.dart';
import 'package:corestaff_mobile/core/network/api_client.dart';
import 'package:corestaff_mobile/core/network/cookie_manager.dart';

class MockDio extends Mock implements Dio {}
class MockAppCookieManager extends Mock implements AppCookieManager {}

void main() {
  late MockDio mockDio;
  late MockAppCookieManager mockCookieManager;
  late ApiClient apiClient;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
  });

  setUp(() {
    mockDio = MockDio();
    mockCookieManager = MockAppCookieManager();
    when(() => mockDio.interceptors).thenReturn(Interceptors());
    when(() => mockDio.options).thenReturn(BaseOptions());

    apiClient = ApiClient(
      dio: mockDio,
      cookieManager: mockCookieManager,
    );
  });

  group('ApiClient Response Unwrapping & Errors', () {
    test('unwraps { success: true, data: T } to inner data payload', () async {
      when(() => mockDio.get(
            any(),
            queryParameters: any(named: 'queryParameters'),
            options: any(named: 'options'),
          )).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/api/test'),
          statusCode: 200,
          data: {
            'success': true,
            'data': {'id': 'user_1', 'name': 'Nguyen Van A'},
          },
        ),
      );

      final result = await apiClient.get<Map<String, dynamic>>('/api/test');

      expect(result['id'], 'user_1');
      expect(result['name'], 'Nguyen Van A');
    });

    test('throws ApiException when response has { success: false, error: ... }', () async {
      when(() => mockDio.get(
            any(),
            queryParameters: any(named: 'queryParameters'),
            options: any(named: 'options'),
          )).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/api/fail'),
          statusCode: 400,
          data: {
            'success': false,
            'error': {
              'code': 'AUTH_INVALID_CREDENTIALS',
              'message': 'Sai tài khoản hoặc mật khẩu',
            },
          },
        ),
      );

      expect(
        () => apiClient.get<dynamic>('/api/fail'),
        throwsA(isA<ApiException>()
            .having((e) => e.code, 'code', 'AUTH_INVALID_CREDENTIALS')
            .having((e) => e.message, 'message', 'Sai tài khoản hoặc mật khẩu')
            .having((e) => e.statusCode, 'statusCode', 400)),
      );
    });

    test('transforms Dio connection timeout into NetworkException', () async {
      when(() => mockDio.get(
            any(),
            queryParameters: any(named: 'queryParameters'),
            options: any(named: 'options'),
          )).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/api/timeout'),
          type: DioExceptionType.connectionTimeout,
        ),
      );

      expect(
        () => apiClient.get<dynamic>('/api/timeout'),
        throwsA(isA<NetworkException>()),
      );
    });

    test('transforms Dio 404 response into ApiException with status 404', () async {
      when(() => mockDio.get(
            any(),
            queryParameters: any(named: 'queryParameters'),
            options: any(named: 'options'),
          )).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/api/not-found'),
          type: DioExceptionType.badResponse,
          response: Response(
            requestOptions: RequestOptions(path: '/api/not-found'),
            statusCode: 404,
            data: {
              'message': 'Resource not found',
            },
          ),
        ),
      );

      expect(
        () => apiClient.get<dynamic>('/api/not-found'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 404)
            .having((e) => e.message, 'message', 'Resource not found')),
      );
    });
  });
}

