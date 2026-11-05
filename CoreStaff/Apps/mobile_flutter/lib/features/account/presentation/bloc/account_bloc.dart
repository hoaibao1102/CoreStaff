import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/error/app_exception.dart';
import '../../../../core/error/error_resolver.dart';
import '../../data/account_repository.dart';
import 'account_event.dart';
import 'account_state.dart';

export 'account_event.dart';
export 'account_state.dart';

class AccountBloc extends Bloc<AccountEvent, AccountState> {
  final AccountRepository accountRepository;

  AccountBloc({required this.accountRepository}) : super(const AccountInitial()) {
    on<AccountProfileRequested>(_onProfileRequested);
  }

  Future<void> _onProfileRequested(
    AccountProfileRequested event,
    Emitter<AccountState> emit,
  ) async {
    if (!event.isRefresh) {
      emit(const AccountLoading());
    }

    try {
      final profile = await accountRepository.getMyProfile();
      emit(AccountLoaded(profile: profile));
    } on ApiException catch (e) {
      final resolved = ErrorResolver.resolveEmployeeError(e.code, e.message);
      emit(AccountError(message: resolved));
    } on NetworkException catch (e) {
      emit(AccountError(message: e.message));
    } on AppException catch (e) {
      emit(AccountError(message: e.message));
    } catch (e) {
      emit(AccountError(message: 'Không thể tải thông tin hồ sơ: ${e.toString()}'));
    }
  }
}

