import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/error/app_exception.dart';
import '../../../../core/error/error_resolver.dart';
import '../../../../core/network/api_client.dart';
import '../../data/auth_repository.dart';
import 'auth_event.dart';
import 'auth_state.dart';

export 'auth_event.dart';
export 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository authRepository;
  final ApiClient? apiClient;

  AuthBloc({
    required this.authRepository,
    this.apiClient,
  }) : super(const AuthInitial()) {
    apiClient?.onSignedOut = () {
      add(const AuthSessionExpired());
    };

    on<AuthCheckRequested>(_onCheckRequested);
    on<AuthLoggedIn>(_onLoggedIn);
    on<AuthLoginRequested>(_onLoginRequested);
    on<AuthLogoutRequested>(_onLogoutRequested);
    on<AuthSessionExpired>(_onSessionExpired);
    on<AuthPasswordChanged>(_onPasswordChanged);
  }

  void _onLoggedIn(
    AuthLoggedIn event,
    Emitter<AuthState> emit,
  ) {
    emit(AuthAuthenticated(
      user: event.user,
      forcedPasswordChange: event.forcedPasswordChange,
    ));
  }

  Future<void> _onCheckRequested(
    AuthCheckRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    try {
      final hasSession = await authRepository.hasSavedSession();
      if (!hasSession) {
        emit(const AuthUnauthenticated());
        return;
      }

      final user = await authRepository.getCurrentUser();
      emit(AuthAuthenticated(
        user: user,
        forcedPasswordChange: user.mustChangePassword,
      ));
    } catch (_) {
      emit(const AuthUnauthenticated());
    }
  }

  Future<void> _onLoginRequested(
    AuthLoginRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    try {
      final result = await authRepository.login(
        identifier: event.identifier,
        password: event.password,
      );
      emit(AuthAuthenticated(
        user: result.user,
        forcedPasswordChange: result.mustChangePassword,
      ));
    } on ApiException catch (e) {
      final resolved = ErrorResolver.resolveAuthError(e.code, e.message);
      emit(AuthFailure(message: resolved));
    } on NetworkException catch (e) {
      emit(AuthFailure(message: e.message));
    } on AppException catch (e) {
      emit(AuthFailure(message: e.message));
    } catch (e) {
      emit(AuthFailure(message: 'Đăng nhập không thành công: ${e.toString()}'));
    }
  }

  Future<void> _onLogoutRequested(
    AuthLogoutRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    try {
      await authRepository.logout();
    } catch (_) {}
    emit(const AuthUnauthenticated());
  }

  Future<void> _onSessionExpired(
    AuthSessionExpired event,
    Emitter<AuthState> emit,
  ) async {
    try {
      await authRepository.logout();
    } catch (_) {}
    emit(const AuthUnauthenticated(
      message: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.',
    ));
  }

  void _onPasswordChanged(
    AuthPasswordChanged event,
    Emitter<AuthState> emit,
  ) {
    if (state is AuthAuthenticated) {
      final current = state as AuthAuthenticated;
      final updatedUser = current.user.copyWith(mustChangePassword: false);
      emit(AuthAuthenticated(
        user: updatedUser,
        forcedPasswordChange: false,
      ));
    }
  }
}
