import 'package:flutter/material.dart';
import '../../core/config/api_config.dart';
import '../../core/format.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/cards.dart';

typedef DayJson = Map<dynamic, dynamic>;

/// Kết quả quy đổi công của một ngày, khớp `calculateDayWorkCredit` bên web.
class DayCredit {
  final double credit;
  final String label;
  final bool provisional;
  final int obligation;
  final int worked;
  final int ratioPercent;
  final String explanation;
  final String fullPct;
  final String halfPct;
  final int fullMin;
  final int halfMin;

  const DayCredit({
    required this.credit,
    required this.label,
    required this.provisional,
    required this.obligation,
    required this.worked,
    required this.ratioPercent,
    required this.explanation,
    required this.fullPct,
    required this.halfPct,
    required this.fullMin,
    required this.halfMin,
  });
}

String _pct(double v) {
  final p = (v * 1000).round() / 10;
  return p == p.roundToDouble() ? '${p.round()}%' : '$p%';
}

/// Trạng thái hiển thị của ngày: FORFEITED, FORGOTTEN, LATE, EARLY_LEAVE, DAY_OFF, ATTENDED, NONE.
String dayHistoryStatus(DayJson d) {
  final workday = d['workdayType'];
  if (workday == 'WEEKLY_OFF') return 'NONE';
  if ((d['resolution'] as DayJson?)?['type'] == 'FORFEITED_MISSING_PUNCH') return 'FORFEITED';
  final req = d['attendanceRequirements'] as DayJson?;
  final partial = ['PAID_LEAVE', 'UNPAID_LEAVE'].contains(workday) &&
      (((req?['requiredWorkingMinutes'] as num?) ?? 0) > 0 ||
          ((req?['durationTypes'] as List?) ?? const []).any((t) => t != 'FULL_DAY'));
  final status = d['attendanceStatus'] ?? d['status'];
  if (!partial &&
      (status == 'DAY_OFF' || ['PUBLIC_HOLIDAY', 'PAID_LEAVE', 'UNPAID_LEAVE'].contains(workday))) {
    return 'DAY_OFF';
  }
  final hasIn = (d['checkIn'] as DayJson?)?['recordedAt'] != null;
  final hasOut = (d['checkOut'] as DayJson?)?['recordedAt'] != null;
  if ('${d['workDate']}'.compareTo(todayKey()) < 0 &&
      (!hasIn || !hasOut) &&
      status != 'COMPLETED' &&
      d['dayResult'] != 'PRESENT') {
    return 'FORGOTTEN';
  }
  if (((d['lateMinutes'] as num?) ?? 0) > 0 || status == 'LATE') return 'LATE';
  if (((d['earlyMinutes'] as num?) ?? 0) > 0 || status == 'EARLY_LEAVE') return 'EARLY_LEAVE';
  if (hasIn || status == 'COMPLETED' || d['dayResult'] == 'PRESENT') return 'ATTENDED';
  return 'NONE';
}

DayCredit calculateDayCredit(DayJson d, String hs, DayJson? policy) {
  final req = d['attendanceRequirements'] as DayJson?;
  final obligation = ((req?['requiredWorkingMinutes'] as num?) ?? 480).round();
  final leave = ((req?['approvedLeaveMinutes'] as num?) ?? 0).round();
  var worked = ((d['totalWorkingMinutes'] ?? d['workingMinutes']) as num?)?.round() ?? 0;
  final inAt = DateTime.tryParse('${(d['checkIn'] as DayJson?)?['recordedAt'] ?? ''}');
  final outAt = DateTime.tryParse('${(d['checkOut'] as DayJson?)?['recordedAt'] ?? ''}');
  if (hs == 'FORFEITED') {
    worked = 0;
  } else if (worked == 0 && inAt != null && outAt != null) {
    worked = outAt.difference(inAt).inMinutes.clamp(0, 100000);
  }
  final full = (policy?['fullDayMinimumRatio'] as num?)?.toDouble() ?? 0.875;
  final half = (policy?['halfDayMinimumRatio'] as num?)?.toDouble() ?? 0.5;
  final fp = _pct(full), hp = _pct(half);
  final fm = (obligation * full).round(), hm = (obligation * half).round();

  DayCredit make(double c, String label, String why,
          {bool prov = false, int? ob, int? w, int? ratio}) =>
      DayCredit(
        credit: c,
        label: label,
        provisional: prov,
        obligation: ob ?? obligation,
        worked: w ?? worked,
        ratioPercent: ratio ??
            (obligation > 0 ? ((worked / obligation) * 100).round().clamp(0, 100) : 0),
        explanation: why,
        fullPct: fp,
        halfPct: hp,
        fullMin: fm,
        halfMin: hm,
      );

  switch (d['workdayType']) {
    case 'WEEKLY_OFF':
      return make(0, '0 công', 'Ngày nghỉ hàng tuần theo quy định, không phát sinh nghĩa vụ làm việc.',
          ob: 0, w: 0, ratio: 0);
    case 'PUBLIC_HOLIDAY':
      return make(1, '1.0 công', 'Nghỉ lễ theo quy định Nhà nước, được hưởng nguyên lương (1.0 ngày công).',
          ratio: 100);
    case 'PAID_LEAVE':
      return make(1, '1.0 công', 'Nghỉ phép hưởng lương đã được duyệt, tính đủ 1.0 ngày công.', ratio: 100);
    case 'UNPAID_LEAVE':
      return make(0, '0 công', 'Nghỉ không hưởng lương theo đơn đề nghị đã phê duyệt.', w: 0, ratio: 0);
  }
  if (hs == 'FORFEITED') {
    return make(0, '0 công',
        'Đã xác nhận vắng (không tính công do thiếu mốc chấm công và không giải trình).',
        w: 0, ratio: 0);
  }
  if (hs == 'FORGOTTEN') {
    return make(0, '0 công',
        'Chưa đủ 2 mốc vào/ra. Theo chính sách công ty, ngày công tạm tính là 0 công cho đến khi gửi đơn Xác nhận công và được Quản lý duyệt.',
        prov: true);
  }
  if ((d['attendanceStatus'] ?? d['status']) == 'CHECKED_IN') {
    return make(0, 'Đang làm việc', 'Ca làm việc đang diễn ra. Ngày công sẽ được chốt sau khi bạn hoàn tất ra ca.',
        prov: true);
  }
  final credited = (worked + leave).clamp(0, obligation);
  final ratio = obligation > 0 ? credited / obligation : 0.0;
  final rp = (ratio * 100).round().clamp(0, 100);
  if (ratio >= full - 0.0001) {
    return make(1, '1.0 công',
        'Thời gian làm việc đạt $rp% ca quy định (yêu cầu tối thiểu $fp), được ghi nhận trọn vẹn 1.0 ngày công.',
        ratio: rp);
  }
  if (ratio >= half - 0.0001) {
    return make(0.5, '0.5 công',
        'Thời gian làm việc đạt $rp% ca quy định (từ $hp đến dưới $fp), được ghi nhận 0.5 ngày công.',
        ratio: rp);
  }
  return make(0, '0 công',
      'Thời gian làm việc đạt $rp% ca (dưới $hp), không đủ điều kiện ghi nhận ngày công.',
      ratio: rp);
}

Future<void> showDayDetailSheet(BuildContext context, DayJson day, DayJson? policy) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppColors.bgDefault,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.88,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (ctx, scroll) => _DaySheet(day: day, policy: policy, controller: scroll),
    ),
  );
}

class _DaySheet extends StatefulWidget {
  final DayJson day;
  final DayJson? policy;
  final ScrollController controller;
  const _DaySheet({required this.day, required this.policy, required this.controller});

  @override
  State<_DaySheet> createState() => _DaySheetState();
}

class _DaySheetState extends State<_DaySheet> {
  bool _showCredit = false;

  DayJson get d => widget.day;

  Color _creditColor(double c) => c >= 1
      ? AppColors.successText
      : c >= 0.5
          ? AppColors.infoText
          : AppColors.warningText;

  (String, BadgeTone) _statusBadge(String hs) {
    switch (hs) {
      case 'FORFEITED':
        return ('Mất ngày công', BadgeTone.danger);
      case 'FORGOTTEN':
        return ('Quên chấm công', BadgeTone.warning);
      case 'LATE':
        return ('Đi muộn', BadgeTone.warning);
      case 'EARLY_LEAVE':
        return ('Về sớm', BadgeTone.danger);
      case 'DAY_OFF':
        return ('Nghỉ', BadgeTone.neutral);
      case 'ATTENDED':
        return (((d['attendanceStatus'] ?? d['status']) == 'CHECKED_IN') ? 'Đang trong ca' : 'Hoàn thành',
            ((d['attendanceStatus'] ?? d['status']) == 'CHECKED_IN') ? BadgeTone.info : BadgeTone.success);
      default:
        return ('Chưa có dữ liệu', BadgeTone.neutral);
    }
  }

  String _workedText(String hs) {
    if (hs == 'FORFEITED') return '0 phút';
    final mins = (d['totalWorkingMinutes'] ?? d['workingMinutes']) as num?;
    if (mins != null && mins > 0) return formatMinutes(mins);
    final i = DateTime.tryParse('${(d['checkIn'] as DayJson?)?['recordedAt'] ?? ''}');
    final o = DateTime.tryParse('${(d['checkOut'] as DayJson?)?['recordedAt'] ?? ''}');
    if (i != null && o != null) {
      final m = o.difference(i).inMinutes;
      return m > 0 ? formatMinutes(m) : '${o.difference(i).inSeconds.clamp(0, 59)} giây';
    }
    return 'Chưa chốt';
  }

  Widget _statCard(String label, Widget value) => Expanded(
        child: Container(
          constraints: const BoxConstraints(minHeight: 72),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              value,
            ],
          ),
        ),
      );

  Widget _creditSection(DayCredit c, String hs) {
    final color = _creditColor(c.credit);
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => setState(() => _showCredit = !_showCredit),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  const Icon(Icons.calculate_outlined, size: 18, color: AppColors.primary),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text('Chi tiết quy đổi công',
                        style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w800)),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                    child: Text(c.label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w800)),
                  ),
                  Icon(_showCredit ? Icons.expand_less : Icons.expand_more, color: AppColors.textMuted),
                ],
              ),
            ),
          ),
          if (_showCredit)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Divider(height: 1, color: AppColors.divider),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Hoàn thành ca (${c.ratioPercent}%)',
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                      Text('${formatMinutes(c.worked)} / ${formatMinutes(c.obligation)}',
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LinearProgressIndicator(
                      value: (c.credit > 0 ? c.ratioPercent.clamp(10, 100) : c.ratioPercent) / 100,
                      minHeight: 8,
                      backgroundColor: AppColors.divider,
                      valueColor: AlwaysStoppedAnimation(color),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(c.explanation,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, height: 1.5, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  Text('• 1.0 công: từ ${c.fullPct} ca (${formatMinutes(c.fullMin)})',
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 11, height: 1.5)),
                  Text('• 0.5 công: từ ${c.halfPct} ca (${formatMinutes(c.halfMin)})',
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 11, height: 1.5)),
                  if (hs == 'FORGOTTEN') ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.warningBg,
                        border: Border.all(color: AppColors.warningBorder),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Text(
                          'Ngày này thiếu mốc chấm công. Hãy gửi đơn Xác nhận công ở mục Đơn từ để Quản lý duyệt và ghi nhận đủ công.',
                          style: TextStyle(color: AppColors.warningText, fontSize: 11, height: 1.5)),
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _eventCard(String title, DayJson? e) {
    final time = formatTime(e?['recordedAt'] as String?);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(shape: BoxShape.circle, color: e == null ? AppColors.borderLight : AppColors.successDot),
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w800))),
            Text(time, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w800)),
          ]),
          if (e == null)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('Chưa ghi nhận', style: TextStyle(color: AppColors.textMuted, fontSize: 12, fontStyle: FontStyle.italic)),
            )
          else
            _evidence(e),
        ],
      ),
    );
  }

  Widget _evidence(DayJson e) {
    final method = e['method'];
    final address = (e['address'] ?? (e['location'] as DayJson?)?['address'] ?? e['workplaceName'])?.toString();
    final acc = (e['accuracyMeters'] ?? (e['location'] as DayJson?)?['accuracyMeters']) as num?;
    final distance = e['distanceMeters'] as num?;
    final url = e['evidenceUrl']?.toString();

    final (icon, text) = switch (method) {
      'SELFIE' => (Icons.photo_camera_outlined, 'Ảnh selfie'),
      'GPS' => (Icons.my_location_outlined, 'Xác thực vị trí GPS'),
      'NETWORK' => (Icons.wifi, 'Xác thực Wi-Fi công ty'),
      _ => (Icons.verified_outlined, 'Đã ghi nhận'),
    };
    Widget line(IconData i, String t) => Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(i, size: 14, color: AppColors.textMuted),
            const SizedBox(width: 6),
            Expanded(child: Text(t, style: const TextStyle(color: AppColors.textMuted, fontSize: 11, height: 1.4))),
          ]),
        );

    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(10)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (method == 'SELFIE' && url != null && url.isNotEmpty) ...[
            _thumb(url),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Icon(icon, size: 15, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Expanded(child: Text(text, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w800))),
                ]),
                if (address != null && address.isNotEmpty) line(Icons.place_outlined, address),
                if (distance != null) line(Icons.straighten, 'Khoảng cách: ${distance.round()} m'),
                if (acc != null) line(Icons.gps_fixed, 'Độ chính xác GPS: ±${acc.round()} m'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _thumb(String path) {
    final url = path.startsWith('http') ? path : ApiConfig.buildUri(ApiConfig.currentBaseUrl, path).toString();
    return GestureDetector(
      onTap: () => showDialog<void>(
        context: context,
        builder: (ctx) => Dialog(
          backgroundColor: Colors.black,
          insetPadding: const EdgeInsets.all(16),
          child: InteractiveViewer(child: _image(url, fit: BoxFit.contain)),
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(width: 64, height: 64, child: _image(url)),
      ),
    );
  }

  Widget _image(String url, {BoxFit fit = BoxFit.cover}) => Image.network(
        url,
        fit: fit,
        headers: {'Cookie': ApiClient.instance.cookieHeader},
        loadingBuilder: (c, child, p) => p == null
            ? child
            : const Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))),
        errorBuilder: (c, e, s) => Container(
          color: AppColors.divider,
          alignment: Alignment.center,
          child: const Icon(Icons.broken_image_outlined, color: AppColors.textMuted),
        ),
      );

  Widget _overtime(DayJson ot) {
    String t(dynamic v) => v == null ? '—' : formatTime('$v');
    final start = ot['approvedStart'] ?? ot['requestedStart'];
    final end = ot['approvedEnd'] ?? ot['requestedEnd'];
    final mins = ot['otMinutes'] as num?;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.infoBg,
        border: Border.all(color: AppColors.infoBorder),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.schedule, size: 16, color: AppColors.infoText),
            const SizedBox(width: 6),
            const Expanded(
                child: Text('Tăng ca được duyệt',
                    style: TextStyle(color: AppColors.infoText, fontSize: 13, fontWeight: FontWeight.w800))),
            const StatusBadge(label: 'Đã duyệt', tone: BadgeTone.success),
          ]),
          const SizedBox(height: 8),
          Text('${t(start)} → ${t(end)}${mins != null && mins > 0 ? ' (${formatMinutes(mins)})' : ''}',
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w700)),
          if ('${ot['reason'] ?? ''}'.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('Lý do: ${ot['reason']}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 11, height: 1.4)),
            ),
          if ('${ot['reviewComment'] ?? ''}'.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('Ý kiến quản lý: "${ot['reviewComment']}"',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 11, fontStyle: FontStyle.italic, height: 1.4)),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hs = dayHistoryStatus(d);
    final credit = calculateDayCredit(d, hs, widget.policy);
    final (statusLabel, statusTone) = _statusBadge(hs);
    final late = ((d['lateMinutes'] as num?) ?? 0);
    final early = ((d['earlyMinutes'] as num?) ?? 0);
    final ot = d['overtime'] as DayJson?;
    final resolution = d['resolution'] as DayJson?;

    return Column(
      children: [
        Center(
          child: Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(top: 10, bottom: 6),
            decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(4)),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 6, 8, 8),
          child: Row(children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.event_note_outlined, color: AppColors.primary, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Chi tiết ngày ${formatDate(d['workDate'] as String?)}',
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w800)),
                if (shiftTitle(d['shiftName']).isNotEmpty)
                  Text(shiftTitle(d['shiftName']), style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
              ]),
            ),
            IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close, color: AppColors.textMuted)),
          ]),
        ),
        const Divider(height: 1, color: AppColors.divider),
        Expanded(
          child: ListView(
            controller: widget.controller,
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _statCard('Trạng thái', Wrap(spacing: 4, runSpacing: 4, children: [
                  StatusBadge(label: statusLabel, tone: statusTone),
                  if (hs == 'LATE' && early > 0) const StatusBadge(label: 'Về sớm', tone: BadgeTone.danger),
                ])),
                const SizedBox(width: 8),
                _statCard('Tổng thời gian',
                    Text(_workedText(hs), style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w800))),
                const SizedBox(width: 8),
                _statCard(
                    'Ngày công',
                    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(credit.label,
                          style: TextStyle(color: _creditColor(credit.credit), fontSize: 13, fontWeight: FontWeight.w800)),
                      if (credit.provisional)
                        const Text('Tạm tính', style: TextStyle(color: AppColors.warningText, fontSize: 10, fontWeight: FontWeight.w700)),
                    ])),
              ]),
              if (late > 0 || early > 0) ...[
                const SizedBox(height: 10),
                Wrap(spacing: 12, children: [
                  if (late > 0)
                    Text('Đi muộn ${formatMinutes(late)}',
                        style: const TextStyle(color: AppColors.warningText, fontSize: 12, fontWeight: FontWeight.w700)),
                  if (early > 0)
                    Text('Về sớm ${formatMinutes(early)}',
                        style: const TextStyle(color: AppColors.dangerDarkText, fontSize: 12, fontWeight: FontWeight.w700)),
                ]),
              ],
              const SizedBox(height: 12),
              _creditSection(credit, hs),
              if (hs == 'FORFEITED' && resolution != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    border: Border.all(color: AppColors.borderDanger),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Ngày này đã được xác nhận vắng và không tính công.',
                        style: TextStyle(color: AppColors.dangerText, fontSize: 12, fontWeight: FontWeight.w800)),
                    if ('${resolution['reason'] ?? ''}'.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text('Lý do: ${resolution['reason']}',
                            style: const TextStyle(color: AppColors.dangerText, fontSize: 11, height: 1.4)),
                      ),
                  ]),
                ),
              ],
              const SizedBox(height: 12),
              _eventCard('Giờ vào', d['checkIn'] as DayJson?),
              const SizedBox(height: 10),
              _eventCard('Giờ ra', d['checkOut'] as DayJson?),
              if (ot != null) ...[const SizedBox(height: 12), _overtime(ot)],
              const SizedBox(height: 18),
              SizedBox(
                height: 46,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Đóng', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
