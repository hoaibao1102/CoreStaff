import '../../data/models/payslip_dto.dart';

abstract class PayslipState {
  const PayslipState();
}

class PayslipInitial extends PayslipState {
  const PayslipInitial();
}

class PayslipLoading extends PayslipState {
  const PayslipLoading();
}

class PayslipLoaded extends PayslipState {
  final List<PayslipDto> payslips;
  final String? expandedId;

  const PayslipLoaded({
    required this.payslips,
    this.expandedId,
  });

  PayslipDto? get newest => payslips.isNotEmpty ? payslips.first : null;

  int get unreadCount => payslips.where((p) => p.isUnread).length;

  PayslipLoaded copyWith({
    List<PayslipDto>? payslips,
    String? Function()? expandedId,
  }) {
    return PayslipLoaded(
      payslips: payslips ?? this.payslips,
      expandedId: expandedId != null ? expandedId() : this.expandedId,
    );
  }
}

class PayslipError extends PayslipState {
  final String message;

  const PayslipError({required this.message});
}

