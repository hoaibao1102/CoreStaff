import '../../data/models/employee_profile_dto.dart';

abstract class AccountState {
  const AccountState();
}

class AccountInitial extends AccountState {
  const AccountInitial();
}

class AccountLoading extends AccountState {
  const AccountLoading();
}

class AccountLoaded extends AccountState {
  final EmployeeProfileDto profile;

  const AccountLoaded({required this.profile});
}

class AccountError extends AccountState {
  final String message;

  const AccountError({required this.message});
}

