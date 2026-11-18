import 'dart:convert';

import 'package:http/http.dart' as http;

/// A company instance the app can connect to.
class Instance {
  Instance(this.url, this.name, {this.mobileEnabled = true});
  final String url;
  final String name;
  final bool mobileEnabled;
}

/// Accepts what the web app shows under Settings → Mobile app:
///  - a connection code `RY1-` + base64url(JSON {u, n}) (also inside the QR),
///  - or a plain server address like "erp.company.com".
/// Returns the normalised https URL (and company name when known).
({String url, String? name})? parseConnection(String raw) {
  var s = raw.trim();
  if (s.isEmpty) return null;
  if (s.toUpperCase().startsWith('RY1-')) {
    try {
      var b64 = s.substring(4).replaceAll('-', '+').replaceAll('_', '/');
      while (b64.length % 4 != 0) {
        b64 += '=';
      }
      final json = jsonDecode(utf8.decode(base64.decode(b64))) as Map<String, dynamic>;
      final u = normaliseUrl('${json['u'] ?? ''}');
      if (u == null) return null;
      final n = '${json['n'] ?? ''}'.trim();
      return (url: u, name: n.isEmpty ? null : n);
    } catch (_) {
      return null;
    }
  }
  final u = normaliseUrl(s);
  return u == null ? null : (url: u, name: null);
}

String? normaliseUrl(String raw) {
  var u = raw.trim();
  if (u.isEmpty || u.contains(' ')) return null;
  if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'https://$u';
  while (u.endsWith('/')) {
    u = u.substring(0, u.length - 1);
  }
  final uri = Uri.tryParse(u);
  if (uri == null || uri.host.isEmpty) return null;
  return u;
}

/// Confirms the address is a reyOne instance and reports whether the mobile
/// app is activated there.
Future<Instance> verifyInstance(String url) async {
  http.Response res;
  try {
    res = await http.get(Uri.parse('$url/api/v1/public/instance'), headers: {'X-Client': 'mobile'}).timeout(const Duration(seconds: 15));
  } catch (_) {
    throw Exception('Could not reach $url. Check the address and your internet connection.');
  }
  Map<String, dynamic>? data;
  try {
    data = (jsonDecode(res.body) as Map<String, dynamic>)['data'] as Map<String, dynamic>?;
  } catch (_) {}
  if (res.statusCode != 200 || data == null || data['app'] != 'reyone') {
    throw Exception('That address is not a reyOne server.');
  }
  return Instance(url, '${data['name'] ?? 'reyOne'}', mobileEnabled: data['mobileEnabled'] == true);
}
