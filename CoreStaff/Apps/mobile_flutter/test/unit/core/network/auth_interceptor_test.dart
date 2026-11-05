import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/auth_interceptor.dart';
import 'package:corestaff_mobile/core/network/cookie_manager.dart';

class MockAppCookieManager extends Mock implements AppCookieManager {}
class MockDio extends Mock implements Dio {}
class MockRequestInterceptorHandler extends Mock implements RequestInterceptorHandler {}
class MockResponseInterceptorHandler extends Mock implements ResponseInterceptorHandler {}
class MockErrorInterceptorHandler extends Mock implements ErrorInterceptorHandler {}

void main() {
  late MockAppCookieManager mockCookieManager;
  late MockDio mockClientDio;
  late AuthInterceptor interceptor;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
    registerFallbackValue(Response(requestOptions: RequestOptions(path: '')));
    registerFallbackValue(DioException(requestOptions: RequestOptions(path: '')));
  });

  setUp(() {
    mockCookieManager = MockAppCookieManager();
    mockClientDio = MockDio();
    when(() => mockCookieManager.init()).thenAnswer((_) async {});
    when(() => mockCookieManager.clear()).thenAnswer((_) async {});

    interceptor = AuthInterceptor(
      cookieManager: mockCookieManager,
      clientDio: mockClientDio,
    );
  });

  group('AuthInterceptor', () {
    test('attaches Cookie header if cookies are present', () async {
      when(() => mockCookieManager.buildCookieHeader()).thenReturn('sid=abc; rt=xyz');
      final options = RequestOptions(path: '/api/attendance/today');
      final handler = MockRequestInterceptorHandler();

      await interceptor.onRequest(options, handler);

      expect(options.headers['Cookie'], 'sid=abc; rt=xyz');
      expect(options.headers['Accept'], 'application/json');
      verify(() => handler.next(options)).called(1);
    });

    test('extracts Set-Cookie headers from successful response', () {
      final response = Response(
        requestOptions: RequestOptions(path: '/api/auth/login'),
        statusCode: 200,
        headers: Headers.fromMap({
          'set-cookie': ['sid=new_session_123; Path=/'],
        }),
      );
      final handler = MockResponseInterceptorHandler();

      interceptor.onResponse(response, handler);

      verify(() => mockCookieManager.parseAndSaveCookies(['sid=new_session_123; Path=/'])).called(1);
      verify(() => handler.next(response)).called(1);
    });

    test('bypasses 401 refresh logic for noRefreshPaths', () async {
      final err = DioException(
        requestOptions: RequestOptions(path: '/api/auth/login'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/auth/login'),
          statusCode: 401,
        ),
      );
      final handler = MockErrorInterceptorHandler();

      await interceptor.onError(err, handler);

      verifyNever(() => mockCookieManager.hasRefreshToken);
      verify(() => handler.next(err)).called(1);
    });

    test('triggers onSignedOut and clears cookies when 401 occurs and no refresh token exists', () async {
      bool signedOutTriggered = false;
      interceptor.onSignedOut = () {
        signedOutTriggered = true;
      };

      when(() => mockCookieManager.hasRefreshToken).thenReturn(false);

      final err = DioException(
        requestOptions: RequestOptions(path: '/api/attendance/today'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/attendance/today'),
          statusCode: 401,
        ),
      );
      final handler = MockErrorInterceptorHandler();

      await interceptor.onError(err, handler);

      expect(signedOutTriggered, isTrue);
      verify(() => mockCookieManager.clear()).called(1);
      verify(() => handler.next(err)).called(1);
    });
  });
}

