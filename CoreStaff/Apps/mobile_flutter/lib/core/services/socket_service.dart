import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../config/api_config.dart';
import '../network/cookie_manager.dart';

class RealtimeEvent {
  final String event;
  final dynamic data;
  final DateTime timestamp;

  const RealtimeEvent({
    required this.event,
    this.data,
    required this.timestamp,
  });

  @override
  String toString() => 'RealtimeEvent(event: $event, data: $data, timestamp: $timestamp)';
}

abstract class SocketService {
  void connect({bool forceRecreate = false});
  void disconnect();
  bool get isConnected;
  Stream<RealtimeEvent> get eventStream;
  Stream<int> get revisionStream;
  void dispose();
}

class SocketServiceImpl implements SocketService {
  final AppCookieManager cookieManager;
  final String Function()? baseUrlProvider;
  final io.Socket Function(String uri, Map<String, dynamic> options)? socketFactory;

  io.Socket? _socket;
  bool _isConnected = false;
  int _revision = 0;

  final StreamController<RealtimeEvent> _eventController =
      StreamController<RealtimeEvent>.broadcast();
  final StreamController<int> _revisionController =
      StreamController<int>.broadcast();

  static const List<String> domainEvents = [
    'attendance:changed',
    'request:decided',
    'leave:changed',
    'payslip:released',
    'compliance:warning',
    'request:new',
    'leave:new',
  ];

  SocketServiceImpl({
    required this.cookieManager,
    this.baseUrlProvider,
    this.socketFactory,
  });

  @override
  bool get isConnected => _isConnected || (_socket?.connected ?? false);

  @override
  Stream<RealtimeEvent> get eventStream => _eventController.stream;

  @override
  Stream<int> get revisionStream => _revisionController.stream;

  @override
  void connect({bool forceRecreate = false}) {
    if (!forceRecreate && _socket != null && (_socket!.connected || _isConnected)) {
      return;
    }

    if (_socket != null) {
      _socket?.disconnect();
      _socket?.dispose();
      _socket = null;
    }

    final rawBase = baseUrlProvider != null ? baseUrlProvider!() : ApiConfig.currentBaseUrl;
    final parsed = Uri.parse(rawBase);
    final isLocalApi = parsed.path.contains('/local-api');
    final socketPath = isLocalApi ? '/local-api/socket.io' : '/socket.io';
    final namespaceUri = '${parsed.origin}/events';

    final cookieHeader = cookieManager.buildCookieHeader();
    final optionBuilder = io.OptionBuilder()
        .setTransports(['websocket', 'polling'])
        .setPath(socketPath)
        .enableReconnection()
        .setReconnectionAttempts(double.infinity)
        .setReconnectionDelay(2000)
        .enableAutoConnect();

    if (cookieHeader.isNotEmpty) {
      optionBuilder.setExtraHeaders({'cookie': cookieHeader});
    }

    final options = optionBuilder.build();

    final socket = socketFactory != null
        ? socketFactory!(namespaceUri, options)
        : io.io(namespaceUri, options);

    _socket = socket;

    socket.onConnect((_) {
      _isConnected = true;
      _eventController.add(RealtimeEvent(
        event: 'connect',
        data: null,
        timestamp: DateTime.now(),
      ));
    });

    socket.onDisconnect((reason) {
      _isConnected = false;
      _eventController.add(RealtimeEvent(
        event: 'disconnect',
        data: reason,
        timestamp: DateTime.now(),
      ));
    });

    socket.onConnectError((error) {
      _isConnected = false;
      _eventController.add(RealtimeEvent(
        event: 'connect_error',
        data: error,
        timestamp: DateTime.now(),
      ));
    });

    for (final eventName in domainEvents) {
      socket.on(eventName, (data) {
        _eventController.add(RealtimeEvent(
          event: eventName,
          data: data,
          timestamp: DateTime.now(),
        ));
        _revision++;
        _revisionController.add(_revision);
      });
    }

    socket.connect();
  }

  @override
  void disconnect() {
    _socket?.disconnect();
    _isConnected = false;
  }

  @override
  void dispose() {
    disconnect();
    _socket?.dispose();
    _socket = null;
    _eventController.close();
    _revisionController.close();
  }
}
