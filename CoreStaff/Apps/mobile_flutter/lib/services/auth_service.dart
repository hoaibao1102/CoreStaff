import '../core/network/api_client.dart';
import '../features/auth/data/auth_repository.dart';
import '../features/auth/data/models/auth_user_dto.dart';

export '../features/auth/data/models/auth_user_dto.dart' show LoginResult;

class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  AuthRepository? _authRepository;

  void initialize(AuthRepository repository) {
    _authRepository = repository;
  }

  AuthRepository get _repo => _authRepository ?? AuthRepositoryImpl(apiClient: ApiClient.instance);

  Future<LoginResult> login(String identifier, String password) async {
    return _repo.login(identifier: identifier, password: password);
  }

  Future<AuthUser> getCurrentUser() async {
    return _repo.getCurrentUser();
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    return _repo.changePassword(
      currentPassword: currentPassword,
      newPassword: newPassword,
      confirmPassword: confirmPassword,
    );
  }

  Future<void> forgotPassword(String email) async {
    return _repo.forgotPassword(email);
  }

  Future<void> resetPassword(String token, String newPassword) async {
    return _repo.resetPassword(token: token, newPassword: newPassword);
  }

  Future<void> logout() async {
    return _repo.logout();
  }
}
