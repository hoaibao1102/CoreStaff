import 'package:flutter/material.dart';
import '../../core/config/api_config.dart';
import '../../core/network/api_client.dart';
import '../../core/format.dart';
import '../../core/theme/app_colors.dart';
import '../../services/employee_api.dart';
import '../../services/manager_api.dart';
import '../../widgets/banners.dart';
import '../../widgets/buttons.dart';
import '../../widgets/cards.dart';
import '../../widgets/feature_screen.dart';
import '../requests/requests_tab.dart';
import 'manager_team_screen.dart' show initialsOf;

class _Row {
  final String key;
  final bool isLeave;
  final String name;
  final String? code;
  final String createdAt;
  final Json data;
  _Row(this.key, this.isLeave, this.name, this.code, this.createdAt, this.data);
}

/// Duyệt đơn của nhân viên + tab "Đơn của tôi" (đơn cá nhân của quản lý).
class ManagerApprovalsScreen extends StatefulWidget {
  final int realtimeRevision;
  final ValueChanged<int>? onCountChange;

  const ManagerApprovalsScreen({super.key, this.realtimeRevision = 0, this.onCountChange});

  @override
  State<ManagerApprovalsScreen> createState() => _ManagerApprovalsScreenState();
}

class _ManagerApprovalsScreenState extends State<ManagerApprovalsScreen> {
  final _api = ManagerApi.instance;
  bool _mine = false;
  List<Map> _team = [];
  List<Map> _leaves = [];
  List<Map> _approvals = [];
  bool _loading = true;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant ManagerApprovalsScreen old) {
    super.didUpdateWidget(old);
    if (old.realtimeRevision != widget.realtimeRevision) _load(silent: true);
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    final r = await Future.wait([
      _api.team().then<Object>((v) => v).catchError((Object e) => e),
      _api.pendingLeaves().then<Object>((v) => v).catchError((Object e) => e),
      _api.pendingApprovals().then<Object>((v) => v).catchError((Object e) => e),
    ]);
    if (!mounted) return;
    setState(() {
      if (r[0] is List) _team = (r[0] as List).cast<Map>();
      if (r[1] is List) _leaves = (r[1] as List).cast<Map>();
      if (r[2] is List) _approvals = (r[2] as List).cast<Map>();
      final failure = r.whereType<Exception>().firstOrNull;
      _error = failure == null ? null : friendlyEmployeeError(failure);
      _loading = false;
    });
    widget.onCountChange?.call(_rows.length);
  }

  List<_Row> get _rows {
    final names = <String, Map>{};
    for (final m in _team) {
      names['${m['id']}'] = m;
      names['${m['userId']}'] = m;
    }
    final rows = <_Row>[
      for (final l in _leaves)
        _Row('leave-${l['_id']}', true, (names['${l['employeeId']}']?['fullName'] ?? 'Nhân viên').toString(),
            names['${l['employeeId']}']?['employeeCode'] as String?, '${l['createdAt'] ?? l['startDate'] ?? ''}', Map<String, dynamic>.from(l)),
      for (final a in _approvals)
        _Row('approval-${a['_id']}', false, (names[approvalEmployeeKey(Map<String, dynamic>.from(a))]?['fullName'] ?? 'Nhân viên').toString(),
            names[approvalEmployeeKey(Map<String, dynamic>.from(a))]?['employeeCode'] as String?, '${a['createdAt'] ?? a['workDate'] ?? ''}', Map<String, dynamic>.from(a)),
    ];
    rows.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return rows;
  }

  Future<void> _openRow(_Row row) async {
    setState(() => _success = null);
    final result = await Navigator.of(context).push<({String message, List<String> warnings})>(
      MaterialPageRoute(fullscreenDialog: true, builder: (_) => _DecisionScreen(row: row)),
    );
    if (result == null || !mounted) return;
    setState(() => _success = result.message);
    await _load(silent: true);
    if (result.warnings.isNotEmpty && mounted) {
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Cảnh báo giới hạn lao động'),
          content: Text(result.warnings.join('\n')),
          actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Đã hiểu'))],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _rows;
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(22, 28, 22, 0),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const ScreenHeader(eyebrow: 'DUYỆT ĐƠN', title: 'Duyệt đơn', description: 'Xử lý đơn của nhân viên và theo dõi đơn của bạn.'),
          const SizedBox(height: 14),
          _segmented(rows.length),
          const SizedBox(height: 4),
        ]),
      ),
      Expanded(
        child: _mine
            ? RequestsTab(onBackToOverview: () {}, realtimeRevision: widget.realtimeRevision, embedded: true)
            : RefreshIndicator(
                onRefresh: () => _load(silent: true),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(22, 12, 22, 32),
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    if (_success != null) ...[SuccessBanner(message: _success!), const SizedBox(height: 12)],
                    if (_error != null && (_loading || rows.isNotEmpty)) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
                    if (_loading)
                      const LoadingBlock()
                    else if (_error != null && rows.isEmpty)
                      ErrorState(message: _error!, onRetry: _load)
                    else if (rows.isEmpty)
                      const EmptyCard('Không còn đơn chờ duyệt. Khi nhân viên gửi đơn nghỉ phép hoặc tăng ca, đơn sẽ xuất hiện ở đây.')
                    else
                      ...rows.map((r) => Padding(padding: const EdgeInsets.only(bottom: 10), child: _card(r))),
                  ],
                ),
              ),
      ),
    ]);
  }

  Widget _segmented(int pending) {
    final opts = [(false, 'Cần duyệt${pending > 0 ? ' ($pending)' : ''}'), (true, 'Đơn của tôi')];
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.divider, borderRadius: BorderRadius.circular(14)),
      child: Row(
        children: opts.map((o) {
          final on = _mine == o.$1;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() { _mine = o.$1; _success = null; }),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(color: on ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(11)),
                alignment: Alignment.center,
                child: Text(o.$2, style: TextStyle(color: on ? AppColors.primaryDark : AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w800)),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _card(_Row row) {
    final d = row.data;
    final title = row.isLeave ? 'Nghỉ phép' : approvalLabel(d);
    final when = row.isLeave
        ? '${formatDate(d['startDate'] as String?)}${d['endDate'] != d['startDate'] ? ' - ${formatDate(d['endDate'] as String?)}' : ''} · ${durationLabel(d['durationType'] as String?)}'
        : '${formatDate(d['workDate'] as String?)}${d['requestedStart'] != null ? ' · ${formatTime(d['requestedStart'] as String?)} - ${formatTime(d['requestedEnd'] as String?)}' : ''}';
    return InkWell(
      onTap: () => _openRow(row),
      borderRadius: BorderRadius.circular(16),
      child: AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 42,
              height: 42,
              decoration: const BoxDecoration(color: AppColors.primarySoft, shape: BoxShape.circle),
              alignment: Alignment.center,
              child: Text(initialsOf(row.name), style: const TextStyle(color: AppColors.primary, fontSize: 14, fontWeight: FontWeight.w800)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(row.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text(title, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
              ]),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textQuaternary),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            Icon(row.isLeave ? Icons.calendar_today_outlined : Icons.schedule, size: 16, color: AppColors.textMuted),
            const SizedBox(width: 6),
            Expanded(child: Text(when, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600))),
          ]),
          const SizedBox(height: 8),
          Text('${d['reason'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.5)),
        ]),
      ),
    );
  }
}

/// Chi tiết đơn + duyệt / từ chối / yêu cầu bổ sung.
class _DecisionScreen extends StatefulWidget {
  final _Row row;
  const _DecisionScreen({required this.row});

  @override
  State<_DecisionScreen> createState() => _DecisionScreenState();
}

class _DecisionScreenState extends State<_DecisionScreen> {
  final _comment = TextEditingController();
  final _scroll = ScrollController();

  /// Lỗi hiển thị ở đầu trang nên cuộn lên để người dùng thấy ngay.
  void _showError(String message) {
    setState(() => _error = message);
    if (_scroll.hasClients) _scroll.animateTo(0, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
  }
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _comment.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _run(String action) async {
    final row = widget.row;
    final text = _comment.text.trim();
    if (action != 'approve' && text.length < 3) {
      _showError(action == 'reject'
          ? 'Vui lòng nhập lý do từ chối (tối thiểu 3 ký tự).'
          : 'Vui lòng nhập nội dung cần nhân viên bổ sung (tối thiểu 3 ký tự).');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      var warnings = <String>[];
      final api = ManagerApi.instance;
      if (row.isLeave) {
        final id = '${row.data['_id']}';
        action == 'approve' ? await api.approveLeave(id) : await api.rejectLeave(id, text);
      } else {
        final decided = await api.decideApproval(row.data, action, reason: text);
        final v = (decided['compliance'] as Map?)?['violations'] as List?;
        warnings = (v ?? const []).map((e) => '${(e as Map)['message']}').toList();
      }
      final msg = action == 'approve'
          ? 'Đã duyệt đơn của ${row.name}.'
          : action == 'reject'
              ? 'Đã từ chối đơn của ${row.name}.'
              : 'Đã yêu cầu ${row.name} bổ sung giải trình.';
      if (mounted) Navigator.of(context).pop((message: msg, warnings: warnings));
    } catch (e) {
      if (mounted) _showError(friendlyEmployeeError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String? _evidenceId(Map d) {
    final e = d['evidenceId'];
    if (e is Map) return e['_id']?.toString();
    return e?.toString();
  }

  /// Ảnh selfie bằng chứng: endpoint cần cookie phiên nên gửi kèm header Cookie.
  Widget _selfie(String id) {
    final url = ApiConfig.buildUri(ApiConfig.currentBaseUrl, '/api/attendance/evidence/$id').toString();
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Ảnh selfie bằng chứng', style: TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 320),
            child: Image.network(
              url,
              headers: {'Cookie': ApiClient.instance.cookieHeader},
              width: double.infinity,
              fit: BoxFit.cover,
              loadingBuilder: (c, child, p) => p == null ? child : const SizedBox(height: 160, child: Center(child: CircularProgressIndicator(strokeWidth: 2))),
              errorBuilder: (c, e, s) => Container(
                height: 84,
                alignment: Alignment.center,
                color: AppColors.bgDefault,
                child: const Text('Không tải được ảnh bằng chứng.', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
              ),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _detail(String label, String value, {bool last = false}) => Padding(
        padding: EdgeInsets.only(bottom: last ? 0 : 12),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 110, child: Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 12))),
          Expanded(child: Text(value, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600, height: 1.4))),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final row = widget.row;
    final d = row.data;
    final webOnly = !row.isLeave && isWebOnlyApproval(d);
    final meta = d['metadata'] as Map?;

    final details = row.isLeave
        ? [
            _detail('Loại nghỉ', d['leaveType'] == 'PAID_LEAVE' ? 'Có lương' : 'Không lương'),
            _detail('Thời gian', '${formatDate(d['startDate'] as String?)}${d['endDate'] != d['startDate'] ? ' - ${formatDate(d['endDate'] as String?)}' : ''}'),
            _detail('Thời lượng',
                '${durationLabel(d['durationType'] as String?)}${d['durationType'] == 'CUSTOM_HOURS' && d['requestedStart'] != null ? ' (${d['requestedStart']}–${d['requestedEnd']})' : ''}'),
            if (d['calculatedMinutes'] != null)
              _detail('Quy đổi', '${minutesText(d['calculatedMinutes'] as num)} · ${((d['leaveEquivalent'] as num?) ?? 0).toStringAsFixed(2)} ngày phép'),
            _detail('Lý do', '${d['reason'] ?? ''}', last: true),
          ]
        : [
            if (meta?['actionType'] != null) _detail('Hành động', meta!['actionType'] == 'CHECK_OUT' ? 'Ra ca' : 'Vào ca'),
            _detail('Ngày làm việc', formatDate(d['workDate'] as String?)),
            if (d['createdAt'] != null) _detail('Gửi lúc', formatDateTime(d['createdAt'] as String?)),
            if (d['requestedStart'] != null) _detail('Khung giờ', '${formatTime(d['requestedStart'] as String?)} - ${formatTime(d['requestedEnd'] as String?)}'),
            if ((d['workDescription'] ?? '').toString().isNotEmpty) _detail('Công việc', '${d['workDescription']}'),
            if (meta?['address'] != null) _detail('Địa điểm', '${meta!['address']}'),
            if (meta?['accuracyMeters'] is num) _detail('Độ chính xác GPS', '±${(meta!['accuracyMeters'] as num).round()} m'),
            if (d['isRetroactive'] == true) _detail('Khai báo muộn', '${d['retroactiveReason'] ?? 'Có'}'),
            _detail('Lý do', '${d['reason'] ?? ''}', last: true),
          ];

    return Scaffold(
      backgroundColor: AppColors.bgDefault,
      appBar: AppBar(
        backgroundColor: AppColors.bgDefault,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(icon: const Icon(Icons.close, color: AppColors.textSecondary), onPressed: _busy ? null : () => Navigator.pop(context)),
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(row.isLeave ? 'ĐƠN NGHỈ PHÉP' : approvalLabel(d).toUpperCase(),
              style: const TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
          Text(row.name, style: const TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
        ]),
      ),
      body: SafeArea(
        child: ListView(controller: _scroll, keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag, padding: const EdgeInsets.fromLTRB(22, 8, 22, 32), children: [
          if (row.code != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(row.code!, style: const TextStyle(color: AppColors.textMuted, fontSize: 12))),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          AppCard(child: Column(children: details)),
          if (!row.isLeave && _evidenceId(d) != null) ...[const SizedBox(height: 14), _selfie(_evidenceId(d)!)],
          const SizedBox(height: 14),
          if (webOnly)
            const NoticeBanner(message: 'Đơn xác nhận công theo lịch cần kiểm tra kỳ công và ngữ cảnh nên chỉ duyệt được trên web.')
          else ...[
            Text(row.isLeave ? 'Lý do (bắt buộc khi từ chối)' : 'Ý kiến (bắt buộc khi từ chối hoặc yêu cầu bổ sung)',
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            TextField(
              controller: _comment,
              enabled: !_busy,
              minLines: 3,
              maxLines: 5,
              decoration: InputDecoration(
                hintText: 'Nhập ý kiến xử lý',
                filled: true,
                fillColor: AppColors.bgSurface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
              ),
            ),
            const SizedBox(height: 14),
            PrimaryButton(label: 'Duyệt đơn', loading: _busy, onPress: () => _run('approve')),
            const SizedBox(height: 10),
            SecondaryButton(label: 'Từ chối', danger: true, disabled: _busy, onPress: () => _run('reject')),
            if (!row.isLeave) ...[
              const SizedBox(height: 10),
              SecondaryButton(label: 'Yêu cầu bổ sung', disabled: _busy, onPress: () => _run('request-clarification')),
            ],
          ],
        ]),
      ),
    );
  }
}
