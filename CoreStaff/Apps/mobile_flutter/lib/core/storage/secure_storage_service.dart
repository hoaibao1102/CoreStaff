import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract class SecureStorageService {
  Future<void> write(String key, String value);
  Future<String?> read(String key);
  Future<void> delete(String key);
  Future<void> deleteAll();

  Future<void> saveSessionCookies({required String sid, String? rt});
  Future<String?> getSid();
  Future<String?> getRt();
  Future<void> clearSessionCookies();
}

class SecureStorageServiceImpl implements SecureStorageService {
  final FlutterSecureStorage _storage;

  SecureStorageServiceImpl([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
            );

  static const String _keySid = 'cookie_sid';
  static const String _keyRt = 'cookie_rt';

  @override
  Future<void> write(String key, String value) async {
    await _storage.write(key: key, value: value);
  }

  @override
  Future<String?> read(String key) async {
    return await _storage.read(key: key);
  }

  @override
  Future<void> delete(String key) async {
    await _storage.delete(key: key);
  }

  @override
  Future<void> deleteAll() async {
    await _storage.deleteAll();
  }

  @override
  Future<void> saveSessionCookies({required String sid, String? rt}) async {
    await _storage.write(key: _keySid, value: sid);
    if (rt != null && rt.isNotEmpty) {
      await _storage.write(key: _keyRt, value: rt);
    }
  }

  @override
  Future<String?> getSid() async {
    return await _storage.read(key: _keySid);
  }

  @override
  Future<String?> getRt() async {
    return await _storage.read(key: _keyRt);
  }

  @override
  Future<void> clearSessionCookies() async {
    await _storage.delete(key: _keySid);
    await _storage.delete(key: _keyRt);
  }
}

