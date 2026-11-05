class PayslipBreakdownItem {
  final String label;
  final num amount;

  const PayslipBreakdownItem({
    required this.label,
    required this.amount,
  });

  factory PayslipBreakdownItem.fromJson(Map<String, dynamic> json) {
    return PayslipBreakdownItem(
      label: json['label']?.toString() ?? '',
      amount: json['amount'] is num ? json['amount'] as num : 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'label': label,
    'amount': amount,
  };
}

class PayslipDto {
  final String id;
  final String periodLabel;
  final String status; // 'GENERATED' | 'RELEASED' | 'VIEWED'
  final num grossEarnings;
  final num netSalary;
  final num socialInsurance;
  final num healthInsurance;
  final num unemploymentInsurance;
  final num pitAmount;
  final num otherDeductions;
  final List<PayslipBreakdownItem> earningBreakdown;
  final List<PayslipBreakdownItem> deductionBreakdown;
  final String? releasedAt;
  final String? viewedAt;

  const PayslipDto({
    required this.id,
    required this.periodLabel,
    required this.status,
    required this.grossEarnings,
    required this.netSalary,
    required this.socialInsurance,
    required this.healthInsurance,
    required this.unemploymentInsurance,
    required this.pitAmount,
    required this.otherDeductions,
    this.earningBreakdown = const [],
    this.deductionBreakdown = const [],
    this.releasedAt,
    this.viewedAt,
  });

  num get totalInsurance => socialInsurance + healthInsurance + unemploymentInsurance;

  bool get isUnread => status == 'RELEASED';

  factory PayslipDto.fromJson(Map<String, dynamic> json) {
    return PayslipDto(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      periodLabel: json['periodLabel']?.toString() ?? '',
      status: json['status']?.toString() ?? 'GENERATED',
      grossEarnings: json['grossEarnings'] is num ? json['grossEarnings'] as num : 0,
      netSalary: json['netSalary'] is num ? json['netSalary'] as num : 0,
      socialInsurance: json['socialInsurance'] is num ? json['socialInsurance'] as num : 0,
      healthInsurance: json['healthInsurance'] is num ? json['healthInsurance'] as num : 0,
      unemploymentInsurance: json['unemploymentInsurance'] is num ? json['unemploymentInsurance'] as num : 0,
      pitAmount: json['pitAmount'] is num ? json['pitAmount'] as num : 0,
      otherDeductions: json['otherDeductions'] is num ? json['otherDeductions'] as num : 0,
      earningBreakdown: (json['earningBreakdown'] as List<dynamic>?)
              ?.map((item) => PayslipBreakdownItem.fromJson(item as Map<String, dynamic>))
              .toList() ??
          const [],
      deductionBreakdown: (json['deductionBreakdown'] as List<dynamic>?)
              ?.map((item) => PayslipBreakdownItem.fromJson(item as Map<String, dynamic>))
              .toList() ??
          const [],
      releasedAt: json['releasedAt']?.toString(),
      viewedAt: json['viewedAt']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'periodLabel': periodLabel,
    'status': status,
    'grossEarnings': grossEarnings,
    'netSalary': netSalary,
    'socialInsurance': socialInsurance,
    'healthInsurance': healthInsurance,
    'unemploymentInsurance': unemploymentInsurance,
    'pitAmount': pitAmount,
    'otherDeductions': otherDeductions,
    'earningBreakdown': earningBreakdown.map((e) => e.toJson()).toList(),
    'deductionBreakdown': deductionBreakdown.map((e) => e.toJson()).toList(),
    if (releasedAt != null) 'releasedAt': releasedAt,
    if (viewedAt != null) 'viewedAt': viewedAt,
  };

  PayslipDto copyWith({
    String? id,
    String? periodLabel,
    String? status,
    num? grossEarnings,
    num? netSalary,
    num? socialInsurance,
    num? healthInsurance,
    num? unemploymentInsurance,
    num? pitAmount,
    num? otherDeductions,
    List<PayslipBreakdownItem>? earningBreakdown,
    List<PayslipBreakdownItem>? deductionBreakdown,
    String? releasedAt,
    String? viewedAt,
  }) {
    return PayslipDto(
      id: id ?? this.id,
      periodLabel: periodLabel ?? this.periodLabel,
      status: status ?? this.status,
      grossEarnings: grossEarnings ?? this.grossEarnings,
      netSalary: netSalary ?? this.netSalary,
      socialInsurance: socialInsurance ?? this.socialInsurance,
      healthInsurance: healthInsurance ?? this.healthInsurance,
      unemploymentInsurance: unemploymentInsurance ?? this.unemploymentInsurance,
      pitAmount: pitAmount ?? this.pitAmount,
      otherDeductions: otherDeductions ?? this.otherDeductions,
      earningBreakdown: earningBreakdown ?? this.earningBreakdown,
      deductionBreakdown: deductionBreakdown ?? this.deductionBreakdown,
      releasedAt: releasedAt ?? this.releasedAt,
      viewedAt: viewedAt ?? this.viewedAt,
    );
  }
}

