abstract class PayslipEvent {
  const PayslipEvent();
}

class PayslipsRequested extends PayslipEvent {
  final bool isRefresh;

  const PayslipsRequested({this.isRefresh = false});
}

class PayslipToggleExpanded extends PayslipEvent {
  final String id;

  const PayslipToggleExpanded({required this.id});
}

