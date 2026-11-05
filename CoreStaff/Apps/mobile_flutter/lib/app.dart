import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'core/config/api_config.dart';
import 'core/di/injection.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/bloc/auth_bloc.dart';
import 'features/shell/presentation/screens/main_shell_screen.dart';
import 'features/shell/presentation/screens/unauthorized_role_screen.dart';
import 'screens/auth/change_password_screen.dart';
import 'screens/auth/forgot_password_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/reset_password_screen.dart';
import 'screens/splash/splash_screen.dart';

enum AuthSubScreen { login, forgot, reset, voluntaryChangePassword }

class CoreStaffApp extends StatefulWidget {
  const CoreStaffApp({super.key});

  @override
  State<CoreStaffApp> createState() => _CoreStaffAppState();
}

class _CoreStaffAppState extends State<CoreStaffApp> {
  bool _connecting = true;
  String? _connectionError;
  AuthSubScreen _authSubScreen = AuthSubScreen.login;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _connecting = true;
      _connectionError = null;
    });

    try {
      await ApiConfig.resolveApiBase();
    } catch (err) {
      if (mounted) {
        setState(() {
          _connectionError = err.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _connecting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<AuthBloc>(
      create: (context) => sl<AuthBloc>()..add(const AuthCheckRequested()),
      child: MaterialApp(
        title: 'CoreStaff Mobile',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: _buildHome(),
      ),
    );
  }

  Widget _buildHome() {
    if (_connecting) {
      return const SplashScreen();
    }

    if (_connectionError != null) {
      return ConnectionErrorScreen(
        message: _connectionError!,
        onRetry: _bootstrap,
        onSkipToDemo: () {
          setState(() {
            _connectionError = null;
            _authSubScreen = AuthSubScreen.login;
          });
        },
      );
    }

    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        if (state is AuthInitial || (state is AuthLoading && _authSubScreen != AuthSubScreen.login)) {
          return const SplashScreen();
        }

        if (state is AuthAuthenticated) {
          if (state.forcedPasswordChange) {
            return ChangePasswordScreen(
              forced: true,
              onCancel: null,
              onChanged: () {
                context.read<AuthBloc>().add(const AuthPasswordChanged());
              },
              onSessionExpired: () {
                context.read<AuthBloc>().add(const AuthSessionExpired());
              },
            );
          }

          if (state.isBlockedRole) {
            return UnauthorizedRoleScreen(user: state.user);
          }

          if (_authSubScreen == AuthSubScreen.voluntaryChangePassword) {
            return ChangePasswordScreen(
              forced: false,
              onCancel: () {
                setState(() => _authSubScreen = AuthSubScreen.login);
              },
              onChanged: () {
                setState(() => _authSubScreen = AuthSubScreen.login);
                context.read<AuthBloc>().add(const AuthPasswordChanged());
              },
              onSessionExpired: () {
                setState(() => _authSubScreen = AuthSubScreen.login);
                context.read<AuthBloc>().add(const AuthSessionExpired());
              },
            );
          }

          return MainShellScreen(
            user: state.user,
            onChangePassword: () {
              setState(() => _authSubScreen = AuthSubScreen.voluntaryChangePassword);
            },
            onLogout: () {
              context.read<AuthBloc>().add(const AuthLogoutRequested());
            },
          );
        }

        // Unauthenticated or Failure states
        switch (_authSubScreen) {
          case AuthSubScreen.login:
            return LoginScreen(
              onAuthenticated: (user, forced) {
                context.read<AuthBloc>().add(AuthLoggedIn(
                      user: user,
                      forcedPasswordChange: forced,
                    ));
              },
              onForgot: () => setState(() => _authSubScreen = AuthSubScreen.forgot),
              onReset: () => setState(() => _authSubScreen = AuthSubScreen.reset),
            );

          case AuthSubScreen.forgot:
            return ForgotPasswordScreen(
              onBack: () => setState(() => _authSubScreen = AuthSubScreen.login),
              onReset: () => setState(() => _authSubScreen = AuthSubScreen.reset),
            );

          case AuthSubScreen.reset:
            return ResetPasswordScreen(
              onBack: () => setState(() => _authSubScreen = AuthSubScreen.login),
            );

          case AuthSubScreen.voluntaryChangePassword:
            return LoginScreen(
              onAuthenticated: (user, forced) {
                context.read<AuthBloc>().add(AuthLoggedIn(
                      user: user,
                      forcedPasswordChange: forced,
                    ));
              },
              onForgot: () => setState(() => _authSubScreen = AuthSubScreen.forgot),
              onReset: () => setState(() => _authSubScreen = AuthSubScreen.reset),
            );
        }
      },
    );
  }
}

