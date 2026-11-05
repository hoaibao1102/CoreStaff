abstract class AccountEvent {
  const AccountEvent();
}

class AccountProfileRequested extends AccountEvent {
  final bool isRefresh;

  const AccountProfileRequested({this.isRefresh = false});
}

