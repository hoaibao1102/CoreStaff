import '../core/network/api_client.dart';
import '../models/auth_user.dart';

class LoginResult {
  final AuthUser user;
  final bool mustChangePassword;

  LoginResult({required this.user, required this.mustChangePassword});
}

class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  final ApiClient _client = ApiClient.instance;

  Future<LoginResult> login(String identifier, String password) async {
    final data = await _client.request<Map<String, dynamic>>(
      path: '/api/auth/login',
      method: 'POST',
      body: {
        'identifier': identifier.trim(),
        'password': password,
      },
    );

    final userJson = data['user'] as Map<String, dynamic>;
    final mustChange = data['mustChangePassword'] == true;
    final user = AuthUser.fromJson(userJson);

    return LoginResult(user: user, mustChangePassword: mustChange);
  }

  Future<AuthUser> getCurrentUser() async {
    final data = await _client.request<Map<String, dynamic>>(
      path: '/api/auth/me',
      method: 'GET',
    );
    return AuthUser.fromJson(data);
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    await _client.request<dynamic>(
      path: '/api/auth/change-password',
      method: 'POST',
      body: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
        'confirmPassword': confirmPassword,
      },
    );
  }

  Future<void> forgotPassword(String email) async {
    await _client.request<dynamic>(
      path: '/api/auth/forgot-password',
      method: 'POST',
      body: {
        'email': email.trim(),
      },
    );
  }

  Future<void> resetPassword(String token, String newPassword) async {
    await _client.request<dynamic>(
      path: '/api/auth/reset-password',
      method: 'POST',
      body: {
        'token': token.trim(),
        'newPassword': newPassword,
      },
    );
  }

  Future<void> logout() async {
    try {
      await _client.request<dynamic>(
        path: '/api/auth/logout',
        method: 'POST',
      );
    } finally {
      await _client.clearCookies();
    }
  }
}
