import '../../data/models/auth_user_dto.dart';

abstract class AuthState {
  const AuthState();
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  final AuthUser user;
  final bool forcedPasswordChange;

  const AuthAuthenticated({
    required this.user,
    this.forcedPasswordChange = false,
  });

  bool get isBlockedRole => user.isBlockedRole;

  AuthAuthenticated copyWith({
    AuthUser? user,
    bool? forcedPasswordChange,
  }) {
    return AuthAuthenticated(
      user: user ?? this.user,
      forcedPasswordChange: forcedPasswordChange ?? this.forcedPasswordChange,
    );
  }
}

class AuthUnauthenticated extends AuthState {
  final String? message;

  const AuthUnauthenticated({this.message});
}

class AuthFailure extends AuthState {
  final String message;

  const AuthFailure({required this.message});
}
