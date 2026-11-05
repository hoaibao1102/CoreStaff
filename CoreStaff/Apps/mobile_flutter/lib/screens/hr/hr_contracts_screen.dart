import 'package:flutter/material.dart';
import '../../core/format.dart';
import '../../core/theme/app_colors.dart';
import '../../services/employee_api.dart';
import '../../services/hr_api.dart';
import '../../widgets/banners.dart';
import '../../widgets/cards.dart';
import '../../widgets/feature_screen.dart';

/// Hợp đồng lao động (chỉ đọc), khớp `web/src/screens/Contracts`: nổi bật hợp đồng sắp hết hạn và cảnh báo tuân thủ.
class HrContractsScreen extends StatefulWidget {
  final int realtimeRevision;
  const HrContractsScreen({super.key, this.realtimeRevision = 0});

  @override
  State<HrContractsScreen> createState() => _HrContractsScreenState();
}

class _HrContractsScreenState extends State<HrContractsScreen> {
  List<Map> _contracts = [];
  List<Map> _findings = [];
  String _query = '';
  String _filter = 'ALL';
  bool _loading = true;
  String? _error;

  static const _filters = [
    ('ALL', 'Tất cả'),
    ('EXPIRING', 'Sắp hết hạn'),
    ('ACTIVE', 'Hiệu lực'),
    ('EXPIRED', 'Hết hạn'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant HrContractsScreen old) {
    super.didUpdateWidget(old);
    if (old.realtimeRevision != widget.realtimeRevision) _load(silent: true);
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final contracts = await HrApi.instance.contracts();
      List<Map> findings = [];
      try {
        final c = await HrApi.instance.compliance();
        findings = (c['findings'] as List?)?.whereType<Map>().toList() ?? [];
      } catch (_) {
        // Cảnh báo tuân thủ là phần phụ: danh sách hợp đồng vẫn hiển thị.
      }
      if (mounted) setState(() { _contracts = contracts.whereType<Map>().toList(); _findings = findings; _error = null; });
    } catch (e) {
      if (mounted) setState(() => _error = friendlyEmployeeError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool _isExpiring(Map c) {
    final days = c['expiryWarningDays'];
    return c['isExpiringSoon'] == true || (days is num && days <= 30 && c['isExpired'] != true && c['status'] == 'ACTIVE');
  }

  bool _isExpired(Map c) => c['isExpired'] == true || c['status'] == 'EXPIRED';

  @override
  Widget build(BuildContext context) {
    final needle = _query.trim().toLowerCase();
    final filtered = _contracts.where((c) {
      final ok = switch (_filter) {
        'EXPIRING' => _isExpiring(c),
        'ACTIVE' => c['status'] == 'ACTIVE',
        'EXPIRED' => _isExpired(c),
        _ => true,
      };
      if (!ok) return false;
      if (needle.isEmpty) return true;
      return '${c['employeeFullName'] ?? ''} ${c['employeeCode'] ?? ''}'.toLowerCase().contains(needle);
    }).toList();

    return RefreshIndicator(
      onRefresh: () => _load(silent: true),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 28, 22, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          const ScreenHeader(eyebrow: 'HỢP ĐỒNG', title: 'Hợp đồng lao động', description: 'Theo dõi hiệu lực và thời hạn hợp đồng.'),
          const SizedBox(height: 16),
          if (_error != null && (_loading || _contracts.isNotEmpty)) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          if (!_loading && _findings.isNotEmpty) ...[
            AppCard(
              color: AppColors.warningBg,
              borderColor: AppColors.warningText.withValues(alpha: 0.25),
              child: Row(children: [
                const Icon(Icons.warning_amber_rounded, color: AppColors.warningText),
                const SizedBox(width: 12),
                Expanded(
                  child: Text('${_findings.length} cảnh báo tuân thủ: nhân viên chưa có hợp đồng hoặc hợp đồng đã quá hạn.',
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700, height: 1.35)),
                ),
              ]),
            ),
            const SizedBox(height: 12),
          ],
          TextField(
            onChanged: (v) => setState(() => _query = v),
            decoration: InputDecoration(
              hintText: 'Tìm theo tên hoặc mã nhân viên',
              prefixIcon: const Icon(Icons.search, color: AppColors.textMuted, size: 20),
              filled: true,
              fillColor: AppColors.bgSurface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.borderLight)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.borderLight)),
            ),
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _filters.map((f) {
                final selected = _filter == f.$1;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(f.$2, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: selected ? Colors.white : AppColors.textSecondary)),
                    selected: selected,
                    showCheckmark: false,
                    selectedColor: AppColors.primary,
                    backgroundColor: AppColors.bgSurface,
                    side: BorderSide(color: selected ? AppColors.primary : AppColors.borderLight),
                    onSelected: (_) => setState(() => _filter = f.$1),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 14),
          if (_loading)
            const LoadingBlock()
          else if (_error != null && _contracts.isEmpty)
            ErrorState(message: _error!, onRetry: _load)
          else if (filtered.isEmpty)
            const EmptyCard('Không có hợp đồng phù hợp.')
          else
            ...filtered.map((c) => Padding(padding: const EdgeInsets.only(bottom: 10), child: _card(c))),
        ],
      ),
    );
  }

  Widget _card(Map c) {
    final expiring = _isExpiring(c);
    final expired = _isExpired(c);
    final days = c['expiryWarningDays'];
    return AppCard(
      borderColor: expiring ? AppColors.warningText.withValues(alpha: 0.4) : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${c['employeeFullName'] ?? c['employeeCode'] ?? ''}',
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w800)),
              Text('${c['employeeCode'] ?? ''} · ${contractTypeLabel('${c['contractType']}')}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
            ]),
          ),
          StatusBadge(label: contractStatusLabel('${c['status']}'), tone: contractStatusTone('${c['status']}')),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          const Icon(Icons.event_outlined, size: 16, color: AppColors.textMuted),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              '${formatDate(c['effectiveDate'] as String?)} - ${c['expiryDate'] == null ? 'Không thời hạn' : formatDate(c['expiryDate'] as String?)}',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ),
        ]),
        if (expiring && days is num) ...[
          const SizedBox(height: 8),
          StatusBadge(label: 'Còn ${days.round()} ngày hết hạn', tone: BadgeTone.warning),
        ] else if (expired) ...[
          const SizedBox(height: 8),
          const StatusBadge(label: 'Đã hết hạn', tone: BadgeTone.danger),
        ],
      ]),
    );
  }
}
