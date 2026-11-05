enum RequestsFilter {
  all,
  leave,
  overtime;

  String get label {
    switch (this) {
      case RequestsFilter.all:
        return 'Tất cả';
      case RequestsFilter.leave:
        return 'Nghỉ phép';
      case RequestsFilter.overtime:
        return 'Tăng ca';
    }
  }
}

abstract class RequestsEvent {
  const RequestsEvent();
}

class RequestsLoadStarted extends RequestsEvent {
  final bool isRefresh;
  final String? successMessage;

  const RequestsLoadStarted({
    this.isRefresh = false,
    this.successMessage,
  });
}

class RequestsRefreshed extends RequestsEvent {
  final String? successMessage;

  const RequestsRefreshed({this.successMessage});
}

class RequestsFilterChanged extends RequestsEvent {
  final RequestsFilter filter;

  const RequestsFilterChanged(this.filter);
}

class RequestsCancelRequested extends RequestsEvent {
  final String id;

  const RequestsCancelRequested(this.id);
}
