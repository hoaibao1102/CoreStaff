abstract class OverviewEvent {
  const OverviewEvent();
}

class LoadOverview extends OverviewEvent {
  final bool isRefresh;

  const LoadOverview({this.isRefresh = false});
}

class RefreshOverview extends OverviewEvent {
  const RefreshOverview();
}

