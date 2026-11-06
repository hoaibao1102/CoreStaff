import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:network_info_plus/network_info_plus.dart';
import '../../core/format.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_colors.dart';
import '../../services/employee_api.dart';
import '../../widgets/banners.dart';
import '../../widgets/buttons.dart';
import '../../widgets/cards.dart';
import '../../widgets/feature_screen.dart';
import 'day_detail_sheet.dart';

/// Thiết bị không cung cấp được bằng chứng cho lần chấm công này.
class _PunchError implements Exception {
  final String message;
  _PunchError(this.message);
}

class AttendanceTab extends StatefulWidget {
  final VoidCallback onBackToOverview;
  final int realtimeRevision;

  const AttendanceTab({super.key, required this.onBackToOverview, this.realtimeRevision = 0});

  @override
  State<AttendanceTab> createState() => _AttendanceTabState();
}

class _AttendanceTabState extends State<AttendanceTab> {
  final _api = EmployeeApi.instance;
  Json? _today;
  Json? _history;
  String _month = currentMonthKey();
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  String? _success;
  // Lỗi chấm công tách khỏi lỗi tải dữ liệu để reload không xoá lý do thất bại.
  String? _punchError;
  String? _punchNotice; // thông báo tiến trình (không phải lỗi)

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant AttendanceTab old) {
    super.didUpdateWidget(old);
    if (old.realtimeRevision != widget.realtimeRevision) _load(silent: true);
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    _error = null;
    final results = await Future.wait([
      _api.today().then<Object>((v) => v).catchError((Object e) => e),
      _api.history(_month).then<Object>((v) => v).catchError((Object e) => e),
    ]);
    if (!mounted) return;
    setState(() {
      if (results[0] is Map<String, dynamic>) _today = results[0] as Json;
      if (results[1] is Map<String, dynamic>) _history = results[1] as Json;
      final failure = results.whereType<Exception>().firstOrNull;
      if (failure != null) _error = friendlyEmployeeError(failure);
      _loading = false;
    });
  }

  // ── Bằng chứng chấm công ────────────────────────────────────────────
  Future<PunchLocation> _currentLocation() async {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      throw _PunchError('Cần quyền truy cập vị trí để chấm công. Hãy bật trong Cài đặt.');
    }
    try {
      final p = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 20)),
      );
      return PunchLocation(latitude: p.latitude, longitude: p.longitude, accuracyMeters: p.accuracy);
    } catch (_) {
      throw _PunchError('Không lấy được vị trí. Hãy bật Vị trí và "Độ chính xác vị trí" trong Cài đặt rồi thử lại.');
    }
  }

  Future<String?> _takeSelfie() async {
    try {
      final shot = await ImagePicker().pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 80,
        maxWidth: 1280,
      );
      return shot?.path;
    } catch (_) {
      throw _PunchError('Cần quyền camera để chụp ảnh chấm công. Hãy bật trong Cài đặt.');
    }
  }

  String? _clean(String? v) {
    final t = v?.trim().replaceAll(RegExp(r'^"|"$'), '');
    if (t == null || t.isEmpty || t == '<unknown ssid>' || t == '00:00:00:00:00:00') return null;
    return t;
  }

  /// BSSID là trường duy nhất server kiểm tra; cần quyền vị trí trên Android.
  Future<({String? ssid, String? bssid})> _currentWifi() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      final info = NetworkInfo();
      return (ssid: _clean(await info.getWifiName()), bssid: _clean(await info.getWifiBSSID())?.toLowerCase());
    } catch (_) {
      return (ssid: null, bssid: null);
    }
  }

  bool _isSelfieRequired(Object e) => e is AuthApiException && e.code == 'SELFIE_REQUIRED';

  /// Thứ tự như server: Wi-Fi (BSSID) → GPS → selfie. Mỗi bước chỉ chạy khi
  /// bước trước trả SELFIE_REQUIRED. OUT_OFFICE đi thẳng selfie; nơi làm không
  /// có Wi-Fi tin cậy đi thẳng GPS.
  Future<void> _submit() async {
    final today = _today;
    if (today == null || today['availableAction'] == 'NONE') return;
    final action = today['availableAction'] as String;
    final assignment = (today['assignment'] as Map?) ?? const {};
    final outOffice = assignment['workplaceType'] == 'OUT_OFFICE';
    final mode = outOffice ? 'OUT_OFFICE' : 'IN_OFFICE';

    Future<bool> accepted({PunchLocation? location, String? selfie, String? ssid, String? bssid}) async {
      try {
        await _api.punch(action,
            workMode: mode, location: location, selfiePath: selfie, wifiSsid: ssid, wifiBssid: bssid);
        return true;
      } catch (e) {
        if (!_isSelfieRequired(e)) rethrow;
        return false;
      }
    }

    setState(() {
      _submitting = true;
      _punchError = null;
      _punchNotice = null;
      _success = null;
    });
    try {
      if (outOffice) {
        final selfie = await _takeSelfie();
        if (selfie == null) return;
        await _api.punch(action, workMode: mode, selfiePath: selfie);
      } else {
        final wifiFirst = assignment['hasWifiNetworks'] != false;
        final wifi = wifiFirst ? await _currentWifi() : (ssid: null, bssid: null);
        if (!(wifiFirst && await accepted(ssid: wifi.ssid, bssid: wifi.bssid))) {
          if (mounted) setState(() => _punchNotice = 'Chưa xác thực được Wi-Fi công ty. Đang kiểm tra vị trí GPS…');
          final location = await _currentLocation();
          if (!await accepted(location: location, ssid: wifi.ssid, bssid: wifi.bssid)) {
            if (mounted) setState(() => _punchNotice = 'Vị trí ngoài phạm vi công ty. Chụp ảnh selfie để gửi quản lý duyệt.');
            final selfie = await _takeSelfie();
            if (selfie == null) return;
            await _api.punch(action,
                workMode: mode, location: location, selfiePath: selfie, wifiSsid: wifi.ssid, wifiBssid: wifi.bssid);
          }
        }
      }
      if (!mounted) return;
      setState(() {
        _punchError = null;
        _success = action == 'CHECK_IN' ? 'Đã ghi nhận thời gian vào ca.' : 'Đã ghi nhận thời gian ra ca.';
      });
      await _load(silent: true);
    } catch (e) {
      if (mounted) setState(() => _punchError = e is _PunchError ? e.message : friendlyEmployeeError(e));
    } finally {
      if (mounted) setState(() { _submitting = false; _punchNotice = null; });
    }
  }

  Future<void> _confirmSubmit() async {
    final today = _today;
    if (today == null || today['availableAction'] == 'NONE') return;
    final checkingIn = today['availableAction'] == 'CHECK_IN';
    final assignment = (today['assignment'] as Map?) ?? const {};
    final outOffice = assignment['workplaceType'] == 'OUT_OFFICE';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgSurface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(checkingIn ? 'Xác nhận vào ca' : 'Xác nhận ra ca', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        content: Text(
            checkingIn
                ? 'Ghi nhận vào ca tại ${assignment['workplaceName'] ?? 'nơi làm việc'}?'
                : 'Ghi nhận kết thúc ca làm việc hôm nay?',
            style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy', style: TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w700))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(outOffice ? 'Chụp selfie' : checkingIn ? 'Vào ca' : 'Ra ca', style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (ok == true) await _submit();
  }

  void _changeMonth(int offset) {
    final next = shiftMonth(_month, offset);
    if (next.compareTo(currentMonthKey()) > 0) return;
    setState(() => _month = next);
    _load();
  }

  // ── UI ──────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () => _load(silent: true),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 28, 22, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const ScreenHeader(
            eyebrow: 'CHẤM CÔNG',
            title: 'Chấm công',
            description: 'Ghi nhận thời gian và theo dõi công của bạn.',
          ),
          const SizedBox(height: 16),
          if (_punchNotice != null) ...[NoticeBanner(message: _punchNotice!), const SizedBox(height: 12)],
          if (_punchError != null) ...[ErrorBanner(message: _punchError!), const SizedBox(height: 12)],
          if (_error != null && (_today != null || _history != null)) ...[
            ErrorBanner(message: _error!),
            const SizedBox(height: 12),
          ],
          if (_success != null) ...[SuccessBanner(message: _success!), const SizedBox(height: 12)],
          if (_loading)
            const LoadingBlock()
          else if (_error != null && _today == null && _history == null)
            ErrorState(message: _error!, onRetry: _load)
          else ...[
            _hero(),
            const SizedBox(height: 12),
            _leaveNotice(),
            _metrics(),
            const SizedBox(height: 16),
            _historySection(),
          ],
        ],
      ),
    );
  }

  static const _statusLabels = {
    'NOT_CHECKED_IN': 'Chưa vào ca',
    'CHECKED_IN': 'Đang trong ca',
    'COMPLETED': 'Hoàn thành',
    'DAY_OFF': 'Ngày nghỉ',
    'LOCKED': 'Đã khóa',
  };

  BadgeTone _tone(String? s) => switch (s) {
        'COMPLETED' => BadgeTone.success,
        'CHECKED_IN' => BadgeTone.info,
        'LOCKED' => BadgeTone.warning,
        _ => BadgeTone.neutral,
      };

  Widget _hero() {
    final t = _today;
    final a = (t?['assignment'] as Map?) ?? const {};
    final status = t?['attendanceStatus'] as String?;
    final action = t?['availableAction'] as String?;
    final label = action == 'CHECK_IN'
        ? 'Xác nhận vào ca'
        : action == 'CHECK_OUT'
            ? 'Xác nhận ra ca'
            : 'Ca làm đã hoàn tất';
    final checkIn = (t?['checkIn'] as Map?)?['recordedAt'] as String?;
    final checkOut = (t?['checkOut'] as Map?)?['recordedAt'] as String?;
    final workplace = '${a['workplaceName'] ?? ''}${(a['address'] ?? '').toString().isNotEmpty ? ' - ${a['address']}' : ''}';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(20)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(shiftTitle(a['shiftName'], 'Ca làm hôm nay'),
                        style: const TextStyle(color: Color(0xFF93C5FD), fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1)),
                    const SizedBox(height: 6),
                    Text((a['shiftHours'] ?? '-').toString(),
                        style: const TextStyle(color: Colors.white, fontSize: 25, fontWeight: FontWeight.w800)),
                  ],
                ),
              ),
              StatusBadge(label: _statusLabels[status] ?? 'Chưa có dữ liệu', tone: _tone(status)),
            ],
          ),
          const SizedBox(height: 6),
          Text(workplace, style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 12, height: 1.5)),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _timelinePoint(checkIn != null, 'Vào ca', formatTime(checkIn)),
              Expanded(
                child: Container(
                  height: 2,
                  margin: const EdgeInsets.only(top: 6),
                  color: checkOut != null ? AppColors.successDot : const Color(0xFF475569),
                ),
              ),
              _timelinePoint(checkOut != null, 'Ra ca', formatTime(checkOut)),
            ],
          ),
          const SizedBox(height: 18),
          PrimaryButton(
            label: label,
            loading: _submitting,
            disabled: t == null || action == 'NONE',
            onPress: _confirmSubmit,
          ),
          if (a['workplaceType'] == 'OUT_OFFICE') ...[
            const SizedBox(height: 10),
            const Text(
              'Ca ngoài văn phòng có thể yêu cầu vị trí hoặc selfie theo chính sách công ty.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFFA7F3D0), fontSize: 11, height: 1.45),
            ),
          ],
        ],
      ),
    );
  }

  Widget _timelinePoint(bool active, String label, String time) => SizedBox(
        width: 68,
        child: Column(
          children: [
            Container(
              width: 13,
              height: 13,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: active ? AppColors.successDot : AppColors.bgDark,
                border: Border.all(color: active ? const Color(0xFF86EFAC) : const Color(0xFF64748B), width: 2),
              ),
            ),
            const SizedBox(height: 7),
            Text(label, style: const TextStyle(color: Color(0xFF93C5FD), fontSize: 11, fontWeight: FontWeight.w800)),
            const SizedBox(height: 3),
            Text(time, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800)),
          ],
        ),
      );

  String _intervals(dynamic list) {
    final items = (list as List?) ?? const [];
    return items.isEmpty ? 'Không có' : items.map((i) => '${i['from']}–${i['to']}').join(', ');
  }

  String _pendingLeaveText(Map p) {
    switch (p['durationType']) {
      case 'MORNING_HALF':
        return 'Nghỉ buổi sáng';
      case 'AFTERNOON_HALF':
        return 'Nghỉ buổi chiều';
      case 'CUSTOM_HOURS':
        return 'Nghỉ theo giờ${p['requestedStart'] != null && p['requestedEnd'] != null ? ' (${p['requestedStart']}–${p['requestedEnd']})' : ''}';
      default:
        return 'Nghỉ cả ngày';
    }
  }

  Widget _leaveNotice() {
    final req = _today?['attendanceRequirements'] as Map?;
    final pending = _today?['pendingLeave'] as Map?;
    if (req != null) {
      const s = TextStyle(color: AppColors.textSecondary, fontSize: 11, height: 1.55);
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: AppCard(
          color: AppColors.successBg,
          borderColor: AppColors.successBorder,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Nghỉ phép đã được HR áp dụng',
                  style: TextStyle(color: AppColors.successText, fontSize: 13, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('Thời gian nghỉ: ${_intervals(req['approvedLeaveIntervals'])} (${formatMinutes(req['approvedLeaveMinutes'] as num?)})', style: s),
              Text('Thời gian còn phải làm: ${_intervals(req['requiredWorkingIntervals'])} (${formatMinutes(req['requiredWorkingMinutes'] as num?)})', style: s),
              Text('Khung chấm công hiệu lực: ${req['effectiveCheckInTime'] ?? '—'} – ${req['effectiveCheckOutTime'] ?? '—'}', style: s),
            ],
          ),
        ),
      );
    }
    if (pending != null) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: AppCard(
          color: AppColors.warningBg,
          borderColor: AppColors.warningBorder,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Đơn nghỉ đang chờ xử lý',
                  style: TextStyle(color: AppColors.warningText, fontSize: 13, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('${_pendingLeaveText(pending)}. Ca làm gốc vẫn được áp dụng cho tới khi quản lý duyệt và HR áp dụng.',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 11, height: 1.55)),
            ],
          ),
        ),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _metric(String label, String value) => Expanded(
        child: Container(
          height: 76,
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(14),
          ),
          alignment: Alignment.center,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: FittedBox(fit: BoxFit.scaleDown, child: Text(value, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w800))),
              ),
              const SizedBox(height: 4),
              Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
            ],
          ),
        ),
      );

  Widget _metrics() => Row(children: [
        _metric('Giờ làm', formatMinutes(_today?['workingMinutes'] as num?)),
        const SizedBox(width: 8),
        _metric('Đi muộn', formatMinutes(_today?['lateMinutes'] as num?)),
        const SizedBox(width: 8),
        _metric('Về sớm', formatMinutes(_today?['earlyMinutes'] as num?)),
      ]);

  Widget _historySection() {
    final h = _history;
    final summary = (h?['summary'] as Map?) ?? const {};
    final items = ((h?['items'] as List?) ?? const []).cast<Map>();
    final parts = _month.split('-');
    final canNext = _month.compareTo(currentMonthKey()) < 0;

    Widget sum(String label, String value) => Expanded(
          child: Column(children: [
            Text(value, style: const TextStyle(color: AppColors.primaryDark, fontSize: 17, fontWeight: FontWeight.w800)),
            const SizedBox(height: 3),
            Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          ]),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Expanded(child: SectionTitle('Lịch sử tháng')),
            IconButton(onPressed: () => _changeMonth(-1), icon: const Icon(Icons.chevron_left, color: AppColors.primary)),
            Text('Tháng ${int.parse(parts[1])}/${parts[0]}',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w800)),
            IconButton(
              onPressed: canNext ? () => _changeMonth(1) : null,
              icon: Icon(Icons.chevron_right, color: canNext ? AppColors.primary : AppColors.borderLight),
            ),
          ],
        ),
        if (h != null) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(16)),
            child: Row(children: [
              sum('Ngày công', '${summary['workingDays'] ?? 0}'),
              sum('Ngày đi muộn', '${summary['lateDays'] ?? 0}'),
              sum('Tăng ca', formatMinutes(summary['otMinutes'] as num?)),
            ]),
          ),
          const SizedBox(height: 12),
        ],
        if (items.isEmpty)
          const EmptyCard('Chưa có dữ liệu chấm công trong tháng này.')
        else
          ...items.map((d) => Padding(padding: const EdgeInsets.only(bottom: 10), child: _dayCard(d))),
      ],
    );
  }

  Widget _dayCard(Map d) {
    final status = d['attendanceStatus'] as String?;
    final late = (d['lateMinutes'] as num?) ?? 0;
    final early = (d['earlyMinutes'] as num?) ?? 0;
    final ot = ((d['overtime'] as Map?)?['otMinutes'] as num?) ?? 0;
    final now = DateTime.now();
    final todayKey = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    final missedCheckout = status == 'CHECKED_IN' && '${d['workDate']}'.compareTo(todayKey) < 0;
    Widget chip(String t, Color c) => Text(t, style: TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.w700));
    return AppCard(
      onTap: () => showDayDetailSheet(context, d, _history?['workCreditPolicy'] as Map?),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(formatDate(d['workDate'] as String?),
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 5),
                  Text(
                    '${formatTime((d['checkIn'] as Map?)?['recordedAt'] as String?)} - ${formatTime((d['checkOut'] as Map?)?['recordedAt'] as String?)}',
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                  ),
                ]),
              ),
              StatusBadge(
                label: missedCheckout ? 'Thiếu giờ ra' : (_statusLabels[status] ?? 'Chưa có dữ liệu'),
                tone: missedCheckout ? BadgeTone.warning : _tone(status),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(height: 1, color: AppColors.divider),
          const SizedBox(height: 10),
          Wrap(spacing: 12, runSpacing: 4, children: [
            if (d['workingMinutes'] != null) chip('Làm ${formatMinutes(d['workingMinutes'] as num?)}', AppColors.textSecondary),
            if (late > 0) chip('Muộn ${formatMinutes(late)}', AppColors.warningText),
            if (early > 0) chip('Về sớm ${formatMinutes(early)}', AppColors.dangerDarkText),
            if (ot > 0) chip('Tăng ca ${formatMinutes(ot)}', AppColors.primaryDark),
          ]),
        ],
      ),
    );
  }
}
