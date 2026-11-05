import 'package:flutter/material.dart';
import '../../core/format.dart';
import '../../core/theme/app_colors.dart';
import '../../services/employee_api.dart';
import '../../widgets/banners.dart';
import '../../widgets/cards.dart';
import '../../widgets/feature_screen.dart';

/// Phiếu lương của nhân viên. Mở phiếu RELEASED sẽ đánh dấu đã xem.
class PayslipsScreen extends StatefulWidget {
  final int realtimeRevision;
  const PayslipsScreen({super.key, this.realtimeRevision = 0});

  @override
  State<PayslipsScreen> createState() => _PayslipsScreenState();
}

class _PayslipsScreenState extends State<PayslipsScreen> {
  final _api = EmployeeApi.instance;
  List<Map<String, dynamic>> _items = [];
  String? _expanded;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant PayslipsScreen old) {
    super.didUpdateWidget(old);
    if (old.realtimeRevision != widget.realtimeRevision) _load(silent: true);
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final data = await _api.myPayslips();
      if (!mounted) return;
      setState(() {
        _items = data.cast<Map<String, dynamic>>();
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = friendlyEmployeeError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open(Map<String, dynamic> item) async {
    final id = item['_id'] as String;
    setState(() => _expanded = _expanded == id ? null : id);
    if (item['status'] != 'RELEASED') return;
    try {
      await _api.markPayslipViewed(id);
      if (mounted) setState(() => item['status'] = 'VIEWED');
    } catch (_) {
      // Chi tiết vẫn đọc được nếu không ghi nhận được lượt xem.
    }
  }

  String _statusLabel(String? s) => const {'GENERATED': 'Đang xử lý', 'RELEASED': 'Mới', 'VIEWED': 'Đã xem'}[s] ?? '-';
  BadgeTone _tone(String? s) => switch (s) {
        'RELEASED' => BadgeTone.info,
        'VIEWED' => BadgeTone.success,
        _ => BadgeTone.neutral,
      };

  num _n(Map m, String k) => (m[k] as num?) ?? 0;

  @override
  Widget build(BuildContext context) {
    final newest = _items.isEmpty ? null : _items.first;
    final unread = _items.where((i) => i['status'] == 'RELEASED').length;
    return RefreshIndicator(
      onRefresh: () => _load(silent: true),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 28, 22, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const ScreenHeader(
            eyebrow: 'PHIẾU LƯƠNG',
            title: 'Phiếu lương',
            description: 'Theo dõi thu nhập và các khoản khấu trừ của bạn.',
          ),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          if (_loading)
            const LoadingBlock()
          else ...[
            if (newest != null) ...[_summary(newest, unread), const SizedBox(height: 16)],
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const SectionTitle('Lịch sử phiếu lương'),
              Text('${_items.length} kỳ', style: const TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 12),
            if (_items.isEmpty)
              const EmptyCard('Chưa có phiếu lương. Phiếu lương sẽ xuất hiện khi HR phát hành kỳ lương.')
            else
              ..._items.map((i) => Padding(padding: const EdgeInsets.only(bottom: 10), child: _card(i))),
          ],
        ],
      ),
    );
  }

  Widget _summary(Map<String, dynamic> n, int unread) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(20)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('KỲ GẦN NHẤT', style: TextStyle(color: Color(0xFF93C5FD), fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.1)),
                const SizedBox(height: 6),
                Text('Tháng ${formatPeriod(n['periodLabel'])}', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
              ]),
            ),
            if (unread > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
                child: Text('$unread mới', style: const TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w800)),
              ),
          ]),
          const SizedBox(height: 24),
          const Text('Thực nhận', style: TextStyle(color: Color(0xFF93C5FD), fontSize: 11, fontWeight: FontWeight.w700)),
          const SizedBox(height: 3),
          Text(formatMoney(n['netSalary'] as num?), style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(n['releasedAt'] != null ? 'Phát hành ${formatDate(n['releasedAt'] as String?)}' : 'Chưa phát hành',
              style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 11)),
        ]),
      );

  Widget _card(Map<String, dynamic> i) {
    final open = _expanded == i['_id'];
    final insurance = _n(i, 'socialInsurance') + _n(i, 'healthInsurance') + _n(i, 'unemploymentInsurance');
    return InkWell(
      onTap: () => _open(i),
      borderRadius: BorderRadius.circular(16),
      child: AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Kỳ ${formatPeriod(i['periodLabel'])}', style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(i['releasedAt'] != null ? 'Phát hành ${formatDate(i['releasedAt'] as String?)}' : 'Chưa phát hành',
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ]),
            ),
            StatusBadge(label: _statusLabel(i['status'] as String?), tone: _tone(i['status'] as String?)),
          ]),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(12)),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Thực nhận', style: TextStyle(color: AppColors.primaryDark, fontSize: 11, fontWeight: FontWeight.w800)),
              Text(formatMoney(i['netSalary'] as num?), style: const TextStyle(color: AppColors.primaryDark, fontSize: 18, fontWeight: FontWeight.w800)),
            ]),
          ),
          const SizedBox(height: 12),
          if (open) ...[
            const Divider(height: 1, color: AppColors.divider),
            const SizedBox(height: 12),
            ..._detail(i, insurance),
          ] else
            const Center(child: Text('Chạm để xem chi tiết', style: TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w700))),
        ]),
      ),
    );
  }

  List<Map> _list(Map i, String key) => ((i[key] as List?) ?? const []).whereType<Map>().toList();

  Widget _head(String t) => Padding(
        padding: const EdgeInsets.only(top: 6, bottom: 8),
        child: Text(t, style: const TextStyle(color: AppColors.primaryDark, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.9)),
      );

  Widget _info(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
          Text(value, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w700)),
        ]),
      );

  Widget _sub(String label, num value) => Padding(
        padding: const EdgeInsets.only(left: 12, bottom: 6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 11, height: 1.35))),
          const SizedBox(width: 8),
          Text(formatMoney(value), style: const TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w600)),
        ]),
      );

  /// Cấu trúc theo web `PayslipPreviewDialog`: thu nhập → khấu trừ → thông tin tính thuế → thực nhận.
  List<Widget> _detail(Map<String, dynamic> i, num insurance) {
    final earnings = _list(i, 'earningBreakdown');
    final allowances = _list(i, 'allowanceBreakdown');
    final ot = (i['otBreakdown'] as Map?) ?? const {};
    final otLines = ((ot['breakdown'] as List?) ?? const []).whereType<Map>().toList();
    final deductions = _list(i, 'deductionBreakdown');
    final other = _n(i, 'otherDeductions');
    final payable = i['payableWorkingDays'];
    final standard = i['standardWorkingDays'];
    final dependents = _n(i, 'dependentDeduction');

    String otLabel(Map l) {
      final hours = ((l['hours'] as num?) ?? 0);
      final hText = hours == hours.roundToDouble() ? '${hours.round()}' : hours.toStringAsFixed(1);
      return '${l['label']}: $hText giờ × hệ số ${l['coefficient']}';
    }

    return [
      if (payable != null && standard != null) _info('Ngày công tính lương', '$payable / $standard ngày'),
      if ('${i['employeeCode'] ?? ''}'.isNotEmpty) _info('Mã nhân viên', '${i['employeeCode']}'),
      if ('${i['taxCode'] ?? ''}'.isNotEmpty) _info('Mã số thuế', '${i['taxCode']}'),
      const Divider(height: 20, color: AppColors.divider),
      _head('THU NHẬP'),
      if (earnings.isEmpty)
        _money('Tổng thu nhập', _n(i, 'grossEarnings'))
      else ...[
        for (final e in earnings) ...[
          if (e['type'] == 'ALLOWANCE' && allowances.isNotEmpty) ...[
            _money('Phụ cấp', (e['amount'] as num?) ?? 0),
            for (final a in allowances) _sub('${a['label']}', (a['amount'] as num?) ?? 0),
          ] else if (e['type'] == 'OVERTIME' && otLines.isNotEmpty) ...[
            _money('${e['label']}', (e['amount'] as num?) ?? 0),
            for (final l in otLines) _sub(otLabel(l), (l['amount'] as num?) ?? 0),
          ] else
            _money('${e['label']}', (e['amount'] as num?) ?? 0),
        ],
        const SizedBox(height: 2),
        _money('Tổng thu nhập', _n(i, 'grossEarnings'), strong: true),
      ],
      const Divider(height: 20, color: AppColors.divider),
      _head('KHẤU TRỪ'),
      if (deductions.isEmpty) ...[
        _money('Bảo hiểm', -insurance),
        _money('Thuế TNCN', -_n(i, 'pitAmount')),
      ] else
        for (final d in deductions) _money('${d['label']}', -((d['amount'] as num?) ?? 0)),
      if (other > 0) _money('Khấu trừ khác', -other),
      const Divider(height: 20, color: AppColors.divider),
      _head('THÔNG TIN TÍNH THUẾ'),
      _info('Thu nhập chịu thuế', formatMoney(_n(i, 'taxableIncome'))),
      _info('Giảm trừ bản thân', formatMoney(_n(i, 'personalDeduction'))),
      _info('Giảm trừ người phụ thuộc', formatMoney(dependents)),
      const Divider(height: 20, color: AppColors.divider),
      _money('Thực nhận', _n(i, 'netSalary'), strong: true),
    ];
  }

  Widget _money(String label, num value, {bool strong = false}) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(label, style: TextStyle(color: strong ? AppColors.textPrimary : AppColors.textMuted, fontSize: 12, fontWeight: strong ? FontWeight.w800 : FontWeight.w400)),
          Text(formatMoney(value),
              style: TextStyle(
                  color: value < 0 ? AppColors.dangerText : strong ? AppColors.textPrimary : AppColors.textSecondary,
                  fontSize: 12,
                  fontWeight: strong ? FontWeight.w800 : FontWeight.w700)),
        ]),
      );
}
