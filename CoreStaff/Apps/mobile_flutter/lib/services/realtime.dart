import 'package:socket_io_client/socket_io_client.dart' as io;
import '../core/config/api_config.dart';
import '../core/network/api_client.dart';

const _events = ['request:decided', 'attendance:changed', 'leave:changed', 'payslip:released', 'compliance:warning'];

/// Lắng nghe sự kiện realtime của nhân viên (namespace /events), khớp `mobile/src/realtime.ts`.
/// Trả về hàm huỷ đăng ký.
void Function() subscribeEmployeeRealtime(void Function(String event) onChange) {
  final base = Uri.parse(ApiConfig.currentBaseUrl);
  final socketPath = base.path.contains('/local-api') ? '/local-api/socket.io' : '/socket.io';
  final cookie = ApiClient.instance.cookieHeader;

  final socket = io.io(
    '${base.origin}/events',
    io.OptionBuilder()
        .setPath(socketPath)
        .setTransports(['polling', 'websocket'])
        .setExtraHeaders({if (cookie.isNotEmpty) 'Cookie': cookie})
        .enableReconnection()
        .setReconnectionDelay(2000)
        .disableAutoConnect()
        .build(),
  );
  for (final e in _events) {
    socket.on(e, (_) => onChange(e));
  }
  socket.connect();

  return () {
    socket.dispose();
  };
}
