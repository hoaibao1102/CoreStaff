import '../../data/models/auth_user_dto.dart';

abstract class AuthEvent {
  const AuthEvent();
}

class AuthCheckRequested extends AuthEvent {
  const AuthCheckRequested();
}

class AuthLoggedIn extends AuthEvent {
  final AuthUser user;
  final bool forcedPasswordChange;

  const AuthLoggedIn({
    required this.user,
    this.forcedPasswordChange = false,
  });
}

class AuthLoginRequested extends AuthEvent {
  final String identifier;
  final String password;

  const AuthLoginRequested({
    required this.identifier,
    required this.password,
  });
}

class AuthLogoutRequested extends AuthEvent {
  const AuthLogoutRequested();
}

class AuthSessionExpired extends AuthEvent {
  const AuthSessionExpired();
}

class AuthPasswordChanged extends AuthEvent {
  const AuthPasswordChanged();
}

