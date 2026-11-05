import '../config/app_constants.dart';
import '../storage/secure_storage_service.dart';

class AppCookieManager {
  final SecureStorageService _storage;
  final Map<String, String> _cookies = {};
  bool _initialized = false;

  AppCookieManager(this._storage);

  bool get hasSession => _cookies.containsKey(AppConstants.sessionCookieName);
  bool get hasRefreshToken => _cookies.containsKey(AppConstants.refreshCookieName);

  String? get sid => _cookies[AppConstants.sessionCookieName];
  String? get rt => _cookies[AppConstants.refreshCookieName];

  Future<void> init() async {
    if (_initialized) return;
    try {
      final sid = await _storage.getSid();
      final rt = await _storage.getRt();
      if (sid != null && sid.isNotEmpty) _cookies[AppConstants.sessionCookieName] = sid;
      if (rt != null && rt.isNotEmpty) _cookies[AppConstants.refreshCookieName] = rt;
    } catch (_) {}
    _initialized = true;
  }

  void parseAndSaveCookies(List<String>? setCookieHeaders) {
    if (setCookieHeaders == null || setCookieHeaders.isEmpty) return;

    for (final rawHeader in setCookieHeaders) {
      // In case multiple cookies are passed comma-separated within a single element
      final candidates = _splitSetCookie(rawHeader);
      for (final candidate in candidates) {
        final cookiePair = candidate.split(';').first.trim();
        final eqIdx = cookiePair.indexOf('=');
        if (eqIdx > 0) {
          final key = cookiePair.substring(0, eqIdx).trim();
          final value = cookiePair.substring(eqIdx + 1).trim();
          if (value.isEmpty || value.toLowerCase() == 'deleted') {
            _cookies.remove(key);
          } else {
            _cookies[key] = value;
          }
        }
      }
    }
    _persistCookies();
  }

  /// Splits Set-Cookie strings safely without splitting on date commas like 'Wed, 21 Oct 2026'
  List<String> _splitSetCookie(String raw) {
    if (!raw.contains(',')) return [raw];
    // Looks for a comma followed by key=value attribute pattern
    return raw.split(RegExp(r',(?=\s*[a-zA-Z0-9_-]+=)'));
  }

  Future<void> _persistCookies() async {
    final sid = _cookies[AppConstants.sessionCookieName];
    final rt = _cookies[AppConstants.refreshCookieName];
    if (sid != null && sid.isNotEmpty) {
      await _storage.saveSessionCookies(sid: sid, rt: rt);
    } else {
      await _storage.clearSessionCookies();
    }
  }

  String buildCookieHeader({bool includeRefreshToken = true}) {
    if (_cookies.isEmpty) return '';
    final entries = <String>[];
    final sid = _cookies[AppConstants.sessionCookieName];
    if (sid != null && sid.isNotEmpty) {
      entries.add('${AppConstants.sessionCookieName}=$sid');
    }
    if (includeRefreshToken) {
      final rt = _cookies[AppConstants.refreshCookieName];
      if (rt != null && rt.isNotEmpty) {
        entries.add('${AppConstants.refreshCookieName}=$rt');
      }
    }
    return entries.join('; ');
  }

  void updateSessionCookie(String newSid) {
    _cookies[AppConstants.sessionCookieName] = newSid;
    _persistCookies();
  }

  Future<void> clear() async {
    _cookies.clear();
    await _storage.clearSessionCookies();
  }
}

