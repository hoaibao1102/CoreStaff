import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/format.dart';
import '../../core/theme/app_colors.dart';
import '../../services/employee_api.dart';
import '../../widgets/banners.dart';
import '../../widgets/buttons.dart';
import 'requests_tab.dart' show durationLabel, minutesText;

bool _validDate(String v) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(v);
  if (m == null) return false;
  final y = int.parse(m[1]!), mo = int.parse(m[2]!), d = int.parse(m[3]!);
  final dt = DateTime.utc(y, mo, d);
  return dt.year == y && dt.month == mo && dt.day == d;
}

bool _validTime(String v) {
  final m = RegExp(r'^(\d{2}):(\d{2})$').firstMatch(v);
  return m != null && int.parse(m[1]!) < 24 && int.parse(m[2]!) < 60;
}

int _mins(String v) {
  final p = v.split(':').map(int.parse).toList();
  return p[0] * 60 + p[1];
}

/// Form tạo đơn nghỉ phép / đăng ký tăng ca. Pop về chuỗi thông báo khi gửi thành công.
class RequestFormScreen extends StatefulWidget {
  final String type; // 'leave' | 'overtime'
  const RequestFormScreen({super.key, required this.type});

  @override
  State<RequestFormScreen> createState() => _RequestFormScreenState();
}

class _RequestFormScreenState extends State<RequestFormScreen> {
  final _api = EmployeeApi.instance;
  final _scroll = ScrollController();
  late String _start = todayKey();
  late String _end = todayKey();
  String _leaveType = 'PAID_LEAVE';
  String _duration = 'FULL_DAY';
  String _startTime = '18:00';
  String _endTime = '20:00';
  final _reason = TextEditingController();
  final _desc = TextEditingController();
  final _retro = TextEditingController();
  bool _busy = false;
  bool _previewing = false;
  String? _error;
  Json? _preview;
  Timer? _debounce;

  bool get _leave => widget.type == 'leave';

  @override
  void dispose() {
    _debounce?.cancel();
    _scroll.dispose();
    _reason.dispose();
    _desc.dispose();
    _retro.dispose();
    super.dispose();
  }

  void _setError(String? e) {
    setState(() => _error = e);
    if (e != null && _scroll.hasClients) _scroll.animateTo(0, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
  }

  // Xem trước số phút nghỉ theo lịch làm việc, debounce như bản RN.
  void _schedulePreview() {
    _debounce?.cancel();
    if (!_leave) return;
    final custom = _duration == 'CUSTOM_HOURS';
    if (!_validDate(_start) || !_validDate(_end) || _end.compareTo(_start) < 0 || (custom && (!_validTime(_startTime) || !_validTime(_endTime)))) {
      setState(() => _preview = null);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 250), () async {
      setState(() => _previewing = true);
      try {
        final v = await _api.previewLeave({
          'startDate': _start,
          'endDate': _end,
          'durationType': _duration,
          if (custom) 'requestedStart': _startTime,
          if (custom) 'requestedEnd': _endTime,
        });
        if (mounted) setState(() { _preview = v; _error = null; });
      } catch (e) {
        if (mounted) setState(() { _preview = null; _error = friendlyEmployeeError(e); });
      } finally {
        if (mounted) setState(() => _previewing = false);
      }
    });
  }

  @override
  void initState() {
    super.initState();
    _schedulePreview();
  }

  Future<void> _pickDate(bool isStart) async {
    final cur = DateTime.tryParse(isStart ? _start : _end) ?? DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: cur,
      firstDate: DateTime(cur.year - 1),
      lastDate: DateTime(cur.year + 1, 12, 31),
    );
    if (d == null) return;
    final key = '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    setState(() {
      if (isStart) {
        _start = key;
        if (!_leave || _duration != 'FULL_DAY' || _end.compareTo(key) < 0) _end = key;
      } else {
        _end = key;
      }
    });
    _schedulePreview();
  }

  Future<void> _pickTime(bool isStart) async {
    final cur = isStart ? _startTime : _endTime;
    final p = _validTime(cur) ? cur.split(':').map(int.parse).toList() : [18, 0];
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: p[0], minute: p[1]),
      builder: (c, child) => MediaQuery(data: MediaQuery.of(c).copyWith(alwaysUse24HourFormat: true), child: child!),
    );
    if (t == null) return;
    final key = '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
    setState(() => isStart ? _startTime = key : _endTime = key);
    _schedulePreview();
  }

  Future<void> _submit() async {
    final reason = _reason.text.trim();
    final custom = _duration == 'CUSTOM_HOURS';
    if (reason.length < 10) return _setError('Lý do cần có ít nhất 10 ký tự.');
    if (!_validDate(_start) || (_leave && !_validDate(_end))) return _setError('Ngày cần hợp lệ.');
    if (_leave) {
      if (_end.compareTo(_start) < 0) return _setError('Ngày kết thúc không được sớm hơn ngày bắt đầu.');
      if (_duration != 'FULL_DAY' && _start != _end) return _setError('Đơn nghỉ một phần ngày chỉ áp dụng cho một ngày.');
      if (custom && (!_validTime(_startTime) || !_validTime(_endTime) || _mins(_endTime) <= _mins(_startTime))) {
        return _setError('Khoảng giờ xin nghỉ chưa hợp lệ.');
      }
      if (_preview == null) return _setError('Cần có kết quả tính từ lịch làm việc trước khi gửi đơn.');
    } else {
      if (_mins(_endTime) <= _mins(_startTime)) return _setError('Giờ kết thúc phải muộn hơn giờ bắt đầu.');
      final d = _desc.text.trim();
      if (d.isNotEmpty && d.length < 3) return _setError('Mô tả công việc cần ít nhất 3 ký tự hoặc để trống.');
    }
    setState(() { _busy = true; _error = null; });
    try {
      if (_leave) {
        await _api.createLeave({
          'startDate': _start,
          'endDate': _end,
          'leaveType': _leaveType,
          'durationType': _duration,
          if (custom) 'requestedStart': _startTime,
          if (custom) 'requestedEnd': _endTime,
          'reason': reason,
        });
      } else {
        await _api.createOvertime({
          'workDate': _start,
          'requestedStart': '${_start}T$_startTime:00+07:00',
          'requestedEnd': '${_start}T$_endTime:00+07:00',
          'reason': reason,
          if (_desc.text.trim().isNotEmpty) 'workDescription': _desc.text.trim(),
          if (_retro.text.trim().isNotEmpty) 'retroactiveReason': _retro.text.trim(),
        });
      }
      if (mounted) Navigator.of(context).pop(_leave ? 'Đã gửi đơn nghỉ phép.' : 'Đã gửi đăng ký tăng ca.');
    } catch (e) {
      if (mounted) _setError(friendlyEmployeeError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────
  Widget _label(String t, {bool required = false}) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text.rich(TextSpan(text: t, children: [
          if (required) const TextSpan(text: ' *', style: TextStyle(color: AppColors.dangerText)),
        ]), style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w800)),
      );

  Widget _picker(String label, String value, IconData icon, VoidCallback onTap) => Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _label(label, required: true),
          InkWell(
            onTap: _busy ? null : onTap,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(children: [
                Expanded(child: Text(value, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w600))),
                Icon(icon, size: 18, color: AppColors.textMuted),
              ]),
            ),
          ),
        ]),
      );

  Widget _text(String label, TextEditingController c, String hint, {bool required = false}) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _label(label, required: required),
          TextField(
            controller: c,
            enabled: !_busy,
            minLines: 3,
            maxLines: 5,
            decoration: InputDecoration(
              hintText: hint,
              filled: true,
              fillColor: AppColors.bgSurface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
            ),
          ),
        ],
      );

  Widget _seg(List<(String, String)> opts, String value, ValueChanged<String> on) => Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: AppColors.divider, borderRadius: BorderRadius.circular(14)),
        child: Row(
          children: opts.map((o) {
            final sel = value == o.$1;
            return Expanded(
              child: GestureDetector(
                onTap: _busy ? null : () => on(o.$1),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(color: sel ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(11)),
                  alignment: Alignment.center,
                  child: Text(o.$2, style: TextStyle(color: sel ? AppColors.primaryDark : AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w800)),
                ),
              ),
            );
          }).toList(),
        ),
      );

  Widget _previewBox() {
    const s = TextStyle(color: AppColors.textSecondary, fontSize: 11, height: 1.55);
    String iv(dynamic l) {
      final items = (l as List?) ?? const [];
      return items.isEmpty ? '—' : items.map((x) => '${x['from']}–${x['to']}').join(', ');
    }

    final p = _preview;
    final day = (p?['days'] as List?)?.firstOrNull as Map?;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppColors.primarySoft, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(12)),
      child: _previewing
          ? const Text('Đang tính theo ca làm việc…', style: s)
          : p == null
              ? const Text('Chọn ngày hợp lệ để xem số giờ nghỉ được tính từ lịch làm việc.', style: s)
              : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Kết quả từ lịch làm việc', style: TextStyle(color: AppColors.primaryDark, fontSize: 12, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text('Ca: ${day?['shiftStart']}–${day?['shiftEnd']} · Nghỉ trưa: ${day?['breakStart']}–${day?['breakEnd']}', style: s),
                  Text('Xin nghỉ: ${iv(day?['approvedLeaveIntervals'])}', style: s),
                  Text('Tổng: ${minutesText(p['calculatedMinutes'] as num)} · ${((p['leaveEquivalent'] as num).toDouble()).toStringAsFixed(2)} ngày phép', style: s),
                  Text('Còn phải làm: ${(day?['requiredWorkingIntervals'] as List?)?.isNotEmpty == true ? iv(day?['requiredWorkingIntervals']) : 'Không có'}', style: s),
                ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final custom = _duration == 'CUSTOM_HOURS';
    return Scaffold(
      backgroundColor: AppColors.bgDefault,
      appBar: AppBar(
        backgroundColor: AppColors.bgDefault,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(icon: const Icon(Icons.close, color: AppColors.textSecondary), onPressed: _busy ? null : () => Navigator.pop(context)),
        title: Text(_leave ? 'Đơn nghỉ phép' : 'Đăng ký tăng ca',
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
      ),
      body: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
        child: SafeArea(
        child: ListView(
          controller: _scroll,
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.fromLTRB(22, 8, 22, 32),
          children: [
            if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 14)],
            if (_leave) ...[
              _seg(const [('PAID_LEAVE', 'Có lương'), ('UNPAID_LEAVE', 'Không lương')], _leaveType, (v) => setState(() => _leaveType = v)),
              const SizedBox(height: 14),
              _label('Thời lượng nghỉ'),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: ['FULL_DAY', 'MORNING_HALF', 'AFTERNOON_HALF', 'CUSTOM_HOURS'].map((v) {
                  final sel = _duration == v;
                  return ChoiceChip(
                    label: Text(durationLabel(v)),
                    selected: sel,
                    onSelected: _busy ? null : (_) {
                      setState(() { _duration = v; if (v != 'FULL_DAY') _end = _start; });
                      _schedulePreview();
                    },
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(color: sel ? Colors.white : AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w700),
                    showCheckmark: false,
                  );
                }).toList(),
              ),
              const SizedBox(height: 14),
              Row(children: [
                _picker('Từ ngày', formatDate(_start), Icons.calendar_today_outlined, () => _pickDate(true)),
                const SizedBox(width: 12),
                _picker('Đến ngày', formatDate(_end), Icons.calendar_today_outlined, () => _pickDate(false)),
              ]),
              if (custom) ...[
                const SizedBox(height: 14),
                Row(children: [
                  _picker('Từ giờ', _startTime, Icons.schedule, () => _pickTime(true)),
                  const SizedBox(width: 12),
                  _picker('Đến giờ', _endTime, Icons.schedule, () => _pickTime(false)),
                ]),
              ],
              const SizedBox(height: 14),
              _previewBox(),
            ] else ...[
              Row(children: [_picker('Ngày tăng ca', formatDate(_start), Icons.calendar_today_outlined, () => _pickDate(true))]),
              const SizedBox(height: 14),
              Row(children: [
                _picker('Bắt đầu', _startTime, Icons.schedule, () => _pickTime(true)),
                const SizedBox(width: 12),
                _picker('Kết thúc', _endTime, Icons.schedule, () => _pickTime(false)),
              ]),
              const SizedBox(height: 14),
              _text('Mô tả công việc', _desc, 'Công việc dự kiến thực hiện'),
              const SizedBox(height: 14),
              _text('Lý do khai báo muộn', _retro, 'Chỉ cần nhập nếu đăng ký sau thời hạn'),
            ],
            const SizedBox(height: 14),
            _text('Lý do', _reason, 'Nhập tối thiểu 10 ký tự', required: true),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.successBg, border: Border.all(color: AppColors.successBorder), borderRadius: BorderRadius.circular(12)),
              child: Text(
                _leave
                    ? 'Đơn sẽ được gửi đến quản lý phòng ban, sau đó HR áp dụng vào bảng công.'
                    : 'Loại OT và số phút hợp lệ được hệ thống tự tính từ lịch làm việc và chấm công thực tế.',
                style: const TextStyle(color: AppColors.successText, fontSize: 12, height: 1.5),
              ),
            ),
            const SizedBox(height: 18),
            PrimaryButton(label: _leave ? 'Gửi đơn nghỉ phép' : 'Gửi đăng ký tăng ca', loading: _busy, onPress: _submit),
            const SizedBox(height: 10),
            SecondaryButton(label: 'Hủy', disabled: _busy, onPress: () => Navigator.pop(context)),
          ],
        ),
        ),
      ),
    );
  }
}
