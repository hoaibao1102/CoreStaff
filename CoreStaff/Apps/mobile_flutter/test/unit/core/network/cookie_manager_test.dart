import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/config/app_constants.dart';
import 'package:corestaff_mobile/core/network/cookie_manager.dart';
import 'package:corestaff_mobile/core/storage/secure_storage_service.dart';

class MockSecureStorageService extends Mock implements SecureStorageService {}

void main() {
  late MockSecureStorageService mockStorage;
  late AppCookieManager cookieManager;

  setUp(() {
    mockStorage = MockSecureStorageService();
    when(() => mockStorage.getSid()).thenAnswer((_) async => null);
    when(() => mockStorage.getRt()).thenAnswer((_) async => null);
    when(() => mockStorage.saveSessionCookies(
          sid: any(named: 'sid'),
          rt: any(named: 'rt'),
        )).thenAnswer((_) async {});
    when(() => mockStorage.clearSessionCookies()).thenAnswer((_) async {});

    cookieManager = AppCookieManager(mockStorage);
  });

  group('AppCookieManager', () {
    test('initializes cookies from secure storage', () async {
      when(() => mockStorage.getSid()).thenAnswer((_) async => 'stored_sid_123');
      when(() => mockStorage.getRt()).thenAnswer((_) async => 'stored_rt_456');

      await cookieManager.init();

      expect(cookieManager.hasSession, isTrue);
      expect(cookieManager.hasRefreshToken, isTrue);
      expect(cookieManager.sid, 'stored_sid_123');
      expect(cookieManager.rt, 'stored_rt_456');
    });

    test('correctly parses Set-Cookie headers with expiration date commas', () {
      final headers = [
        'sid=session_abc; Path=/; HttpOnly; Expires=Wed, 21 Oct 2026 07:28:00 GMT; SameSite=Lax',
        'rt=refresh_xyz; Path=/api/auth/refresh; HttpOnly; Expires=Fri, 23 Oct 2026 12:00:00 GMT',
      ];

      cookieManager.parseAndSaveCookies(headers);

      expect(cookieManager.sid, 'session_abc');
      expect(cookieManager.rt, 'refresh_xyz');
      expect(cookieManager.hasSession, isTrue);
      expect(cookieManager.hasRefreshToken, isTrue);

      verify(() => mockStorage.saveSessionCookies(
            sid: 'session_abc',
            rt: 'refresh_xyz',
          )).called(1);
    });

    test('correctly parses multiple cookies separated by commas in a single header', () {
      final headers = [
        'sid=cookie_val1; Path=/, rt=cookie_val2; Path=/',
      ];

      cookieManager.parseAndSaveCookies(headers);

      expect(cookieManager.sid, 'cookie_val1');
      expect(cookieManager.rt, 'cookie_val2');
    });

    test('deletes cookies when value is deleted or empty', () {
      cookieManager.parseAndSaveCookies(['sid=active_session; Path=/']);
      expect(cookieManager.sid, 'active_session');

      cookieManager.parseAndSaveCookies(['sid=deleted; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT']);
      expect(cookieManager.sid, isNull);
      expect(cookieManager.hasSession, isFalse);
    });

    test('buildCookieHeader builds valid Cookie header string', () {
      cookieManager.parseAndSaveCookies([
        '${AppConstants.sessionCookieName}=test_sid_val',
        '${AppConstants.refreshCookieName}=test_rt_val',
      ]);

      final withRt = cookieManager.buildCookieHeader(includeRefreshToken: true);
      expect(withRt, contains('${AppConstants.sessionCookieName}=test_sid_val'));
      expect(withRt, contains('${AppConstants.refreshCookieName}=test_rt_val'));

      final withoutRt = cookieManager.buildCookieHeader(includeRefreshToken: false);
      expect(withoutRt, '${AppConstants.sessionCookieName}=test_sid_val');
    });

    test('clear wipes in-memory cookies and clears secure storage', () async {
      cookieManager.parseAndSaveCookies(['sid=active_session; Path=/']);
      expect(cookieManager.hasSession, isTrue);

      await cookieManager.clear();

      expect(cookieManager.hasSession, isFalse);
      expect(cookieManager.sid, isNull);
      verify(() => mockStorage.clearSessionCookies()).called(greaterThanOrEqualTo(1));
    });
  });
}

