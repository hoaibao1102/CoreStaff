import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:corestaff_mobile/core/network/cookie_manager.dart';
import 'package:corestaff_mobile/core/services/socket_service.dart';
import 'package:corestaff_mobile/core/storage/secure_storage_service.dart';

class MockSecureStorageService extends Mock implements SecureStorageService {}

class MockSocket extends Mock implements io.Socket {}

void main() {
  late MockSecureStorageService mockStorage;
  late AppCookieManager cookieManager;
  late MockSocket mockSocket;
  late Map<String, Function> socketHandlers;
  late String capturedUri;
  late Map<String, dynamic> capturedOptions;
  bool isConnected = false;

  setUp(() {
    mockStorage = MockSecureStorageService();
    when(() => mockStorage.getSid()).thenAnswer((_) async => 'sid_mock_123');
    when(() => mockStorage.getRt()).thenAnswer((_) async => 'rt_mock_456');
    when(() => mockStorage.saveSessionCookies(
          sid: any(named: 'sid'),
          rt: any(named: 'rt'),
        )).thenAnswer((_) async {});
    when(() => mockStorage.clearSessionCookies()).thenAnswer((_) async {});

    cookieManager = AppCookieManager(mockStorage);
    mockSocket = MockSocket();
    socketHandlers = {};
    capturedUri = '';
    capturedOptions = {};
    isConnected = false;

    when(() => mockSocket.connected).thenAnswer((_) => isConnected);

    when(() => mockSocket.on(any(), any())).thenAnswer((inv) {
      final event = inv.positionalArguments[0] as String;
      final handler = inv.positionalArguments[1] as Function;
      socketHandlers[event] = handler;
      return () {};
    });

    when(() => mockSocket.connect()).thenAnswer((_) {
      isConnected = true;
      socketHandlers['connect']?.call(null);
      return mockSocket;
    });

    when(() => mockSocket.disconnect()).thenAnswer((_) {
      isConnected = false;
      socketHandlers['disconnect']?.call('client disconnect');
      return mockSocket;
    });

    when(() => mockSocket.dispose()).thenAnswer((_) {});
  });

  SocketServiceImpl createService({String? baseUrl}) {
    return SocketServiceImpl(
      cookieManager: cookieManager,
      baseUrlProvider: baseUrl != null ? () => baseUrl : null,
      socketFactory: (uri, options) {
        capturedUri = uri;
        capturedOptions = options;
        return mockSocket;
      },
    );
  }

  group('SocketService Initialization & Handshake Options', () {
    test('connect builds correct /events namespace URI and handshake options', () async {
      await cookieManager.init();
      final service = createService(baseUrl: 'https://corestaff.test.com');

      service.connect();

      expect(capturedUri, 'https://corestaff.test.com/events');
      expect(capturedOptions['path'], '/socket.io');
      expect(capturedOptions['transports'], ['websocket', 'polling']);
      expect(capturedOptions['extraHeaders'], containsPair('cookie', contains('sid=sid_mock_123')));
      expect(service.isConnected, isTrue);

      service.dispose();
    });

    test('handles /local-api URL prefix correctly for socket path', () async {
      await cookieManager.init();
      final service = createService(baseUrl: 'http://10.0.2.2:3000/local-api');

      service.connect();

      expect(capturedUri, 'http://10.0.2.2:3000/events');
      expect(capturedOptions['path'], '/local-api/socket.io');

      service.dispose();
    });
  });

  group('SocketService Event & Revision Streams', () {
    test('emits RealtimeEvent and increments revisionStream on domain events', () async {
      await cookieManager.init();
      final service = createService(baseUrl: 'https://test.com');
      service.connect();

      final events = <RealtimeEvent>[];
      final revisions = <int>[];
      final eventSub = service.eventStream.listen(events.add);
      final revSub = service.revisionStream.listen(revisions.add);

      // Trigger domain events via captured handlers
      socketHandlers['attendance:changed']?.call({'userId': 'u1', 'status': 'CHECKED_IN'});
      socketHandlers['request:decided']?.call({'requestId': 'r1', 'status': 'APPROVED'});
      socketHandlers['payslip:released']?.call({'periodLabel': 'Tháng 11/2026'});
      socketHandlers['leave:changed']?.call({'leaveId': 'l1'});

      await Future.delayed(const Duration(milliseconds: 10));

      expect(events.length, 4);
      expect(events[0].event, 'attendance:changed');
      expect(events[0].data, containsPair('status', 'CHECKED_IN'));
      expect(events[1].event, 'request:decided');
      expect(events[2].event, 'payslip:released');
      expect(events[3].event, 'leave:changed');

      expect(revisions, [1, 2, 3, 4]);

      await eventSub.cancel();
      await revSub.cancel();
      service.dispose();
    });

    test('tracks connection lifecycle: connect, disconnect, and connect_error', () async {
      final service = createService(baseUrl: 'https://test.com');
      final events = <RealtimeEvent>[];
      final sub = service.eventStream.listen(events.add);

      service.connect();
      await Future.delayed(const Duration(milliseconds: 10));
      expect(service.isConnected, isTrue);
      expect(events.any((e) => e.event == 'connect'), isTrue);

      // Disconnect
      service.disconnect();
      await Future.delayed(const Duration(milliseconds: 10));
      expect(service.isConnected, isFalse);
      expect(events.any((e) => e.event == 'disconnect'), isTrue);

      // Connect error
      socketHandlers['connect_error']?.call('Connection refused');
      await Future.delayed(const Duration(milliseconds: 10));
      expect(service.isConnected, isFalse);
      expect(events.any((e) => e.event == 'connect_error'), isTrue);

      await sub.cancel();
      service.dispose();
    });

    test('calling dispose tears down socket and closes streams', () async {
      final service = createService(baseUrl: 'https://test.com');
      service.connect();

      service.dispose();

      verify(() => mockSocket.dispose()).called(1);
      expect(service.isConnected, isFalse);
    });
  });
}
