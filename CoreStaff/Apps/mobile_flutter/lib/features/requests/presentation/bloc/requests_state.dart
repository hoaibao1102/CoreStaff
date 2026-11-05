import '../../data/models/leave_request_dto.dart';
import '../../data/models/overtime_request_dto.dart';
import 'requests_event.dart';

sealed class RequestFeedItem {
  String get id;
  String get date;
}

class LeaveFeedItem extends RequestFeedItem {
  final LeaveRequestDto leave;

  LeaveFeedItem(this.leave);

  @override
  String get id => 'leave-${leave.id}';

  @override
  String get date => leave.createdAt ?? leave.startDate;
}

class OvertimeFeedItem extends RequestFeedItem {
  final OvertimeRequestDto overtime;

  OvertimeFeedItem(this.overtime);

  @override
  String get id => 'ot-${overtime.id}';

  @override
  String get date => overtime.createdAt ?? overtime.workDate;
}

abstract class RequestsState {
  const RequestsState();
}

class RequestsInitial extends RequestsState {
  const RequestsInitial();
}

class RequestsLoading extends RequestsState {
  const RequestsLoading();
}

class RequestsLoaded extends RequestsState {
  final List<LeaveRequestDto> leaves;
  final List<OvertimeRequestDto> overtime;
  final RequestsFilter filter;
  final bool isRefreshing;
  final String? bannerError;
  final String? bannerSuccess;

  const RequestsLoaded({
    required this.leaves,
    required this.overtime,
    this.filter = RequestsFilter.all,
    this.isRefreshing = false,
    this.bannerError,
    this.bannerSuccess,
  });

  List<RequestFeedItem> get filteredItems {
    final List<RequestFeedItem> items = [];
    if (filter != RequestsFilter.overtime) {
      items.addAll(leaves.map((l) => LeaveFeedItem(l)));
    }
    if (filter != RequestsFilter.leave) {
      items.addAll(overtime.map((o) => OvertimeFeedItem(o)));
    }
    items.sort((a, b) => b.date.compareTo(a.date));
    return items;
  }

  int get totalCount => leaves.length + overtime.length;
  int get filteredCount => filteredItems.length;

  RequestsLoaded copyWith({
    List<LeaveRequestDto>? leaves,
    List<OvertimeRequestDto>? overtime,
    RequestsFilter? filter,
    bool? isRefreshing,
    String? Function()? bannerError,
    String? Function()? bannerSuccess,
  }) {
    return RequestsLoaded(
      leaves: leaves ?? this.leaves,
      overtime: overtime ?? this.overtime,
      filter: filter ?? this.filter,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      bannerError: bannerError != null ? bannerError() : this.bannerError,
      bannerSuccess: bannerSuccess != null ? bannerSuccess() : this.bannerSuccess,
    );
  }
}

class RequestsError extends RequestsState {
  final String message;

  const RequestsError({required this.message});
}
