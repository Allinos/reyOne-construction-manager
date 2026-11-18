import 'package:flutter/foundation.dart';

import 'api.dart';

/// Signed-in user, company and the modules / permissions that decide which
/// screens the app shows. The server only returns enabled modules.
class Session extends ChangeNotifier {
  Session._();
  static final Session I = Session._();

  Map<String, dynamic>? user;
  Map<String, dynamic>? company;
  Map<String, dynamic> settings = {};
  Set<String> modules = {};
  Set<String> perms = {};
  bool ready = false;

  bool get signedIn => user != null;
  String get name => (user?['name'] as String?) ?? '';
  String get currency => (company?['currency'] as String?) ?? 'INR';
  int get userId => (user?['id'] as num?)?.toInt() ?? 0;

  bool can(String p) => perms.contains('*') || perms.contains(p);
  bool on(String m) => modules.contains(m);
  bool allowed(String module, [String? perm]) => on(module) && (perm == null || can(perm));

  Future<void> restore() async {
    await Api.I.load();
    Api.I.onUnauthorized = () {
      user = null;
      notifyListeners();
    };
    if (Api.I.baseUrl.isNotEmpty && Api.I.hasTokens) {
      try {
        await loadBootstrap();
      } catch (_) {
        user = null;
      }
    }
    ready = true;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final data = await Api.I.post('/auth/login', {'email': email.trim(), 'password': password}) as Map<String, dynamic>;
    await Api.I.setTokens(data['accessToken'] as String, data['refreshToken'] as String);
    await loadBootstrap();
  }

  Future<void> loadBootstrap() async {
    final b = await Api.I.get('/bootstrap') as Map<String, dynamic>;
    user = b['user'] as Map<String, dynamic>;
    company = b['company'] as Map<String, dynamic>?;
    settings = (b['settings'] as Map<String, dynamic>?) ?? {};
    modules = ((b['modules'] as List?) ?? const []).map((m) => m['key'] as String).toSet();
    perms = ((user?['permissions'] as List?) ?? const []).map((p) => '$p').toSet();
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      await Api.I.post('/auth/logout', {'refreshToken': Api.I.refreshToken});
    } catch (_) {}
    await Api.I.clearTokens();
    user = null;
    modules = {};
    perms = {};
    notifyListeners();
  }
}
